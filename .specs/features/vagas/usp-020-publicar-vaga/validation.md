# USP-020 — Publicar vaga (Restyle Fase 2 / DS) — Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/vagas/usp-020-publicar-vaga/spec.md`
**Diff range**: `c83b0d8..HEAD` (9 commits; USP-020 commits: `9cac01d`, `d2fa682`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 — Restyle `JobForm` + RTL + guarda | ✅ Done | `src/modules/jobs/components/job-form.tsx`, `job-form.spec.tsx`, `ds-vagas-parity.test.ts` |
| T2 — Restyle casca `vagas/nova/page.tsx` | ✅ Done | `StepIcon`/`FormHeader`/`FormCard` composed around `JobForm` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 (form): DS primitives, zero raw palette/hex | `Label/Input/Textarea/Button/FormRow` from `@/shared/ui`, no `bg-blue-600`/`text-gray-*`/hex | `src/shared/__tests__/ds-vagas-parity.test.ts:40-49` — `expect(content).not.toMatch(FIXED_PALETTE_PATTERN)` + `.toMatch(/<Label\b/…)`; `job-form.tsx:185,197,207,288,297,369` raw `<select>`/`<input type=hidden\|checkbox>` kept (no DS equivalent, documented in guard comment L43-45) | ✅ PASS |
| AC2 (form): RHF + actions preserved | `submitJobForModeration`/`createJobDraft` unchanged, `ActionResult`→PT-BR mapping unchanged | `job-form.spec.tsx:121-156` (submit payload), `job-form.spec.tsx:157-…` (draft), `job-form.spec.tsx:60-75` (CONFLICT message) | ✅ PASS |
| AC3 (form): all fields preserved, same RHF binding | No field added/removed | `job-form.spec.tsx:99-120` — `U20-MN-05: todos os campos esperados renderizam` (12 `getByLabelText` assertions) | ✅ PASS |
| AC4 (form): error box uses `danger` token | Token-based error banner, same text/mapping | `job-form.spec.tsx:60-75` (CONFLICT message rendered); visual token verified via guard (no raw palette) | ✅ PASS |
| AC5 (form): dark-mode parity via tokens | No raw hex | `ds-vagas-parity.test.ts:40-49` (hex pattern) | ✅ PASS |
| AC1 (página): `StepIcon`+`FormHeader`+`FormCard` composition, no raw palette | Page composes the 3 primitives around `JobForm` | `src/app/(app)/empresa/[empresaId]/vagas/nova/page.tsx:66-76`; guard `ds-vagas-parity.test.ts:48-51` (`requiredPrimitives: StepIcon/FormHeader/FormCard`) | ✅ PASS |
| AC2 (página): company-selection/gate P-006 preserved | Preserved, presentation-only change | `page.tsx:38-49` (`personCompanyGrant` gate → `notFound()`) unchanged vs. base (only markup below the gate changed) | ✅ PASS |
| AC3 (página): session guard/metadata/dynamic/navigation preserved | Unchanged | `page.tsx:8` (`dynamic='force-dynamic'`), `requireActivePerson()` (`page.tsx:33`) unchanged | ✅ PASS |
| AC4 (página): dark-mode parity | No raw hex/palette | `ds-vagas-parity.test.ts` covers the page path | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps.

---

## Discrimination Sensor

Run against the shared restyle surface (see USP-022 report for full 3-mutation log; mutations 1 and 2 directly exercise the guard files this USP also depends on — `ds-vagas-parity.test.ts`).

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/jobs/components/job-card.tsx:34` | Injected `bg-blue-600` into a `className` (USP-021 file, same guard file `ds-vagas-parity.test.ts` that also covers USP-020's `job-form.tsx`/page) | ✅ Killed — `ds-vagas-parity.test.ts` failed as expected |

Full sensor log (3 mutations, all killed) recorded in `.specs/features/vagas/usp-022-detalhe-vaga/validation.md` — the guard mechanism (`node:fs` + regex over `className`) is identical across all three USPs' parity tests, so the kill evidence transfers.

**Sensor depth**: lightweight (shared across the 3-USP restyle unit)
**Result**: 1/1 targeted mutation on this USP's guard file killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U20-MN-01 | Non-responsible person publish/persist a job | `submit-job-for-moderation.int.test.ts` / `create-job-draft.int.test.ts` (untouched by this diff — preserved) | ✅ (part of 44/46 passing int files) | n/a — file not touched, no guard to mutate |
| U20-MN-02 | Accept submit with validade ≤ today or > 180d | `validade.spec.ts` + `submit-job-for-moderation.int.test.ts` (untouched) | ✅ | n/a |
| U20-MN-03 | Create duplicate live job (same company+area+title) | `submit-job-for-moderation.int.test.ts` (untouched) | ✅ | n/a |
| U20-MN-04 | Retain raw palette/hex in `JobForm`/page | `ds-vagas-parity.test.ts:84-88` — `expect(content).not.toMatch(FIXED_PALETTE_PATTERN)` / `not.toMatch(HEX_COLOR_PATTERN)` | ✅ | ✅ (sensor mutation 1, cross-file same guard mechanism) |
| U20-MN-05 | Change field set / RHF binding under restyle disguise | `job-form.spec.tsx:99-156` — field presence + submit payload equality | ✅ | not separately mutated this run (RTL asserts concrete payload equality — direct evidence, not solely guard-based) |

**Status**: ✅ All must-nots proven. U20-MN-01/02/03 are preservation must-nots whose owning files (`submit-job-for-moderation.ts`, `create-job-draft.ts`, `validade.ts`) are **not in the diff** (confirmed via `git diff c83b0d8..HEAD --name-only`) — structurally impossible for this restyle to have regressed them; their tests are green in the full `test` + `test:integration` runs (see Gate Check).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (style-only, no logic touched) | ✅ |
| Surgical changes (only `job-form.tsx` + page + tests) | ✅ |
| No scope creep | ✅ |
| Matches existing patterns (`RegisterPersonForm`/`LoginForm` restyle precedent, `cadastro/page.tsx` shell precedent) | ✅ |
| Spec-anchored outcome check | ✅ |
| Documented guidelines followed | `CLAUDE.md` §Testing, `project-guideline.md` §10/§18, AD-014/AD-015 |

**Deviation judged**: raw `<select>`/`<input type="hidden"\|"checkbox">` kept with token classes instead of a DS primitive. This is **not** an unplanned deviation — `tasks.md` T1 and the `ds-vagas-parity.test.ts` guard comment (L43-45) explicitly document that the DS foundation has no `<select>`/checkbox primitive yet. Judged **acceptable** — matches the plan, not a regression.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **Result**: typecheck 0 errors; lint 0 errors; unit 966/966 passed (134 files); integration 258/262 passed (44/46 files, 4 failures — see cross-USP pre-existing-flake finding below, not attributable to this USP's diff surface); build succeeded, `/empresa/[empresaId]/vagas/nova` compiles (180 kB First Load JS).
- **Test count before feature (master `c83b0d8`)**: 132 unit files / 940 tests.
- **Test count after feature (HEAD)**: 134 unit files / 966 tests.
- **Delta**: +2 files / +26 tests (no deletions, no weakened assertions).
- **Failures**: 4 integration tests in `search-jobs.int.test.ts`/`get-job-detail.int.test.ts` — **not in USP-020's surface**; see the shared pre-existing-flake finding in `usp-021-buscar-vagas-publica/validation.md` (root-caused and reproduced on pristine master).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| U20-STYLE-01 | Pending | ✅ Verified |
| U20-STYLE-02 | Pending | ✅ Verified |
| U20-MN-01 | Pending | ✅ Verified (preserved, untouched file) |
| U20-MN-02 | Pending | ✅ Verified (preserved, untouched file) |
| U20-MN-03 | Pending | ✅ Verified (preserved, untouched file) |
| U20-MN-04 | Pending | ✅ Verified |
| U20-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 9/9 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 1/1 targeted mutation killed (shared guard mechanism, full log in USP-022 report)
**Must-nots**: 5/5 green
**Gate**: typecheck ✅, lint ✅, unit 966/966 ✅, integration 258/262 (4 pre-existing/environmental failures outside this USP's diff surface), build ✅

**What works**: Full DS adoption on `JobForm` and the publish-job page shell; all RHF bindings, actions, and field sets preserved; guard catches raw-palette regressions (proven via mutation).

**Issues found**: None blocking. See cross-cutting flake finding in USP-021's report for the `dateOffset()`/`hojeSaoPaulo()` timezone-window issue (does not touch USP-020's files).

**Next steps**: None required for merge. Optional follow-up (shared across the 3 USPs): fix `dateOffset()` test helper to be UTC-safe (tracked as a residual, not a blocker).
