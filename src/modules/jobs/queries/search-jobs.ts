import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';
import { hojeSaoPaulo } from '@/shared/lib/time';
import { viewJobForVisitor, type JobListItem, type JobListRow } from '../views/job-list-item.view';

/** Tamanho de página da busca pública (L-002 — `take` obrigatório). */
export const SEARCH_PAGE_SIZE = 20;

/** Filtros da busca pública de vagas (USP-021 / E-002). Todos opcionais (AND lógico). */
export interface SearchJobsFilters {
  q?: string; // busca textual sem acento (E-003)
  areaId?: string;
  educationLevel?: string;
  contractType?: string;
  workRegime?: string;
  regionId?: string;
  salaryMin?: number; // faixa: piso desejado
  salaryMax?: number; // faixa: teto desejado
  page?: number;
}

export interface SearchJobsResult {
  items: JobListItem[];
  page: number;
  pageSize: number;
  total: number;
}

/** `select` explícito: só o que o View Model precisa (P-004 — nada de entidade crua). */
const jobListSelect = {
  id: true,
  title: true,
  educationLevelRequired: true,
  contractType: true,
  workRegime: true,
  salaryMin: true,
  salaryMax: true,
  salaryVisible: true,
  publishedAt: true,
  area: { select: { name: true } },
  region: { select: { name: true } },
  company: { select: { nomeFantasia: true, setor: true } },
} satisfies Prisma.JobSelect;

/**
 * Faixa salarial por **overlap** de intervalo (AD-5): a vaga "casa" se seu intervalo
 * [salaryMin, salaryMax] cruza o filtro. Vagas sem faixa (null) são excluídas quando
 * há filtro de salário (intervalo desconhecido não satisfaz a restrição).
 */
function salaryOverlapWhere(filters: SearchJobsFilters): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {};
  if (typeof filters.salaryMin === 'number') {
    where.salaryMax = { gte: new Prisma.Decimal(filters.salaryMin) };
  }
  if (typeof filters.salaryMax === 'number') {
    where.salaryMin = { lte: new Prisma.Decimal(filters.salaryMax) };
  }
  return where;
}

/**
 * Busca pública de vagas (USP-021 / TD §4.4 `jobs.buscarVagas`). Read-only, sem
 * Server Action (leitura pública). Padrão runbook-search-pagination:
 *
 * 1. On-read obrigatório (E-001/P-003/P-005): `ACTIVE` **AND** `validUntil >= hoje(SP)`
 *    **AND** `company.isVerified`. A fonte da verdade da expiração é a query, não o job
 *    da USP-024 — uma vaga vencida some mesmo se o status persistido ainda for `ACTIVE`.
 * 2. Filtros em AND (E-002): área, escolaridade, contrato, regime, região, faixa salarial.
 * 3. Busca textual sem acento (E-003): `immutable_unaccent` sobre título+descrição+requisitos,
 *    via `$queryRaw` parametrizado (anti-injeção) que usa o índice GIN/trgm `job_search_trgm`.
 * 4. Ordenação `publishedAt DESC` (E-001), com fallback p/ vagas sem `publishedAt`.
 * 5. Paginação `take`/`skip` (L-002); `total` conta com o mesmo `where`.
 * 6. `select` explícito → View Model por papel (anonimização — P-001/E-004/E-005).
 */
export async function searchJobs(
  filters: SearchJobsFilters,
  viewer: CurrentPerson | null,
): Promise<SearchJobsResult> {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));

  const where: Prisma.JobWhereInput = {
    status: 'ACTIVE',
    validUntil: { gte: hojeSaoPaulo() },
    company: { isVerified: true },
    ...(filters.areaId ? { areaId: filters.areaId } : {}),
    ...(filters.regionId ? { regionId: filters.regionId } : {}),
    ...(filters.contractType ? { contractType: filters.contractType } : {}),
    ...(filters.workRegime ? { workRegime: filters.workRegime } : {}),
    ...(filters.educationLevel ? { educationLevelRequired: filters.educationLevel } : {}),
    ...salaryOverlapWhere(filters),
  };

  // Busca textual (E-003): resolve os ids casados pelo índice funcional unaccent e
  // restringe o `where` tipado. Mantém os filtros estruturais no Prisma + a paginação.
  const term = filters.q?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const matched = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM jobs
      WHERE immutable_unaccent(
              lower(coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(requirements, ''))
            ) LIKE immutable_unaccent(lower(${pattern}))`);
    where.id = { in: matched.map((row) => row.id) };
  }

  const [total, rows] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      select: jobListSelect,
      orderBy: [{ publishedAt: 'desc' }, { lastStatusChangeAt: 'desc' }, { createdAt: 'desc' }],
      take: SEARCH_PAGE_SIZE,
      skip: (page - 1) * SEARCH_PAGE_SIZE,
    }),
  ]);

  return {
    items: rows.map((row) => viewJobForVisitor(row as JobListRow, viewer)),
    page,
    pageSize: SEARCH_PAGE_SIZE,
    total,
  };
}
