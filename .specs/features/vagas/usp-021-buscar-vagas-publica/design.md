# USP-021 — Buscar vagas (pública) — Design

> **Modo ICE (thin adapter).** Resolve TD §4.4/§4.5 + ADRs + runbooks para o concreto do código.
> Padrões de referência: `jobs/queries/list-approved-job-areas.ts` (query read-only),
> `consents/views/own-consents.view.ts` (View Model puro), `reporting/views/access-report.view.ts`
> (View Model async com recorte de privacidade), `moderation/adapters/next-cache-invalidation.ts`
> (revalidação on-demand de `/vagas` — **já cabeado**), `identity/server/session.ts` (`getCurrentPerson`).

## 0. Reconciliação (TD doc × schema implementado)

- **`content_items`/`content_transitions` não existem** — o `status` mora na própria entidade `Job` (coluna `ContentStatus`), histórico em `audit_log` (ADR-0023). A busca filtra **on-read** sobre `Job.status` direto. Ver [[td-content-items-nao-implementado]].
- **O `Job` da USP-020 divergiu do TD §4.5** — simplificou para `salary`/`location`/`workRegime` freetext, sem `educationLevelRequired`/`contractType`/`salaryMin-Max`/`salaryVisible`/`regionId`. **AD-011 (kickoff 2026-06-20):** estender ao contrato canônico do TD §4.5 nesta USP (§1 abaixo).
- **Cache de `/vagas` já está cabeado:** `NextCacheInvalidation.publicPathsFor(JOB) → ['/vagas']` é chamado por `transitionContent` quando uma vaga entra/sai de `ACTIVE`. A rota só precisa existir e exportar `revalidate` (ADR-0019).
- **`Region` já existe** (`prisma/schema.prisma:59`) — só relacionada a `ProviderProfile`; adicionar relação reversa `Region.jobs`.
- **`Company.isVerified` já existe** (`:359`, USP-017) — usado no filtro on-read (P-005).
- **Rate limiting já existe** no middleware (`RATE_LIMIT_DISABLED` em `shared/env.ts`) — cobre L-003 para a rota pública sem trabalho novo.

## 1. Modelo de dados — extensão do `Job` (migração, AD-011)

Estender `model Job` em `prisma/schema.prisma` ao contrato do TD §4.5. Colunas **novas opcionais/com default** para não quebrar vagas existentes (mesmo padrão nullable da USP-020):

```prisma
model Job {
  // … colunas existentes (USP-020) …
  educationLevelRequired String?   @map("education_level_required")   // freetext (espelha CandidateProfile.educationLevel — sem enum no MVP)
  contractType           String?   @map("contract_type")              // CLT, PJ, MEI… (string livre; enum quando D-007 fechar)
  salaryMin              Decimal?  @map("salary_min") @db.Decimal(10, 2)
  salaryMax              Decimal?  @map("salary_max") @db.Decimal(10, 2)
  salaryVisible          Boolean   @default(true) @map("salary_visible")
  regionId               String?   @map("region_id") @db.Uuid          // FK Region (opcional p/ não quebrar seed; UI exige no submit)

  region Region? @relation(fields: [regionId], references: [id])

  // índices p/ a busca (L-001 / RP-009)
  @@index([status, validUntil])               // filtro on-read (E-001/P-003)
  @@index([areaId, regionId, status])         // filtros combinados (E-002)
}
```

- **`salary` freetext legado:** mantido por compat; `salaryMin/Max/Visible` são a fonte para filtro de faixa e edge `salaryVisible`. (Migração pode marcar `salary` como deprecado em comentário; não remover nesta USP.)
- **`contractType`/`regionId` opcionais:** TD os tem NOT NULL, mas vagas seedadas/existentes não têm valor → manter **nullable** + backfill no seed; o `JobForm` (USP-020) passa a exigi-los no submit via Zod. Decisão **AD-1** (confirmar no PR).
- **`Region.jobs Job[]`** — relação reversa nova.
- **Migração SQL bruto adicional:** habilitar busca sem acento (§3).

