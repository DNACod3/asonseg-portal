'use server';

import { headers } from 'next/headers';
import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import type { EmailMessage } from '@/shared/lib/email/email-sender.port';
import { wouldLeaveCompanyWithoutResponsible } from '../domain/grants';
import {
  removeResponsibleSchema,
  type RemoveResponsibleInput,
} from '../schemas/remove-responsible.schema';

export interface RemoveResponsibleResult {
  /** A remoção foi do próprio vínculo do ator (perde o acesso de gestão na próxima requisição). */
  selfRemoved: boolean;
}

/**
 * Remove (encerra) um vínculo de responsável de uma Empresa (USP-014).
 *
 * Remoção é **append-only**: marca `revokedAt`/`revokedBy`/`revokeReason` — nunca
 * apaga a linha (VPE-06). Sequência canônica (runbook-server-action):
 *  1. Valida input com Zod (grantId uuid + motivo opcional ≤280).
 *  2. Resolve Pessoa autenticada (status revalidado — ADR-0030).
 *  3. Carrega o grant alvo (RESPONSIBLE, não revogado) e resolve a Empresa.
 *  4. Permissão (P-005): o ator deve ser responsável ATIVO da Empresa do grant.
 *  5. Invariante (AC-014-2): se o alvo é ACTIVE e seria o último ativo → bloqueia.
 *  6. withAudit(COMPANY_RESPONSIBLE_REMOVED): revoga o grant + enfileira o e-mail
 *     de aviso no outbox, na mesma transação (ADR-0020). Falha de envio não reverte.
 */
export async function removerResponsavel(
  rawInput: RemoveResponsibleInput,
): Promise<ActionResult<RemoveResponsibleResult>> {
  const log = childLogger({ module: 'companies', action: 'removerResponsavel' });

  // 1. Validação.
  const parsed = removeResponsibleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { grantId, motivo } = parsed.data;

  // 2. Pessoa autenticada.
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // 3. Carrega o grant alvo (não revogado). Idempotência defensiva: grant
  //    inexistente ou já encerrado → NOT_FOUND (não revela existência).
  const target = await prisma.personCompanyGrant.findFirst({
    where: { id: grantId, grantType: 'RESPONSIBLE', revokedAt: null },
    select: { id: true, companyId: true, personId: true, status: true },
  });
  if (!target) {
    return fail('NOT_FOUND', 'Vínculo não encontrado ou já removido.');
  }

  // 4. Permissão (P-005): só responsável ATIVO da mesma Empresa remove.
  const actorGrant = await prisma.personCompanyGrant.findFirst({
    where: {
      personId: person.id,
      companyId: target.companyId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!actorGrant) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  // 5. Invariante (AC-014-2): remover um vínculo ACTIVE não pode deixar a Empresa
  //    sem nenhum responsável ativo. Vínculos PENDING não contam (nunca bloqueiam).
  if (target.status === 'ACTIVE') {
    const activeGrants = await prisma.personCompanyGrant.findMany({
      where: {
        companyId: target.companyId,
        grantType: 'RESPONSIBLE',
        status: 'ACTIVE',
        revokedAt: null,
      },
      select: { id: true },
    });
    if (wouldLeaveCompanyWithoutResponsible(activeGrants.map((g) => g.id), target.id)) {
      return fail(
        'PRECONDITION_FAILED',
        'Designe outro responsável antes de remover o último responsável ativo.',
      );
    }
  }

  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? null : rawIp;
  const userAgent = hdrs.get('user-agent') ?? null;

  // 6. Remoção atômica: revoga o grant (append-only) + e-mail de aviso no outbox.
  try {
    await withAudit(
      AuditEvent.COMPANY_RESPONSIBLE_REMOVED,
      async (tx, audit) => {
        // Releitura defensiva + revogação (fecha corrida de dupla remoção).
        const revoke = await tx.personCompanyGrant.updateMany({
          where: { id: target.id, revokedAt: null },
          data: { revokedAt: new Date(), revokedBy: person.id, revokeReason: motivo ?? null },
        });
        if (revoke.count === 0) {
          throw Object.assign(new Error('ALREADY_REVOKED'), { code: 'ALREADY_REVOKED' });
        }

        // Aviso à Pessoa removida (AC-014-1). Envio assíncrono é da USP-044; sem
        // e-mail cadastrado a notificação é simplesmente não enfileirada.
        const removed = await tx.person.findUnique({
          where: { id: target.personId },
          select: { emailLogin: true },
        });
        if (removed?.emailLogin) {
          const company = await tx.company.findUnique({
            where: { id: target.companyId },
            select: { nomeFantasia: true },
          });
          // `satisfies EmailMessage`: o payload do outbox é checado contra a union
          // discriminada da porta de e-mail — drift de template/campos quebra o build.
          const message = {
            to: removed.emailLogin,
            template: 'responsible-removed',
            data: { empresaNome: company?.nomeFantasia ?? 'Empresa' },
          } satisfies EmailMessage;
          await tx.outbox.create({ data: { topic: 'email', payload: message } });
        }

        audit.entityType = 'person_company_grant';
        audit.entityId = target.id;
        audit.before = { status: target.status, revokedAt: null };
        audit.after = { revokedBy: person.id, revokeReason: motivo ?? null };
        // Justificativa forense é obrigatória p/ COMPANY_RESPONSIBLE_REMOVED
        // (JUSTIFICATION_REQUIRED_EVENTS). O motivo de negócio é opcional na UI
        // (revokeReason); quando ausente, registramos um texto padrão para manter
        // o rastro não-vazio sem forçar o operador a digitar.
        audit.justification = motivo ?? 'Remoção de responsável pela gestão da Empresa.';
      },
      {
        actorUserId: person.supabaseUserId,
        actorPersonId: person.id,
        ip,
        userAgent,
        context: { route: '/empresa/responsaveis' },
      },
    );

    const selfRemoved = target.personId === person.id;
    log.info(
      { actorPersonId: person.id, companyId: target.companyId, grantId: target.id, selfRemoved },
      'companies:responsible_removed',
    );
    return ok({ selfRemoved });
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === 'ALREADY_REVOKED') {
      return fail('NOT_FOUND', 'Vínculo não encontrado ou já removido.');
    }
    const errCode = err instanceof Error ? (err as NodeJS.ErrnoException).code ?? err.message : String(err);
    log.error({ errCode }, 'companies:remove_responsible_failed');
    return fail('INTERNAL', 'Não foi possível remover o responsável. Tente novamente mais tarde.');
  }
}
