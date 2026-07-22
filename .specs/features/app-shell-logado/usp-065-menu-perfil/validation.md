# USP-065 — Menu de Perfil Validation

**Date**: 2026-07-22
**Spec**: `.specs/features/app-shell-logado/usp-065-menu-perfil/spec.md`
**Diff range**: `a2c3707..cd986f8` (base → last commit, plano combinado 064+065)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T2 (`ProfileMenu`) | ✅ Done | `src/app/(app)/_components/profile-menu.tsx` — commit `139242e` |
| T4 (`AppHeader` mounts `ProfileMenu`, reframes MN-01) | ✅ Done | `src/app/(app)/_components/app-header.tsx` — commit `fbec79c` |
| T5 (`ThemeToggle` migration) | ✅ Done | `src/app/layout.tsx`, `(public)/layout.tsx`, `(auth)/layout.tsx` — commit `a866393` |

(T1/T3/T6 are USP-064-owned but touch shared files — see that spec's validation.md; both are part of the same 1-PR unit and were verified together.)

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| -------------------------- | --------------------- | ----------------------- | ------ |
| PROF-01: trigger de perfil abre painel | Avatar(inicial)+nome; abre `role="menu"` | `profile-menu.test.tsx:18-35` — `aria-expanded`, `aria-controls`, panel present/absent | ✅ PASS |
| PROF-01/06: painel exibe nome+papel; papel omitido se `roleLabel===''` | `data-testid="app-header-role-label"` presente só se não-vazio | `profile-menu.test.tsx:48-61` — `getByTestId`/`queryByTestId` (ausência direta, não texto-proxy) | ✅ PASS |
| PROF-02: controle de tema reusa `ThemeToggle`, persiste | `document.documentElement.dataset.theme` + `localStorage['theme']` alternam | `profile-menu.test.tsx:65-73` — asserts exact `'dark'` value in both DOM dataset and localStorage | ✅ PASS |
| PROF-03: Sair efetua logout (`SignOutForm` injetado) | Ação presente, painel fecha ao acionar | `profile-menu.test.tsx:77-91` | ✅ PASS |
| PROF-04: disclosure abre/fecha, `aria-expanded`/`aria-controls`/`aria-haspopup`/`aria-label` | Todos os 4 atributos presentes e corretos | `profile-menu.test.tsx:20-23` | ✅ PASS |
| PROF-05: `ThemeToggle` flutuante ausente em `(app)`, presente em `(public)`/`(auth)`, `ThemeScript` global | Source-scan exato por grupo | `theme-toggle-placement.test.ts:24-40` (3 assertions: raiz sem, public com, auth com) | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps. The PROF-06 (papel omitido) assertion specifically checks absence via `queryByTestId(...).not.toBeInTheDocument()` rather than a weaker "text not visible" check — matches spec's precise "sem placeholder" requirement.

---

## Discrimination Sensor

Ran in the real working tree via edit → test → revert (verified clean via `git diff cd986f8 -- <file>` = empty after each revert).

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `profile-menu.tsx:55-59` | Removed `{roleLabel && (...)}` guard — always renders the role `<p>` node (PROF-06 regression) | ✅ Killed — 3 tests failed simultaneously: `profile-menu.test.tsx:60` (component), `app-header.test.tsx:48` (integration), `layout.test.tsx:100` (composition-root) — strong triple-layer coverage |
| 2 | `src/app/layout.tsx` | Reintroduced floating `<ThemeToggle>` in root layout (PROF-MN-04 guard removal) | ✅ Killed — `theme-toggle-placement.test.ts:26` |
| 3 | `profile-menu.tsx:5` | Reintroduced `import type { HubAccess } from '@/modules/identity'` (PROF-MN-03 guard violation) | ✅ Killed — `profile-menu.test.tsx:100` (static-scan assertion fails) |

**Sensor depth**: lightweight (3 mutations targeting USP-065-owned new code — exceeds the 1-3 minimum for standard features given must-not density).
**Result**: 3/3 killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ---------- | ---------------------------------------- | ------ | ----------------------- |
| PROF-MN-01 | Import de `prisma`/`getCurrentPerson`/`requireActivePerson`/View Models/Server Actions/`'use server'` | `app-shell-no-auth-pii.test.ts:64-67` — asserts `profile-menu.tsx` is in the scanned-file list, plus `it.each(FORBIDDEN_PATTERNS)` sweep | ✅ | Guard is a source-scan; `profile-menu.tsx` imports only `react` + `@/shared/ui` (confirmed by reading the file) |
| PROF-MN-02 | Hex cru/paleta fixa/CDN/lib de ícone ou estado | `app-shell-uses-tokens.test.ts:63-66` — asserts `profile-menu.tsx` is in the scanned-file list, plus the 5 pattern sweeps | ✅ | Confirmed tokens-only (`bg-gradient-to-br from-primary to-secondary`, `text-fg`, `border-border`, etc.) |
| PROF-MN-03 | `ProfileMenu` (Client) importa o barrel `@/modules/identity` | `profile-menu.test.tsx:94-101` — static-scan asserts `source` does not match `/from\s+['"]@\/modules\/identity['"]/` | ✅ | ✅ Killed (mutation #3 above) |
| PROF-MN-04 | `ThemeToggle` flutuante montado em `(app)/*` | `theme-toggle-placement.test.ts:23-29` — asserts root layout has no `<ThemeToggle` but has `<ThemeScript` | ✅ | ✅ Killed (mutation #2 above) |
| PROF-MN-05 | `children` renderizado sem header persistente + trigger de perfil sempre visível (Sair alcançável) | `app-shell.test.tsx:67-97` (3 arbitrary `children` cases, all assert header+brand-link+trigger+reachable "Sair") + `app-header.test.tsx:51-59` + `layout.test.tsx:152-169` (composition-root regression) | ✅ | Not separately mutated in this pass — the PROF-06 mutation (#1) already demonstrates `app-shell.test.tsx`/`layout.test.tsx` exercise the real `AppHeader→ProfileMenu` tree and catch regressions in it; the three-location assertion (component/header/shell/layout) gives strong structural confidence that removing the trigger or the Sair action would be caught identically |

**Status**: ✅ All 5 must-nots proven (evidence-or-zero, all traced to `file:line`).

**Supersession check (A7)**: PROF-MN-05 explicitly reframes `APP-SHELL-MN-01` (USP-061) from "Sair sempre no DOM" to "trigger sempre visível + Sair alcançável ao abrir". Confirmed in `app-shell.test.tsx:67-97` — the old unconditional `getByRole('button', {name:'Sair'})` assertion is gone; the new test opens the trigger first (`fireEvent.click(trigger)`) before asserting Sair is present. This is a documented reframe, not a silent weakening — the trigger-always-visible half of the guarantee is still asserted unconditionally (line 89), and Sair reachability is asserted immediately after one click, preserving the "no dead end" property.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| No features beyond what was asked | ✅ — no extra menu sections (Account, Feature previews, etc. — explicitly Out of Scope and absent); no avatar image upload (Out of Scope, absent) |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — `profile-menu.tsx` (new), `app-header.tsx`, 3 layout files, guards; zero unrelated files |
| Didn't "improve" unrelated code | ✅ — `ThemeToggle`/`ThemeScript` logic untouched (confirmed: `theme-toggle.tsx` not in diff) |
| Matches existing patterns/style | ✅ — disclosure pattern mirrors `PublicNav` (`useState`, `aria-expanded`/`aria-controls`) exactly |
| Would senior engineer approve? | ✅ |
| Tests map to ACs, non-shallow | ✅ — spot-checked PROF-06: uses `queryByTestId(...).not.toBeInTheDocument()` (kills the "renders empty node" mutant), not a weaker text-content check |
| Spec-anchored outcome check | ✅ — see table above |
| Per-layer coverage (domain 1:1; routes happy+edge+error) | ✅ — `ProfileMenu` is presentational-only; `SignOutForm` untouched, injected via prop per A4 |
| Every test maps to a spec AC/must-not — no unclaimed tests | ✅ |
| Documented guidelines followed | CLAUDE.md (RTL component tests, "SignOutForm via prop" pattern per L-021), `docs/arch/project-guideline.md` §18 DoD |

---

## Edge Cases

- [x] `roleLabel===''` → só o nome (sem nó de papel) — `profile-menu.test.tsx:57-61`
- [x] `localStorage` indisponível → controle de tema degrada sem lançar — herdado do `ThemeToggle` (componente reusado verbatim, sem reescrita; guard de degradação já testado em `theme-toggle.test.tsx`, fora do escopo desta unidade)
- [x] Painel fechado → nome/papel/tema/Sair fora do fluxo (só trigger focável) — `profile-menu.test.tsx:24` (`document.getElementById('profile-menu-panel')` not in document when closed)
- [x] Rota `(public)`/`(auth)` → tema no `ThemeToggle` flutuante — `theme-toggle-placement.test.ts:32-40`

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && NODE_ENV=production npm run build`
- **Result**: typecheck 0 errors; lint 0 errors/warnings; **296 test files / 2107 tests passed, 0 failed**; production build succeeded
- **Test count**: matches Implementer's reported count (2107 tests / 296 files)
- **Skipped tests**: none
- **Failures**: none

**Exhaustive `ThemeToggle` placement check** (explicitly requested by orchestrator): confirmed by direct source read —
- `src/app/layout.tsx`: only `<ThemeScript/>` in `<head>`; body has no `<ThemeToggle>` — **0 toggles** ✓
- `src/app/(public)/layout.tsx`: `<ThemeToggle className="fixed bottom-4 right-4 z-50 shadow-md" />` — **1 toggle** ✓
- `src/app/(auth)/layout.tsx`: same floating toggle — **1 toggle** ✓
- `src/app/(app)/_components/app-header.tsx` → `ProfileMenu` → `<ThemeToggle className="h-8 w-8"/>` inside the dropdown panel — **1 toggle**, not floating, not duplicated with a floating one (no floating toggle exists anywhere in the `(app)` render tree — confirmed no `(app)/*` file other than `profile-menu.tsx` imports `ThemeToggle`) ✓
- Every route group has **exactly 1** place to switch theme: never 0, never 2. Confirmed exhaustive — the only 4 files in the repo that render `<ThemeToggle` are these 3 layouts + `profile-menu.tsx` (verified via `grep -rn '<ThemeToggle' src/`).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| PROF-01 | Pending | ✅ Verified |
| PROF-02 | Pending | ✅ Verified |
| PROF-03 | Pending | ✅ Verified |
| PROF-04 | Pending | ✅ Verified |
| PROF-05 | Pending | ✅ Verified |
| PROF-06 | Pending | ✅ Verified |
| PROF-MN-01 | Pending | ✅ Verified |
| PROF-MN-02 | Pending | ✅ Verified |
| PROF-MN-03 | Pending | ✅ Verified |
| PROF-MN-04 | Pending | ✅ Verified |
| PROF-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Must-nots**: 5/5 green
**Gate**: typecheck + lint + 2107 tests + production build all green

**What works**: `ProfileMenu` dropdown (trigger avatar+nome, painel nome+papel condicional+tema+Sair), `ThemeToggle` reused unmodified inside the panel, `SignOutForm` injected via prop (no barrel import — build-safe), `ThemeToggle` migration is exhaustive and non-duplicated across all route groups, PROF-MN-05 reframe of APP-SHELL-MN-01 is a documented supersession (not a silent weakening).

**Issues found**: none

**Next steps**: none — PASS