## 2. Extensão `unaccent` + índice funcional (migração, E-003)

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- índice funcional p/ match case-insensitive sem acento sobre título+descrição+requisitos
CREATE INDEX job_search_trgm ON jobs
  USING gin (immutable_unaccent(lower(coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(requirements,''))) gin_trgm_ops);
```

- `unaccent()` do Postgres **não é IMMUTABLE** por padrão → criar wrapper `immutable_unaccent(text)` marcado `IMMUTABLE` para poder indexar (gotcha conhecido). Verificar via Context7/docs do Postgres na implementação.
- **Query:** `WHERE immutable_unaccent(lower(title)) LIKE immutable_unaccent(lower($term))` (idem description/requirements em OR), `$term` = `%termo%`. Filtra **no DB** (respeita `take`, runbook-search-pagination).
- Como Prisma não expressa `unaccent` nativamente, usar **`prisma.$queryRaw`** (parametrizado, anti-injeção) na query de busca, ou `Prisma.sql` com fragmentos. Decisão **AD-2** (raw query parametrizada).

## 3. Query de busca — `jobs.buscarVagas` (TD §4.4)

`src/modules/jobs/queries/search-jobs.ts` (read-only; **sem** Server Action — leitura pública).

```ts
export interface SearchJobsFilters {
  q?: string;                 // busca textual (E-003)
  areaId?: string;
  educationLevel?: string;
  contractType?: string;
  workRegime?: string;
  regionId?: string;
  salaryMin?: number;         // faixa (E-002)
  salaryMax?: number;
  page?: number;
}
export interface SearchJobsResult { items: JobListItem[]; page: number; pageSize: number; total: number; }

export async function searchJobs(filters, viewer: CurrentPerson | null): Promise<SearchJobsResult>
```

Padrão **runbook-search-pagination**:
1. **On-read obrigatório (E-001/P-003/P-005):** `status = ACTIVE` **AND** `validUntil >= hojeSP()` **AND** `company.isVerified = true`. Fonte da verdade é a query, não o job de expiração.
2. **Filtros em AND (E-002):** todos aplicados juntos — `areaId`, `educationLevelRequired`, `contractType`, `workRegime`, `regionId`, faixa `salaryMin/Max` (overlap de intervalo). Cada filtro é opcional; ausente = não restringe.
3. **Busca textual (E-003):** `unaccent` (§2) sobre título+descrição+requisitos.
4. **Ordenação:** `publishedAt DESC` (mais recente primeiro, E-001). Fallback `lastStatusChangeAt`/`createdAt` p/ vagas sem `publishedAt`.
5. **Paginação (L-002):** `take = PAGE_SIZE` (tunável, ex. 20) + `skip`. `total` via `count` com o mesmo `where`.
6. **`select` explícito** — só os campos do View Model (sem `SELECT *`, sem vazar entidade crua nem dados da Empresa além do permitido). Inclui `company.{ name, sector/segmento, isVerified }` para o View Model decidir a anonimização.
7. **Mapear cada row para `JobListItem` via View Model por papel** (§4).

**Helper `hojeSP()`:** não existe em `shared/lib` — criar `hojeSaoPaulo(): Date` (data, sem hora, em America/Sao_Paulo) em `shared/lib/time.ts` reusando `date-fns-tz` (ou passar `new Date()` à query e normalizar lá). Decisão **AD-3**.

## 4. View Models por papel (runbook-view-model-visibility, ADR-0022/ADR-0017)

`src/modules/jobs/views/job-list-item.view.ts` — **anonimização no serializer, nunca no template** (P-001/E-004):

```ts
export interface JobListItem {
  id: string; title: string;
  area: string | null; educationLevel: string | null;
  contractType: string | null; workRegime: string | null;
  region: string | null;
  salary: { min: number | null; max: number | null } | null;   // null se salaryVisible=false
  publishedAt: Date | null;
  company: { displayName: string; isAnonymized: boolean };       // anônimo → "Empresa do setor de X"
}

