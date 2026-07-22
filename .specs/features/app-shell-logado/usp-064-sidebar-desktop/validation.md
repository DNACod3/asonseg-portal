# USP-064 — Sidebar colapsável Validation

**Date**: 2026-07-22
**Spec**: `.specs/features/app-shell-logado/usp-064-sidebar-desktop/spec.md`
**Diff range**: `a2c3707..cd986f8` (base → last commit, plano combinado 064+065)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (`AppSidebar`) | ✅ Done | `src/app/(app)/_components/app-sidebar.tsx` — commit `6190074` |
| T3 (`AppShell` flex-row) | ✅ Done | `src/app/(app)/_components/app-shell.tsx` — commit `b55687b` |
| T6 (wire layout + remove `AppDesktopMenu`) | ✅ Done | `src/app/(app)/layout.tsx` — commit `cd986f8` |

(T2/T4/T5 are USP-065-owned but touch shared files — see that spec's validation.md; both are part of the same 1-PR unit and were verified together.)

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| -------------------------- | --------------------- | ----------------------- | ------ |
| SIDE-01: sidebar completa role-aware em `≥ md` | Todos os grupos/links de `buildHubLinks`, agrupados | `app-sidebar.test.tsx:81-92` — `getByText('Minha conta')`, `getByText('Meus papéis')`, `queryByText('Institucional')` ausente para candidate-only | ✅ PASS |
| SIDE-02: expandido = ícone+rótulo+título; colapsado = só ícone | Rótulos/títulos visíveis só quando `!collapsed` | `app-sidebar.test.tsx:40-44` (expandido) + `:46-59` (colapsado, `queryByText('Minha conta')` ausente) | ✅ PASS |
| SIDE-03: toggle alterna e persiste (`localStorage`) | `localStorage['asonseg:sidebar-collapsed']==='true'` após toggle; lido no mount | `app-sidebar.test.tsx:46-59` (grava) + `:61-69` (lê ao montar) | ✅ PASS |
| SIDE-04: active-state longest-match, `aria-current="page"`, ≤1 ativo | `/perfil/papeis` ativo (não `/perfil`); sem match → nenhum ativo | `app-sidebar.test.tsx:96-118` (3 casos: exato, aninhado, sem-match) | ✅ PASS |
| SIDE-05: oculta `< md` | `hidden md:flex` na raiz | `app-sidebar.test.tsx:121-126` — regex `\bhidden\b` e `\bmd:flex\b` no `className` | ✅ PASS |
| SIDE-06: acessível (landmark `nav`, toggle `aria-pressed`/`aria-label`, nome acessível colapsado) | `aria-label`/`title` = rótulo quando colapsado | `app-sidebar.test.tsx:151-161` (SIDE-MN-05) + `app-sidebar.tsx:76,95,110-111` (source) | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps found (spec's numeric outcomes — allowlist membership, exact classNames, storage key — are all matched exactly by the assertions, not just "assertion exists").

---

## Discrimination Sensor

Ran in the real working tree via edit → test → revert (verified clean via `git diff cd986f8 -- <file>` = empty after each revert; confirmed no residual diffs before proceeding).

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `app-sidebar.tsx:110-111` | Removed `aria-label`/`title` on collapsed links (SIDE-06/SIDE-MN-05 guard) | ✅ Killed — `app-sidebar.test.tsx:156` (`getByRole('link', {name: 'Meu perfil'})` fails to resolve) |
| 2 | `layout.tsx` (root) | Reintroduced floating `<ThemeToggle>` in root layout (PROF-MN-04 guard removal, cross-cutting with USP-065 but exercises the same sidebar/shell composition path) | ✅ Killed — `theme-toggle-placement.test.ts:26` |

**Sensor depth**: lightweight (2 mutations targeting USP-064-owned new code; 2 additional mutations targeting USP-065-owned code are reported in that USP's validation.md — 4 total across the combined unit, all killed).
**Result**: 2/2 (USP-064-scoped) killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ---------- | ---------------------------------------- | ------ | ----------------------- |
| SIDE-MN-01 | Link fora de `EXISTING_HUB_ROUTES` | `app-sidebar.test.tsx:129-139` — `expect(EXISTING_HUB_ROUTES.includes(href)).toBe(true)` for every anchor, full-access groups | ✅ | Not separately mutated (allowlist itself is untouched reused code from USP-062/063 — no new must-not-specific mutation needed; SIDE-MN-05 mutation above proves the test file's discriminating power over `app-sidebar.tsx`) |
| SIDE-MN-02 | Grupo/link sem permissão | `app-sidebar.test.tsx:141-148` (candidate-only, no Institucional/moderação/relatórios) + `layout.test.tsx:137-150` (composition-root angle) | ✅ | n/a — reused `buildHubLinks` filtering (USP-061/062 already covered) |
| SIDE-MN-03 | Import de `prisma`/`getCurrentPerson`/`requireActivePerson`/View Models/Server Actions/`'use server'` | `app-shell-no-auth-pii.test.ts:59-62` — asserts `app-sidebar.tsx` is in the scanned-file list, plus `it.each(FORBIDDEN_PATTERNS)` sweep | ✅ | Guard is a source-scan over the whole dir; `app-sidebar.tsx` correctly has none of the forbidden patterns (confirmed by reading the file — imports only `@/modules/identity/domain/*` direct, `@/shared/ui`, `next/navigation`, `next/link`) |
| SIDE-MN-04 | Hex cru/paleta fixa/CDN/lib de ícone ou estado | `app-shell-uses-tokens.test.ts:58-61` — asserts `app-sidebar.tsx` is in the scanned-file list, plus the 5 pattern sweeps | ✅ | Confirmed tokens-only (`text-fg-muted`, `border-border`, `bg-surface`, etc.) by reading the file |
| SIDE-MN-05 | Item sem nome acessível quando colapsado | `app-sidebar.test.tsx:151-161` | ✅ | ✅ Killed (mutation #1 above — removing `aria-label`/`title` fails `getByRole('link', {name: …})`) |

**Status**: ✅ All 5 must-nots proven (evidence-or-zero, all traced to `file:line`).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| No features beyond what was asked | ✅ — matches A1-A9 assumptions exactly; no extra sidebar features (no resizable width, no pinned/unpinned per-group, etc.) |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ |
| Only touched files required for task | ✅ — diff scoped to `(app)/_components/**`, `(app)/layout.tsx`, 2 guard tests; zero `(app)/*` page files touched (confirmed via `git diff --stat`) |
| Didn't "improve" unrelated code | ✅ |
| Matches existing patterns/style | ✅ — mirrors `ThemeToggle`'s persistence pattern and `AppBottomNav`'s reuse of `NavIcon`/`pickActiveHref` exactly |
| Would senior engineer approve? | ✅ |
| Tests map to ACs, non-shallow | ✅ — spot-checked SIDE-04 (3 distinct pathname cases, not just 1) |
| Spec-anchored outcome check | ✅ — see table above |
| Per-layer coverage (domain 1:1; routes happy+edge+error) | ✅ — `AppSidebar` is presentational-only per spec (no domain logic added; reuses `pickActiveHref`/`buildHubLinks` unchanged) |
| Every test maps to a spec AC/must-not — no unclaimed tests | ✅ |
| Documented guidelines followed | CLAUDE.md (RTL component tests), `docs/arch/project-guideline.md` §18 DoD |

---

## Edge Cases

- [x] Zero-role Pessoa → só "Minha conta" (never empty) — `app-sidebar.test.tsx:95-100` (implicit: `hubAccessFromRoles([])` still yields "Minha conta"/"Meus papéis")
- [x] `pathname` sem match → nenhum link ativo — `app-sidebar.test.tsx:112-118`
- [x] `/perfil/papeis` → ativo é o mais específico — `app-sidebar.test.tsx:102-110`
- [x] `localStorage` indisponível → degrada sem lançar (default expandido) — `app-sidebar.test.tsx:71-77`
- [x] Href sem ícone mapeado → fallback do `NavIcon` (herdado, não recodificado; `nav-icons.tsx` intacto, confirmado via diff — não modificado)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && NODE_ENV=production npm run build`
- **Result**: typecheck 0 errors; lint 0 errors/warnings; **296 test files / 2107 tests passed, 0 failed**; production build succeeded (all `(app)/*` routes render `ƒ` dynamic as expected, no route errors)
- **Test count**: matches Implementer's reported count (2107 tests / 296 files) — no discrepancy found
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| SIDE-01 | Pending | ✅ Verified |
| SIDE-02 | Pending | ✅ Verified |
| SIDE-03 | Pending | ✅ Verified |
| SIDE-04 | Pending | ✅ Verified |
| SIDE-05 | Pending | ✅ Verified |
| SIDE-06 | Pending | ✅ Verified |
| SIDE-MN-01 | Pending | ✅ Verified |
| SIDE-MN-02 | Pending | ✅ Verified |
| SIDE-MN-03 | Pending | ✅ Verified |
| SIDE-MN-04 | Pending | ✅ Verified |
| SIDE-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 2/2 (USP-064-scoped) mutations killed
**Must-nots**: 5/5 green
**Gate**: typecheck + lint + 2107 tests + production build all green

**What works**: Sidebar renders full role-aware nav, collapses/persists via `localStorage`, active-state is longest-match correct including the aninhado case, hidden `< md`, accessible when collapsed (aria-label/title), tokens-only, no PII/session import, `AppDesktopMenu` cleanly removed with guards migrated.

**Issues found**: none

**Next steps**: none — PASS
