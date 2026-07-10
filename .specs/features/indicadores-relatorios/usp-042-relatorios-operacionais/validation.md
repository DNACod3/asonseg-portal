# USP-042 — Relatórios Operacionais — Validation

**Date**: 2026-07-09
**Spec**: `.specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/spec.md`
**Design**: `.specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/design.md`
**Diff range**: `bc4d15f..377e9e4` (feature commits `f872b39..377e9e4`, 12 commits T1–T12), branch `feat/fase-6-relatorios-home-hardening`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
|---|---|---|
| T1 (RBAC guards) | ✅ Done | `report-access.ts` |
| T2 (REPORT_EXPORTED + metrics/schema) | ✅ Done | `audit/events.ts` + `report-window.ts`/`report-filters.ts` |
| T3 (calc puras) | ✅ Done | `referral-outcomes.ts`, `moderation-time.ts` |
| T4 (csv) | ✅ Done | `csv.ts` |
| T5–T10 (queries/view) | ✅ Done | `report-jobs/applications/services/referrals/moderation-queue.ts`, `social-report.view.ts` |
| T11 (exportReport action) | ✅ Done | `actions/export-report.tsx` + `components/report-pdf.tsx` |
| T12 (rotas + view + E2E) | ✅ Done | `(app)/relatorios/{page,[tipo]/page}.tsx` + `e2e/reporting/relatorios.spec.ts` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (ICE ID) | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| E-001 (R1..R6 filtrável, visibilidade por papel) | Coordenador/BOARD veem R1–R4; AS/BOARD veem R6; R5 via MODERATE_* | `src/modules/reporting/__tests__/report-access.test.ts:31-123` — todos os ramos testados; `report-jobs.int.test.ts` etc. — `where` de período/status real | ✅ PASS |
| E-002 (CSV/PDF + watermark) | Watermark verbatim `"Dados pessoais — uso restrito conforme LGPD"` na 1ª linha quando PII | `csv.test.ts:45-53` `expect(lines[0]).toBe(watermark)`; `export-report.test.ts:187-213` | ✅ PASS |
| E-003 (log imutável do export) | `REPORT_EXPORTED` com quem/relatório/filtros/escopo PII | `export-report.int.test.ts:98-118` — delta real de `audit_log` = 1 | ✅ PASS |
| E-004 (MP9 sempre com "sem resultado" ao lado) | retorno carrega `successRate` E `noResultRate` sempre | `referral-outcomes.test.ts` (caso `HIRED=17,NOT_SELECTED=3,null=5` → `successRate=17/20`, `noResultRate=5/25`) | ✅ PASS |
| E-005 (janela longa, pré-agregação/paginação) | queries usam `groupBy`/`count`/`take`, sem carregar linhas em memória | `report-jobs.ts`, `report-services.ts` (`groupBy`), `social-report.view.ts:127` (`take: 5000`) | ✅ PASS |
| REL42-MN-05 (ficha social stripped para coordenador) | sensível nem SELECIONADO nem serializado; sem audit | `social-report.view.ts:117-147` (B1: early-return antes do 2º `findMany`); `social-report.int.test.ts:112-140` (payload serializado sem marcadores sensíveis; audit delta = 0) | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps found in scope.

---

## Discrimination Sensor

Sensor depth: **P0-full** (ICED USP with must-nots) — 7 targeted mutations, one per must-not, run in the real working tree via edit→test→`git checkout --` restore cycle (no worktree needed; each mutation touched exactly one file and was restored before the next).

