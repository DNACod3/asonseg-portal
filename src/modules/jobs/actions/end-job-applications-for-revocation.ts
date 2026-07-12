import type { Prisma } from '@prisma/client';
import { AuditEvent, recordAuditEvent } from '@/modules/audit';

export interface EndJobApplicationsForRevocationContext {
  personId: string;
  actorPersonId: string;
  ip: string | null;
  userAgent: string | null;
  justification: string;
}

export interface EndJobApplicationsForRevocationResult {
  endedCount: number;
  endedApplicationIds: string[];
}

/**
 * Participante de transação (USP-053 / CAND-7 — ENCERRAR+MARCAR) que encerra
 * (soft-cancel) todas as candidaturas **ativas** do titular e emite um
 * `APPLICATION_CANCELLED` marcado `via:'consent_revoke'` por linha, dentro da
 * mesma tx da revogação de `JOB_APPLICATION`. Não abre transação própria —
 * recebe o `tx` do chamador (padrão `createReferralApplication`).
 *
 * Reusa a mecânica de cancelamento da USP-026 (`cancel-application.ts`):
 * guarda otimista `updateMany({ where: { id, cancelledAt: null } })` por
 * candidatura — a mesma defesa que resolve a concorrência com um cancelamento
 * avulso da mesma linha (USP053-E3/MN-01): exatamente um dos dois preenche
 * `cancelledAt` e audita; o outro conta `count===0` e é ignorado.
 *
 * **ENCERRAR** = `cancelledAt` preenchido (sai do pipeline ativo do
 * empregador, sem apagar a linha — USP053-MN-03). **MARCAR** (A-1, sem coluna
 * nova) = o `APPLICATION_CANCELLED` por linha, com `after.via='consent_revoke'`
 * — a "flag histórica" vive no evento append-only.
 *
 * Escopo estritamente por `candidatePersonId=ctx.personId` (USP053-MN-05) —
 * todas as vagas do titular, nenhuma de outra Pessoa (USP053-E4).
 */
export async function endJobApplicationsForRevocation(
  tx: Prisma.TransactionClient,
  ctx: EndJobApplicationsForRevocationContext,
): Promise<EndJobApplicationsForRevocationResult> {
  const active = await tx.application.findMany({
    where: { candidatePersonId: ctx.personId, cancelledAt: null },
    select: { id: true },
  });

  const cancelledAt = new Date();
  const endedApplicationIds: string[] = [];

  for (const { id } of active) {
    // Guarda otimista idêntica à USP-026: se um cancelamento avulso concorrente
    // já venceu, `count` vem 0 e esta linha é ignorada (sem duplo evento).
    const res = await tx.application.updateMany({
      where: { id, cancelledAt: null },
      data: { cancelledAt },
    });
    if (res.count === 1) {
      endedApplicationIds.push(id);
      await recordAuditEvent(
        tx,
        AuditEvent.APPLICATION_CANCELLED,
        {
          entityType: 'APPLICATION',
          entityId: id,
          before: { cancelledAt: null },
          after: {
            cancelledAt: cancelledAt.toISOString(),
            via: 'consent_revoke',
            reason: 'retirada por revogação de consentimento JOB_APPLICATION',
          },
          justification: ctx.justification,
        },
        { actorPersonId: ctx.actorPersonId, ip: ctx.ip, userAgent: ctx.userAgent },
      );
    }
  }

  return { endedCount: endedApplicationIds.length, endedApplicationIds };
}
