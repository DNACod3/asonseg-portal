import { prisma } from '@/shared/lib/prisma';

/** Limite defensivo de devoluções lidas por vaga (paginação obrigatória — CLAUDE.md). */
const RETURN_HISTORY_PER_JOB = 5;

/** Motivo da devolução mais recente de uma vaga (USP-054 / MOD-3). */
export interface LatestReturnReason {
  reason: string | null;
  returnedAt: Date;
}

/**
 * Motivo da **última** devolução para ajustes de cada vaga em `jobIds` (USP-054 /
 * MOD-3 / USP-016 E-003), lido do `AuditLog` (append-only, ADR-0023) — não há
 * tabela própria de moderação; o registro já é gravado por `transitionContent` na
 * mesma transação da decisão (L-003). Molde: `listCompanyRejections`
 * (`@/modules/companies`), trocando a `action` de `CONTENT_REJECTED` para
 * `CONTENT_RETURNED_FOR_ADJUSTMENTS`.
 *
 * **Owner-scope (MN-03)**: esta query não resolve `companyId` — o isolamento
 * cross-tenant é responsabilidade do chamador, que deve passar **apenas** os
 * `jobId` já filtrados por Empresa (ex.: `listCompanyJobs(companyId)`). Vagas de
 * outras Empresas passadas aqui por engano seriam consultadas — a garantia de
 * isolamento vem de nunca passar `jobId` de fora do escopo do chamador.
 *
 * Retorna um `Map jobId → { reason, returnedAt }`; vagas sem devolução (nunca
 * devolvidas, ou `jobId` sem correspondência) ficam **fora** do Map (USP054-E2 —
 * o fallback "sem motivo registrado" é responsabilidade da UI).
 */
export async function listLatestReturnReasons(
  jobIds: readonly string[],
): Promise<Map<string, LatestReturnReason>> {
  const unique = [...new Set(jobIds)];
  if (unique.length === 0) return new Map();

  const rows = await prisma.auditLog.findMany({
    where: {
      action: 'CONTENT_RETURNED_FOR_ADJUSTMENTS',
      entityType: 'JOB',
      entityId: { in: unique },
    },
    select: { entityId: true, justification: true, occurredAt: true },
    orderBy: { occurredAt: 'desc' },
    take: RETURN_HISTORY_PER_JOB * unique.length,
  });

  // Primeira ocorrência por `entityId` na ordem desc = a mais recente (USP054-08).
  const result = new Map<string, LatestReturnReason>();
  for (const row of rows) {
    if (!row.entityId || result.has(row.entityId)) continue;
    result.set(row.entityId, { reason: row.justification, returnedAt: row.occurredAt });
  }
  return result;
}
