# USP-058 — Relatórios legíveis — Design

**Spec**: `.specs/features/ajustes-uat/usp-058-relatorios/spec.md`
**Status**: Done

> **💠 Adapt, don't re-derive.** Toda a arquitetura de relatórios (queries agregadas, projeção única `build-report-rows`, export CSV/PDF com watermark, RBAC por guard de papel, R6 2-barreiras) é da **USP-042** — resolvida e **referenciada**, nunca re-decidida. Ver `../indicadores-relatorios/usp-042-relatorios-operacionais/design.md` §2/§3/§6/§7. Esta remediação toca **apenas** a camada de exibição (projeção) e a UI de filtros.

---

## Architecture Overview

Três correções de **exibição** convergem num único ponto de projeção server-side e num único componente de UI. Nada muda nas queries de agregação, na Server Action de export, no schema Zod ou no RBAC.

```mermaid
graph TD
    Page["(app)/relatorios/[tipo]/page.tsx (server)"] -->|filters + statusOptions/categoryOptions/regionOptions| RV[ReportView (client)]
    Page -->|reportType, filters, viewer| BRR[buildReportRows (server, projeção única)]
    BRR -->|status→PT-BR| RL[report-labels.ts CONTENT_STATUS_LABELS]
    BRR -->|categoryId→name| LSC[listServiceCategories @/modules/services]
    BRR -->|income/housing→PT-BR| PL[INCOME/HOUSING_LABELS @/modules/persons]
    BRR -->|columns+rows PT-BR| RV
    BRR -->|columns+rows PT-BR| EXP[exportReport → toCsv / ReportPdfDocument]
    RV -->|GET form: from/to + selects| Page
    Page -.->|status options| RL
    Page -.->|categoria options| LSC
    Page -.->|região options| LActiveR[listActiveRegions @/modules/jobs]
```

Chave: `buildReportRows` é o **único** lugar que sabe transformar cada relatório em `{columns, rows}` — tela, CSV e PDF consomem a mesma projeção. Traduzir ali corrige as três superfícies de uma vez, sem tocar o serializador (`csv.ts`) nem o PDF (`report-pdf.tsx`). A UI (`ReportView`) recebe as opções de filtro **como props** montadas pela página server — nenhum barrel server é importado no Client Component (**AD-019**).

---

## Approaches Considered (Large — exploração de abordagem)

**Decisão central: ONDE traduzir/resolver os valores.**

| Abordagem | Como | Trade-off | Veredito |
|---|---|---|---|
| **(A) Na projeção única `build-report-rows.ts`** ✅ **recomendada** | Resolver nome de categoria e aplicar rótulos PT-BR ao montar `rows` | Corrige tela+CSV+PDF num ponto; serializador segue agnóstico (`csv.test.ts:92` verde); não toca as queries (int-tests intactos) | **Escolhida** |
| (B) No serializador/`formatCell`/`cellToString` | Mapear por coluna dentro do stringifier | Quebra `csv.test.ts:92` (que exige passagem-crua); acopla o serializador genérico ao domínio; PDF/tela precisariam do mesmo hook duplicado | Rejeitada |
| (C) Nas queries (`report-services.ts` etc.) | Retornar `categoryName`/status traduzido da query | Quebra os int-tests de shape (`{status,categoryId,count}`); mistura exibição com agregação; N queries a mudar | Rejeitada |

**Decisão UI (REL-5): opções via props (server→client), não import client.** A página server monta `statusOptions/categoryOptions/regionOptions` e passa ao `ReportView`. Alternativa (importar os mapas/queries no Client Component) é **rejeitada**: dispara o hazard do **AD-019** (barrel arrasta Prisma p/ o bundle client) e violaria o carve-out client/server.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `buildReportRows` (projeção única) | `src/modules/reporting/queries/build-report-rows.ts` | **Modificar** os cases `jobs`/`services`/`social` — resolver nome de categoria + aplicar rótulos PT-BR |
| `ReportView` (form GET + tabela + export) | `src/modules/reporting/components/report-view.tsx` | **Modificar** — adicionar `<select>` status/categoria/região ao form GET; novas props de opções |
| `[tipo]/page.tsx` (server) | `src/app/(app)/relatorios/[tipo]/page.tsx` | **Modificar** — montar opções de filtro por `reportType` e passar como props (já parseia os 5 `searchParams`) |
| `INCOME_BRACKET_LABELS` / `HOUSING_SITUATION_LABELS` | `src/modules/persons/domain/socioeconomic-record.ts` (barrel `@/modules/persons`) | **Reusar** (import server em build-report-rows) para R6 full — REL-3 |
| `listServiceCategories(): ServiceCategoryOption[]` | `src/modules/services/queries/list-service-categories.ts` (barrel `@/modules/services`) | **Reusar** — opções do select de categoria (R3) **e** `Map<id,name>` para resolver nomes em build-report-rows |
| `listActiveRegions(): RegionOption[]` | `src/modules/jobs/queries/list-active-regions.ts` (barrel `@/modules/jobs`) | **Reusar** — opções do select de região (R6) |
| `STATUS_LABEL` (services, masculino) | `src/modules/services/views/provider-service-row.view.ts:5` | **Referência de valores** (não import): os rótulos de `CONTENT_STATUS_LABELS` são idênticos — "não inventa rótulo" (spec A1) |
| `ContentStatus` (enum de tipo) | `src/modules/moderation/domain/content-status.ts` (barrel `@/modules/moderation`) | **Reusar** — `import type` para tipar `Record<ContentStatus,string>` (type-only, client-safe) |
| `formatCell` / `cellToString` (null→"—") | `report-view.tsx:36` / `csv.ts:71` | **Referência** — marcador "—" e agnosticismo do serializador preservados (REL-3 A7/A14) |

