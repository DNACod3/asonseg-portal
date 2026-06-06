'use server';

import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '@/shared/env';
import { prisma } from '@/shared/lib/prisma';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { container } from '@/shared/container';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/server';
import { EMAIL_SENDER_TOKEN } from '@/shared/lib/email/email-sender.port';
import { getCurrentPerson } from '../server/session';
import { canApproveCredentialClaim } from '../domain/credential-claim';
import { RESET_LINK_EXPIRY_HOURS } from '../schemas/password-reset.schema';
import {
  verifyCredentialClaimSchema,
  type VerifyCredentialClaimInput,
} from '../schemas/credential-claim.schema';

export interface VerifyCredentialClaimResult {
  personId: string;
  claimId: string;
}

/**
 * Verificação e ativação de uma reivindicação de credencial (USP-003 / IDN-08).
 *
 * Fluxo **interno** (AS/diretoria): após confirmar a identidade pelo meio
 * definido (D-011 — manual), ativa a credencial da Pessoa pré-cadastrada e marca
 * a solicitação como VERIFICADA, registrando solicitante-alvo, verificador, meio
 * e data/hora na auditoria imutável (E-002 / P-001).
 *
 * Sequência canônica (project-guideline §9):
 *   1. Zod (`verifyCredentialClaimSchema`)
 *   2. `requirePermission` — inline: apenas papéis aprovadores (P-005)
 *   3. Consentimento — não se aplica aqui; os consentimentos das finalidades dos
 *      papéis são colhidos eletronicamente quando a Pessoa aceita o termo do
 *      papel (grants nascem AWAITING_CONSENT e ativam via `acceptRoleConsent`,
 *      ADR-0020), no primeiro acesso.
 *   4. Pré-condições — claim PENDENTE, Pessoa ATIVA sem credencial, e-mail livre
 *   5. `withAudit('CREDENTIAL_CLAIM_VERIFIED')` — vincula credencial + marca claim
 *
 * A senha não é definida aqui: criamos a credencial no provedor com uma senha
 * aleatória descartável e enviamos um link para a própria Pessoa definir a sua
 * (reuso da página de redefinição da USP-005). Assim ninguém — nem a AS — conhece
 * a senha da Pessoa.
 *
 * Nunca lança: retorna sempre `ActionResult<VerifyCredentialClaimResult>`.
 */
