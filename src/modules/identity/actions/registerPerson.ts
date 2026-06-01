'use server';

import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/server';
import { container } from '@/shared/container';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent } from '@/modules/audit/events';
import { withAudit } from '@/modules/audit/withAudit';
import { CAPTCHA_VERIFIER_TOKEN } from '../ports/captchaVerifier';
import {
  registerPersonSchema,
  type RegisterPersonInput,
  type PublicRole,
} from '../schemas/registerPerson';

// ── Constantes de consentimento PORTAL_ACCESS ─────────────────────────────────
// Gate jurídico D-004 das expectations: os termos finais precisam ser aprovados
// pela diretoria/jurídico antes de ir para produção. Estes valores de
// placeholder devem ser substituídos pelos termos reais aprovados.
const PORTAL_ACCESS_TERM_VERSION = 'portal-access@v1.0-draft';
const PORTAL_ACCESS_TERM_HASH = crypto
  .createHash('sha256')
  .update('PLACEHOLDER — substituir pelo hash SHA-256 do texto aprovado')
  .digest('hex');

// ── Mapeamento papel → finalidade de consentimento ───────────────────────────
const ROLE_PURPOSE_MAP = {
  CANDIDATE: 'JOB_APPLICATION',
  PROVIDER: 'SERVICE_OFFERING',
  CLIENT: 'SERVICE_HIRING',
} as const satisfies Record<PublicRole, string>;

export interface RegisterPersonResult {
  personId: string;
  role: PublicRole;
}

/**
 * TX1 do auto-cadastro (USP-001 / E-001).
 *
 * Persiste em transação única:
 *   1. Pessoa no banco (cpf único, email_login único — ADR-0021)
 *   2. PersonRoleGrant com status AWAITING_CONSENT
 *   3. Consent PORTAL_ACCESS (base legal mínima)
 *   4. AuditLog PERSON_CREATED_PUBLIC + CONSENT_GRANTED
 *
 * O papel fica AWAITING_CONSENT até a TX2 (acceptRoleConsent), quando o
 * consentimento da finalidade é persistido e o grant é ativado (ADR-0020).
 */
