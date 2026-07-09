import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';
import { viewServiceForVisitor, type ServiceListItem, type ServiceListRow } from '../views/service-list-item.view';

/** Tamanho de página da busca pública (SVC030-MN-03 — `take`/`LIMIT` obrigatório). */
export const SERVICE_SEARCH_PAGE_SIZE = 20;

/** Teto de caracteres do termo de busca (endpoint público anônimo — espelha jobs). */
export const SERVICE_SEARCH_TERM_MAX = 100;

/** Filtros da busca pública de serviços (USP-030 / AC-030-2). Todos opcionais (AND lógico). */
export interface SearchServicesFilters {
  q?: string; // busca textual sem acento (AC-030-3)
  categoryId?: string;
  regionId?: string;
  priceMin?: number; // faixa: piso desejado
  priceMax?: number; // faixa: teto desejado
  page?: number;
}

export interface SearchServicesResult {
  items: ServiceListItem[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * `select` explícito (P-004 — least privilege): **nunca** inclui `phone`/
 * `emailLogin` do autor (SVC030-MN-02) — o campo nem é carregado, defesa
 * contra vazamento no payload RSC/Flight.
 */
const serviceListSelect = {
  id: true,
  title: true,
  priceMin: true,
  priceMax: true,
  priceUnit: true,
  publishedAt: true,
  category: { select: { name: true } },
  region: { select: { name: true } },
  author: { select: { fullName: true } },
  company: { select: { nomeFantasia: true } },
  photos: { select: { storagePath: true }, orderBy: { position: 'asc' as const }, take: 1 },
} satisfies Prisma.ServiceSelect;

/**
 * Monta as condições SQL da busca (on-read + filtros AND + texto), compartilhadas pela
 * contagem e pela página. Tudo parametrizado via `Prisma.sql` (anti-injeção). Fonte
 * única do `WHERE` — evita drift entre `count` e `findMany`. Espelha `search-jobs.ts`,
 * mas SEM `company.isVerified` (verificação de Empresa é exclusiva de vagas) e SEM
 * `validUntil` (serviço não expira).
 *
 * 1. On-read obrigatório (AC-030-1/SVC030-MN-01): `ACTIVE` **AND** prestador ativo
 *    (`author.inactivated_at IS NULL`).
 * 2. Filtros em AND (AC-030-2): categoria, região, faixa de preço por overlap.
 * 3. Busca textual sem acento (AC-030-3): `immutable_unaccent` sobre título+descrição
 *    (índice `service_search_trgm`) OU `category_id` casando um subselect sobre o
 *    nome da categoria — ambos os ramos são predicados de `services`, o que permite
 *    ao planner combinar índices via BitmapOr em vez do `OR` bloquear o GIN trgm
 *    quando comparava a relação juntada `service_categories.name` (F4, review PR #284).
 */
function buildWhere(filters: SearchServicesFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [
    Prisma.sql`s.status = 'ACTIVE'`,
    Prisma.sql`author.inactivated_at IS NULL`,
  ];

  if (filters.categoryId) conds.push(Prisma.sql`s.category_id = ${filters.categoryId}::uuid`);
  if (filters.regionId) conds.push(Prisma.sql`s.region_id = ${filters.regionId}::uuid`);
  // Faixa de preço por overlap: o serviço casa se seu intervalo cruza o filtro.
  // Serviços sem faixa (NULL) são excluídos quando há filtro (intervalo desconhecido não satisfaz).
  if (typeof filters.priceMin === 'number') {
    conds.push(Prisma.sql`s.price_max >= ${filters.priceMin}`);
  }
  if (typeof filters.priceMax === 'number') {
    conds.push(Prisma.sql`s.price_min <= ${filters.priceMax}`);
  }

  const term = filters.q?.trim().slice(0, SERVICE_SEARCH_TERM_MAX);
  if (term) {
    const pattern = `%${term}%`;
    conds.push(Prisma.sql`(
      immutable_unaccent(lower(coalesce(s.title, '') || ' ' || coalesce(s.description, '')))
        LIKE immutable_unaccent(lower(${pattern}))
      OR s.category_id IN (
        SELECT id FROM service_categories
        WHERE immutable_unaccent(lower(name)) LIKE immutable_unaccent(lower(${pattern}))
      )
    )`);
  }

  return Prisma.join(conds, ' AND ');
}

/**
 * Busca pública de serviços (USP-030). Read-only, sem Server Action (leitura
 * pública). Padrão runbook-search-pagination (espelha `searchJobs`):
 *
 * - O `WHERE` (on-read + filtros + texto) é resolvido uma vez em SQL parametrizado
 *   ({@link buildWhere}) e usado tanto pela contagem quanto pela seleção da página.
 * - A página é resolvida no banco com `ORDER BY` + `LIMIT/OFFSET` (SVC030-MN-03) — só
 *   os ids da página atual sobem para a aplicação.
 * - Os ids da página são hidratados via `select` tipado (sem contato) → View Model.
 */
export async function searchServices(
  filters: SearchServicesFilters,
  viewer: CurrentPerson | null,
): Promise<SearchServicesResult> {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const offset = (page - 1) * SERVICE_SEARCH_PAGE_SIZE;
  const whereSql = buildWhere(filters);

  const [pageRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT s.id
      FROM services s
      JOIN persons author ON author.id = s.author_person_id
      WHERE ${whereSql}
      ORDER BY s.published_at DESC NULLS LAST, s.last_status_change_at DESC, s.created_at DESC
      LIMIT ${SERVICE_SEARCH_PAGE_SIZE} OFFSET ${offset}`),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM services s
      JOIN persons author ON author.id = s.author_person_id
      WHERE ${whereSql}`),
  ]);

  const ids = pageRows.map((row) => row.id);
  const total = Number(countRows[0]?.count ?? 0);

  const rows = ids.length
    ? await prisma.service.findMany({ where: { id: { in: ids } }, select: serviceListSelect })
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null)
    .map((row) => viewServiceForVisitor(row as ServiceListRow, viewer));

  return { items, page, pageSize: SERVICE_SEARCH_PAGE_SIZE, total };
}
