import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';
import { hojeSaoPaulo } from '@/shared/lib/time';
import { viewJobForVisitor, type JobListItem, type JobListRow } from '../views/job-list-item.view';

/** Tamanho de página da busca pública (L-002 — `take` obrigatório). */
export const SEARCH_PAGE_SIZE = 20;

/**
 * Teto de caracteres do termo de busca (RP-009 — endpoint público anônimo). Limita o
 * custo do `LIKE` trgm e evita abuso por termo gigante. Generoso para uso legítimo.
 */
export const SEARCH_TERM_MAX = 100;

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

/**
 * `select` explícito por papel (P-004 — least privilege). O nome real da Empresa
 * (`nomeFantasia`) é dado restrito para o anônimo (ADR-0017): NÃO é sequer carregado
 * quando não há viewer — assim não há como vazar no HTML/Flight/JSON, nem por engano
 * de template. O `setor` (base da anonimização) é sempre buscado.
 */
function jobListSelect(authenticated: boolean) {
  return {
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
    company: { select: { setor: true, ...(authenticated ? { nomeFantasia: true } : {}) } },
  } satisfies Prisma.JobSelect;
}

/**
 * Monta as condições SQL da busca (on-read + filtros AND + texto), compartilhadas pela
 * contagem e pela página. Tudo parametrizado via `Prisma.sql` (anti-injeção). Fonte
 * única do `WHERE` — evita drift entre `count` e `findMany`.
 *
 * 1. On-read obrigatório (E-001/P-003/P-005): `ACTIVE` **AND** `valid_until >= hoje(SP)`
 *    **AND** `companies.is_verified`. A expiração é resolvida aqui, não pelo job da USP-024.
 * 2. Filtros em AND (E-002): área, escolaridade, contrato, regime, região, faixa por overlap.
 * 3. Busca textual sem acento (E-003): `immutable_unaccent` sobre título+descrição+requisitos,
 *    usando o índice GIN/trgm `job_search_trgm` (mesma função nos dois lados).
 */
function buildWhere(filters: SearchJobsFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [
    Prisma.sql`j.status = 'ACTIVE'`,
    Prisma.sql`j.valid_until >= ${hojeSaoPaulo()}`,
    Prisma.sql`c.is_verified = true`,
  ];

  if (filters.areaId) conds.push(Prisma.sql`j.area_id = ${filters.areaId}::uuid`);
  if (filters.regionId) conds.push(Prisma.sql`j.region_id = ${filters.regionId}::uuid`);
  if (filters.contractType) conds.push(Prisma.sql`j.contract_type = ${filters.contractType}`);
  if (filters.workRegime) conds.push(Prisma.sql`j.work_regime = ${filters.workRegime}`);
  if (filters.educationLevel) {
    conds.push(Prisma.sql`j.education_level_required = ${filters.educationLevel}`);
  }
  // Faixa salarial por overlap (AD-5): a vaga casa se seu intervalo cruza o filtro.
  // Vagas sem faixa (NULL) são excluídas quando há filtro (intervalo desconhecido não satisfaz).
  if (typeof filters.salaryMin === 'number') {
    conds.push(Prisma.sql`j.salary_max >= ${filters.salaryMin}`);
  }
  if (typeof filters.salaryMax === 'number') {
    conds.push(Prisma.sql`j.salary_min <= ${filters.salaryMax}`);
  }

  const term = filters.q?.trim().slice(0, SEARCH_TERM_MAX);
  if (term) {
    const pattern = `%${term}%`;
    conds.push(Prisma.sql`immutable_unaccent(
      lower(coalesce(j.title, '') || ' ' || coalesce(j.description, '') || ' ' || coalesce(j.requirements, ''))
    ) LIKE immutable_unaccent(lower(${pattern}))`);
  }

  return Prisma.join(conds, ' AND ');
}

/**
 * Busca pública de vagas (USP-021 / TD §4.4 `jobs.buscarVagas`). Read-only, sem
 * Server Action (leitura pública). Padrão runbook-search-pagination:
 *
 * - O `WHERE` (on-read + filtros + texto) é resolvido uma vez em SQL parametrizado
 *   ({@link buildWhere}) e usado tanto pela contagem quanto pela seleção da página.
 * - A página é resolvida no banco com `ORDER BY` + `LIMIT/OFFSET` (L-002) — só os ids
 *   da página atual sobem para a aplicação, nunca todos os casados (RP-009/L-001).
 * - Os ids da página são hidratados via `select` tipado → View Model por papel
 *   (anonimização P-001/E-004/E-005), preservando a ordem do banco.
 */
export async function searchJobs(
  filters: SearchJobsFilters,
  viewer: CurrentPerson | null,
): Promise<SearchJobsResult> {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const offset = (page - 1) * SEARCH_PAGE_SIZE;
  const whereSql = buildWhere(filters);

  // Resolve a página (ids ordenados + paginados no banco) e o total com o mesmo WHERE.
  const [pageRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT j.id
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE ${whereSql}
      ORDER BY j.published_at DESC NULLS LAST, j.last_status_change_at DESC, j.created_at DESC
      LIMIT ${SEARCH_PAGE_SIZE} OFFSET ${offset}`),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE ${whereSql}`),
  ]);

  const ids = pageRows.map((row) => row.id);
  const total = Number(countRows[0]?.count ?? 0);

  // Hidrata só os ids da página com o select por papel; reordena conforme a página do banco.
  const rows = ids.length
    ? await prisma.job.findMany({ where: { id: { in: ids } }, select: jobListSelect(viewer !== null) })
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map((row) => viewJobForVisitor(row as JobListRow, viewer));

  return { items, page, pageSize: SEARCH_PAGE_SIZE, total };
}
