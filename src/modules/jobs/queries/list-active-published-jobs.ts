import { prisma } from '@/shared/lib/prisma';

/** Tamanho de página da listagem de conteúdo publicado (USP-018 / L-002 — `take` obrigatório). */
export const PUBLISHED_JOBS_PAGE_SIZE = 20;

/** Vaga `ACTIVE` na superfície de gestão de conteúdo publicado (INACT-06). */
export interface PublishedJobRow {
  id: string;
  title: string;
  publishedAt: Date | null;
  companyName: string;
  areaName: string | null;
}

export interface ListActivePublishedJobsResult {
  items: PublishedJobRow[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Lista vagas `ACTIVE` (USP-018 / INACT-06) para a superfície de gestão de
 * conteúdo publicado (`(app)/moderacao/publicados`), paginada (`take`
 * obrigatório — convenção de paginação de `search-jobs.ts`).
 */
export async function listActivePublishedJobs(
  opts: { page?: number } = {},
): Promise<ListActivePublishedJobsResult> {
  const page = Math.max(1, Math.trunc(opts.page ?? 1));
  const skip = (page - 1) * PUBLISHED_JOBS_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        company: { select: { nomeFantasia: true } },
        area: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: PUBLISHED_JOBS_PAGE_SIZE,
    }),
    prisma.job.count({ where: { status: 'ACTIVE' } }),
  ]);

  const items: PublishedJobRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    publishedAt: row.publishedAt,
    companyName: row.company.nomeFantasia,
    areaName: row.area?.name ?? null,
  }));

  return { items, page, pageSize: PUBLISHED_JOBS_PAGE_SIZE, total };
}
