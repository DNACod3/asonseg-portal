# USP-009 (Fase 3, Unidade U1) Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/cadastros-publicos/usp-009-cadastro-candidato/spec.md`
**Diff range**: `042c8c1..HEAD` (branch `feat/fase-3-candidaturas-busca-cv`, commits `bf381b1`, `68f256d`, `22440db`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 — restyle `candidate-form.tsx` | ✅ Done | commit `bf381b1` |
| T2 — restyle `(app)/candidato/page.tsx` | ✅ Done | commit `68f256d` |
| T3 — guard estático CAD-MN-03 | ✅ Done | commit `22440db` |

---

## Diff Surface (must-not: style-only)

`git diff --stat 042c8c1..HEAD`:

```
.specs/.../usp-009-cadastro-candidato/design.md    | 243 ++++++++----------
.specs/.../usp-009-cadastro-candidato/spec.md      | 138 +++++++----
.specs/.../usp-009-cadastro-candidato/tasks.md     | 259 ++++++++++++++-------
src/app/(app)/candidato/page.tsx                   |  47 ++--
.../__tests__/candidate-ds-tokens.guard.test.ts    |  34 +++
src/modules/persons/components/candidate-form.tsx  |  94 ++++----
6 files changed, 497 insertions(+), 318 deletions(-)
```

**Result**: ✅ Confirmed — diff confined to `candidate-form.tsx`, `(app)/candidato/page.tsx`, the new guard test, and the 3 spec docs. No `schema/migrations/actions/domain/schemas Zod` files touched (`git diff --name-only` grep for those paths returns empty). Matches spec Out-of-Scope table verbatim.

**Untouched test files (claim: unedited)** — confirmed via `git diff --name-only 042c8c1..HEAD | grep test`: only `candidate-ds-tokens.guard.test.ts` (new file) appears. `CandidateForm.test.tsx`, `candidate-actions.test.ts`, `candidate-actions.int.test.ts`, `candidate-schema.test.ts`, `e2e/candidato.spec.ts` are all absent from the diff — not modified. ✅

**Known pre-existing auth-spec failures out of scope** — `git diff --name-only 042c8c1..HEAD | grep -iE "auto-cadastro|login|recuperar-senha|reivindicar-credencial"` returns empty. Their sources are not in this diff. ✅

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| CAD-01 (preserve, DRAFT on submit) | `CandidateProfile.publicationStatus = 'DRAFT'` on happy path | `src/modules/persons/__tests__/candidate-actions.int.test.ts` — "CAD-01 happy path: cria CandidateProfile em DRAFT" (green, unedited) | ✅ PASS |
| CAD-03 (preserve, DRAFT→IN_MODERATION via `transitionContent`) | status transitions to `IN_MODERATION`; reject `INVALID_TRANSITION` from `IN_MODERATION` | `candidate-actions.int.test.ts` — "CAD-03 happy path" + "CAD-03 borda: reenviar... INVALID_TRANSITION" (green, unedited) | ✅ PASS |
| CAD-05 (preserve, LGPD gate) | submit disabled until consent accepted | `CandidateForm.test.tsx:58` — `expect(screen.getByRole('button', {name: /salvar cadastro/i})).toBeDisabled()` (green, unedited) | ✅ PASS |
| CAD-R1 (form uses `@/shared/ui` primitives + tokens, no fixed-palette utility) | 0 fixed-palette matches in `candidate-form.tsx` | `candidate-form.tsx:1-251` (source review) + `candidate-ds-tokens.guard.test.ts:28` — `expect(offenders...).toEqual([])` | ✅ PASS |
| CAD-R2 (page uses `StepIcon`+`FormHeader`+`FormCard`, no fixed-palette utility) | 0 fixed-palette matches in `(app)/candidato/page.tsx`; build/E2E green | `page.tsx:1-89` (source review, imports `FormCard, FormHeader, StepIcon` from `@/shared/ui`) + guard test above + `npm run build` (0 errors) + `e2e/candidato.spec.ts` (1/1 green) | ✅ PASS |
| CAD-R3 (identical behavior, all USP-009 suites green unedited) | 0 edits to the 5 anchor suites; all green | See Gate Check below (30 unit/component + 9 integration = 39 tests green, 0 edited files) | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps.

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `src/app/(app)/candidato/page.tsx:82` | Replaced `bg-[color-mix(...--color-danger...)]` with fixed-palette `bg-blue-600` on the "termo indisponível" error box | ✅ Killed — `candidate-ds-tokens.guard.test.ts` failed (`expected [Array(1)] to deeply equal []`), reverted, re-confirmed green |
| 2 | `src/modules/persons/components/candidate-form.tsx:196` | Appended fixed-palette `text-red-600` to the consent checkbox `className` | ✅ Killed — same guard test failed on the second target file, reverted, re-confirmed green |
| 3 (must-not guard, CAD-MN-01) | `src/modules/persons/components/candidate-form.tsx:217,234` | Removed the LGPD gate: `disabled={isPending \|\| !consentChecked}` → `disabled={isPending}` | ✅ Killed — untouched `CandidateForm.test.tsx` "exibe o termo e desabilita o envio até o aceite (CAD-05)" failed (`Received element is not disabled`), reverted, re-confirmed green (5/5) |

**Sensor depth**: lightweight (default tier — style-only refactor, no P0/critical-path new logic)
**Result**: 3/3 killed — PASS ✅. All mutations applied and reverted in the real working tree (no worktree/stash available mid-session); `git status --short` confirmed zero residue on all 3 target files after each revert.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| CAD-MN-01 | Enable/submit without `JOB_APPLICATION` consent accepted | `CandidateForm.test.tsx:58` — `expect(button).toBeDisabled()` (unedited) | ✅ | ✅ (mutation 3 above) |
| CAD-MN-02 | Change `publicationStatus` other than via `transitionContent()` | `candidate-actions.int.test.ts` — DRAFT→IN_MODERATION via `transitionContent` + "CAD-03 borda: reenviar... INVALID_TRANSITION" (unedited) | ✅ | Not independently re-mutated this session (backend files out of this unit's diff surface entirely — no line changed to point a UI-level mutation at; spec/task explicitly scope CAD-MN-02 ownership to "T1 (UI não introduz caminho de status)", proven by absence of any new Prisma/status-write call in the diff — confirmed by source read of `candidate-form.tsx`, zero `prisma`/`.update(` occurrences) |
| CAD-MN-03 | Contain fixed-palette Tailwind utilities in the 2 restyled files | `candidate-ds-tokens.guard.test.ts:28` — `expect(offenders.map(o=>o.file)).toEqual([])` | ✅ | ✅ (mutations 1 and 2 above, one per target file) |

**Status**: ✅ All must-nots proven.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (style-only, no logic added) | ✅ |
| Surgical changes (2 files restyled + 1 new guard test) | ✅ |
| No scope creep (no touch to schema/actions/domain/Zod) | ✅ |
| Matches existing patterns (`job-form.tsx` `selectClass`/`errorClass`, `empresa/cadastrar` `StepIcon`+`FormHeader`+`FormCard`, `no-external-verify.test.ts` guard pattern) | ✅ |
| Spec-anchored outcome check | ✅ |
| Every test in scope maps to a spec AC/must-not — no unclaimed tests | ✅ |
| Documented guidelines followed | `CLAUDE.md`, `docs/arch/project-guideline.md`, AD-014/015/016 DS pattern |

---

## Gate Check

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | ✅ 0 errors |
| Lint | `npm run lint` | ✅ 0 errors |
| Unit/Component (full suite) | `npm run test` | ✅ 142 files / 1000 tests passed |
| Unit/Component (USP-009 scoped, verbose) | targeted run of `CandidateForm.test.tsx`, `candidate-ds-tokens.guard.test.ts`, `candidate-schema.test.ts`, `candidate-actions.test.ts` | ✅ 4 files / 30 tests passed |
| Integration | `candidate-actions.int.test.ts` via `vitest.integration.config.ts` (Supabase local, :55321/:55322) | ✅ 1 file / 9 tests passed |
| Build | `npm run build` | ✅ compiled, `/candidato` route present, 0 errors |
| E2E (USP-009) | `npx playwright test e2e/candidato.spec.ts` | ✅ 1/1 passed |

**Test count before feature**: N/A (style-only refactor of an already-implemented feature; no test file in the 5 anchor suites was edited — count is unchanged by definition)
**Test count after feature**: +1 test file (`candidate-ds-tokens.guard.test.ts`), +1 test case, 0 removed
**Skipped tests**: none
**Failures**: none

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --- | --- | --- |
| CAD-01 | Verified (preservar) | ✅ Verified (preserved, unedited anchor green) |
| CAD-03 | Verified (preservar) | ✅ Verified (preserved, unedited anchor green) |
| CAD-05 | Verified (preservar) | ✅ Verified (preserved, unedited anchor green) |
| CAD-R1 | Pending | ✅ Verified |
| CAD-R2 | Pending | ✅ Verified |
| CAD-R3 | Pending | ✅ Verified |
| CAD-MN-01 | Pending | ✅ Verified |
| CAD-MN-02 | Pending | ✅ Verified |
| CAD-MN-03 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Must-nots**: 3/3 green (2 independently re-mutated against their own guard this session; CAD-MN-02 verified by unedited-test evidence + absence of any status-write path in the diff, backend files not in this unit's surface)
**Gate**: typecheck/lint/build/test/test:integration/test:e2e all green

**What works**: Full style-only restyle of `candidate-form.tsx` and `(app)/candidato/page.tsx` to DS primitives/tokens; zero behavior drift (39 pre-existing tests green unedited); new discriminant guard against DS token drift; E2E route confinement intact.

**Issues found**: none

**Next steps**: None — unit U1 (USP-009) is verified PASS. Proceed to next Fase 3 unit.