### Integration Points

| System | Integration Method |
| --- | --- |
| `exportReport` (Server Action) | **Inalterada** — consome `buildReportRows`; recebe automaticamente a projeção já traduzida (watermark/ciência/audit intactos) |
| `reportFiltersSchema` (Zod) | **Inalterado** — já aceita `status`/`categoryId`/`regionId`; a UI só passa a preenchê-los |
| `searchParams` da rota `[tipo]` | **Inalterado** — já parseia os 5 filtros (linhas 60-66); os novos `<select>` alimentam os mesmos campos GET |
| Barrel `@/modules/reporting` | **Estendido** — exporta `CONTENT_STATUS_LABELS` (consumido pela página server) |

---

## Components

### `report-labels.ts` (NOVO)

- **Purpose**: fonte canônica dos rótulos PT-BR de `ContentStatus` para os relatórios + rótulo do marcador de manifestações; client-safe (só consts + `import type`).
- **Location**: `src/modules/reporting/domain/report-labels.ts`
- **Interfaces**:
  - `CONTENT_STATUS_LABELS: Record<ContentStatus, string>` — 9 valores, forma masculina (spec A1), idêntica ao map de `services` view.
  - `MANIFESTATIONS_STATUS_LABEL: string` = `"Manifestações de interesse"`.
  - `labelContentStatus(value: string): string` — `CONTENT_STATUS_LABELS[value as ContentStatus] ?? value` (fallback = token, nunca crash — spec USP058-15).
- **Dependencies**: `import type { ContentStatus } from '@/modules/moderation'` (type-only; sem IO).
- **Reuses**: valores idênticos ao `STATUS_LABEL` de `provider-service-row.view.ts` (não inventa rótulo).

### `build-report-rows.ts` (MODIFICAR)

- **Purpose**: projeção única `{columns, rows}` — passa a resolver **nome de categoria** (REL-2) e aplicar **rótulos PT-BR** (REL-3).
- **Location**: `src/modules/reporting/queries/build-report-rows.ts`
- **Interfaces** (assinatura pública `buildReportRows(reportType, filters, viewer)` **inalterada**):
  - case `jobs`: `status` → `labelContentStatus(r.status)`.
  - case `services`: carrega `listServiceCategories()` → `Map<id,name>`; row `categoria = nameMap.get(r.categoryId) ?? '—'`; `status → labelContentStatus`; linha sintética `status = MANIFESTATIONS_STATUS_LABEL`, `categoria = '—'`. Coluna passa de `{key:'categoryId'}` para `{key:'categoria', label:'Categoria'}`.
  - case `social` (ramo `full`): `categoria` de renda → `INCOME_BRACKET_LABELS[bracket] ?? bracket`; de moradia → `HOUSING_SITUATION_LABELS[situation] ?? situation`. Ramo `stripped` inalterado (só região+total).
- **Dependencies**: `labelContentStatus`/`CONTENT_STATUS_LABELS`/`MANIFESTATIONS_STATUS_LABEL` (report-labels); `listServiceCategories` (`@/modules/services`); `INCOME_BRACKET_LABELS`/`HOUSING_SITUATION_LABELS` (`@/modules/persons`). Todos server-side.
- **Reuses**: a estrutura de cada case; o marcador "—" (A7).

### `report-view.tsx` (MODIFICAR)

- **Purpose**: adicionar os `<select>` de status/categoria/região ao form GET, **gated** pela presença da prop de opções.
- **Location**: `src/modules/reporting/components/report-view.tsx`
- **Interfaces**: props estendidas — `statusOptions?: FilterOption[]`, `categoryOptions?: FilterOption[]`, `regionOptions?: FilterOption[]` (`FilterOption = { value: string; label: string }`). Cada `<select name="…">` só renderiza quando a respectiva prop existe; `defaultValue={filters.x}`; primeira opção "Todos/Todas" com `value=""`.
- **Dependencies**: `@/shared/ui` (Label/Button existentes); os inputs `from`/`to` e o fluxo de export permanecem intactos.
- **Reuses**: o `<form method="get">` nativo (o browser serializa os `<select>` nomeados → a rota reprocessa via `searchParams`).

### `[tipo]/page.tsx` (MODIFICAR)