| # | Must-not | File:line | Mutation | Killed? |
|---|---|---|---|---|
| 1 | MN-01 | `src/modules/reporting/domain/csv.ts:65` | `if (opts.watermark)` → `if (false && opts.watermark)` (watermark line dropped) | ✅ Killed — `csv.test.ts` + `export-report.test.ts` MN-01 tests RED |
| 2 | MN-02 | `src/modules/reporting/domain/report-access.ts:53-57` | `canViewModerationQueueReport` body replaced with `return true` (bypassed `MODERATE_*`/BOARD check) | ✅ Killed — 4 tests in `report-access.test.ts` RED (negative, revoked-grant, wrong-permission-grant cases) |
| 3 | MN-03 | `src/modules/reporting/domain/report-authorization.ts:16` | `isReportTypeAuthorized` short-circuited to `return true` before the switch | ✅ Killed — `export-report.test.ts` MN-03 and MN-02 tests RED |
| 4 | MN-04 | `src/modules/reporting/domain/referral-outcomes.ts:53` | return `noResultRate: null` unconditionally instead of computed value | ✅ Killed — 4 tests in `referral-outcomes.test.ts` RED |
| 5 | MN-05 | `src/modules/reporting/views/social-report.view.ts:143` | gate swapped `!canSocial` → `!canOps` (mirrors the exact mutation named in tasks.md T10) | ✅ Killed — `social-report.int.test.ts`: AS assertion (`scope` expected `'full'`, got `'stripped'`) and coordinator assertion (`scope` expected `'stripped'`, got `'full'`) both RED |
| 6 | MN-06 | `src/modules/reporting/actions/export-report.tsx:84` | `if (containsPII && !acknowledgePII)` → `if (false && ...)` (ack check bypassed) | ✅ Killed — `export-report.test.ts` MN-06 test RED |
| 7 | MN-07 | `src/modules/reporting/actions/export-report.tsx:149-152` | `catch` block returns `ok({...payload})` instead of `fail('INTERNAL', ...)` on audit failure (rollback bypassed) | ✅ Killed — `export-report.test.ts` MN-07 test RED (`expected true to be false`) |

**Result**: 7/7 killed — **PASS**. All mutations discarded via `git checkout --` immediately after each run; verified clean (`git diff --stat` on the reporting/route/e2e/audit surface returns empty) after all 7 cycles.

---

## 🧬 Must-Not Verification (ICE mode)

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
|---|---|---|---|---|
| REL42-MN-01 | export PII sem watermark | `csv.test.ts:45` `expect(lines[0]).toBe(watermark)`; `export-report.test.ts:187` | ✅ | ✅ |
| REL42-MN-02 | fila sem `MODERATE_*`/delegação | `report-access.test.ts:85,110,117` (negativo/revogado/errado) + `:89-107` (delegação concede) | ✅ | ✅ |
| REL42-MN-03 | não autorizado → dados/arquivo | `export-report.test.ts:125-135` (sem query, sem audit, sem payload); `export-report.int.test.ts:154-170` (audit_log real, delta=0) | ✅ | ✅ |
| REL42-MN-04 | MP9 sem "sem resultado" | `referral-outcomes.test.ts` (retorno sempre com ambas taxas) | ✅ | ✅ |
| REL42-MN-05 | ficha social ao coordenador | `social-report.view.ts` B1 (early-return, 2ª query nunca chamada) + B2 (`sensitive: null` estrutural); `social-report.int.test.ts:112-140` (payload sem marcadores + audit delta=0); AS/BOARD confirmado `full` + `SENSITIVE_FIELD_VIEWED` (delta=1) | ✅ | ✅ |
| REL42-MN-06 | export PII sem ciência | `export-report.test.ts:176-185` (`VALIDATION`, `viewSocialReport` não chamado, sem audit) | ✅ | ✅ |
| REL42-MN-07 | export sem `REPORT_EXPORTED` / falha sem rollback | `export-report.test.ts:245-258` (audit falha → `INTERNAL`, sem payload); `export-report.int.test.ts:98-118` (happy path grava 1 linha real) | ✅ | ✅ |

**Status**: ✅ All 7 must-nots proven (evidence-or-zero, each with `file:line` + a live-killed mutation).

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ — module scoped to `reporting`, no unrelated files touched |
| Surgical changes | ✅ — only `audit/events.ts` touched outside the module (adding `REPORT_EXPORTED`, per design) |
| No scope creep | ✅ |
| Matches patterns | ✅ — inline guards mirror AD-022/USP-036 precedent; 2-barrier privacy mirrors USP-039/AD-022; Server Action sequence matches project-guideline §9 |
| Spec-anchored outcome check | ✅ — see AC table above |
| Every test maps to a spec requirement | ✅ — all reporting test files carry `REL42-MN-NN`/`E-NNN` comments tracing to spec |

---

## Edge Cases

- [x] Período sem dados → CSV/PDF só com cabeçalhos, sem erro (`export-report.int.test.ts:138-152`, `csv.test.ts:24-28`)
- [x] MP9 sem resultados → taxas `null`/"—", não 0% enganoso (`referral-outcomes.ts:46-48`)
- [x] Não autorizado tenta exportar → nega, não gera arquivo (multiple tests above)

---

## Gate Check

