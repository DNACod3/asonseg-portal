import { prisma } from '@/shared/lib/prisma';

export interface CompanyApplicationCounts {
  total: number;
  active: number;
}

/**
 * Contadores de candidaturas às vagas de uma Empresa — `{ total, active }` —
 * para os KPIs "candidatos aplicados/ativos" do bloco COMPANY_RESPONSIBLE do
 * painel `/inicio` (USP-067 — PNL-04 / A-07). Count-only (nenhum `select` de
 * linha, nenhuma PII de candidato) via `$transaction` para consistência de
 * snapshot entre os 2 counts, mesmo padrão de `getHomeIndicators`.
 * `active = cancelledAt: null` (candidatura não cancelada).
 */
export async function countCompanyApplications(companyId: string): Promise<CompanyApplicationCounts> {
  const [total, active] = await prisma.$transaction([
    prisma.application.count({ where: { job: { companyId } } }),
    prisma.application.count({ where: { job: { companyId }, cancelledAt: null } }),
  ]);

  return { total, active };
}