export async function registerPerson(
  rawInput: RegisterPersonInput,
): Promise<ActionResult<RegisterPersonResult>> {
  // 1. Validação de input
  const parsed = registerPersonSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // 2. Contexto da request (IP, user-agent para audit e CAPTCHA)
  const hdrs = await headers();
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 3. Verificação CAPTCHA (fail-closed — ADR-0014 / P-005)
  const captcha = container.resolve(CAPTCHA_VERIFIER_TOKEN);
  const captchaResult = await captcha.verify(input.captchaToken, ip ?? undefined);
  if (!captchaResult.ok) {
    return fail('PRECONDITION_FAILED', 'CAPTCHA inválido ou expirado. Tente novamente.');
  }

  // 4. Criar credencial no Supabase Auth (hash bcrypt gerenciado pelo provedor — P-003)
  const supabase = createSupabaseAdminClient();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    // E-mail já em uso no Supabase Auth
    if (authError?.message?.toLowerCase().includes('already')) {
      return fail('CONFLICT', 'E-mail já está em uso. Faça login ou use outro e-mail.');
    }
    return fail('INTERNAL', 'Erro ao criar credencial. Tente novamente mais tarde.');
  }

  const supabaseUserId = authUser.user.id;

  // 5. TX1: Pessoa + grant AWAITING_CONSENT + consent PORTAL_ACCESS + audit
  try {
    const personId = crypto.randomUUID();
    const grantId = crypto.randomUUID();
    const consentPortalId = crypto.randomUUID();

    const person = await withAudit(
      AuditEvent.PERSON_CREATED_PUBLIC,
      async (tx, audit) => {
        // INSERT person
        const createdPerson = await tx.person.create({
          data: {
            id: personId,
            supabaseUserId,
            fullName: input.fullName,
            cpf: input.cpf,
            emailLogin: input.email,
          },
          select: { id: true, fullName: true, emailLogin: true },
        });

        // INSERT person_role_grant (AWAITING_CONSENT)
        await tx.personRoleGrant.create({
          data: {
            id: grantId,
            personId,
            role: input.role,
            status: 'AWAITING_CONSENT',
          },
        });

        // INSERT consent PORTAL_ACCESS (base legal mínima)
        await tx.consent.create({
          data: {
            id: consentPortalId,
            personId,
            purpose: 'PORTAL_ACCESS',
            termVersion: PORTAL_ACCESS_TERM_VERSION,
            termContentHash: PORTAL_ACCESS_TERM_HASH,
            acceptedIp: ip,
            userAgent,
          },
        });

        // Segundo evento de auditoria na mesma transação (CONSENT_GRANTED)
        await tx.auditLog.create({
          data: {
            action: AuditEvent.CONSENT_GRANTED,
            actorPersonId: personId,
            entityType: 'consent',
            entityId: consentPortalId,
            ip,
            userAgent,
            after: { purpose: 'PORTAL_ACCESS', termVersion: PORTAL_ACCESS_TERM_VERSION },
          },
          select: { id: true },
        });

        // Preenche o recorder do withAudit para o evento principal
        audit.entityType = 'person';
        audit.entityId = personId;
        audit.after = {
          personId,
          role: input.role,
          supabaseUserId,
          consentPurpose: 'PORTAL_ACCESS',
        };

        return createdPerson;
      },
      { ip, userAgent },
    );

    // 6. Enfileirar e-mail de boas-vindas (fora da transação — outbox pattern / P-004)
    // TODO: substituir por job Resend quando o módulo de e-mail for implementado.
    // Por ora, chamada direta (se falhar, logamos mas não revertemos o cadastro).
    try {
      await sendWelcomeEmail(person.fullName, person.emailLogin!, input.role);
    } catch (emailErr) {
      // E-mail de boas-vindas é best-effort — falha não reverte o cadastro.
      // O log aqui é suficiente para rastrear (a Pessoa já existe no banco).
      console.error('[registerPerson] Falha ao enviar e-mail de boas-vindas:', emailErr);
    }

    return ok({ personId, role: input.role });
  } catch (err) {
    // Conflito de CPF ou e-mail (unique constraint — ADR-0021 / E-006)
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      // Rollback Supabase Auth: apagar a credencial recém-criada
      await supabase.auth.admin.deleteUser(supabaseUserId).catch(() => null);

      if (err.message.includes('persons_cpf_key')) {
        return fail('CONFLICT', 'CPF já está cadastrado no portal.');
      }
      if (err.message.includes('persons_email_login_key')) {
        return fail('CONFLICT', 'E-mail já está em uso. Faça login ou use outro e-mail.');
      }
      return fail('CONFLICT', 'Dados já cadastrados. Verifique CPF e e-mail.');
    }

    // Rollback da credencial Supabase em qualquer erro inesperado
    await supabase.auth.admin.deleteUser(supabaseUserId).catch(() => null);

    console.error('[registerPerson] Erro inesperado na TX1:', err);
    return fail('INTERNAL', 'Erro interno. Tente novamente mais tarde.');
  }
}

// ── Helpers privados ──────────────────────────────────────────────────────────

const ROLE_LABEL: Record<PublicRole, string> = {
  CANDIDATE: 'candidato(a)',
  PROVIDER: 'prestador(a) de serviços',
  CLIENT: 'cliente',
};

async function sendWelcomeEmail(name: string, email: string, role: PublicRole): Promise<void> {
  const { Resend } = await import('resend');
  const { env } = await import('@/shared/env');
  const resend = new Resend(env.RESEND_API_KEY);

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: 'Bem-vindo(a) ao Portal ASONSEG!',
    html: `
      <h1>Olá, ${name}!</h1>
      <p>Seu cadastro como <strong>${ROLE_LABEL[role]}</strong> foi realizado com sucesso.</p>
      <p>O próximo passo é aceitar os termos do seu papel para ativar o acesso completo.</p>
      <p>Equipe ASONSEG</p>
    `,
  });
}
