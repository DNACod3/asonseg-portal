import { prisma } from '@/shared/lib/prisma';
import type { ContentStatus } from '@/modules/moderation';

/** `select` mínimo para a lista de gestão da Empresa — dado próprio, sem anonimização. */
export interface CompanyJobRow {
  id: string;
  title: string;
  status: ContentStatus;
  validUntil: Date | null;
  publishedAt: Date | null;
  lastStatusChangeAt: Date;
}

/** Tamanho máximo da lista de gestão (`take` obrigatório, CLAUDE.md). */
export const COMPANY_JOBS_PAGE_SIZE = 100;

/**
 * Lista as vagas de uma Empresa (**todos** os status) para o painel de gestão da
 * própria Pessoa-responsável (USP-023 / T8). Dado da própria Empresa → sem
 * anonimização (CLAUDE.md: "Direct Prisma access is only OK when a Person views
 * their own data"). Ordena por status (agrupa DRAFT/ACTIVE/PAUSED/etc.) e depois
 * pela mais recente.
 */
export async function listCompanyJobs(companyId: string): Promise<CompanyJobRow[]> {
  const rows = await prisma.job.findMany({
    where: { companyId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: COMPANY_JOBS_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      status: true,
      validUntil: true,
      publishedAt: true,
      lastStatusChangeAt: true,
    },
  });
  return rows as unknown as CompanyJobRow[];
}
