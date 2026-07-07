# USP-006 Ativar papel adicional — Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-006-ativar-papel/spec.md`
**Diff range**: `28578fc..HEAD` (commits `d2767a9`, `64cbbfe` — 2 of the 5 Group D commits)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | Done | `refactor(identity): restyle ActivateRoleForm com Design System (AD-014) - so estilo` (`d2767a9`) |
| T2   | Done | `refactor(identity): restyle pagina de ativar papel (perfil/papeis) com Design System (AD-014)` (`64cbbfe`) |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| P1-AC1: `ActivateRoleForm` reestilizado usa `Label`/`Input`/`Button` do `@/shared/ui` + danger-token, preservando fluxo | Import de `Button, Input, Label` de `@/shared/ui`; comportamento (payload, redirect) idêntico | `src/modules/identity/components/activate-role-form.tsx:5` — `import { Button, Input, Label } from '@/shared/ui'`; `activate-role-form.tsx:66-232` unchanged handler/state logic (diff shows only className/JSX changes); `src/modules/identity/__tests__/ActivateRoleForm.test.tsx:66` — `expect(activateAdditionalRole).toHaveBeenCalledWith(...)` | PASS |
| P1-AC2: `perfil/papeis/page.tsx` composto com `FormHeader`(+`StepIcon`), sem paleta crua, preservando `dynamic`/`requireActivePerson`/`buildActivatableOptions` verbatim | Linhas de `dynamic`, `requireActivePerson()`, snapshot, `buildActivatableOptions` inalteradas no diff | `src/app/(app)/perfil/papeis/page.tsx` diff (`git diff 28578fc..HEAD`) — hunk shows `export const dynamic = 'force-dynamic'`, `await requireActivePerson()`, `buildActivatableOptions(snapshot, activeRoles)` lines untouched (no `-`/`+` on those lines); only `<header>` block replaced with `<StepIcon>`+`<FormHeader>` | PASS |
| P1-AC3: telas em dark mode resolvem cores via tokens, sem hex cru | No `bg-blue-*`, `text-gray-*`, `border-gray-*`, `accent-blue-*` in the diff's added lines | `git diff 28578fc..HEAD -- .../activate-role-form.tsx .../perfil/papeis/page.tsx \| grep '^+' \| grep -E 'text-gray-\|bg-blue-\|border-gray-\|accent-blue-'` → no matches (command run, zero output) | PASS |

**Status**: All ACs covered.

---

## Discrimination Sensor

Run in a disposable `git worktree` (`git worktree add .../verify-wt HEAD`), never on the real tree; every mutation reverted before `git worktree remove`.

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/identity/components/activate-role-form.tsx:232` | `disabled={!accepted \|\| isPending}` → `disabled={isPending}` (removes U6-MN-01 accept-gate) | Killed — `ActivateRoleForm.test.tsx` "opção única auto-selecionada..." fails: `expect(...).toBeDisabled()` receives an enabled button |

**Sensor depth**: lightweight (1 targeted mutation on the must-not guard; USP-006's only must-not, U6-MN-01, has two guard clauses — the accept-checkbox clause was mutated; the missing-fields clause is exercised identically by the sibling test "campos faltantes não preenchidos → validação client-side e NÃO chama a action", same code shape, same protection mechanism — not independently mutated to keep scope proportional).
**Result**: 1/1 killed — PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U6-MN-01 | Chamar `activateAdditionalRole` com campos faltantes vazios OU sem aceite do termo marcado | `src/modules/identity/__tests__/ActivateRoleForm.test.tsx:57` — "campos faltantes não preenchidos → validação client-side e NÃO chama a action" (`expect(activateAdditionalRole).not.toHaveBeenCalled()`); `ActivateRoleForm.test.tsx:48-54` — accept-gate: `expect(screen.getByRole('button', { name: 'Ativar papel' })).toBeDisabled()` | Yes (5/5 `ActivateRoleForm.test.tsx` cases green — see Gate Check) | Yes (see Discrimination Sensor #1) |

**Status**: Must-not proven.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | Yes — diff is markup/className only in both files |
| Surgical changes | Yes — no handler, state, action-call, or navigation line touched |
| No scope creep | Yes — `activate-additional-role.ts`, `schemas/activate-role.schema.ts`, `domain/role-activation.ts`, `server/build-activatable-options.ts`, `server/session.ts` are absent from `git diff 28578fc..HEAD --name-only` (confirmed by direct diff: 0 lines) |
| Matches patterns | Yes — mirrors `LoginForm.tsx` restyle precedent (danger-token box, `Label`/`Input`/`Button`) |
| Spec-anchored outcome check | Yes — see AC table above |
| Per-layer Coverage Expectation met | Yes — Client Component has 5/5 RTL cases incl. the must-not; Server Component page has no test per repo convention (build gate only), matching the spec's own decision table |
| Every test maps to a spec requirement | Yes — all 5 `ActivateRoleForm.test.tsx` cases map to P1-AC1/E-001/P-004/U6-MN-01 |
| Documented guidelines followed | `docs/arch/project-guideline.md` (DoD), AD-014 (Design System), CLAUDE.md §Testing Requirements |

---

## Edge Cases

- [x] Sem papéis ativáveis → mensagem em token (`bg-surface`/`text-fg-muted`), sem `text-gray-500` cru — confirmed in diff.
- [x] Campos faltantes não preenchidos → NÃO chama `activateAdditionalRole` — `ActivateRoleForm.test.tsx:57`, green.
- [x] Aceite não marcado → botão "Ativar papel" permanece desabilitado — `ActivateRoleForm.test.tsx:54`, green; sensor-confirmed discriminating.
- [x] Restyle não altera handlers/schema/action/payload/`dynamic`/textos — confirmed by diff inspection (action files: 0-line diff; page.tsx: only header block replaced).

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build` (T2 = Build gate, superset of T1's Quick gate)
- **Result**: typecheck 0 errors; lint 0 errors; unit tests 858/858 passed (0 failed, 0 skipped); build succeeded (`✓ Compiled successfully`, `/perfil/papeis` route present in output)
- **`ActivateRoleForm.test.tsx`**: 5/5 passed (spec-required count, unchanged)
- **Skipped tests**: none in this file set
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-14 (upstream) | Preserved | Verified — diff = 0 on `activate-additional-role.ts` and all domain/schema/server files |
| U6-STYLE-01 | Pending | Verified |
| U6-MN-01 | Pending | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 3/3 ACs matched spec outcome
**Sensor**: 1/1 mutations killed
**Must-nots**: 1/1 green
**Gate**: typecheck + lint + 858 unit tests + build all green

**What works**: `ActivateRoleForm` and `perfil/papeis/page.tsx` restyled to DS tokens (`Label`/`Input`/`Button`, danger-token error box, `FormHeader`+`StepIcon`) with zero behavioral diff; the canonical USP-006 Server Action sequence (`activate-additional-role.ts`) and all its supporting domain/schema/server files remain byte-identical (0-line diff) to `28578fc`; U6-MN-01's client guards proven both green and discriminating.

**Issues found**: none.

**Next steps**: none — PASS.
