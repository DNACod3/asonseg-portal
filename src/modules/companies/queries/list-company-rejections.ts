import { prisma } from '@/shared/lib/prisma';
import { viewStaffPersonNames } from '@/modules/persons';

/** Uma rejeição de vaga da Empresa, derivada do audit_log (P-003 / D-005). */
export interface CompanyRejection {
  rejectedAt: Date;
  byName: string | null;
  reason: string | null;
}

/** Limite de itens do histórico **por Empresa** (paginação obrigatória). */
const HISTORY_PAGE_SIZE = 50;

/**
 * Histórico de rejeições de vagas de **várias Empresas** numa única passada
 * (P-003 / D-005), evitando N+1 quando a fila tem várias Empresas. Não há tabela
 * própria — o histórico vive no `audit_log` (ADR-0023) como eventos
 * `CONTENT_REJECTED` cujo `entityId` é uma vaga; a Empresa é derivada via `jobs`
 * (a auditoria guarda só o id da vaga).
 *
 * Retorna um `Map companyId → rejeições`, cada lista ordenada do mais recente
 * para o mais antigo e limitada a `HISTORY_PAGE_SIZE` por Empresa. Empresas sem
 * rejeições ficam de fora do Map.
 */
export async function listCompanyRejectionsByCompany(
  companyIds: readonly string[],
): Promise<Map<string, CompanyRejection[]>> {
  const unique = [...new Set(companyIds)];
  if (unique.length === 0) return new Map();

  // job → company (a auditoria só guarda o id da vaga). `take` defensivo: até
  // o limite por Empresa multiplicado pela quantidade de Empresas da fila.
  const jobs = await prisma.job.findMany({
    where: { companyId: { in: unique } },
    select: { id: true, companyId: true },
    take: HISTORY_PAGE_SIZE * unique.length,
  });
  if (jobs.length === 0) return new Map();

  const companyByJobId = new Map(jobs.map((j) => [j.id, j.companyId]));

  const rows = await prisma.auditLog.findMany({
    where: {
      action: 'CONTENT_REJECTED',
      entityType: 'JOB',
      entityId: { in: jobs.map((j) => j.id) },
    },
    select: { occurredAt: true, actorPersonId: true, justification: true, entityId: true },
    orderBy: { occurredAt: 'desc' },
    take: HISTORY_PAGE_SIZE * unique.length,
  });
  if (rows.length === 0) return new Map();

  const actorIds = rows
    .map((r) => r.actorPersonId)
    .filter((id): id is string => Boolean(id));
  const nameById = await viewStaffPersonNames(actorIds);

  const result = new Map<string, CompanyRejection[]>();
  for (const r of rows) {
    const companyId = r.entityId ? companyByJobId.get(r.entityId) : undefined;
    if (!companyId) continue;
    const list = result.get(companyId);
    if (list && list.length >= HISTORY_PAGE_SIZE) continue; // limite por Empresa
    const rejection: CompanyRejection = {
      rejectedAt: r.occurredAt,
      byName: r.actorPersonId ? (nameById.get(r.actorPersonId) ?? null) : null,
      reason: r.justification,
    };
    if (list) list.push(rejection);
    else result.set(companyId, [rejection]);
  }
  return result;
}

/**
 * Histórico de rejeições de uma única Empresa (P-003 / D-005). Conveniência sobre
 * {@link listCompanyRejectionsByCompany} para chamadas pontuais.
 */
export async function listCompanyRejections(companyId: string): Promise<CompanyRejection[]> {
  const byCompany = await listCompanyRejectionsByCompany([companyId]);
  return byCompany.get(companyId) ?? [];
}
