# USP-030 — Buscar serviços (tasks)

Sizing: **Large**. NET-NEW. Ordem: índice trgm → query → View Model → UI/rota → testes.

### T030-1 — Migração do índice trgm `service_search_trgm`
- **What:** Migração `20260708170500_usp030_service_search` criando o índice GIN funcional (design §1). Extensões/função já existem.
- **Where:** `prisma/migrations/20260708170500_usp030_service_search/migration.sql`
- **Depends on:** USP-029 T029-1  ·  **Reuses:** `immutable_unaccent`, `pg_trgm` (existem)
- **Done when:** `db reset` aplica; `EXPLAIN` de busca por termo usa o índice.
- **Gate:** `supabase db reset`

### T030-2 — Query `searchServices` + `listServiceCategories`
- **What:** `services/queries/search-services.ts` (on-read `status=ACTIVE AND author.inactivated_at IS NULL`, filtros categoria/preço/região, termo `immutable_unaccent` dos 2 lados incl. join de categoria, ordenação por `published_at`, paginação por page-of-ids + count). `services/queries/list-service-categories.ts` (só categorias aprovadas). Reuso/replicação de `listActiveRegions`.
- **Where:** `src/modules/services/queries/`
- **Depends on:** T030-1  ·  **Reuses:** `search-jobs.ts` (template), `hojeSaoPaulo` não necessário (sem validUntil)
- **Done when:** retorna `{items,page,pageSize,total}`; só ativos; sem `SELECT` de contato.
- **Tests:** int `search-services.int.test.ts`: **AC-030-1** só ACTIVE + ordem por published; **AC-030-2** filtros + paginação; **AC-030-3** termo com/sem acento em título/descrição/categoria; **SVC030-MN-01** exclui não-ACTIVE + prestador inativado; **SVC030-MN-02** row não contém phone/emailLogin.
- **Gate:** `npm run test -- search-services`

### T030-3 — View Model `viewServiceForVisitor`
- **What:** `services/views/service-list-item.view.ts` — projeta `ServiceListItem`; `providerDisplayName` (company vs PF); `coverPhotoUrl` (URL pública 1ª foto); sem contato.
- **Where:** `src/modules/services/views/`
- **Depends on:** T030-2  ·  **Reuses:** padrão `viewJobForVisitor`
- **Done when:** projeção não expõe campo sensível; nome público correto por PF/Empresa.
- **Tests:** unit `service-list-item.view.test.ts`: PF→fullName; Empresa→nomeFantasia; nenhum campo de contato no tipo/saída.
- **Gate:** `npm run test -- service-list-item`

### T030-4 — UI: rota `/servicos` + filtros + cards + disclaimer
- **What:** `src/app/(public)/servicos/page.tsx` (`revalidate=1800`), `components/service-list.tsx`, `service-card.tsx`, `service-search-filters.tsx`, `asoneg-disclaimer.tsx`. Estado vazio. Paginação preservando filtros.
- **Where:** `src/app/(public)/servicos/page.tsx`, `src/modules/services/components/`
- **Depends on:** T030-2, T030-3  ·  **Reuses:** `@/shared/ui`, `vagas/page.tsx` como referência
- **Done when:** lista renderiza, filtra, pagina; disclaimer visível (AC-030-4); vazio sem erro.
- **Tests:** component `services-page.test.tsx`: disclaimer presente (AC-030-4); estado vazio; card sem contato. E2E `e2e/services/search.spec.ts` (público, não autenticado): abre `/servicos`, aplica filtro, busca termo com acento.
- **Gate:** `npm run test -- services-page` + `npm run build`

### T030-5 — Barrel + revalidação de `/servicos`
- **What:** Exportar novos símbolos no `services/index.ts`. Confirmar que a invalidação de cache SERVICE (USP-029 design §2.8) aponta `/servicos`.
- **Where:** `src/modules/services/index.ts` (+ verificar `NextCacheInvalidation`)
- **Depends on:** T030-2..4
- **Gate:** `npm run lint && npm run typecheck`

---

## Test Matrix (USP-030)

| AC / MN | Tipo | Arquivo::caso |
| --- | --- | --- |
| AC-030-1 | int | `search-services.int.test.ts::only-active-ordered` |
| AC-030-2 | int | `search-services.int.test.ts::filters-paginated` |
| AC-030-3 | int | `search-services.int.test.ts::unaccent-textual` |
| AC-030-4 | component | `services-page.test.tsx::disclaimer` |
| SVC030-MN-01 | int | `search-services.int.test.ts::excludes-non-active` |
| SVC030-MN-02 | int/unit | `search-services.int.test.ts::no-contact-leak` + `service-list-item.view.test.ts` |
| SVC030-MN-03 | int | SQL usa LIMIT/OFFSET (assert no plano/ausência de findMany sem take) |