- **Purpose**: montar as opções de filtro por `reportType` e passá-las ao `ReportView`.
- **Location**: `src/app/(app)/relatorios/[tipo]/page.tsx`
- **Interfaces**: por `reportType` — `jobs` → `statusOptions = Object.entries(CONTENT_STATUS_LABELS).map(([value,label]) => ({value,label}))`; `services` → `categoryOptions = (await listServiceCategories()).map(c => ({value:c.id,label:c.name}))`; `social` → `regionOptions = (await listActiveRegions()).map(r => ({value:r.id,label:r.name}))`. Os demais tipos: nenhuma opção extra (só período — R2/R4/R5).
- **Dependencies**: `CONTENT_STATUS_LABELS` (`@/modules/reporting`), `listServiceCategories` (`@/modules/services`), `listActiveRegions` (`@/modules/jobs`).
- **Reuses**: o parsing de `searchParams` (já presente); a chamada `buildReportRows`.

### `index.ts` (MODIFICAR — barrel)

- Exportar `CONTENT_STATUS_LABELS` (+ `labelContentStatus`/`MANIFESTATIONS_STATUS_LABEL` se úteis a testes) de `./domain/report-labels`.

---

## Data Models

Nenhum. **Zero migração, zero dep nova.** Reusa os enums Prisma existentes (`ContentStatus`, `IncomeBracket`, `HousingSituation`) e a entidade `ServiceCategory` (campo `name @unique` já presente). `FilterOption` é um tipo de view local (`{value,label}`), não persistido.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| `categoryId` órfão (categoria removida) | `nameMap.get(id) ?? '—'` | Célula "—"; sem erro |
| `status` fora do mapa (enum novo) | `labelContentStatus` → fallback token; teste de completude falha no CI | Runtime não quebra; divergência barrada no merge |
| `categoryId`/`regionId` inválido na URL | `reportFiltersSchema` já rejeita (`VALIDATION`) — inalterado | Mensagem de validação atual |
| Período sem dados | Projeção vazia (edge USP-042 preservada); export só com cabeçalhos | Lista vazia, sem erro |
| Opções de categoria/região vazias (nenhuma cadastrada) | `<select>` só com "Todas" | Filtro sem efeito; lista tudo |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Importar barrel server (`@/modules/persons`, mapas/queries) num Client Component arrasta Prisma p/ o bundle (**AD-019**) | `report-view.tsx` (client) | Quebra de build / bundle inchado | Opções resolvidas **na página server** e passadas como **props**; `ReportView` só renderiza props (nenhum barrel server importado no client) |
| `report-services.int.test.ts` afirma shape exato `{status,categoryId,count}` da **query** | `src/modules/reporting/__tests__/report-services.int.test.ts` | Falso quebra se mudarmos a query | Resolver nome **em build-report-rows**, não em `report-services.ts` (A4) → a query e seu int-test ficam intactos |
| `csv.test.ts` afirma que `cellToString` **não** altera enum/UUID (passagem-crua + anti-injeção CWE-1236) | `src/modules/reporting/__tests__/csv.test.ts:92` | Falso quebra se traduzirmos no serializador | Traduzir **upstream** (build-report-rows); serializador segue agnóstico → `csv.test.ts` vira **teste negativo** do USP058-MN-01/14 |
| Selects renderizados para dimensões que a query ignora (controle inerte) | `report-view.tsx` / `page.tsx` | Usuário filtra e nada muda | Gating por presença de prop (A5): status→R1, categoria→R3, região→R6 apenas |
| Divergência de gênero entre o map de reporting (masc.) e o de jobs (fem.) | `report-labels.ts` vs `company-job-row.view.ts` | Inconsistência visual entre relatório e painel de vagas | Aceito e documentado (A1): report Status é coluna genérica; consolidação futura fora de escopo |

> Nenhum concern de segurança/perf novo: as mudanças são display-only; RBAC, watermark, ciência e auditoria permanecem no caminho da Server Action de export, intocados.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Onde traduzir/resolver | `build-report-rows.ts` (projeção única) | Corrige tela+CSV+PDF num ponto; serializador agnóstico; queries e seus int-tests intactos |
| Mapa de `ContentStatus` | Novo em `reporting/domain` (masc.), aditivo | Nenhum map exportado hoje; não tocar os privados de jobs/services (risco de teste) — spec A1/A2 |
| Renda/moradia | Reusar `@/modules/persons` (server) | Já exportados, canônicos — spec A3 |
| Nome da categoria | `listServiceCategories()` → `Map` em build-report-rows | Reusa query de opções; sem alterar a query de agregação — spec A4 |
| Opções de filtro | Montadas na página server, passadas como props | Evita hazard AD-019 (barrel→Prisma no client) — spec A6 |
| Filtros por relatório | status→R1, categoria→R3, região→R6 (gated) | Só o que a query honra; sem controle inerte; "só UI" (REL-5) — spec A5 |

> **Project-level decisions:** nenhuma nova convenção de projeto (AD-NNN) — a remediação conforma às decisões ativas (AD-019 carve-out client/server; USP-042 contratos de export/RBAC). Decisões locais ficam nesta tabela.
