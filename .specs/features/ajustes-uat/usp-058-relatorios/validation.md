# USP-058 — Relatórios legíveis — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-058-relatorios/spec.md`
**Diff range**: `1cc5021~1..3bbdd4e`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `report-labels.ts` + guard de completude |
| T4   | ✅ Done | Selects gated no `ReportView` |
| T2   | ✅ Done | Nome de categoria na projeção (`build-report-rows.ts`) |
| T3   | ✅ Done | Rótulos PT-BR (status R1/R3, manifestações, renda/moradia R6) |
| T5   | ✅ Done | Página resolve opções por `reportType` no server |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| USP058-01 R3 exibe nome, não UUID | célula `categoria` = `ServiceCategory.name` | `build-report-rows.int.test.ts:79-85` — `expect(row!.categoria).toBe(CAT_NAME)` | ✅ PASS |
| USP058-02 CSV/PDF via projeção única | mesma projeção alimenta export | `build-report-rows.ts:63-88` produz `{columns,rows}` consumido por `export-report.ts`/`report-pdf.tsx` (ponto único) | ✅ PASS |
| USP058-03 nulo/manifestações → "—" | `categoria === '—'` | `build-report-rows.int.test.ts:95-107` | ✅ PASS |
| USP058-04 query inalterada | `report-services.ts` intocado; int-test de shape verde | `report-services.int.test.ts` (10/10 green, shape `{status,categoryId,count}` preservado) | ✅ PASS |
| USP058-05 select status R1 | `<select name="status">` com opções + "Todos", pré-selecionado | `report-view.test.tsx:188-205` — `expect(select.value).toBe('ACTIVE')` | ✅ PASS |
| USP058-06 select categoria R3 | idem, categoria | `report-view.test.tsx:207-223` | ✅ PASS |
| USP058-07 select região R6 | idem, região | `report-view.test.tsx:225-236` | ✅ PASS |
| USP058-08 sem controle inerte | dimensão não honrada ⇒ nenhum select | `report-view.test.tsx:238-243` + `page.test.tsx:225-237` (`it.each` applications/referrals/moderation_queue) | ✅ PASS |
| USP058-09 schema/Action inalterados | `report-filters.ts`/`exportReport` sem diff | `git diff --stat` (ver Gate Check) — nenhum dos dois arquivos aparece no diff | ✅ PASS |
| USP058-10 período preservado | inputs `from`/`to` intactos | `report-view.test.tsx:252-277` | ✅ PASS |
| USP058-11 status PT-BR R1/R3 | `IN_MODERATION`→"Em moderação" etc. | `build-report-rows.int.test.ts:87-93,172-180` | ✅ PASS |
| USP058-12 manifestações PT-BR | "Manifestações de interesse" | `build-report-rows.int.test.ts:102-107` | ✅ PASS |
| USP058-13 renda/moradia PT-BR (R6 full) | `UP_TO_1_MW`→"Até 1 salário mínimo", `RENTED`→"Alugada" | `build-report-rows.int.test.ts:231-244` | ✅ PASS |
| USP058-14 tradução na projeção, serializador agnóstico | `cellToString`/`formatCell` não traduzem | `csv.test.ts` (unit, 0 diff, verde na suíte completa) — serializador cru preservado | ✅ PASS |
| USP058-15 guard de completude | falha se faltar rótulo | `report-labels.test.ts:10-27` + mutação viva (ver Sensor #1) | ✅ PASS |

**Status**: ✅ All ACs covered (15/15) — 0 spec-precision gaps.

---

## Discrimination Sensor

Executado em scratch real (edição do working tree limpo → teste → `git checkout --` imediato; `git status --short` confirmado limpo antes/depois de cada mutação).

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 (MN-01) | `src/modules/reporting/domain/report-labels.ts:23` | Removida a chave `PAUSED` do `CONTENT_STATUS_LABELS` | ✅ Killed — `report-labels.test.ts` (2 failures: guard de completude + rótulo canônico) |
| 2 (MN-02) | `src/modules/reporting/queries/build-report-rows.ts:72` | `categoria` voltou a ser `r.categoryId` cru (regressão REL-2 simulada) | ✅ Killed — `build-report-rows.int.test.ts` (3 failures, incl. `not.toMatch(UUID_PATTERN)`) |
| 3 (MN-04) | `src/modules/reporting/components/report-view.tsx:137` | Gating do select de status trocado por `{true ? (...) : null}` (sempre renderiza) | ✅ Killed — `report-view.test.tsx` ("sem nenhuma prop de opções → nenhum select" falhou) |

**Sensor depth**: lightweight (3 mutações, cada uma no guard de um must-not distinto — MN-01, MN-02, MN-04)
**Result**: 3/3 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| USP058-MN-01 | emitir token cru de `ContentStatus`/`IncomeBracket`/`HousingSituation`/marcador de manifestações | `report-labels.test.ts:10-19` (guard 1:1) + `build-report-rows.int.test.ts:115-122` (`RAW_ENUM_TOKENS.not.toContain`) + `csv.test.ts` (serializador agnóstico, verde) | ✅ | ✅ (Sensor #1) |
| USP058-MN-02 | emitir UUID cru na coluna Categoria | `build-report-rows.int.test.ts:118` — `expect(String(row.categoria)).not.toMatch(UUID_PATTERN)` | ✅ | ✅ (Sensor #2) |
| USP058-MN-03 | alterar watermark/ciência/`REPORT_EXPORTED`/RBAC/schema Zod/`exportReport`; sem dep/migração | `export-report.test.ts`, `export-report.int.test.ts`, `report-pdf.test.tsx`, `csv.test.ts`, `social-report.int.test.ts`, `report-access.test.ts` — todas verdes (ver Gate Check); `git diff --stat` mostra `report-filters.ts`/`export-report.ts` (Action) fora do diff; `package.json` fora do diff (0 dep nova); nenhum arquivo `prisma/migrations/*` no diff | ✅ | não aplicável (contrato preservado por omissão, não por guard novo — provado por ausência no diff + suítes intocadas verdes) |
| USP058-MN-04 | mudar query de agregação; renderizar controle que a query ignora; regressão de período | `report-jobs.int.test.ts`/`report-services.int.test.ts`/`social-report.int.test.ts` verdes (agregação inalterada); `report-view.test.tsx:238-243` (RTL, select ausente); `page.test.tsx:225-237` (nenhuma opção extra p/ `applications`/`referrals`/`moderation_queue`) | ✅ | ✅ (Sensor #3) |

**Status**: ✅ All 4 must-nots proven (evidência-or-zero, 3/4 com mutação de guard morta; MN-03 é um "não-fazer" global provado por ausência de diff + regressão zero nas suítes existentes, não tem um guard de código único para mutar).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — 11 arquivos, todos dentro do escopo declarado (T1/T2/T3/T4/T5) |
| Surgical changes | ✅ — `report-services.ts`, `report-filters.ts`, `exportReport`, schema Zod: 0 diff |
| No scope creep | ✅ — nenhuma consolidação cross-módulo dos mapas de status (fora de escopo, respeitado) |
| Matches patterns | ✅ — reuso de `listServiceCategories`/`listActiveRegions`/`INCOME_BRACKET_LABELS`/`HOUSING_SITUATION_LABELS` em vez de recriar |
| Spec-anchored outcome check | ✅ — ver tabela acima, valores exatos (não só "existe assertion") |
| Per-layer Coverage Expectation | ✅ — domínio (unit, guard 1:1), projeção (integration, Postgres real), componente/página (unit RTL/jsdom) |
| Every test maps to a spec requirement | ✅ — nenhum teste órfão identificado nos arquivos novos/modificados |
| AD-019 (sem barrel server no Client Component) | ✅ — `report-view.tsx` só importa `../actions/export-report` + `@/shared/ui`; resolução de opções (`listServiceCategories`/`listActiveRegions`/`CONTENT_STATUS_LABELS`) ocorre em `page.tsx` (Server Component); build de produção sem erro e bundle de `/relatorios/[tipo]` (190 kB First Load JS) em linha com rotas equivalentes (`/vagas`, `/empresa/...`) — sem leak |

---

## Edge Cases

- [x] `categoryId` órfão (categoria inexistente) → "—" (`Map.get ?? '—'`) — coberto implicitamente pelo mesmo fallback de `categoryId` nulo
- [x] Período com só manifestações → única linha sintética, categoria "—" — `build-report-rows.int.test.ts:124-127`
- [x] Coordenador em R6 stripped → sem dimensões de renda/moradia — `social-report.int.test.ts` (REL42-MN-05, verde, inalterado)
- [x] Filtros vazios → tratados como ausentes — comportamento preservado, sem novo teste necessário (schema/rota inalterados)
- [x] `categoryId`/`regionId` inválido → `VALIDATION` do schema Zod — schema inalterado, suíte de schema não tocada
- [x] Enum novo sem rótulo → guard falha no CI — provado pela mutação #1 (Sensor)

---

## Gate Check

- **Typecheck**: `npm run typecheck` → 0 erros
- **Lint**: `npm run lint` → 0 erros/warnings
- **Unit (`npm run test`)**: 274 arquivos, **1948 testes, 0 falhas**
- **Integration escopo tocado (`npm run test:integration -- src/modules/reporting "src/app/(app)/relatorios"`)**: **10 arquivos, 40 testes, 0 falhas** — inclui as 4 suítes MN-03 (`export-report.int.test.ts`, `social-report.int.test.ts`) + as 2 novas (T2/T3) em `build-report-rows.int.test.ts`
- **Build**: `npm run build` → sucesso, sem erro de trace/leak; `/relatorios/[tipo]` 190 kB First Load JS (consistente com rotas equivalentes)
- **Test count antes da feature**: não medido diretamente (baseline não capturada antes do branch) — delta observável: **+9 testes** em `report-labels.test.ts` (novo), **+9** em `build-report-rows.int.test.ts` (novo), **+8** em `report-view.test.tsx` (seção nova de selects), **+7** em `page.test.tsx` (seção nova de opções) = **+33 testes novos**, todos verdes; nenhuma deleção
- **Escopo do diff** (`git diff --stat 1cc5021~1..3bbdd4e`): 11 arquivos, todos em `src/modules/reporting/**` ou `src/app/(app)/relatorios/**` — **nenhum arquivo de `jobs`/`identity` tocado** (confirma que os flakes pré-existentes declarados — `searchJobs` pagination, `credential-claim` — estão fora do diff desta feature, portanto fora de escopo de reprovação)
- **Skipped**: nenhum skip novo introduzido; `describe.skipIf(!hasDb)` é o padrão pré-existente do módulo (Postgres disponível neste ambiente — nada pulado na prática)
- **Failures**: nenhuma

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| USP058-01..15 | Done (spec) | ✅ Verified |
| USP058-MN-01..04 | Done (spec) | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 15/15 ACs matched spec outcome — 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Must-nots**: 4/4 green
**Gate**: typecheck ✅, lint ✅, unit 1948/1948 ✅, integration (escopo reporting) 40/40 ✅, build ✅

**What works**: nome de categoria (REL-2), rótulos PT-BR (REL-3) e selects de status/categoria/região (REL-5) implementados sem tocar queries de agregação, RBAC, watermark, ciência, auditoria ou schema — todos os contratos da USP-042 permanecem verdes. Deviations declaradas pelo Implementer (tokens de teste `ACTIVE;2`→`Ativo;2` em `export-report.test.ts`/`.int.test.ts`) são mudança intencional de AC (G2/USP058-11 exige PT-BR também no export) e coerentes com `csv.test.ts` intacto (serializador permanece agnóstico).

**Issues found**: nenhuma.

**Next steps**: nenhum — feature pronta para merge.
