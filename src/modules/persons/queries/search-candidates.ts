import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { prisma } from '@/shared/lib/prisma';
import { viewCandidateForSearch, type SearchCandidateView } from '../views/view-candidate-for-search';

/** Tamanho de página da busca de candidatos (L-002 — `take` obrigatório, USP028-MN-04). */
export const SEARCH_PAGE_SIZE = 20;

/** Teto de caracteres do termo de busca (mesmo teto defensivo de `search-jobs`). */
export const SEARCH_TERM_MAX = 100;

/** Filtros da busca ativa de candidatos (USP-028 / E-002). Todos opcionais (AND lógico). */
export interface SearchCandidatesFilters {
  q?: string; // busca textual sem acento sobre headline/skills/courses/experience
  areaId?: string;
  educationLevel?: string;
  availability?: string; // unaccent contains (texto livre)
  regionId?: string;
  page?: number;
}

export interface SearchCandidatesResult {
  items: SearchCandidateView[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Monta as condições SQL da busca (gate on-read + filtros AND + texto), compartilhadas
 * pela contagem e pela página. Tudo parametrizado via `Prisma.sql` (anti-injeção).
 * Fonte única do `WHERE` — evita drift entre `count` e a seleção da página.
 *
 * 1. Gate on-read obrigatório (USP028-MN-03): perfil `ACTIVE` **e** Pessoa `ATIVO`.
 *    Exclui DRAFT/IN_MODERATION/REJECTED/ARCHIVED/INACTIVATED e Pessoa INATIVO.
 * 2. Filtros em AND (E-002): área, escolaridade (igualdade), região (igualdade),
 *    disponibilidade (`unaccent` contains, texto livre).
 * 3. Busca textual sem acento sobre headline+skills+courses+experience (não sensíveis),
 *    mesma técnica/índice (`immutable_unaccent`) de `search-jobs.ts` (USP-021).
 */
function buildWhere(filters: SearchCandidatesFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [
    Prisma.sql`cp.publication_status = 'ACTIVE'`,
    Prisma.sql`p.status = 'ATIVO'`,
  ];

  if (filters.areaId) conds.push(Prisma.sql`cp.primary_area_of_interest_id = ${filters.areaId}::uuid`);
  if (filters.educationLevel) conds.push(Prisma.sql`cp.education_level = ${filters.educationLevel}`);
  if (filters.regionId) conds.push(Prisma.sql`cp.region_id = ${filters.regionId}::uuid`);

  if (filters.availability?.trim()) {
    const pattern = `%${filters.availability.trim()}%`;
    conds.push(Prisma.sql`immutable_unaccent(lower(coalesce(cp.availability, ''))) LIKE immutable_unaccent(lower(${pattern}))`);
  }

  const term = filters.q?.trim().slice(0, SEARCH_TERM_MAX);
  if (term) {
    const pattern = `%${term}%`;
    conds.push(Prisma.sql`immutable_unaccent(
      lower(coalesce(cp.headline, '') || ' ' || coalesce(cp.skills_text, '') || ' ' || coalesce(cp.courses_text, '') || ' ' || coalesce(cp.experience_text, ''))
    ) LIKE immutable_unaccent(lower(${pattern}))`);
  }

  return Prisma.join(conds, ' AND ');
}

/**
 * `select` explícito (USP028-MN-01) — carrega **só** campos não sensíveis do
 * candidato (mais `person.fullName`, usado **apenas** para derivar o primeiro
 * nome no View Model — nunca emitido). `cpf`/`emailLogin`/`phone`/`fullAddress`/
 * `cvStoragePath` NUNCA aparecem aqui: estruturalmente impossível vazá-los.
 */
const candidateSearchSelect = {
  personId: true,
  headline: true,
  skillsText: true,
  educationLevel: true,
  availability: true,
  primaryAreaOfInterest: { select: { name: true } },
  region: { select: { name: true, cityName: true } },
  person: { select: { fullName: true } },
} satisfies Prisma.CandidateProfileSelect;

/**
 * Busca ativa de candidatos pela Empresa (USP-028 / CAN-04). Read-only — leitura
 * **não sensível** (sem candidatura prévia), por isso sem auditoria (ver
 * spec.md Out of Scope). Padrão runbook-search-pagination (mesmo de `search-jobs.ts`):
 *
 * - Authz: só responsável de Empresa (`FORBIDDEN` senão — USP028-08).
 * - O `WHERE` (gate on-read + filtros + texto) é resolvido uma vez em SQL
 *   parametrizado ({@link buildWhere}) e usado tanto pela contagem quanto pela
 *   seleção da página — fonte única, sem drift entre `count` e `findMany`.
 * - A página é resolvida no banco (`ORDER BY created_at DESC` + `LIMIT/OFFSET`,
 *   L-002) — só os ids da página atual sobem para a aplicação.
 * - Os ids são hidratados via `select` não sensível → `viewCandidateForSearch`
 *   (USP028-MN-01/MN-02/MN-05 — o candidato nunca sai como linha crua).
 */
export async function searchCandidates(
  filters: SearchCandidatesFilters,
  viewer: CurrentPerson,
): Promise<ActionResult<SearchCandidatesResult>> {
  if (!viewer.roles.includes('COMPANY_RESPONSIBLE')) {
    return fail('FORBIDDEN', 'Você não tem permissão para buscar candidatos.');
  }

  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const offset = (page - 1) * SEARCH_PAGE_SIZE;
  const whereSql = buildWhere(filters);

  const [pageRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ person_id: string }[]>(Prisma.sql`
      SELECT cp.person_id
      FROM candidate_profiles cp
      JOIN persons p ON p.id = cp.person_id
      WHERE ${whereSql}
      ORDER BY cp.created_at DESC
      LIMIT ${SEARCH_PAGE_SIZE} OFFSET ${offset}`),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM candidate_profiles cp
      JOIN persons p ON p.id = cp.person_id
      WHERE ${whereSql}`),
  ]);

  const ids = pageRows.map((row) => row.person_id);
  const total = Number(countRows[0]?.count ?? 0);

  // Hidrata só os ids da página com o select não sensível; reordena conforme o banco.
  const rows = ids.length
    ? await prisma.candidateProfile.findMany({
        where: { personId: { in: ids } },
        select: candidateSearchSelect,
      })
    : [];
  const byId = new Map(rows.map((row) => [row.personId, row]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map((row) =>
      viewCandidateForSearch({
        personId: row.personId,
        fullName: row.person.fullName,
        headline: row.headline,
        skillsText: row.skillsText,
        educationLevel: row.educationLevel,
        availability: row.availability,
        primaryAreaOfInterest: row.primaryAreaOfInterest,
        region: row.region,
      }),
    );

  return ok({ items, page, pageSize: SEARCH_PAGE_SIZE, total });
}
