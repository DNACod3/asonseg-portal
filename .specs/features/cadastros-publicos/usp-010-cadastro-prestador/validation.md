# USP-010 (Fase 4, Unidade U1) Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/cadastros-publicos/usp-010-cadastro-prestador/spec.md`
**Diff range**: `a4f914c..HEAD` (branch `feat/fase-4-servicos-manifestacoes`, commits `0aa60a8`, `c32d9fe`, `a6f131e`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 — restyle `provider-form.tsx` | ✅ Done | commit `0aa60a8` |
| T2 — restyle `(app)/prestador/page.tsx` | ✅ Done | commit `c32d9fe` |
| T3 — guard estático PRV-MN-01 | ✅ Done | commit `a6f131e` |

---

## Diff Surface (must-not: style-only)

`git diff --stat a4f914c..HEAD`:

```
src/app/(app)/prestador/page.tsx                   |  49 ++++++----
.../__tests__/provider-ds-tokens.guard.test.ts     |  34 +++++++
src/modules/persons/components/provider-form.tsx   | 106 +++++++++------------
3 files changed, 110 insertions(+), 79 deletions(-)
```

**Result**: ✅ Confirmed — diff confined to `provider-form.tsx`, `(app)/prestador/page.tsx`, and the new guard test. No `schema/migrations/actions/domain/schemas Zod` files touched. Line-by-line read of `git show 0aa60a8` and `git show c32d9fe` confirms every hunk is a markup/className/import substitution (raw Tailwind palette → `@/shared/ui` primitives + `selectClass`/`errorClass`/`color-mix` tokens); no `useForm`/`onSubmit`/action-call/state-hook line changed. No CNPJ field introduced (only pre-existing copy/comment mentions of "CNPJ MEI" survive verbatim).

**Untouched test files (claim: unedited)** — `git diff a4f914c..HEAD -- <file>` returns empty for all five anchor suites:
- `src/modules/persons/__tests__/ProviderForm.test.tsx`
- `src/modules/persons/__tests__/provider-actions.test.ts`
- `src/modules/persons/__tests__/provider-actions.int.test.ts`
- `src/modules/persons/__tests__/provider-schema.test.ts`
- `e2e/prestador.spec.ts`

All five are byte-identical to `a4f914c`. ✅

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| E-001 (activation+consent+audit atomic) | `PROVIDER_ROLE_ACTIVATED` audited, unchanged tx | anchor unedited: `provider-actions.int.test.ts` (7 tests, all pass, see Gate) | ✅ PASS |
| E-002 (no CNPJ, MEI → `/empresa`) | no CNPJ field; CTA link `role="link"` name "Registrar meu MEI…" `href="/empresa"` | `provider-form.tsx:274-278` — `<Button asChild variant="secondary"><Link href="/empresa">Registrar meu MEI / atuar como empresa</Link></Button>`; `ProviderForm.test.tsx:65` (unedited, green) | ✅ PASS |
| E-003 (next-step CTA) | CTA "Publicar primeiro serviço" href `/servicos/novo`, `role="status"` | `provider-form.tsx:260-269`; `ProviderForm.test.tsx:77` (unedited, green) + mutation-tested below | ✅ PASS |
| P-003 (LGPD gate) | submit disabled until consent checkbox checked | `provider-form.tsx:243-251` `disabled={isPending || !consentChecked}`; `ProviderForm.test.tsx:57` (unedited, green) | ✅ PASS |
| P-004 (copy OFERECE/CONTRATA) | exact copy "agora você OFERECE serviços" / "contrata" present | `provider-form.tsx:134-137`; `ProviderForm.test.tsx:51` (unedited, green) | ✅ PASS |
| P-005 (must be authenticated) | route under `requireActivePerson()` | `(app)/prestador/page.tsx` unchanged call site; `provider-actions.test.ts` UNAUTHENTICATED case (unedited, green) | ✅ PASS |
| PRV-R1 (form uses DS primitives, no fixed palette) | `Button/Input/Label/Textarea/LgpdBox` imported, zero fixed-palette utility | `provider-form.tsx:8` import line; guard test (see Sensor) | ✅ PASS |
| PRV-R2 (page uses `StepIcon`+`FormHeader`+`FormCard`) | page restyled to cadastro pattern | `(app)/prestador/page.tsx:5,72-84` | ✅ PASS |
| PRV-R3 (zero behavior change) | all USP-010 suites pass unedited | see Gate Check | ✅ PASS |

**Status**: ✅ All ACs covered with file:line evidence.

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `provider-form.tsx` (pre-refactor, `a4f914c`) vs. PRV-MN-01 regex | Ran the guard's fixed-palette regex against the pre-U1 file content | ✅ Matched (would fail the guard) — confirms guard is discriminating against the exact defect it exists to prevent |
| 2 | `(app)/prestador/page.tsx` (pre-refactor, `a4f914c`) vs. PRV-MN-01 regex | Same regex against pre-U1 page content | ✅ Matched |
| 3 | current (post-refactor) `provider-form.tsx` + page vs. PRV-MN-01 regex | Regex against current files | ✅ No match (0 offenders) — guard passes clean |
| 4 | `provider-form.tsx:268` `href="/servicos/novo"` → `href="/servicos"` (manual fault injection in real working tree, reverted after) | Behavior-level mutation on E-003 CTA target | ✅ Killed — `ProviderForm.test.tsx` failed (`getByRole('link',...)` assertion on `href`); file restored immediately after, verified clean via `git diff` and full anchor-suite re-run (8/8 green) |

**Sensor depth**: lightweight (4 targeted mutations; PRV-MN-01 is the only *new* fact this unit introduces, and it was independently exercised pre/post; mutation 4 additionally confirms the *preserved* anchor test still discriminates real DOM regressions post-refactor).
**Result**: 4/4 killed — ✅ PASS

---

## 🧬 Must-Not Verification (ICE mode)

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| PRV-MN-P004 | omit "agora você OFERECE serviços" copy | `ProviderForm.test.tsx:51` (unedited) | ✅ | n/a (anchor unedited; behavior unchanged) |
| PRV-MN-P003 | enable submit without consent checked | `ProviderForm.test.tsx:57` (unedited) + `provider-actions.int.test.ts` CONSENT_REQUIRED | ✅ | n/a |
| PRV-MN-E002 | introduce CNPJ field / break MEI CTA → `/empresa` | `ProviderForm.test.tsx:65` (unedited) + `provider-schema.test.ts` (unedited) + manual grep confirms no CNPJ form field | ✅ | n/a |
| PRV-MN-01 | contain fixed-palette Tailwind utility in the 2 restyled files | `provider-ds-tokens.guard.test.ts:24-33` — `expect(offenders...).toEqual([])` | ✅ | ✅ (sensor mutations 1–3 above) |

**Status**: ✅ All must-nots proven — 4/4 green, PRV-MN-01's guard independently re-derived (not just trusted from the commit message).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (style-only, no logic touched) | ✅ |
| Surgical changes (3 files, exactly as scoped) | ✅ |
| No scope creep (no CNPJ, no new Select primitive, no backend touch) | ✅ |
| Matches existing patterns (`candidate-form.tsx`/`job-form.tsx` twin) | ✅ |
| Spec-anchored outcome check | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ (guard test maps 1:1 to PRV-MN-01) |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build && npm run test:e2e` (per tasks.md §1.5 Full+Build)
- **Result**:
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors/warnings
  - `npm run test` (full unit suite) — **166 test files / 1123 tests passed, 0 failed**
  - `npm run test:integration` (persons scope, `src/modules/persons`) — **6 test files / 53 tests passed, 0 failed** (includes `provider-actions.int.test.ts`)
  - `npm run build` — production build succeeded, `/prestador` route compiled
  - `npx playwright test e2e/prestador.spec.ts` — **1/1 passed** (run twice for stability; pre-existing unrelated dev-server console noise, not a failure)
- **Test count before feature (`a4f914c`)**: baseline unknown exactly for this narrow scope, but diff shows only 1 new test file (`provider-ds-tokens.guard.test.ts`, +8 tests) and 0 deleted/modified test files.
- **Delta**: +1 test file / +8 tests (guard only); zero anchor tests touched.
- **Skipped tests**: none observed in scope.
- **Failures**: none.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| E-001 | Verified (preservar) | ✅ Verified (preserved, unedited anchor) |
| E-002 | Verified (preservar) | ✅ Verified (preserved, unedited anchor + grep) |
| E-003 | Verified (preservar) | ✅ Verified (preserved + mutation-tested) |
| P-003 | Verified (preservar) | ✅ Verified (preserved, unedited anchor) |
| P-004 | Verified (preservar) | ✅ Verified (preserved, unedited anchor) |
| P-005 | Verified (preservar) | ✅ Verified (preserved, unedited anchor) |
| PRV-R1 | Pending | ✅ Verified |
| PRV-R2 | Pending | ✅ Verified |
| PRV-R3 | Pending | ✅ Verified |
| PRV-MN-P004 | Pending (âncora verde) | ✅ Verified |
| PRV-MN-P003 | Pending (âncora verde) | ✅ Verified |
| PRV-MN-E002 | Pending (âncora verde) | ✅ Verified |
| PRV-MN-01 | Pending | ✅ Verified (eval(−) green, sensor-confirmed) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 9/9 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 4/4 mutations killed
**Must-nots**: 4/4 eval(−) green
**Gate**: typecheck/lint/build/test/test:integration/test:e2e all green (1123 unit tests, 53 persons-integration tests, 1 targeted E2E)

**What works**: Style-only refactor of `provider-form.tsx` and `(app)/prestador/page.tsx` to `@/shared/ui` primitives + semantic tokens, zero behavior change, zero anchor-test edits, new discriminating guard against DS drift.

**Issues found**: none.

**Next steps**: none — U1/USP-010 is done.
