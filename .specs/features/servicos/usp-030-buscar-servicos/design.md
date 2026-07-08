# USP-030 — Buscar serviços (design)

Espelha `jobs/queries/search-jobs.ts` + `(public)/vagas/page.tsx` + `viewJobForVisitor`. NET-NEW.

## 1. Índice trgm de busca — migração `20260708170500_usp030_service_search`

Extensões `unaccent`/`pg_trgm` e a função `immutable_unaccent` **já existem** (criadas em `..._usp021_job_search_fields`). Só criar o índice funcional (usar `CREATE EXTENSION IF NOT EXISTS`/`CREATE OR REPLACE FUNCTION` defensivamente é opcional):

```sql
CREATE INDEX "service_search_trgm" ON "services"
  USING gin (
    immutable_unaccent(
      lower(coalesce("title", '') || ' ' || coalesce("description", ''))
    ) gin_trgm_ops
  );
```

Categoria **não** entra no índice (é FK/tabela pequena); o match textual em categoria (AC-030-3) é via join na query.

## 2. Query `searchServices(filters, viewer)` — `services/queries/search-services.ts`

Mirror de `searchJobs`. `SERVICE_SEARCH_PAGE_SIZE = 20`. `SearchServicesFilters { q?, categoryId?, regionId?, priceMin?, priceMax?, page? }`.

**`where` on-read (as 2 condições base — diferença chave vs jobs: sem `company.isVerified`, sem `validUntil`):**
```
s.status = 'ACTIVE'
AND author.inactivated_at IS NULL          -- "prestador ativo" (P não inativada)
```
Filtros opcionais AND: `category_id`, `region_id`, overlap de faixa de preço (`price_max >= :min` / `price_min <= :max`), e o termo textual:
```
( immutable_unaccent(lower(coalesce(s.title,'')||' '||coalesce(s.description,''))) LIKE immutable_unaccent(lower('%'||:q||'%'))
  OR immutable_unaccent(lower(sc.name)) LIKE immutable_unaccent(lower('%'||:q||'%')) )
```
(`immutable_unaccent` dos **dois lados** — respeita o índice GIN no par título+descrição; a cláusula de categoria é match por join na tabela pequena `service_categories`.)

**Ordenação (AC-030-1):** `ORDER BY s.published_at DESC NULLS LAST, s.last_status_change_at DESC, s.created_at DESC`.

**Paginação (SVC030-MN-03):** padrão jobs — `$queryRaw` de page-of-ids (`LIMIT/OFFSET`) + `COUNT` compartilhando o mesmo `whereSql`, depois hidratar via `prisma.service.findMany({ where:{ id:{in} }, select: serviceListSelect })`.

**Anti-vazamento (SVC030-MN-02):** o `select` de hidratação **nunca** inclui `author.phone`/`author.emailLogin`. Seleciona `author: { select: { fullName: true } }` (nome é público) e `company: { select: { nomeFantasia: true } }` quando `companyId` setado.

**Nota — rotação anti-bias (TD §4.4):** a "rotação leve dos top 10 com seed" é **deferida** (conflita com o cache ISR e não é AC do PRD; AC-030-1 pede ordenação por data). Documentado; não implementar.

**Nota — filtro "disponibilidade":** não há enum/estrutura de disponibilidade no MVP (`availabilityDescription` é texto livre). O filtro de disponibilidade da UI é **deferido/best-effort**: expor apenas categoria/preço/região (os 3 estruturados) na primeira entrega; disponibilidade permanece campo exibido no detalhe (USP-031). Assumption documentada — evita filtro inerte sobre texto livre.

## 3. View Model de lista — `viewServiceForVisitor(row, viewer)` — `services/views/service-list-item.view.ts`

Projeta `ServiceListItem { id, title, categoryName, regionName, price {min,max,unit}, providerDisplayName, coverPhotoUrl?, publishedAt }`. `providerDisplayName` = `company.nomeFantasia` se `companyId`, senão `author.fullName` (nome público — ADR-0010). **Sem contato.** `coverPhotoUrl` = URL pública do 1º `ServicePhoto` (bucket `provider-photos`).

> Diferença vs jobs: em vagas o nome da Empresa é oculto para anônimo; em **serviços o nome é público para todos** — a barreira U2 é só o **contato** (telefone/e-mail), revelado apenas na manifestação (USP-033/U3). O View Model existe como fonte única, mas não anonimiza o nome.

## 4. UI — rota `(public)/servicos`

`src/app/(public)/servicos/page.tsx` (mirror `vagas/page.tsx`):
- `export const revalidate = 1800;` (ISR; on-demand via `revalidatePath('/servicos')` disparado por `transitionContent` — ver USP-029 design §2.8). Sem `dynamic`.
- `metadata` estática ("Serviços | ASONSEG").
- Server Component: mapeia `searchParams` → `SearchServicesFilters`, `Promise.all([getCurrentPerson(), listServiceCategories(), listActiveRegions()])`, `searchServices(filters, viewer)`. Renderiza `<ServiceSearchFilters>` + `<ServiceList>` + paginação (`pageHref` preserva filtros) + estado vazio.
- **`<AsonsegDisclaimer/>`** (AC-030-4) — componente compartilhado (novo em `services/components/asoneg-disclaimer.tsx` ou `@/shared/ui`), reusado no detalhe (USP-031). Texto: "A ASONSEG é apenas plataforma de conexão: não presta, não intermedia financeiramente e não garante a execução dos serviços anunciados."
- `<ServiceCard>`/`<ServiceList>` (server components) — mirror `JobCard`/`JobList`.
- `<ServiceSearchFilters>` (server component, form GET) — categoria/preço/região.

## 5. Barrel

Adicionar ao `services/index.ts`: `searchServices` (+`SERVICE_SEARCH_PAGE_SIZE`, tipos), `viewServiceForVisitor` (+`ServiceListItem`), `listServiceCategories`, e componentes `ServiceList`/`ServiceCard`/`ServiceSearchFilters`/`AsonsegDisclaimer`.

## Knowledge chain

Resolvido do codebase (search-jobs.ts, vagas route, índice usp021). Sem incerteza pendente.
