import { prisma } from '@/shared/lib/prisma';
import { viewStaffPersonNames } from '@/modules/persons';

/** Uma rejeição de vaga da Empresa, derivada do audit_log (P-003 / D-005). */
export interface CompanyRejection {
  rejectedAt: Date;
  byName: string | null;
  reason: string | null;
}

/** Limite de itens do histórico (paginação obrigatória). */
const HISTORY_PAGE_SIZE = 50;

/**
 * Histórico de rejeições de vagas de uma Empresa (P-003 / D-005): quando, por
 * quem e por quê. Não há tabela própria — vive no `audit_log` (ADR-0023) como
 * eventos `CONTENT_REJECTED` cujo `entityId` é uma vaga da Empresa. O `companyId`
 * é derivado via `jobs` (a auditoria guarda só o id da vaga).
 *
 * Ordenado do mais recente para o mais antigo.
 */
export async function listCompanyRejections(companyId: string): Promise<CompanyRejection[]> {
  const jobs = await prisma.job.findMany({
    where: { companyId },
    select: { id: true },
  });
  if (jobs.length === 0) return [];

  const rows = await prisma.auditLog.findMany({
    where: {
      action: 'CONTENT_REJECTED',
      entityType: 'JOB',
      entityId: { in: jobs.map((j) => j.id) },
    },
    select: { occurredAt: true, actorPersonId: true, justification: true },
    orderBy: { occurredAt: 'desc' },
    take: HISTORY_PAGE_SIZE,
  });
  if (rows.length === 0) return [];

  const actorIds = rows
    .map((r) => r.actorPersonId)
    .filter((id): id is string => Boolean(id));
  const nameById = await viewStaffPersonNames(actorIds);

  return rows.map((r) => ({
    rejectedAt: r.occurredAt,
    byName: r.actorPersonId ? (nameById.get(r.actorPersonId) ?? null) : null,
    reason: r.justification,
  }));
}