- **typecheck**: `npm run typecheck` → 0 errors
- **lint**: `npm run lint` → 0 errors/warnings
- **unit**: `npm run test` → **1449/1449 passed** (218 test files) — matches Implementer's reported count
- **integration**: `npm run test:integration` → **600/600 passed** (101 test files) — matches Implementer's reported count
- **build**: `npm run build` → succeeds; `/relatorios` and `/relatorios/[tipo]` compile as `ƒ` (dynamic) routes; `@react-pdf/renderer` bundles cleanly, no `<Html>`/prerender break
- **E2E**: `npx playwright test e2e/reporting/relatorios.spec.ts` → **4/4 passed** — matches Implementer's reported count
- **Test count before feature**: not independently re-derived (feature adds ~30 new test files atop a large existing suite); Implementer-reported deltas (T1–T12 "Test count registrado" per commit) are consistent with the final 1449/600 totals observed here.
- **Skipped tests**: none observed in reporting scope.
- **Failures**: none.

---

## Deviations — Verifier Assessment

1. **T7 `ServiceReport` composite `{byStatusAndCategory, interestsCount}`** — ✅ Sound. `build-report-rows.ts:56-72` correctly renders both MP5 (status×category counts) and MP7 (interests count as a synthetic row) from the composite; `report-services.ts` computes both via `Promise.all` (justified: independent metrics, no need for `$transaction` snapshot consistency, and `$transaction` would lose `groupBy` 2-field type inference — reasonable and documented).

2. **T10 `SocialReportViewer` extended to `{roles, personId, ip, userAgent}`** — ✅ Sound, does not weaken MN-05. The extension exists solely to attribute the `SENSITIVE_FIELD_VIEWED` audit event to a real actor (the aggregate report has no single "owner" to delegate audit to, unlike `getSocioeconomicRecord`). Verified: `social-report.int.test.ts:87-110` confirms the audit row's `actorPersonId` matches the AS actor passed in, and the coordinator path (same extended viewer) still produces zero audit rows and `sensitive: null` — the gate that matters (`canSocial`/`canOps`) is untouched by the signature extension. The MN-05 mutation sensor (swapping the gate itself) still kills the test regardless of the viewer shape.

3. **T12 shared `buildReportRows`/`isReportTypeAuthorized`/`REPORT_TITLES`** — ✅ Confirmed no divergence. Both `src/app/(app)/relatorios/[tipo]/page.tsx:8-9` (route) and `src/modules/reporting/actions/export-report.tsx:13` (export action) import `isReportTypeAuthorized` from the same `domain/report-authorization.ts` module, and both call `buildReportRows` from the same `queries/build-report-rows.ts`. The MN-02/MN-03 discrimination mutations (applied once, at the shared `report-authorization.ts`/`report-access.ts` layer) simultaneously killed tests exercising both the action (`export-report.test.ts`) and the route-equivalent guard tests (`report-access.test.ts`), empirically confirming there is one authorization surface, not two that could diverge.

4. **Region fallback `candidateProfile.regionId → providerProfile.regionId → null`** — ✅ Sound, no mis-scope/leak. `resolvePersonRegion` (`social-report.view.ts:71-82`) returns exactly one region per person (candidate profile takes priority, then provider, then unassigned `'__no_region__'` bucket) — no double-counting, no cross-scope leak; the aggregation only ever produces counts, never raw PII, at this layer regardless of which profile resolves.

5. **CSV delimiter `;`** — ✅ Cosmetic, RFC-4180 quoting holds. `csv.test.ts:35-38` explicitly proves a cell containing `;` gets quote-wrapped (`escapeCsvField` checks `raw.includes(DELIMITER)` where `DELIMITER = ';'`), so the delimiter swap from the conventional `,` does not break escaping.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 anchored ACs sampled matched spec-defined outcomes (0 spec-precision gaps)
**Sensor**: 7/7 mutations killed (P0-full depth)
**Must-nots**: 7/7 eval(−) green
**Gate**: typecheck ✅, lint ✅, unit 1449/1449 ✅, integration 600/600 ✅, build ✅ (dynamic routes + `@react-pdf/renderer` compiles), E2E 4/4 ✅

**What works**: RBAC inline guards (R1–R4 ops, R6 social, R5 via `MODERATE_*`/delegation) fully branch-tested; CSV/PDF export with LGPD watermark and PII-acknowledgement gate; append-only `REPORT_EXPORTED` audit with real rollback-on-failure; 2-barrier privacy for the social report (SELECT never runs for coordinator, type-level `sensitive: null`); route and export share one authorization surface (verified via shared-mutation kill); E2E confirms real session-gate confinement of all report routes.

**Issues found**: none.

**Next steps**: none — ready to proceed (subject to the pre-existing go-live gate B-001/DPO sign-off for PII reports in production, which is a deployment gate, not a dev blocker, per design.md §8 ASSUMP-042-02).
