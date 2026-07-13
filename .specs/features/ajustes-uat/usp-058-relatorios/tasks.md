# USP-058 — Relatórios legíveis — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tarefas com a skill **`idsd-spec-driven`**: **ative-a pelo nome** e siga o fluxo Execute + as Critical Rules (ciclo por task, gate, commit atômico, sub-agentes, Verifier independente, sensor de discriminação). Os testes-fonte (facts red) derivam dos ACs via **`skill-tdad`** (ative pelo nome na fase de teste de cada task). Não busque arquivos de skill por caminho.

**Se a skill não ativar, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/ajustes-uat/usp-058-relatorios/design.md`
**Status**: Done

---

## 💠 Entry Gate — LIVRE

Reavaliadas as Assumptions & Open Questions do spec: **todos os 8 itens são owner `agent`** (discricionários, dentro das premissas invioláveis), **nenhum** com owner externo pendente do qual a implementação dependa. **Open questions: none.** → A feature **entra** em task breakdown.

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas: `CLAUDE.md` (§Testing Requirements: unit domínio 90%; integração em Server Actions/queries sensíveis; happy/validation/permission), `vitest.config.ts` + `vitest.integration.config.ts`, `package.json` scripts. Padrão do módulo: `src/modules/reporting/__tests__/*.{test.ts,test.tsx,int.test.ts}`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Domínio — mapa de rótulos (`report-labels.ts`) | unit | Guard de completude (1:1 `ContentStatus`); rótulos PT-BR; fallback `?? token` | `src/modules/reporting/__tests__/report-labels.test.ts` | `npm run test` |
| Projeção — `build-report-rows.ts` (queries + `serviceCategory`/social view via Postgres) | integration | R3 nome de categoria (+ nulo/manifestações → "—"); R1/R3 status PT-BR; R6 full renda/moradia PT-BR; período vazio | `src/modules/reporting/__tests__/build-report-rows.int.test.ts` | `npm run test:integration` |
| Componente — `report-view.tsx` (client, RTL) | unit | Selects presentes/ausentes por prop; pré-seleção; chamada de `exportReport` + inputs `from`/`to` preservados | `src/modules/reporting/__tests__/report-view.test.tsx` | `npm run test` |
| Página — `(app)/relatorios/[tipo]/page.tsx` (jsdom, `ReportView` mockado) | unit | Opções corretas por `reportType` (status→jobs, categoria→services, região→social; nada nos demais) | `src/app/(app)/relatorios/[tipo]/page.test.tsx` | `npm run test` |

**Preservados (testes negativos de regressão — devem permanecer verdes, sem enfraquecer):** `export-report.test.ts`, `export-report.int.test.ts`, `report-pdf.test.tsx`, `csv.test.ts`, `social-report.int.test.ts`, `report-access.test.ts`, `report-services.int.test.ts`, `report-jobs.int.test.ts`.

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (domínio/componente/página) | Yes | jsdom/puro + mocks; sem store compartilhado | `report-view.test.tsx`, `csv.test.ts`, `[tipo]/page.test.tsx` |
| integration (`build-report-rows.int`) | No | Postgres compartilhado + cleanup de tabelas; `describe.skipIf(!hasDb)` | `report-services.int.test.ts`, `social-report.int.test.ts` |

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com testes unit (T1, T4) | `npm run test` |
| Full | Após tasks com integração (T2, T3) | `npm run test && npm run test:integration` |
| Build | Fim da fase / verificação final (T5) | `npm run typecheck && npm run lint && npm run test && npm run build` (+ `npm run test:integration` com DB) |

---

## Execution Plan

### Phase 1: Fundações (Paralelo — subsistemas distintos)

```
T1 [P]  (domínio: mapa de rótulos ContentStatus + guard)
T4 [P]  (client: selects no ReportView)
```

### Phase 2: Projeção (Sequencial — mesmo arquivo `build-report-rows.ts`)

```
T2 ──→ T3
```

### Phase 3: Página (Sequencial)

```
T1, T4 ──→ T5
```

3 fases → execução inline (sem oferta de sub-agente por fase; o pipeline usa 1 Implementer).

---

## Task Breakdown

### T1: Mapa canônico `CONTENT_STATUS_LABELS` + guard de completude [P]

**What**: Criar `reporting/domain/report-labels.ts` client-safe com `CONTENT_STATUS_LABELS: Record<ContentStatus,string>` (9 valores, masculino — idêntico ao map de `services` view), `MANIFESTATIONS_STATUS_LABEL = "Manifestações de interesse"` e `labelContentStatus(v) = LABELS[v] ?? v`; exportar no barrel `@/modules/reporting`.
**Where**:
- `src/modules/reporting/domain/report-labels.ts` (novo)
- `src/modules/reporting/index.ts` (export)
- `src/modules/reporting/__tests__/report-labels.test.ts` (novo)
**Depends on**: None
**Reuses**: valores de `services/views/provider-service-row.view.ts:5` (referência, não import); `import type { ContentStatus } from '@/modules/moderation'`
**Requirement**: USP058-11, USP058-12, USP058-15, USP058-MN-01

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [x] `CONTENT_STATUS_LABELS` cobre os 9 valores de `ContentStatus` (masc.); `MANIFESTATIONS_STATUS_LABEL` presente; `labelContentStatus` faz fallback `?? v`
- [x] Arquivo é client-safe (só consts + `import type`; nenhum IO/Prisma)
- [x] Exportado no barrel; nenhuma dep nova
- [x] Teste unit: **guard de completude** (itera `Object.values`/enum → todo valor tem rótulo, falha se faltar — USP058-15/MN-01); rótulos PT-BR corretos; fallback devolve o token
- [x] Gate quick passa: `npm run test`
- [x] Test count: +N testes verdes (sem deleção silenciosa)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(reporting): mapa canônico de rótulos PT-BR de ContentStatus + guard de completude`

---

### T4: Selects de status/categoria/região no `ReportView` (gated por props) [P]

**What**: Adicionar ao form GET de `report-view.tsx` os `<select name="status|categoryId|regionId">`, cada um renderizado **só** quando sua prop de opções existe; primeira opção "Todos/Todas" (`value=""`), `defaultValue={filters.x}`. Estender as props com `statusOptions?`/`categoryOptions?`/`regionOptions?` (`FilterOption = {value,label}`). Preservar os inputs `from`/`to` e o fluxo de export intactos.
**Where**:
- `src/modules/reporting/components/report-view.tsx` (modificar)
- `src/modules/reporting/__tests__/report-view.test.tsx` (estender)
**Depends on**: None
**Reuses**: `<form method="get">` nativo; `Label`/`Button` de `@/shared/ui`; padrão de `defaultValue` dos inputs de data atuais
**Requirement**: USP058-05, USP058-06, USP058-07, USP058-08, USP058-09, USP058-10, USP058-MN-04

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [x] Com `statusOptions` → `<select name="status">` presente, opções + "Todos", `filters.status` pré-selecionado; idem categoria (`categoryOptions`) e região (`regionOptions`)
- [x] **Negativo (gating)**: sem a prop de opções → o select correspondente **não** é renderizado (USP058-08/MN-04)
- [x] Inputs `from`/`to` e a chamada `exportReport({reportType, filters, format, acknowledgePII})` **inalterados** (asserção preservada em `report-view.test.tsx`)
- [x] Nenhum barrel server importado no Client Component (AD-019); nenhuma dep nova
- [x] Gate quick passa: `npm run test`
- [x] Test count: +N testes verdes; suíte de `report-view.test.tsx` preservada

**Tests**: unit
**Gate**: quick
**Commit**: `feat(reporting): selects de status/categoria/região no formulário de relatórios`

---

### T2: Nome da categoria no relatório de serviços (R3) — resolução na projeção

**What**: No `build-report-rows.ts` case `services`, resolver `categoryId → nome` via `listServiceCategories()` (`Map<id,name>`); row passa a `categoria = nameMap.get(r.categoryId) ?? '—'`; linha sintética de manifestações e `categoryId` nulo → `'—'`; coluna vira `{key:'categoria', label:'Categoria'}`. **Sem** tocar `report-services.ts` (query e seu int-test intactos).
**Where**:
- `src/modules/reporting/queries/build-report-rows.ts` (case `services`)
- `src/modules/reporting/__tests__/build-report-rows.int.test.ts` (novo — cobertura de nome de categoria)
**Depends on**: None
**Reuses**: `listServiceCategories` (`@/modules/services`); marcador `'—'` (A7); harness de seed de `report-services.int.test.ts`
**Requirement**: USP058-01, USP058-02, USP058-03, USP058-04, USP058-MN-02

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [x] Célula de categoria do R3 é o **nome** da `ServiceCategory` (tela/CSV/PDF via projeção única); `categoryId` nulo e a linha de manifestações → "—"
- [x] **Negativo (MN-02)**: a célula de categoria **nunca** casa com padrão UUID (`/^[0-9a-f-]{36}$/`)
- [x] `report-services.ts` (query) **inalterada** → `report-services.int.test.ts` (shape `{status,categoryId,count}`) permanece verde
- [x] Nenhuma dep nova, nenhuma migração; contratos de export inalterados (USP058-MN-03)
- [x] Gate full passa: `npm run test && npm run test:integration`
- [x] Test count: +N testes de integração verdes

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): exibir nome da categoria (não UUID) no relatório de serviços (R3)`

---

### T3: Rótulos PT-BR nos valores (R1 status, R3 status/manifestações, R6 renda/moradia)

**What**: No `build-report-rows.ts`, aplicar rótulos PT-BR: case `jobs` → `labelContentStatus(status)`; case `services` → `labelContentStatus(status)` + linha sintética `status = MANIFESTATIONS_STATUS_LABEL`; case `social` ramo `full` → renda via `INCOME_BRACKET_LABELS`, moradia via `HOUSING_SITUATION_LABELS`. **Não** traduzir em `cellToString`/`formatCell` (serializador agnóstico preservado).
**Where**:
- `src/modules/reporting/queries/build-report-rows.ts` (cases `jobs`, `services`, `social` full)
- `src/modules/reporting/__tests__/build-report-rows.int.test.ts` (estender — status/manifestações/renda/moradia)
**Depends on**: T1, T2
**Reuses**: `labelContentStatus`/`CONTENT_STATUS_LABELS`/`MANIFESTATIONS_STATUS_LABEL` (T1); `INCOME_BRACKET_LABELS`/`HOUSING_SITUATION_LABELS` (`@/modules/persons`); seed social de `social-report.int.test.ts`
**Requirement**: USP058-11, USP058-12, USP058-13, USP058-14, USP058-MN-01

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [x] R1 e R3: coluna Status em PT-BR (ex.: `IN_MODERATION`→"Em moderação", `ACTIVE`→"Ativo"); linha de MP7 = "Manifestações de interesse"
- [x] R6 full: renda/moradia em PT-BR (reuso de `@/modules/persons`); ramo `stripped` inalterado
- [x] **Negativo (MN-01)**: nenhuma célula de status/renda/moradia contém token cru do enum; a tradução ocorre em `build-report-rows`, **não** no serializador → `csv.test.ts` (passagem-crua + anti-injeção CWE-1236) permanece **verde**
- [x] Nenhuma dep nova/migração; watermark/ciência/audit/RBAC inalterados (USP058-MN-03)
- [x] Gate full passa: `npm run test && npm run test:integration`
- [x] Test count: +N testes de integração verdes

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): rótulos PT-BR nos valores de status/renda/moradia dos relatórios`

---

### T5: Página provê as opções de filtro por tipo de relatório

**What**: Em `(app)/relatorios/[tipo]/page.tsx`, montar as opções por `reportType` e passar como props ao `ReportView`: `jobs` → `statusOptions` de `CONTENT_STATUS_LABELS`; `services` → `categoryOptions` de `listServiceCategories()`; `social` → `regionOptions` de `listActiveRegions()`; demais tipos → nenhuma (só período). Resolução **no server** (evita hazard AD-019).
**Where**:
- `src/app/(app)/relatorios/[tipo]/page.tsx` (modificar)
- `src/app/(app)/relatorios/[tipo]/page.test.tsx` (estender)
**Depends on**: T1, T4
**Reuses**: `CONTENT_STATUS_LABELS` (`@/modules/reporting`, T1); `listServiceCategories` (`@/modules/services`); `listActiveRegions` (`@/modules/jobs`); parsing de `searchParams` já presente
**Requirement**: USP058-05, USP058-06, USP058-07, USP058-08, USP058-MN-03, USP058-MN-04

**Tools**:
- MCP: NONE
- Skill: `skill-tdad`

**Done when**:
- [x] `tipo='jobs'` → passa `statusOptions` (todos os `ContentStatus` PT-BR); `tipo='services'` → `categoryOptions` ({id,name}); `tipo='social'` → `regionOptions` ({id,name})
- [x] **Negativo (MN-04)**: `tipo` sem a dimensão (ex.: `applications`/`referrals`/`moderation_queue`) → **nenhuma** opção extra passada (só período)
- [x] Schema Zod (`report-filters.ts`) e Server Action `exportReport` **inalterados** (USP058-MN-03); nenhuma query de agregação alterada; nenhuma dep/migração
- [x] Page test estende as asserções por `reportType`; `[tipo]/page.test.tsx` preservado
- [x] Gate build passa: `npm run typecheck && npm run lint && npm run test && npm run build` (+ `npm run test:integration` com DB)
- [x] Test count: +N testes verdes; todas as suítes preservadas verdes

**Tests**: unit (página jsdom) + build
**Gate**: build
**Commit**: `feat(reporting): página de relatório provê opções de filtro por tipo (status/categoria/região)`

---

## Parallel Execution Map

```
Phase 1 (Paralelo):
    ├── T1 [P]  (domínio: mapa de rótulos + guard)
    └── T4 [P]  (client: selects no ReportView)

Phase 2 (Sequencial — mesmo build-report-rows.ts):
    T2 ──→ T3

Phase 3 (Sequencial):
    T1, T4 ──→ T5
```

`[P]` = sem dependência inter-task (T1 = domínio puro; T4 = componente client; subsistemas distintos, ambos unit parallel-safe).

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: mapa + guard | 1 arquivo de domínio + barrel + teste | ✅ Granular |
| T4: selects no ReportView | 1 componente (3 selects coesos no mesmo form) | ✅ Coeso |
| T2: nome de categoria (R3) | 1 case de `build-report-rows` + int test | ✅ Granular |
| T3: rótulos PT-BR (R1/R3/R6) | mesma função, 3 cases (coeso: "traduzir valores") | ✅ Coeso |
| T5: opções por tipo na página | 1 página server + page test | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagram mostra | Status |
|---|---|---|---|
| T1 | None | raiz (Phase 1) | ✅ Match |
| T4 | None | raiz (Phase 1) | ✅ Match |
| T2 | None | raiz (Phase 2) | ✅ Match |
| T3 | T1, T2 | T1→T3, T2→T3 | ✅ Match |
| T5 | T1, T4 | T1→T5, T4→T5 | ✅ Match |

- Toda aresta do diagrama tem `Depends on` correspondente e vice-versa. T1/T4 marcadas `[P]` não dependem uma da outra; T2 é raiz de fase (sem incoming). ✅

---

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
|---|---|---|---|---|
| T1 | Domínio — mapa de rótulos | unit | unit | ✅ OK |
| T4 | Componente — `report-view.tsx` | unit | unit | ✅ OK |
| T2 | Projeção — `build-report-rows.ts` (Postgres) | integration | integration | ✅ OK |
| T3 | Projeção — `build-report-rows.ts` (Postgres) | integration | integration | ✅ OK |
| T5 | Página — `[tipo]/page.tsx` (jsdom) | unit | unit + build | ✅ OK |

- Nenhum `Tests: none`; nenhum teste diferido para outra task. ✅

---

## 💠 Must-Not Ownership

| Must-Not | Owning task(s) | Teste negativo (Done when) |
|---|---|---|
| **USP058-MN-01** (nenhum token cru de enum; mapa exaustivo) | T1 (guard de completude) + T3 (aplicação) | Unit: `CONTENT_STATUS_LABELS` cobre 1:1 o enum (falha se faltar). Int: células de status/renda/moradia sem token cru. `csv.test.ts` verde (serializador agnóstico → tradução é upstream). |
| **USP058-MN-02** (nenhum UUID cru na categoria do R3) | T2 | Int: célula de categoria = nome ou "—", **nunca** casa com padrão UUID. |
| **USP058-MN-03** (contratos export/RBAC/watermark/schema inalterados; sem dep/migração) | T2, T3, T5 | Suítes preservadas verdes (`export-report.*`, `report-pdf.tsx`, `csv.test.ts`, `social-report.int`, `report-access`); diff sem dep/migração; `report-filters.ts`/`exportReport` inalterados. |
| **USP058-MN-04** (sem mudança de query; sem controle inerte; período preservado) | T4 (gating) + T5 (opções por tipo) | Int: `report-jobs`/`report-services`/`social` verdes (agregação inalterada). RTL: select ausente sem prop; `exportReport` + `from`/`to` preservados. |

- Todo must-not do spec tem task dono + teste negativo. ✅

---

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Cada `Done when` é binário e referencia o comando de gate. A contagem de testes esperada por task previne deleção silenciosa. Após a última task, o **Verifier independente** roda automaticamente (autor ≠ verificador): checagem spec-anchored por AC + sensor de discriminação + verificação dos 4 must-nots (evidência-ou-zero), gravando `validation.md`. Premissas invioláveis re-checadas no fechamento: zero dep nova, zero migração, zero mudança nas queries de agregação e nos contratos de export/RBAC/watermark/auditoria/período.
