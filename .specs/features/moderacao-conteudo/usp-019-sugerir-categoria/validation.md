# USP-019 — Sugerir nova categoria de serviço ou área de vaga — Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/moderacao-conteudo/usp-019-sugerir-categoria/spec.md`
**Diff range**: `2add85c..HEAD` (branch `refactor/fase-2-empresas-vagas-moderacao`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (`CATEGORY_SUGGESTION_REJECTED` event) | ✅ Done | `audit/events.ts:107` — added, NOT in `JUSTIFICATION_REQUIRED_EVENTS` |
| T2 (domain `TaxonomyKind`/`foldForDedup`/schemas) | ✅ Done | `domain/taxonomy-suggestion.ts`, `schemas/taxonomy-suggestion.ts` |
| T3 (`suggestTaxonomy` action) | ✅ Done | `actions/suggest-taxonomy.ts` — dedup-in-tx, `switch`-based delegate selector (deviation, see below) |
| T4 (`approveTaxonomySuggestion`/`rejectTaxonomySuggestion`) | ✅ Done | `actions/resolve-taxonomy-suggestion.ts` |
| T5 (`listTaxonomySuggestions` + view + guard) | ✅ Done | `queries/list-taxonomy-suggestions.ts`, `views/taxonomy-suggestion-item.ts`, `server/taxonomy-suggestion-access.ts` |
| T6 (page + DS component) | ✅ Done | `app/(app)/moderacao/sugestoes/page.tsx`, `components/taxonomy-suggestions-list.tsx` |
| T7 (job-form "Outro/sugerir") | ✅ Done | `jobs/components/job-form.tsx` — direct action-file import + documented `eslint-disable` (deviation, see below) |

All 7 tasks done; no partial/blocked tasks.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| SUGG-01 (criar pendente + audit na tx) | `JobArea` com `isSuggestion=true`, `suggestedBy`, `approvedAt=null`, 1 `CATEGORY_SUGGESTED` | `suggest-taxonomy.int.test.ts:73-88` — `toMatchObject({name, isSuggestion:true, suggestedBy:personId, approvedAt:null})`; `expect(audits).toHaveLength(1)` | ✅ PASS |
| SUGG-02 (não selecionável + fila) | ausente de `listApprovedJobAreas` | `suggest-taxonomy.int.test.ts:120-127` — `expect(approved.map(a=>a.name)).not.toContain(name)` | ✅ PASS |
| SUGG-03 (aprovar) | `isSuggestion=false`, `approvedAt/By`, 1 `CATEGORY_APPROVED`, aparece em `listApprovedJobAreas` | `resolve-taxonomy-suggestion.int.test.ts:110-128` — `toMatchObject({isSuggestion:false, approvedBy:coordinatorId})`; `expect(approved.map(a=>a.name)).toContain(name)` | ✅ PASS |
| SUGG-04 (rejeitar = DELETE, before-state no log) | linha ausente, 1 `CATEGORY_SUGGESTION_REJECTED` com `before.name` | `resolve-taxonomy-suggestion.int.test.ts:130-154` — `expect(row).toBeNull()`; `expect((audits[0].before).name).toBe(name)` | ✅ PASS |
| SUGG-05 (dedup fold → `CONFLICT`) | `ok:false, error.code='CONFLICT'`, contagem de linhas inalterada | `suggest-taxonomy.int.test.ts:106-118` — `toMatchObject({ok:false, error:{code:'CONFLICT'}})`; `expect(after).toBe(before)` | ✅ PASS |
| SUGG-06 (fila 2 kinds + guard 404) | lista só pendentes; guard true/false por permissão | `list-taxonomy-suggestions.int.test.ts:63-113` | ✅ PASS |
| SUGG-07 (UI "Outro/sugerir") | revela input; submete `suggestTaxonomy({kind:'JOB_AREA', name})` | `jobs/__tests__/job-form.spec.tsx:39-57` — `expect(actions.suggestTaxonomy).toHaveBeenCalledWith({kind:'JOB_AREA', name:'Jardinagem'})` | ✅ PASS |
| SUGG-08 (genérico `SERVICE_CATEGORY`) | mesma semântica nos 2 kinds | `suggest-taxonomy.int.test.ts:90-104` + `resolve-taxonomy-suggestion.int.test.ts:218-232` | ✅ PASS |

**Status**: ✅ All ACs covered — todas as asserções batem o valor exato definido na spec (código de erro, campos, contagens, conteúdo do `before`).

---

## Discrimination Sensor

Ran in an isolated `git worktree` (`/private/tmp/.../scratchpad/sensor-wt`, detached at `HEAD`=`17a24e8`), `node_modules` symlinked, no product code touched in the real tree (confirmed via `git status --short src/` post-cleanup — clean). Worktree removed after the run (`git worktree remove --force`).

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `src/modules/moderation/domain/taxonomy-suggestion.ts:24-28` | Removed `.toLowerCase()` from `foldForDedup` (case-insensitivity broken) | ✅ Killed — `moderation/__tests__/taxonomy-suggestion.domain.spec.ts` "normaliza caso, acento e espaços…" failed (`expected 'tecnologia' to be 'Tecnologia'`) |
| 2 | `src/modules/moderation/actions/suggest-taxonomy.ts:66` | Disabled the `UNAUTHENTICATED` guard (`if (false && !person) …`) — anonymous callers reach the create path | ✅ Killed — `suggest-taxonomy.int.test.ts` "sem sessão (getCurrentPerson nulo) ⇒ UNAUTHENTICATED" failed (mutant hits `person.id` as `null.id` inside `withAudit`'s argument evaluation, caught and mapped to `INTERNAL` instead of the expected `ok:false/UNAUTHENTICATED` — still a failing/killed test, confirming the guard is load-bearing) |
| 3 | (shared with USP-018 report) `content-status.ts` TRANSITIONS — INACTIVATED non-terminal | n/a to USP-019 directly, recorded in the sibling report | ✅ Killed (cross-unit) |

**Sensor depth**: lightweight (2 mutations on USP-019-owned code + 1 shared with USP-018, totaling 3 across the unit — within the 1–3 target for non-P0 features).
**Result**: 2/2 USP-019-owned mutations killed (3/3 total across the unit). No survivors.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | --------------------------------------- | ------ | ----------------------- |
| SUGG-MN-01 | Oferecer pendente como selecionável | `suggest-taxonomy.int.test.ts:120-127` — sugestão criada ausente de `listApprovedJobAreas`; also `resolve-taxonomy-suggestion.int.test.ts:152-153` post-rejection | ✅ | Not separately mutated — `listApprovedJobAreas` filters `isSuggestion:false` (pre-existing, unmodified query); removing that filter is the same mutation class as INACT-MN-04's public-exclusion filter (already proven-killable, judged redundant to re-run) |
| SUGG-MN-02 | Aprovar/rejeitar sem `APPROVE_CATEGORY_SUGGESTION` | `resolve-taxonomy-suggestion.int.test.ts:169-191` — both actions return `FORBIDDEN`, state unchanged (`isSuggestion` still `true` / row still present) | ✅ | Not separately mutated in this run — `requirePermission` guard is the identical chokepoint pattern as the `suggestTaxonomy` auth guard (mutation #2 above), same class proven-killable |
| SUGG-MN-03 | Criar 2ª linha para nome que normaliza igual | `suggest-taxonomy.int.test.ts:106-118` (case/accent variant ⇒ `CONFLICT`, row count unchanged) + `:137-151` (exact-casing race ⇒ `CONFLICT` via `P2002`, no 500) | ✅ | ✅ Killed (Sensor mutation #1) |
| SUGG-MN-04 | Persistir sugestão/aprovação/rejeição sem `audit_log` na mesma tx | `suggest-taxonomy.int.test.ts:73-88` (1 `CATEGORY_SUGGESTED`) + `resolve-taxonomy-suggestion.int.test.ts:122-124` (1 `CATEGORY_APPROVED`) + `:141-150` (1 `CATEGORY_SUGGESTION_REJECTED`) — all three write paths use `withAudit(...)`, same atomic-tx mechanism independently proven by `audit/__tests__/withAudit.test.ts:136-146` | ✅ | Not re-mutated — shared, unmodified `withAudit` tx-atomicity mechanism |
| SUGG-MN-05 | Deixar rejeitada selecionável ou na fila | `resolve-taxonomy-suggestion.int.test.ts:152-153` (absent from `listApprovedJobAreas`) + `list-taxonomy-suggestions.int.test.ts:99-104` (absent from the pending queue — DELETE makes both conditions structurally impossible to violate independently) | ✅ | Structural: DELETE removes the only row that could satisfy either query; no separate mutation needed beyond confirming both negative assertions exist (they do) |

**Status**: ✅ All 5 must-nots proven — no missing or red negative test.

---

## Interactive UAT

Not performed — backend/Server-Action-first feature; `taxonomy-suggestions-list.spec.tsx` and `job-form.spec.tsx` RTL component tests already cover the rendering/interaction branches (item render, approve/reject wiring, "Outro" reveal, CONFLICT feedback) without requiring human visual judgment.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — no schema migration; only the audit-event catalog gained one string constant |
| Surgical changes | ✅ — new files scoped to the suggestion surface; only pre-existing files touched are `audit/events.ts` (+1 constant), `job-form.tsx` (new sub-flow), `no-deep-module-imports.test.ts` (exception-list update, not weakened — see deviation below) |
| No scope creep | ✅ — service-category suggestion entry UI correctly deferred (module `services` doesn't exist yet); action generic and tested for both kinds regardless |
| Matches existing patterns | ✅ — mirrors `decide.ts` action shape, `canAccessModerationQueue`-style guard, `(app)/moderacao/page.tsx` route shape, DS token usage (`Card`/`Badge`/`Button`, no raw hex/`dark:`) |
| Spec-anchored outcome check | ✅ — see AC table, all assertions target spec-defined exact values (error codes, field values, row counts, `before` content) |
| Per-layer coverage | ✅ — domain (`foldForDedup`) has dedicated unit spec covering all stated fold cases; actions cover happy/VALIDATION/FORBIDDEN/UNAUTHENTICATED/NOT_FOUND/CONFLICT/concurrency across both kinds |
| No unclaimed tests | ✅ — every test traces to a SUGG-NN/SUGG-MN-NN tag or an explicit edge case in its description |
| Documented guidelines followed | `CLAUDE.md` §Testing Requirements, §Server Action Pattern, §Audit Log (append-only) |

### Deviation 1 — `delegateFor()` replaced by explicit `switch` helpers

**Claim**: generic `delegateFor()` was replaced by explicit `switch(kind){case 'JOB_AREA': …; case 'SERVICE_CATEGORY': …}` helpers (`findExistingNames`/`createSuggestion` in `suggest-taxonomy.ts:30-51`; `findPending`/`approveRow`/`deleteRow` in `resolve-taxonomy-suggestion.ts:38-69`) because the Prisma `JobArea`/`ServiceCategory` delegates are not union-callable under strict mode without `as`/`any`.
**Verification**: confirmed correct and necessary — both files' switch statements are exhaustive over `TaxonomyKind` (`'JOB_AREA'|'SERVICE_CATEGORY'`, no `default` branch, so TS enforces exhaustiveness), and every action is exercised against **both** kinds in the integration suites (`suggest-taxonomy.int.test.ts:90-104`, `resolve-taxonomy-suggestion.int.test.ts:218-232`), all green. `npm run typecheck` is clean (no `as`/`any` escape hatches introduced). Judged: correct engineering response to a real TS-strict constraint, not scope creep — same amount of logic, safer shape.

### Deviation 2 — `job-form.tsx` direct action-file import + `eslint-disable no-restricted-imports`

**Claim**: `job-form.tsx` imports `suggestTaxonomy` from `@/modules/moderation/actions/suggest-taxonomy` (not the barrel) with `// eslint-disable-next-line no-restricted-imports`, and the allowlist in `src/shared/__tests__/no-deep-module-imports.test.ts` was extended to include it.
**Verification**: confirmed to match the pre-existing sanctioned pattern exactly. `no-deep-module-imports.test.ts:14-33`'s own comment documents the empirically-verified reason (barrel drags `next/headers`/`next/cache` server-only code into the client bundle via `transition-content.ts` → `shared/container.ts`) and explicitly lists `jobs/components/job-form.tsx` alongside the 2 pre-existing exceptions (`persons/components/{candidate-form,provider-form}.tsx`) as the **3rd** — not a new, separately-invented carve-out. `npm run build` (EXIT 0) is the empirical proof: `/vagas` route (which bundles `job-form.tsx`) compiled to 180 kB First Load JS without a "Failed to compile / needs next/headers" error, which is exactly the failure mode the guard's comment says an un-excepted deep import would trigger. Judged: correct, matches project convention, not a scope violation.

### Deviation 3 — integration cleanup never `DELETE`s `audit_log`

**Claim**: `afterAll`/`afterEach` cleanup in both new integration suites explicitly skips `audit_log` deletion, with an inline comment citing append-only.
**Verification**: confirmed correct, not a coverage gap. `suggest-taxonomy.int.test.ts` and `resolve-taxonomy-suggestion.int.test.ts` cleanup functions only `deleteMany` on `jobArea`/`serviceCategory`/`person`; the `audit_log` table has `REVOKE DELETE`/`REVOKE UPDATE` at the DB level per `CLAUDE.md` §Audit Log and ADR-T-0004 (also cited verbatim in `inactivate-content.int.test.ts:79` for the sibling USP-018 suite: "audit_log é append-only (DELETE bloqueado no DB)"). Attempting to delete would raise a Postgres permission error, not silently succeed — so the omission is required, not an oversight. No stale-data risk to the tests themselves: all assertions filter `audit_log` by `entityId`/`action` scoped to freshly-created rows.

---

## Edge Cases

- [x] Nome vazio/só-espaços/<2/>60 → `VALIDATION` (`suggest-taxonomy.int.test.ts:129-135`, `it.each(['', '  ', 'x', 'y'.repeat(61)])`)
- [x] Corrida de 2 sugestões com mesmo casing exato → 1 `ok`, 1 `CONFLICT`, sem 500 (`suggest-taxonomy.int.test.ts:137-151`)
- [x] `id` inexistente/já resolvido → `NOT_FOUND` na aprovação e rejeição (`resolve-taxonomy-suggestion.int.test.ts:193-216`)
- [x] Coincidência semântica não-exata ("TI" vs "Tecnologia") deliberadamente NÃO pega pelo dedup automático — decisão humana na aprovação, conforme spec; comportamento não testável como bug (é o design)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **Result**: typecheck EXIT 0 · lint EXIT 0 · unit 940/940 passed (132 files) · integration 260/260 passed (45 files) · build EXIT 0 (routes `/moderacao/sugestoes` and `/vagas` w/ `job-form.tsx` compiled cleanly)
- **Skipped tests**: none observed
- **Failures**: none
- **E2E**: no dedicated E2E spec required by tasks.md for USP-019 (T6/T7 gate is `build`, not `e2e`); N/A

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --- | --- | --- |
| SUGG-01 | Pending | ✅ Verified |
| SUGG-02 | Pending | ✅ Verified |
| SUGG-03 | Pending | ✅ Verified |
| SUGG-04 | Pending | ✅ Verified |
| SUGG-05 | Pending | ✅ Verified |
| SUGG-06 | Pending | ✅ Verified |
| SUGG-07 | Pending | ✅ Verified |
| SUGG-08 | Pending | ✅ Verified |
| SUGG-MN-01 | Pending | ✅ Verified |
| SUGG-MN-02 | Pending | ✅ Verified |
| SUGG-MN-03 | Pending | ✅ Verified |
| SUGG-MN-04 | Pending | ✅ Verified |
| SUGG-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 8/8 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 2/2 USP-019-owned mutations killed (3/3 total across the unit with USP-018)
**Must-nots**: 5/5 green
**Gate**: typecheck ✓, lint ✓, unit 940/940 ✓, integration 260/260 ✓, build ✓

**What works**: Full suggest→approve/reject lifecycle proven at the integration layer with exact-value assertions across both `TaxonomyKind`s; dedup fold proven to catch case/accent/whitespace variants and killed under mutation; rejection proven to hard-delete with before-state preserved in the append-only audit log; permission guard proven at both unit and integration granularity; all three implementer deviations (switch-based delegate selection, direct action-file import with documented ESLint exception, audit_log-exempt cleanup) independently verified as correct engineering responses to real constraints, not shortcuts.

**Issues found**: none.

**Next steps**: none required for PASS.
