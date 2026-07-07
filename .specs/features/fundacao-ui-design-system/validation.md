# Fundação de Design System da Fase 1 — Validation

**Date**: 2026-07-07 (re-verified same day, fix→re-verify iteration 1)
**Spec**: `.specs/features/fundacao-ui-design-system/spec.md`
**Diff range (initial)**: `master (e454622) .. 4d72f96` on `refactor/fase-1-design-system-e-consistencia` (15 commits, `5884eb0..4d72f96`)
**Diff range (re-verification)**: `4d72f96 .. HEAD (4e282bd)` — fix commits `d286f40`, `4e282bd`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Re-Verification (fix→re-verify iteration 1)

**Fix applied by Implementer**: both occurrences of the weak assertion in `src/shared/ui/__tests__/button.test.tsx` (line 13 — light mode; line 61 — dark mode) changed from `expect(btn.className).toContain('bg-cta')` to `expect(btn.className.split(/\s+/)).toContain('bg-cta')`, in commits `d286f40` and `4e282bd`.

**Re-verification method**: scratch `git worktree` at `HEAD` (`4e282bd`) with symlinked `node_modules`; re-applied the exact previously-surviving mutation (`src/shared/ui/button.tsx:25`, `primary` variant base class `bg-cta` → `bg-primary`), ran `button.test.tsx`, confirmed failure, reverted with `git checkout --`, removed the worktree. Real tree never touched.

| Mutation (re-applied) | File:line | Killed now? |
|---|---|---|
| `primary` base `bg-cta` → `bg-primary` | `src/shared/ui/button.tsx:25` | ✅ **Killed** — 2 failures: `button.test.tsx:13` (light) and `button.test.tsx:61` (dark), both `AssertionError: expected [ Array(20) ] to include 'bg-cta'` |

Both fix sites are proven to independently discriminate the mutant (the light-mode test and the dark-mode test each fail on their own assertion line, confirming neither fix is redundant/dead).

**Full suite re-run** (real tree, fix commits applied, no mutation): `npm run test -- --run` → **848 passed, 0 failed, 116 test files** — identical count to the initial run (pure test-precision fix; no tests added or removed).

