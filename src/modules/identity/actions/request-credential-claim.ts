'use server';

import { headers } from 'next/headers';
import { prisma } from '@/shared/lib/prisma';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import {
  requestCredentialClaimSchema,
  GENERIC_CLAIM_REQUEST_MESSAGE,
  type RequestCredentialClaimInput,
} from '../schemas/credential-claim.schema';

export interface RequestCredentialClaimResult {
  message: string;
}

/**
 * Solicitação de reivindicação de credencial (USP-003 / IDN-07).
 *
 * Fluxo **público** (a Pessoa pré-cadastrada ou um familiar autorizado, sem
 * sessão): cria uma solicitação PENDENTE vinculada à Pessoa que já existe —
 * **nunca** cria Pessoa nova (P-002 / F2). A ativação só acontece depois, na
 * verificação manual pela AS/diretoria (`verifyCredentialClaim`).
 *
 * **Exceção à sequência canônica:** o solicitante não está autenticado, então
 * não há `requirePermission`/`requireActiveConsent`.
 *
 * **Anti-enumeração (P-006):** devolve sempre a MESMA mensagem genérica, exista
 * ou não a Pessoa — o solicitante não consegue inferir quem está cadastrado via
 * CPF. A única resposta determinística distinta é o e-mail já em uso (E-003), que
 * revela apenas o e-mail (não a Pessoa-alvo) e é exigida pelo critério de aceite.
 *
 * O casamento automático é por CPF. Pedidos só com identificador alternativo (ou
 * com CPF que não corresponde a Pessoa elegível) recebem a resposta genérica e
 * são tratados manualmente pela AS — não criamos claim "solta" sem Pessoa (P-002).
 *
 * Nunca lança: retorna sempre `ActionResult<RequestCredentialClaimResult>`.
 */
export async function requestCredentialClaim(
  rawInput: RequestCredentialClaimInput,
): Promise<ActionResult<RequestCredentialClaimResult>> {
  const log = childLogger({ module: 'identity', action: 'requestCredentialClaim' });

  // 1. Validação de input (normaliza CPF e e-mail).
  const parsed = requestCredentialClaimSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // 2. Contexto da request (IP, user-agent) para auditoria.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent');

  // Resposta genérica única — retornada em TODOS os caminhos de sucesso/no-op (P-006).
  const generic = ok({ message: GENERIC_CLAIM_REQUEST_MESSAGE });

  // 3. E-mail já em uso por outra Pessoa (E-003). Bloqueio determinístico — é o
  //    único caminho que difere da resposta genérica. `email_login` é único (ADR-0021).
  const emailOwner = await prisma.person.findUnique({
    where: { emailLogin: input.requestedEmail },
    select: { id: true },
  });
  if (emailOwner) {
    return fail('CONFLICT', 'Este e-mail já está em uso. Faça login ou informe outro e-mail.');
  }

  // 4. Casamento por CPF com Pessoa elegível: existe, ATIVA e SEM credencial
  //    (pré-cadastrada por USP-002, ainda não ativou acesso). Sem CPF não há
  //    casamento automático seguro → resposta genérica (P-002 / P-006).
  if (!input.cpf) {
    log.info({}, 'claim:request_noop_no_cpf');
    return generic;
  }

  const person = await prisma.person.findUnique({
    where: { cpf: input.cpf },
    select: { id: true, status: true, supabaseUserId: true },
  });
  if (!person || person.status !== 'ATIVO' || person.supabaseUserId) {
    // Inexistente, inativa, ou já com credencial: sem efeito e sem revelar.
    log.info({}, 'claim:request_noop');
    return generic;
  }

  // 5. Idempotência leve: já há solicitação PENDENTE para esta Pessoa? Não
  //    duplica a fila — devolve a mesma resposta genérica.
  const existingPending = await prisma.credentialClaim.findFirst({
    where: { personId: person.id, status: 'PENDING' },
    select: { id: true },
  });
  if (existingPending) {
    log.info({ personId: person.id }, 'claim:request_already_pending');
    return generic;
  }

  // 6. Cria a solicitação PENDENTE vinculada à Pessoa existente, em auditoria.
  //    O `after` não carrega o e-mail (PII): a minimização do audit o redigiria;
  //    registramos apenas IDs e o meio pretendido.
  try {
    await withAudit(
      AuditEvent.CREDENTIAL_CLAIM_REQUESTED,
      async (tx, audit) => {
        const claim = await tx.credentialClaim.create({
          data: {
            personId: person.id,
            requestedEmail: input.requestedEmail,
            verificationMethod: input.verificationMethod,
            status: 'PENDING',
          },
          select: { id: true },
        });

        audit.entityType = 'credential_claim';
        audit.entityId = claim.id;
        audit.after = {
          personId: person.id,
          claimId: claim.id,
          verificationMethod: input.verificationMethod,
          hasAlternativeIdentifier: Boolean(input.alternativeIdentifier),
        };

        return claim.id;
      },
      // Solicitante anônimo (fluxo público): sem ator de domínio; IP/UA registram a origem.
      { ip, userAgent, context: { route: '/reivindicar-credencial' } },
    );

    log.info({ personId: person.id }, 'claim:request_created');
    // P-003 (follow-up): a fila de verificação (UI interna) é o canal de
    // acompanhamento; a notificação ativa dos aprovadores fica para quando o
    // registro de aprovadores existir (USP-008).
    return generic;
  } catch (err) {
    log.error({ err }, 'claim:request_unexpected');
    // Não revela falha de infraestrutura ao solicitante (anti-enumeração).
    return generic;
  }
}
