# USP-016 — Moderar rascunho — Validation (Fase 2 restyle)

**Date**: 2026-07-07
**Spec**: `.specs/features/moderacao-conteudo/usp-016-moderar-rascunho/spec.md`
**Diff range**: `bb819b9..HEAD` (`a57df0e`, `8fac14a`, `c975c8f`)
**Verifier**: independent sub-agent (author ≠ verifier)

**Scope note**: this cycle is a style-only restyle (AD-015 pattern) of an already-implemented USP. The
behavioral ACs (E-001..E-004, AC5, AC6, P-003, P-005, P-006, P-007, L-001, L-003) are **baseline to
preserve**, not new work — their evidence is the pre-existing, untouched test suite. The new work is T4
(DS-16-01, DS-16-MN-1..3).

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (#121 domain) | ✅ Baseline (pre-existing, untouched) | `src/modules/moderation/domain/**` — 0 diff lines in range |
| T2 (#122 transitionContent) | ✅ Baseline (pre-existing, untouched) | `src/modules/moderation/actions/transition-content.ts` — 0 diff lines in range |
| T3 (#123 actions + fila) | ✅ Baseline (pre-existing, untouched) | `actions/decide.ts`, `schemas/decision.ts`, `queries/moderation-queue.ts` — 0 diff lines in range |
| T4 (restyle to DS) | ✅ Done | `a57df0e` (queue + page), `c975c8f` (planning docs) |

---

## Spec-Anchored Acceptance Criteria

### Baseline behavior (must not regress) — evidence via untouched, still-green tests

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ----------------------- | ------ |
| E-001 fila ordenada, autor≠moderador | itens `IN_MODERATION` ASC por `submittedAt`, exclui autor==viewer | `src/modules/moderation/queries/__tests__/moderation-queue.int.test.ts:67` — `it('P-005: exclui itens cujo autor é o próprio moderador')` | ✅ PASS (green, file untouched) |
| AC6 / P-006 única via | `INVALID_TRANSITION` fora da tabela; update+audit na mesma tx | `src/modules/moderation/__tests__/transition-content.int.test.ts:86` — `it('E-002/AC5/P-006: IN_MODERATION→ACTIVE grava status + audit CONTENT_APPROVED na mesma tx…')` | ✅ PASS (green, file untouched) |
| P-003 motivo ≥20 chars | rejeita motivo insignificante | `src/modules/moderation/actions/__tests__/decide.test.ts:78` — `it.each(...)('P-003: motivo insignificante "%s" retorna VALIDATION sem transitar')` | ✅ PASS (green, file untouched) |
| P-007 permissão | `FORBIDDEN` sem transitar quando sem permissão | `src/modules/moderation/actions/__tests__/decide.test.ts:41,86` | ✅ PASS (green, file untouched) |
| DS-16-MN-2 comportamento intacto (rótulos, 3 fluxos, gating, remoção do item, erros) | idêntico pré/pós restyle | `src/modules/moderation/components/__tests__/moderation-queue.test.tsx` (0 diff lines in range — file untouched, part of 887 unit-test green run) | ✅ PASS |

### New restyle ACs (T4)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ----------------------- | ------ |
| DS-16-01 primitivos/tokens em fila + página | zero paleta crua; `Button`/`Textarea`/`Badge`/`Label` de `@/shared/ui` | `src/modules/moderation/components/moderation-queue.tsx` (diff `a57df0e`) — `Badge`, `Button` (`variant="primary/secondary/danger/outline"`), `Textarea`, `Label` imported from `@/shared/ui`; `src/app/(app)/moderacao/page.tsx:94-98` — `font-heading text-fg` / `text-fg-muted` | ✅ PASS |
| DS-16-MN-1 sem paleta crua | 0 matches de `bg/text/border/ring-{gray,slate,blue,green,amber,red}-NN` nem hex | `src/shared/__tests__/ds-moderation-parity.test.ts:27-30` — `it.each(MODERATION_FILES)('%s não contém utilitário de paleta fixa', ...)` covering `moderation-queue.tsx` + `moderacao/page.tsx` | ✅ PASS (green in full run; sensor-confirmed discriminating, see below) |
| DS-16-MN-3 sem dark-mode ad-hoc | nenhum `dark:` / `prefers-color-scheme` introduzido | `grep -nE "dark:|prefers-color-scheme"` over diff `bb819b9..HEAD` for `moderation-queue.tsx`/`page.tsx`/`verification-panel.tsx` → 0 matches | ✅ PASS |

**Status**: ✅ All ACs covered (baseline preserved by evidence of untouched-and-green tests; new DS ACs covered by the guard test and manual diff inspection).

---

## Discrimination Sensor

Sensor run jointly for USP-016 and USP-017 (both restyle the same guard file); see full report and mutation
table in `usp-017-validar-empresa-primeira-vaga/validation.md`. Summary relevant to USP-016:

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `moderation-queue.tsx` (empty-state `<div>`) | Injected `bg-blue-600` into className | ✅ Killed — `ds-moderation-parity.test.ts` failed on `moderation-queue.tsx` |

**Sensor depth**: lightweight (2 mutations total across both USPs; see USP-017 report for the second)
**Result**: 2/2 killed — PASS ✅ (scratch git worktree at `/tmp/verify-ds-mutant`, discarded after run — real tree untouched)

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | ---------------------------------------- | ------ | ----------------------- |
| DS-16-MN-1 | reter paleta crua/hex em `moderation-queue.tsx`/`page.tsx` | `src/shared/__tests__/ds-moderation-parity.test.ts:27-34` | ✅ | ✅ (mutation above) |
| DS-16-MN-2 | alterar comportamento (rótulos, 3 fluxos, gating motivo ≥20, remoção do item, mensagens de erro) | `src/modules/moderation/components/__tests__/moderation-queue.test.tsx` (untouched, green in 887-test run) | ✅ | n/a — guarded by test-file immutability (0 diff) + gate green |
| DS-16-MN-3 | introduzir `dark:`/`prefers-color-scheme`/lib de tema | manual grep over diff (see AC table above) — 0 matches | ✅ | n/a (static absence check, not a runtime guard — acceptable per design §8.5 scope: only DS-16-MN-1 has a dedicated automated guard) |
| P-003 (behavioral) | aceitar motivo vazio/curto/genérico | `src/modules/moderation/actions/__tests__/decide.test.ts:78`, `src/modules/moderation/schemas/__tests__/decision.test.ts` | ✅ | n/a — server layer untouched, pre-existing coverage |
| P-005 (behavioral) | permitir autor==moderador na fila | `src/modules/moderation/queries/__tests__/moderation-queue.int.test.ts:67` | ✅ | n/a — server layer untouched, pre-existing coverage |
| P-006 (behavioral) | mudar status fora de `transitionContent` | `src/modules/moderation/__tests__/transition-content.int.test.ts:86` | ✅ | n/a — server layer untouched, pre-existing coverage |
| P-007 (behavioral) | moderação sem permissão | `src/modules/moderation/actions/__tests__/decide.test.ts:41,86` | ✅ | n/a — server layer untouched, pre-existing coverage |

**Status**: ✅ All must-nots proven.

**Note on DS-16-MN-3**: unlike DS-16-MN-1, there is no dedicated automated regex guard for `dark:`/
`prefers-color-scheme` introduction in this file (the parity test only checks raw-palette/hex). Evidence is
a manual `git diff` grep, not a green CI assertion — flagged as a minor gap, not blocking (absence is
verifiable and confirmed, but not machine-enforced going forward). Not required to block PASS since the
spec's DS-16-MN-1 (the primary must-not with a mandated negative test per design §8.5) is fully automated
and green.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — only 3 product files + 1 new test file touched |
| Surgical changes | ✅ — matches design.md §8.2/§8.3 mapping table line-for-line |
| No scope creep | ✅ — `ContentKind.CANDIDATE_PROFILE` drift explicitly left untouched (`domain/content-status.ts` — 0 diff lines) |
| Matches patterns | ✅ — same `color-mix`/token pattern as `Badge`/`StepIcon` (DS-MN-02), same guard pattern as `ds-login-parity.test.ts` |
| Spec-anchored outcome check | ✅ — see AC table |
| Every test maps to a spec requirement | ✅ — new guard test cites DS-16-MN-1/DS-17-MN-1 in its own docstring |
| Documented guidelines followed | AD-014/AD-015 (`.specs/project/STATE.md`), `CLAUDE.md` |

**Design decision confirmed acceptable**: `moderacao/page.tsx` header uses direct tokens (`font-heading
text-fg` / `text-fg-muted`) instead of `<FormHeader>` — documented in-code (page.tsx comment) and in
design.md §8.3 as a deliberate consistency call (FormHeader is centered, built for form screens; would
clash with this list layout). Judged **acceptable** — consistent with the AD-015 precedent of documenting
no-code-change consistency decisions.

---

## Gate Check

- **Gate commands**: `npm run typecheck`, `npm run lint`, `npm run test -- --run`, `npm run test:integration -- --run`, `npm run build`
- **Result**: typecheck 0 errors · lint 0 errors · unit 887/887 passed (126 files) · integration 219/219 passed (39 files) · build succeeded (28 routes)
- **Test count before/after feature**: not independently measurable pre-`bb819b9` in this session (restyle range only); no test files were added/removed except the new `ds-moderation-parity.test.ts` (+8 tests, shared with USP-017)
- **Skipped tests**: none observed
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ---------- |
| E-001..E-004, AC5, AC6, P-003, P-005, P-006, P-007, L-001, L-003 | Implemented (master) | ✅ Verified (preserved, non-regressed) |
| DS-16-01 | Implementing | ✅ Verified |
| DS-16-MN-1 | Implementing | ✅ Verified |
| DS-16-MN-2 | Implementing | ✅ Verified |
| DS-16-MN-3 | Implementing | ✅ Verified (manual evidence, not automated — see note) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: baseline ACs traced to untouched pre-existing tests (green); DS ACs traced to new guard test (green, sensor-confirmed discriminating)
**Sensor**: 2/2 mutations killed (shared report with USP-017)
**Must-nots**: 7/7 green (DS-16-MN-1..3 + P-003/P-005/P-006/P-007)
**Gate**: typecheck/lint/unit(887)/integration(219)/build all passed

**What works**: server layer (`domain/`, `actions/`, `queries/`, `schemas/`, `ports/`, `adapters/`, `views/`,
`server/`, `container.ts`) confirmed untouched (0 diff lines) — behavior preservation is structural, not
just tested. DS adoption is genuine: primitives (`Button`/`Badge`/`Textarea`/`Label`) imported and used with
correct variants per design.md §8.2 mapping; guard test kills an injected raw-palette mutation.

**Issues found**: none blocking. Minor: DS-16-MN-3 (no ad-hoc dark-mode) has no dedicated automated guard —
only a one-time manual grep. Low risk (regex guard for DS-16-MN-1 would catch most `dark:` reintroductions
incidentally if extended), but not currently enforced by CI.

**Next steps**: none required for PASS. Optional low-priority follow-up: extend
`ds-moderation-parity.test.ts` with a `dark:`/`prefers-color-scheme` regex check to make DS-16-MN-3
CI-enforced (currently only DS-16-MN-1 has that).