export function viewJobForVisitor(row, viewer: CurrentPerson | null): JobListItem
```

Regras:
- **Anônimo (`viewer === null`):** `company.displayName = "Empresa do setor de " + setor`, `isAnonymized = true`. **Nunca** o nome real — em nenhum campo (E-004/P-001). Como descrição/requisitos podem repetir o nome (F1), a anonimização cosmética é complementada pela **moderação humana** (ADR-0028); o View Model garante que o **campo estruturado** `company.name` jamais sai.
- **Autenticado:** `company.displayName = company.name`, `isAnonymized = false` (E-005).
- **`salaryVisible = false`:** `salary = null` para ambos os papéis (edge do issue).
- **P-004:** o View Model nunca inclui contato, dados de responsáveis, nem `companyId` cru para anônimo.
- **Teste obrigatório por papel:** "anônimo NÃO vê `company.name`" + "autenticado vê".

> **SEO/OG/JSON-LD (E-004):** a página de **lista** não expõe nome de Empresa nos metadados. O detalhe (USP-022) é quem terá OG/JSON-LD por vaga — lá a mesma regra de serializer se aplica (escopo da USP-022, fora daqui).

## 5. UI pública — rota `(public)/vagas` (ISR, ADR-0019)

`src/app/(public)/vagas/page.tsx` (Server Component) + componentes em `src/modules/jobs/components/`.

- **`export const revalidate = 1800`** (30min, listagens — ver comentário do `(public)/layout.tsx`); revalidação on-demand já cabeada (`revalidatePath('/vagas')` na transição de moderação).
- Filtros via **searchParams** (`?area=&regime=&regiao=&q=&pagina=`) — URL compartilhável, compatível com ISR/SSR. Server Component lê `searchParams`, chama `searchJobs`, passa `getCurrentPerson()` p/ decidir anonimização.
- **P-002 (não opressivo):** 2-3 filtros prioritários visíveis (**área + regime/região**) + "Mais filtros" expansível (escolaridade, contrato, faixa salário). Mobile-first (público com baixo letramento — RNF 6.5).
- Lista de cards: título, área, região, regime, salário (se visível), Empresa (anonimizada p/ anônimo), data. Card linka p/ detalhe (USP-022, rota a existir).
- Estado vazio ("nenhuma vaga encontrada") + paginação.
- Selects de filtro carregam taxonomias: `listApprovedJobAreas` (existe), `Region` ativas (nova query simples `listActiveRegions`), valores distintos de contrato/regime (constantes ou distinct).

## 6. Fora de escopo (downstream — não implementar aqui)

- **Detalhe da vaga** (página individual, OG/JSON-LD por vaga) → USP-022.
- **Expiração automática por job/cron** → USP-024 (aqui só o filtro on-read que torna a expiração robusta a atraso de job — P-003).
- **Candidatura** → USP-025.
- **Busca semântica/FTS/stemming** → V2 (decisão PO; F3 do intent). MVP = match exato sem acento.

## 7. Decisões abertas (confirmar com Tech Lead no PR)

- **AD-1:** `contractType`/`regionId` **nullable** no schema (TD os tem NOT NULL) + backfill no seed + obrigatórios no Zod de submit do `JobForm`. ✔ recomendado (não quebra vagas existentes).
- **AD-2:** busca textual via `prisma.$queryRaw` parametrizado com `immutable_unaccent` (vs. coluna derivada normalizada). ✔ recomendado (sem coluna a manter; índice funcional GIN/trgm).
- **AD-3:** novo helper `hojeSaoPaulo()` em `shared/lib/time.ts` para o filtro on-read. ✔ recomendado.
- **AD-4:** reabrir o `JobForm` (USP-020) para coletar os 5 campos novos é parte desta US (toca #165). Confirmar que não há PR aberto conflitante de USP-020.
- **AD-5:** faixa salarial filtra por **overlap** de intervalo (`salaryMax >= filtro.min AND salaryMin <= filtro.max`), tratando nulls. Confirmar semântica com o dono.
