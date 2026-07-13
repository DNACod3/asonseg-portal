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
 * guarda otimista `WHERE cancelledAt IS NULL` — a mesma defesa que resolve a
 * concorrência com um cancelamento avulso da mesma linha (USP053-E3/MN-01):
 * exatamente um dos dois preenche `cancelledAt`; o outro casa 0 linhas para
 * ela e não a audita. Desde a remediação Fase 8 (perf — `/pr-review`), a
 * guarda roda num único `updateMany` em lote (não mais 1 por candidatura) —
 * o Postgres avalia o `WHERE` por linha dentro do mesmo `UPDATE`, então a
 * garantia de concorrência por linha é idêntica; só o número de round-trips
 * sequenciais cai de `2N` para `2 + N` (as N linhas afetadas ainda precisam
 * de 1 insert de auditoria cada — append-only, não dá para agregar).
 *
 * **ENCERRAR** = `cancelledAt` preenchido (sai do pipeline ativo do
 * empregador, sem apagar a linha — USP053-MN-03). **MARCAR** (A-1, sem coluna
 * nova) = o `APPLICATION_CANCELLED` por linha, com `after.via='consent_revoke'`
 * — a "flag histórica" vive no evento append-only.
 *
 * Escopo estritamente por `candidatePersonId=ctx.personId` (USP053-MN-05) —
 * todas as vagas do titular, nenhuma de outra Pessoa (USP053-E4).
 */
/** Teto defensivo do re-select pós-batch — nenhum titular real chega perto disso; só formaliza a paginação obrigatória (CLAUDE.md). */
const MAX_ENDED_APPLICATIONS = 10_000;

export async function endJobApplicationsForRevocation(
  tx: Prisma.TransactionClient,
  ctx: EndJobApplicationsForRevocationContext,
): Promise<EndJobApplicationsForRevocationResult> {
  const cancelledAt = new Date();

  // 1 UPDATE em lote (era 1 `findMany` + N `updateMany` sequenciais) — a guarda
  // otimista por linha (`cancelledAt: null`) é avaliada pelo Postgres dentro do
  // próprio `UPDATE`, então uma corrida com cancelamento avulso da MESMA linha
  // (USP053-E3) continua resolvida corretamente: linhas já canceladas por fora
  // não casam o `WHERE` e não são tocadas por este `updateMany`.
  await tx.application.updateMany({
    where: { candidatePersonId: ctx.personId, cancelledAt: null },
    data: { cancelledAt },
  });

  // Re-seleciona exatamente as linhas que ESTE `updateMany` afetou — o mesmo
  // `cancelledAt` (gerado uma única vez acima) marca o lote desta chamada,
  // nunca reaproveitado por outra revogação/cancelamento.
  const ended = await tx.application.findMany({
    where: { candidatePersonId: ctx.personId, cancelledAt },
    select: { id: true },
    take: MAX_ENDED_APPLICATIONS,
  });
  const endedApplicationIds = ended.map(({ id }) => id);

  // Os inserts de auditoria continuam 1 por linha (append-only) — é o único
  // jeito de manter o rastro correto por candidatura; só o UPDATE foi agregado.
  for (const id of endedApplicationIds) {
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

  return { endedCount: endedApplicationIds.length, endedApplicationIds };
}