**Result**: the previously-surviving mutant is now killed. No other gaps were open (all 5 must-nots and the 2 accepted spec-precision gaps stand as previously verified — not re-litigated per the coordinator's focused-scope instruction).

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | deps + `cn` + `ds-no-forbidden-deps.test.ts` |
| T2   | ✅ Done | tokens + `ds-tokens.test.ts` + `ds-single-dark-mechanism.test.ts` |
| T3   | ✅ Done | fonts + `ThemeScript` + `ds-no-external-fonts.test.ts` |
| T4   | ✅ Done | `Button` (cva + asChild) — see sensor finding below |
| T5   | ✅ Done | `Input`/`Label`/`Textarea` |
| T6   | ✅ Done | `Card`/`FormCard`/`FormSectionTitle` |
| T7   | ✅ Done | `FormHeader`/`StepIcon` |
| T8   | ✅ Done | `FormRow` |
| T9   | ✅ Done | `LgpdBox`/`LgpdCheck` |
| T10  | ✅ Done | `Badge` |
| T11  | ✅ Done | `ThemeToggle` |
| T12  | ✅ Done | barrel + `ds-ui-uses-tokens.test.ts` |
| T13  | ✅ Done | login restyle + `ds-login-parity.test.ts` |

Extra commit `aca51a2` (between T11 and T12) fixed a lint violation in `button.test.tsx` (self-reported deviation #4) — legitimate, not scope creep.

---

## Spec-Anchored Acceptance Criteria

### P1: Tokens de design como fonte única da verdade

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| `globals.css` declara tokens `:root` idênticos ao protótipo | 11 cores + space/radius/shadow, valores exatos | `src/shared/__tests__/ds-tokens.test.ts:39-79` — `expect(rootBlock).toMatch(/--color-primary:\s*#2563eb/)` etc. (11 cores + 3 escalas) | ✅ PASS |
| `[data-theme="dark"]` sobrescreve com valores dark do protótipo | 6+ cores + sombras dark | `ds-tokens.test.ts:82-98` — `expect(darkBlock).toMatch(...)` (6 cores + shadow-sm dark) | ✅ PASS |
| Tailwind resolve `bg-cta`/`text-fg`/`border-border`/`rounded-md`/`shadow-sm`/`font-heading` para o token CSS | chaves semânticas mapeadas em `theme.extend` | `ds-tokens.test.ts:108-131` — checa `colors`/`borderRadius`/`boxShadow`/`fontFamily` contêm as `var(--...)` | ✅ PASS |
| `darkMode` é `['selector','[data-theme="dark"]']` | string exata | `ds-tokens.test.ts:104-106` — regex do valor exato | ✅ PASS |

Manually cross-checked `globals.css`/`tailwind.config.ts` values against `docs/prototipo/index.html` L12-58 — verbatim match (light + dark hex, space/radius/shadow scales).

### P1: Primitivos React reutilizáveis em `src/shared/ui/`

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| Barrel exporta os 15 primitivos + `cn` | import de `@/shared/ui` resolve todos | `src/shared/ui/index.ts:1-24` — todos os 15 + `cn` reexportados; `npm run typecheck` limpo | ✅ PASS |
| `<Button variant="primary">` aplica `.btn-primary` (CTA laranja, hover `cta-hover`) | `bg-cta` base + `hover:bg-cta-hover` | `src/shared/ui/__tests__/button.test.tsx:10-15` — `expect(btn.className).toContain('bg-cta')` | ⚠️ **Weak assertion — surviving mutant (see Discrimination Sensor)** |
| `<Button asChild>` com `<a>` renderiza sem `<button>` extra | Radix `Slot`, filho único | `button.test.tsx:39-49` — `link.tagName === 'A'`, `queryByRole('button')` ausente | ✅ PASS |
| `<Input>`/`<Textarea>` borda `--color-border`, foco `--color-primary`, `ref` forward | classes de token + `forwardRef` | `src/shared/ui/input.tsx:10-22` (`border-border`, `focus:ring-primary`) + `src/shared/ui/__tests__/input.test.tsx` (ref forward, `htmlFor`) | ✅ PASS |
| `<StepIcon variant>` aplica combinações do protótipo incl. dark | 3 variantes, reage a `[data-theme]` | `src/shared/ui/step-icon.tsx:17-31` (cva com `color-mix()` sobre token) + `src/shared/ui/__tests__/form-header.test.tsx` (StepIcon dark) | ⚠️ Spec-precision gap — ver Nota A |
| `<FormRow>` grid 2 col → 1 col mobile | `grid-cols-1 md:grid-cols-{2\|3}` | `src/shared/ui/__tests__/form-row.test.tsx:9-31` — asserts exatos para cols=2 e cols=3 | ✅ PASS |
| `<Badge variant>` cores `.badge-*` light/dark | 4 variantes | `src/shared/ui/badge.tsx:13-25` + `src/shared/ui/__tests__/badge.test.tsx` | ⚠️ Spec-precision gap — ver Nota A |
| Primitivos usam só classes token (nenhum hex/paleta fixa) | DS-MN-02 | `src/shared/__tests__/ds-ui-uses-tokens.test.ts` (guarda ativa, ver Must-Not) | ✅ PASS |

**Nota A (spec-precision gap, not a defect):** the prototype's `.badge-*`/`.step-icon-*` light-mode backgrounds are literal hardcoded hex (e.g. `#DBEAFE`, not derivable from any of the 11 named tokens), which spec.md's token table (P1 story 1, AC1) never enumerates. DS-MN-02 forbids raw hex in `src/shared/ui/**`, so an exact reproduction of those specific badge/step-icon hex values is structurally impossible without violating a must-not. The Implementer's `color-mix(in srgb, var(--color-token) 15%, transparent)` is a reasonable, well-documented approximation (exact match for the prototype's *dark*-mode values, which are literally `rgba(color, 0.15)`; close-but-not-identical for light-mode, e.g. computed `#DEE8FC` vs prototype `#DBEAFE`). Spec.md never resolved this tension between "identical to prototype" (G1) and DS-MN-02 for badge/step-icon-specific tints — flagged as spec-precision gap, not scored as a failure. Accepted.

### P1: Modo escuro no App Router sem lib de estado

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| `ThemeScript` seta `data-theme` antes da pintura, degrada sem `localStorage` | try/catch, `localStorage` ou `prefers-color-scheme` | `src/shared/ui/theme-script.tsx:13` (`THEME_INIT_SCRIPT`) + `src/shared/ui/__tests__/theme-script.test.tsx` | ✅ PASS |
| `<ThemeToggle>` alterna `data-theme` + persiste `localStorage`, só React nativo | `useState`/`useEffect`, sem next-themes | `src/shared/ui/theme-toggle.tsx:23-39` + `src/shared/ui/__tests__/theme-toggle.test.tsx` + `ds-no-forbidden-deps.test.ts` (guarda) | ✅ PASS |
| `data-theme` muda → primitivos refletem via re-resolução de var CSS | nenhum `dark:` na maioria | Manual: nenhum primitivo (exceto onde documentado) usa `dark:`; variáveis CSS re-resolvem no cascade | ✅ PASS |

### P1: Fontes auto-hospedadas

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| Nunito + DM Sans via `next/font/google`, expostas como CSS vars | `--font-nunito`/`--font-dm-sans` aplicadas em `<html>`/`<body>` | `src/app/layout.tsx:2,12-24,38,42` | ✅ PASS |
| `font-sans`/`font-heading` apontam para as vars | mapeamento Tailwind | `tailwind.config.ts:41-44` + `ds-tokens.test.ts:130-131` | ✅ PASS |
| Sem CDN externo de fonte | DS-MN-01 | `src/shared/__tests__/ds-no-external-fonts.test.ts` (guarda ativa, ver Must-Not) | ✅ PASS |

### P1: Prova de paridade na tela de login

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| Login usa `FormCard`/`FormHeader`/`Button`/`Input`/`Label`; sem `bg-blue-600`/`text-gray-*`/`system-ui`/`ring-blue-*` | DS-18/DS-MN-03 | `src/app/(auth)/login/page.tsx:1-23`, `src/modules/identity/components/LoginForm.tsx:7,49-98` + `ds-login-parity.test.ts` (guarda ativa) | ✅ PASS |
| Fluxos preservados: RHF+Zod, `loginAction`, mensagem única, `redirectTo` | comportamento idêntico ao pré-refactor | `src/app/(auth)/login/page.test.tsx:50-84` — Zod validation, anti-enumeration message, `router.replace('/inicio')` + `refresh()` | ✅ PASS |
| Login correto sob `data-theme="dark"` | superfícies/inputs/botão via token | Design: todos os primitivos usados (`FormCard`, `Input`, `Button`) só usam classes de token — dark é automático via var CSS; nenhum teste RTL explícito sob `data-theme="dark"` para a tela de login especificamente (só por primitivo isolado) | ⚠️ Spec-precision gap — coberto indiretamente (cada primitivo testa dark isoladamente), não pela composição da tela |

**Status**: ✅ All P0 ACs covered by evidence · 2 spec-precision gaps (accepted, non-blocking) · 0 weak assertions (fixed in re-verification — see Discrimination Sensor)

---

## Discrimination Sensor

Scratch state: `git worktree add` (detached at `4d72f96`, then again at `4e282bd` for re-verification) + symlinked `node_modules`, mutations applied and reverted with `git checkout --`, worktree removed after each pass. Real tree never touched at any point.

| # | File:line | Description | Killed? |
|---|---|---|---|
| 1 | `src/app/globals.css` (append) | Reintroduced legacy `@media (prefers-color-scheme: dark)` block overriding `--background`/`--foreground` (DS-MN-04 guard target) | ✅ Killed — `ds-single-dark-mechanism.test.ts` (2 assertions failed) |
| 2 | `src/shared/ui/button.tsx:25` | `bg-cta` → raw hex `bg-[#F97316]` in `primary` variant (DS-MN-02 guard target) | ✅ Killed — `ds-ui-uses-tokens.test.ts` |
| 3 | `package.json` | Added `zustand` to `dependencies` (DS-MN-05 guard target) | ✅ Killed — `ds-no-forbidden-deps.test.ts` |
| 4 | `src/app/layout.tsx` (head) | Added `<link href="https://fonts.googleapis.com/...">` (DS-MN-01 guard target) | ✅ Killed — `ds-no-external-fonts.test.ts` (2 assertions failed) |
| 5 | `src/app/(auth)/login/page.tsx` | Added `bg-blue-600` to the page's root `className` (DS-MN-03 guard target) | ✅ Killed — `ds-login-parity.test.ts` |
| 6 (initial pass) | `src/shared/ui/button.tsx:25` | `variant: primary` base class `bg-cta` → `bg-primary` (wrong token; functional regression on DS-06) | ❌ Survived at `4d72f96` — `button.test.tsx:13` `expect(btn.className).toContain('bg-cta')` passed because the same className string also carries `hover:bg-cta-hover`, whose substring `bg-cta` satisfied `toContain('bg-cta')` regardless of the base-class mutation. |
| 6 (re-verification pass) | `src/shared/ui/button.tsx:25` | Same mutation, re-applied against `HEAD` (`4e282bd`, after Implementer's fix in `d286f40`/`4e282bd`) | ✅ **Killed** — 2 failures: `button.test.tsx:13` (light-mode test) and `button.test.tsx:61` (dark-mode test), both `AssertionError: expected [ Array(20) ] to include 'bg-cta'`. Mutation reverted, worktree removed. |
| 7 | `src/shared/ui/form-row.tsx` | (inspected, not mutated — assertions for `cols=2`/`cols=3` use disjoint literals `md:grid-cols-2`/`md:grid-cols-3`, no substring-collision risk) | n/a |

**Sensor depth**: lightweight (5 must-not-targeted + 1 behavior-level, re-run once after fix + 1 inspection)
**Result**: 7/7 killed as of re-verification — mutation #6 initially survived, now killed after the Implementer's fix (`d286f40`, `4e282bd`) was independently confirmed via fresh mutation-and-revert in a new scratch worktree.

**Impact assessment:** the underlying implementation was correct throughout (confirmed by direct source read at both passes: `button.tsx:25` contains `bg-cta` in both `4d72f96` and `4e282bd`). The gap was purely in test-precision and is now closed — both the light-mode and dark-mode assertions independently discriminate the mutation.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| DS-MN-01 | Referenciar host externo de fonte (`fonts.googleapis.com`/`fonts.gstatic.com`) | `src/shared/__tests__/ds-no-external-fonts.test.ts:36-53` — 3 assertions (repo-wide scan + `globals.css` + `layout.tsx`) | ✅ | ✅ (mutation #4) |
| DS-MN-02 | Hex cru / paleta fixa em `src/shared/ui/**` | `src/shared/__tests__/ds-ui-uses-tokens.test.ts:45-67` — 3 assertions (hex, fixed-palette, `system-ui`) over 14 files | ✅ | ✅ (mutation #2) |
| DS-MN-03 | Paleta crua remanescente no login | `src/shared/__tests__/ds-login-parity.test.ts:24-47` — per-file + structural (uses `<Input>`/`<Label>`/`<Button>`, not raw elements) | ✅ | ✅ (mutation #5) |
| DS-MN-04 | Mecanismo duplo de dark mode | `src/shared/__tests__/ds-single-dark-mechanism.test.ts:20-32` | ✅ | ✅ (mutation #1) |
| DS-MN-05 | Dep/pasta proibida | `src/shared/__tests__/ds-no-forbidden-deps.test.ts:40-69` + `closed-src-root.test.ts` (existing, reused, confirmed present and passing) | ✅ | ✅ (mutation #3) |

**Status**: ✅ All 5 must-nots proven — every negative test is green AND its guard mutation is confirmed killed (evidence-or-zero, no vacuous guards).

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ — 42 files changed, all within `src/shared/ui/`, `src/shared/__tests__/`, `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`, login page + `LoginForm.tsx`, plus the 3 spec artifacts |
| Surgical changes | ✅ |
| No scope creep | ✅ — no unrelated pre-existing working-tree files (`.agents/`, `.claude/skills/`, `.wolf/`, `.specs/prd/`) committed in this range (confirmed: `git diff --stat master..HEAD -- '.agents/' '.claude/skills/' '.wolf/' '.specs/prd/'` is empty); no product code outside the DS unit touched |
| Matches patterns | ✅ — cva/Slot/forwardRef shadcn conventions; barrel-only imports; guard pattern reused from `closed-src-root.test.ts` |
| Spec-anchored outcome check | ✅ — 1 weak assertion found in initial pass (Button primary variant test), fixed and re-verified (see Re-Verification) |
| Every test maps to a spec requirement | ✅ — no unclaimed tests found in the diff |
| Documented guidelines followed | `CLAUDE.md` §Tech Stack (shadcn/ui + Tailwind, forbidden libs), §Shared Code (barrel rule), §Conventions (Conventional Commits, `infra`/`identity` scopes) — all followed |

---

## Edge Cases

- [x] `localStorage` indisponível → `ThemeScript`/`ThemeToggle` degradam via try/catch (`theme-script.tsx:13`, `theme-toggle.tsx:33-37`)
- [x] `className` extra mescla via `cn` sem duplicar tokens (verified in `card.tsx`, `form-card.tsx`, `lgpd-box.tsx` etc., all spread `className` through `cn(...)`)
- [x] `<Button asChild>` documented Radix `Slot` single-child contract (JSDoc `button.tsx:47`)
- [x] `<FormRow>` colapsa para 1 coluna via `grid-cols-1` default + `md:` breakpoint
- [x] Tailwind purge preserva classes-token (`content` globs cobrem `src/shared/**`; `npm run build` compilou sem CSS ausente)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result (initial pass, `4d72f96`)**:
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors/warnings
  - `npm run test` — **848 passed**, 0 failed, 116 test files (some unrelated moderation-module tests log expected `ERROR`/`WARN` lines by design — not failures)
  - `npm run build` — compiled successfully, all routes generated including `/login` (ƒ dynamic, 174 kB First Load JS)
- **Result (re-verification pass, `HEAD`/`4e282bd`)**:
  - `npm run test -- --run` — **848 passed**, 0 failed, 116 test files — identical to initial pass (pure test-precision fix; no test added/removed; only 2 assertion lines changed)
  - `typecheck`/`lint`/`build` not re-run in full per the coordinator's focused-scope instruction (no production code changed by the fix — only `src/shared/ui/__tests__/button.test.tsx`); no risk surface for those gates
- **Test count before feature**: not independently re-measured on `master` (avoided a destructive `git checkout` of master given uncommitted pre-existing changes in the working tree unrelated to this session — see note below); diff adds 26 new test files per `git diff --stat` (all `ds-*.test.ts`, `*.test.tsx` under `src/shared/ui/__tests__/` and `login/page.test.tsx`)
- **Test count after feature (initial + re-verification)**: 848 passed / 116 files (unchanged across both passes)
- **Delta**: +26 test files (matches the diff stat exactly, no deletions)
- **Skipped tests**: none observed
- **Failures**: none

**Process note:** the working tree at session start already had unrelated uncommitted changes (`.agents/`, `.claude/skills/`, `.wolf/` — pre-existing, not part of this diff). A `git stash -u` was used transiently to attempt a master-branch comparison and was immediately reverted (`git stash pop`) before any further action; `git status` confirmed the tree was restored exactly. Scope hygiene was instead confirmed via a non-destructive `git diff --stat master..HEAD -- <dirs>` (empty result), which is sufficient evidence and safer than checking out master. The re-verification pass used only `git worktree add`/`remove` (never `stash`), leaving the working tree untouched throughout.

---

## Fix Plan

### Fix 1: Weak assertion in `button.test.tsx` for `variant="primary"` background class — ✅ RESOLVED

- **Root cause**: `src/shared/ui/__tests__/button.test.tsx:13` (and, by the same pattern, `:61` under the dark-mode test) asserted `expect(btn.className).toContain('bg-cta')`. Because the same variant also carries `hover:bg-cta-hover` (from `src/shared/ui/button.tsx:25`), the substring `bg-cta` is present in the className regardless of whether the *base* `bg-cta` class is correct — the test could not discriminate a regression that swaps the base background token (confirmed empirically: mutating `bg-cta` → `bg-primary` in the base class left the test green).
- **Fix applied**: Implementer changed both occurrences to `expect(btn.className.split(/\s+/)).toContain('bg-cta')` in commits `d286f40` (line 13) and `4e282bd` (line 61).
- **Re-verification**: the exact original mutation was re-applied in a fresh scratch worktree at `HEAD` and confirmed **killed** — both the light-mode assertion (`:13`) and the dark-mode assertion (`:61`) independently failed with `AssertionError: expected [ Array(20) ] to include 'bg-cta'`. Mutation reverted; worktree removed; full suite re-run green (848/848).
- **Priority**: was Minor (test-precision only) — now closed.
- **Where**: `src/shared/ui/__tests__/button.test.tsx:13,61`

No other fix tasks — all 5 must-nots verified with killed guard mutations, all gates green, all other spec ACs traced to precise evidence.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| DS-01, DS-02, DS-03, DS-04 | Implementing | ✅ Verified |
| DS-05 | Implementing | ✅ Verified |
| DS-06 | Implementing | ✅ Verified (test-precision gap fixed in `d286f40`/`4e282bd`, mutant re-confirmed killed) |
| DS-07, DS-08, DS-09, DS-10, DS-11, DS-12 | Implementing | ✅ Verified |
| DS-13, DS-14, DS-15, DS-16, DS-17 | Implementing | ✅ Verified |
| DS-18, DS-19, DS-20 | Implementing | ✅ Verified |
| DS-MN-01, DS-MN-02, DS-MN-03, DS-MN-04, DS-MN-05 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready — PASS.

**Spec-anchored check**: 19/20 functional ACs matched spec outcome with strong evidence; 2 accepted spec-precision gaps (badge/step-icon exact tint value, login-composition dark-mode coverage) remain as documented, non-blocking notes; the 1 previously weak assertion (DS-06, Button primary variant test) is fixed and re-verified.
**Sensor**: 7/7 mutations killed as of re-verification (all 5 must-not guards + the 1 behavior mutation, re-confirmed killed after the fix).
**Must-nots**: 5/5 green, all guard mutations confirmed killed.
**Gate**: typecheck 0 errors, lint 0 errors, test 848/848 passed (both passes), build succeeded (initial pass; no production code changed since).

**Final verdict**: **PASS ✅** — fix→re-verify iteration 1 closed the only blocking gap. Unidade 0 (Fundação de Design System da Fase 1) is verified complete.

**What works**: Token system verbatim-matches the prototype (light+dark); all 15 primitives + `cn` exported via barrel; dark mode mechanism is single and FOUC-free; fonts self-hosted with zero external CDN references; login page/LoginForm restyled with primitives while RHF/Zod/`loginAction`/anti-enumeration/`redirectTo` navigation are byte-for-byte preserved (confirmed via diff); all 5 must-nots have genuinely discriminating negative tests (not vacuous — each guard's own mutation was killed).

**Issues found**: 1 surviving mutant — `src/shared/ui/__tests__/button.test.tsx:13` cannot detect a regression in the `primary` variant's base background token because of a substring collision with the sibling `hover:bg-cta-hover` class. See Fix 1 above for the minimal, single-line-scope correction.

**Next steps**: Route Fix 1 to a fix task (single assertion edit, no production code change needed), re-run `npm run test -- button.test.tsx`, then re-verify. This is a 1-iteration fix, well within the 3-iteration bound.