export async function verifyCredentialClaim(
  rawInput: VerifyCredentialClaimInput,
): Promise<ActionResult<VerifyCredentialClaimResult>> {
  const log = childLogger({ module: 'identity', action: 'verifyCredentialClaim' });

  // 1. Validação de input.
  const parsed = verifyCredentialClaimSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // 2. requirePermission (inline): apenas papéis aprovadores (P-005). A rota
  //    `(app)` também gateia; a action se protege contra chamada direta.
  const operator = await getCurrentPerson();
  if (!operator) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }
  if (!canApproveCredentialClaim(operator.roles)) {
    log.warn(
      { actorPersonId: operator.id, roles: operator.roles },
      'claim:verify_forbidden',
    );
    return fail(
      'FORBIDDEN',
      'Apenas assistentes sociais, coordenação ou diretoria podem aprovar reivindicações.',
    );
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  // 3. Consentimento — não se aplica: os consentimentos das finalidades dos
  //    papéis são colhidos no 1º acesso da Pessoa (grants AWAITING_CONSENT →
  //    acceptRoleConsent, ADR-0020), não aqui.

  // 4. Pré-condições.
  const claim = await prisma.credentialClaim.findUnique({
    where: { id: input.claimId },
    select: {
      id: true,
      status: true,
      requestedEmail: true,
      person: { select: { id: true, status: true, supabaseUserId: true, fullName: true } },
    },
  });
  if (!claim) {
    return fail('NOT_FOUND', 'Solicitação não encontrada.');
  }
  if (claim.status !== 'PENDING') {
    return fail('PRECONDITION_FAILED', 'Esta solicitação já foi processada.');
  }
  const person = claim.person;
  if (person.status !== 'ATIVO') {
    return fail('PRECONDITION_FAILED', 'A Pessoa desta solicitação não está ativa.');
  }
  if (person.supabaseUserId) {
    return fail('PRECONDITION_FAILED', 'Esta Pessoa já possui credencial ativa.');
  }

  // Revalida e-mail livre (E-003) — janela entre solicitação e verificação.
  const emailOwner = await prisma.person.findUnique({
    where: { emailLogin: claim.requestedEmail },
    select: { id: true },
  });
  if (emailOwner && emailOwner.id !== person.id) {
    return fail('CONFLICT', 'O e-mail desta solicitação já está em uso por outra Pessoa.');
  }

  // Cria a credencial no Supabase Auth (hash bcrypt gerenciado pelo provedor).
  // Senha aleatória descartável: a Pessoa define a sua pelo link de boas-vindas.
  const supabase = createSupabaseAdminClient();
  const throwawayPassword = crypto.randomBytes(24).toString('base64url');
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: claim.requestedEmail,
    password: throwawayPassword,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      return fail('CONFLICT', 'O e-mail desta solicitação já está em uso por outra Pessoa.');
    }
    log.error({ err: authError?.message }, 'claim:verify_create_user_failed');
    return fail('INTERNAL', 'Erro ao ativar a credencial. Tente novamente mais tarde.');
  }
  const supabaseUserId = authUser.user.id;

  // 5. Vincula credencial + marca claim VERIFICADA, em auditoria atômica.
  //    Sentinela para abortar a transação quando a claim deixou de estar PENDING
  //    entre a pré-condição (lida fora da tx) e a escrita — dois aprovadores em
  //    corrida sobre a mesma solicitação (P-005).
  const ALREADY_PROCESSED = 'CLAIM_ALREADY_PROCESSED';
  try {
    await withAudit(
      AuditEvent.CREDENTIAL_CLAIM_VERIFIED,
      async (tx, audit) => {
        // Transição condicional (guard de concorrência): só efetiva se ainda
        // PENDING. `updateMany` devolve count 0 numa corrida (a outra request já
        // verificou) — aborta a transação (e o vínculo de credencial abaixo)
        // lançando a sentinela, sem depender só do unique de e-mail do provedor.
        const transition = await tx.credentialClaim.updateMany({
          where: { id: claim.id, status: 'PENDING' },
          data: {
            status: 'VERIFIED',
            verifiedByPersonId: operator.id,
            verifiedAt: new Date(),
            verificationMethod: input.verificationMethod,
          },
        });
        if (transition.count === 0) {
          throw new Error(ALREADY_PROCESSED);
        }

        await tx.person.update({
          where: { id: person.id },
          data: { supabaseUserId, emailLogin: claim.requestedEmail },
        });

        audit.entityType = 'credential_claim';
        audit.entityId = claim.id;
        audit.after = {
          claimId: claim.id,
          personId: person.id,
          verifiedBy: operator.id,
          verificationMethod: input.verificationMethod,
        };
      },
      {
        actorUserId: operator.supabaseUserId,
        actorPersonId: operator.id,
        ip,
        userAgent,
        context: { route: '/credenciais/reivindicacoes' },
      },
    );
  } catch (err) {
    // Corrida de aprovação, conflito de e-mail (unique — ADR-0021) ou falha
    // inesperada: desfaz a credencial órfã no provedor (nenhuma Pessoa loga com ela).
    await supabase.auth.admin
      .deleteUser(supabaseUserId)
      .catch((rollbackErr) => log.error({ err: rollbackErr }, 'claim:verify_rollback_failed'));

    if (err instanceof Error && err.message === ALREADY_PROCESSED) {
      return fail('PRECONDITION_FAILED', 'Esta solicitação já foi processada.');
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return fail('CONFLICT', 'O e-mail desta solicitação já está em uso por outra Pessoa.');
    }
    log.error({ err }, 'claim:verify_unexpected');
    return fail('INTERNAL', 'Erro ao ativar a credencial. Tente novamente mais tarde.');
  }

  // E-mail de boas-vindas com link de definição de senha (best-effort, fora da
  // transação — falha não reverte a ativação). Reusa o link de recuperação do
  // GoTrue (uso único, 24h) apontando para a NOSSA página de redefinição.
  try {
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: claim.requestedEmail,
    });
    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      log.error({ err: linkError?.message ?? 'sem token' }, 'claim:verify_link_failed');
    } else {
      const baseUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
      const setPasswordUrl = `${baseUrl}/redefinir-senha?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`;
      const emailSender = container.resolve(EMAIL_SENDER_TOKEN);
      const sent = await emailSender.send({
        to: claim.requestedEmail,
        template: 'credential-claim-welcome',
        data: {
          nome: person.fullName,
          setPasswordUrl,
          expiraEmHoras: RESET_LINK_EXPIRY_HOURS,
        },
      });
      if (!sent.ok) {
        log.error({ personId: person.id }, 'claim:verify_email_send_failed');
      }
    }
  } catch (emailErr) {
    log.error({ err: emailErr }, 'claim:verify_email_unexpected');
  }

  log.info({ actorPersonId: operator.id, personId: person.id }, 'claim:verified');
  return ok({ personId: person.id, claimId: claim.id });
}
