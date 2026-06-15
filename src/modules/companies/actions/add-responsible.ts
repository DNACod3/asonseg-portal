'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { rateLimiter, RATE_LIMITS } from '@/shared/lib/rateLimit';
import { env } from '@/shared/env';
import {
  addResponsibleSchema,
  classifyIdentifier,
  type AddResponsibleInput,
} from '../schemas/add-responsible.schema';

export interface AddResponsibleResult {
  /** O vínculo nasce sempre PENDING — só vira ACTIVE após o aceite (USP-013/P-002). */
  status: 'PENDING';
}

/**
 * Adiciona outra Pessoa (já cadastrada) como responsável adicional de uma Empresa (USP-013).
 *
 * Sequência canônica (runbook-server-action):
 *  1. Valida input com Zod (empresaId uuid + cpfOuEmail = CPF|e-mail válido).
 *  2. Resolve Pessoa autenticada (status revalidado — ADR-0030).
 *  3. Permissão (P-005): o ator deve ser responsável ATIVO da Empresa.
 *  4. Rate limit anti-enumeração por identidade (L-002 / ADR-0029).
 *  5. Busca binária da Pessoa por CPF|e-mail (P-001 / ADR-0022) — sem expor PII.
 *  6. Pré-condições: Pessoa existe (E-002) e não há vínculo PENDING/ACTIVE (CONFLICT).
 *  7. withAudit(COMPANY_RESPONSIBLE_ADDED): cria grant PENDING + enfileira o e-mail
 *     de aceite no outbox, na mesma transação (ADR-0020). P2002 → CONFLICT (P-004).
 */
export async function adicionarResponsavel(
  rawInput: AddResponsibleInput,
): Promise<ActionResult<AddResponsibleResult>> {
  const log = childLogger({ module: 'companies', action: 'adicionarResponsavel' });

  // 1. Validação.
  const parsed = addResponsibleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { empresaId, cpfOuEmail } = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Permissão (P-005): só responsável ATIVO da Empresa pode adicionar.
  const actorGrant = await prisma.personCompanyGrant.findFirst({
    where: {
      personId: person.id,
      companyId: empresaId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!actorGrant) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  // 4. Rate limit anti-enumeração de CPF/e-mail (L-002).
  const rl = rateLimiter.check(`add-responsible:${person.id}`, RATE_LIMITS.responsibleLookup);
  if (!rl.allowed) {
    return fail(
      'PRECONDITION_FAILED',
      'Muitas buscas em sequência. Aguarde alguns instantes e tente novamente.',
    );
  }

  // 5. Busca binária (P-001) — resolvida server-side; nada de PII no retorno.
  const ident = classifyIdentifier(cpfOuEmail);
  if (!ident) {
    // Defensivo — o schema já garante; mantém o tipo estreito.
    return fail('VALIDATION', 'Informe um CPF ou e-mail válido.');
  }
  const target = await prisma.person.findFirst({
    where: ident.kind === 'cpf' ? { cpf: ident.value } : { emailLogin: ident.value },
    select: { id: true, emailLogin: true },
  });

  // 6a. Pessoa não cadastrada (E-002): bloqueia e orienta auto-cadastro (sem convite).
  if (!target) {
    return fail(
      'NOT_FOUND',
      'Não há Pessoa cadastrada com este CPF/e-mail. Peça que ela faça o auto-cadastro no portal antes de ser adicionada como responsável.',
    );
  }

  // 6b. Duplicidade: já há vínculo não-removido (PENDING ou ACTIVE) → CONFLICT.
  const existingLink = await prisma.personCompanyGrant.findFirst({
    where: { personId: target.id, companyId: empresaId, revokedAt: null },
    select: { id: true },
  });
  if (existingLink) {
    return fail(
      'CONFLICT',
      'Esta Pessoa já é responsável desta Empresa ou já possui um convite pendente.',
    );
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 7. Persistência atômica: grant PENDING + e-mail de aceite no outbox.
  try {
    await withAudit(
      AuditEvent.COMPANY_RESPONSIBLE_ADDED,
      async (tx, audit) => {
        const grant = await tx.personCompanyGrant.create({
          data: {
            personId: target.id,
            companyId: empresaId,
            grantType: 'RESPONSIBLE',
            grantedBy: person.id,
            status: 'PENDING',
            pendingAt: new Date(),
          },
          select: { id: true },
        });

        // Enfileira o convite de aceite (E-003). O envio assíncrono é da USP-044;
        // sem e-mail cadastrado a Pessoa aceita pelo painel (link do e-mail é opcional).
        if (target.emailLogin) {
          const company = await tx.company.findUnique({
            where: { id: empresaId },
            select: { nomeFantasia: true },
          });
          const acceptUrl = `${env.NEXT_PUBLIC_SITE_URL}/empresa/aceitar-vinculo?empresaId=${empresaId}`;
          await tx.outbox.create({
            data: {
              topic: 'email',
              payload: {
                to: target.emailLogin,
                template: 'responsible-link-pending',
                data: { empresaNome: company?.nomeFantasia ?? 'Empresa', acceptUrl },
              },
            },
          });
        }

        audit.entityType = 'person_company_grant';
        audit.entityId = grant.id;
        audit.after = { personId: target.id, companyId: empresaId, status: 'PENDING' };
      },
      {
        actorUserId: person.supabaseUserId,
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { route: '/empresa/responsaveis' },
      },
    );

    log.info({ actorPersonId: person.id, companyId: empresaId }, 'companies:responsible_added_pending');
    return ok({ status: 'PENDING' });
  } catch (err) {
    // Corrida de duplicidade: UNIQUE parcial dispara P2002 (P-004 / ADR-0021).
    if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
      return fail(
        'CONFLICT',
        'Esta Pessoa já é responsável desta Empresa ou já possui um convite pendente.',
      );
    }
    const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
    log.error({ errCode }, 'companies:add_responsible_failed');
    return fail('INTERNAL', 'Não foi possível adicionar o responsável. Tente novamente mais tarde.');
  }
}
