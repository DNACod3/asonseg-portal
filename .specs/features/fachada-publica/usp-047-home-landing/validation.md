# USP-047 — Home/landing pública fiel ao protótipo — Validation

**Date**: 2026-07-10
**Spec**: `.specs/features/fachada-publica/usp-047-home-landing/spec.md`
**Design**: `.specs/features/fachada-publica/usp-047-home-landing/design.md`
**Diff range**: `3bd6cf8~1..bf05865` (9 commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|------|---------|-------|
| T1 HomeSearch          | ✅ Done | `home-search.tsx` + `home-search.test.tsx` |
| T2 HomeFeaturedJobs    | ✅ Done | `home-featured-jobs.tsx` + test |
| T3 HomeHowItWorks      | ✅ Done | `home-how-it-works.tsx` + test |
| T4 HomePersonas        | ✅ Done | `home-personas.tsx` + test |
| T5 HomeServices        | ✅ Done | `home-services.tsx` + test |
| T6 HomeCta             | ✅ Done | `home-cta.tsx` + test |
| T7 HomeHero            | ✅ Done | `home-hero.tsx` composes T1+T2+`HomeIndicatorsView`, + test |
| T8 page.tsx composition + page.test.tsx migration | ✅ Done | order hero→HowItWorks→Personas→Services→Cta; revalidate=600 preserved |
| T9 home-page-static.test.ts guard | ✅ Done | scans `page.tsx` for forbidden imports/hex/CDN + sanity check on `casca-*` coverage |

All 9 commits present in range, one per task, in dependency order (T1..T6 parallel leaves → T7 → T8 → T9).

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| **HOME-01** hero `<h1>` "talentos" + subtítulo | Exact copy: "Conectando **talentos** a oportunidades na comunidade" + Paróquia N.S. Guadalupe subtitle | `src/app/(public)/_components/home-hero.tsx:36-42` — rendered `<h1>`; confirmed live in build HTML (`grep` of `/tmp/home.html`: single `<h1>` with "Conectando…") | ✅ PASS |
| **HOME-02** CTAs Buscar Vagas/Publicar Vaga | `Buscar Vagas`→`/vagas` (default), `Publicar Vaga`→`/cadastro` (default) via `Button asChild`+`Link` | `home-hero.tsx:44-51`; live HTML: `href="/vagas">Buscar Vagas`, `href="/cadastro">Publicar Vaga` | ✅ PASS |
| **HOME-03** UI de busca | `<form role="search">`, `<input name="q">` labeled, submit button, `action` seam default GET `/vagas` | `home-search.tsx:26-46`; `home-search.test.tsx`; live HTML: `<form role="search" ... action="/vagas" method="get">`, `name="q"` | ✅ PASS |
| **HOME-04** ≥2 cards de destaque | ≥2 static job cards (title+company+tags) via `jobs?` seam | `home-featured-jobs.tsx:17-29` (`DEFAULT_JOBS`, 2 entries); `home-featured-jobs.test.tsx` | ✅ PASS |
| **HOME-05** embed HomeIndicatorsView | `HomeIndicatorsView` (USP-041, unmodified) embedded fed by `indicators` prop | `home-hero.tsx:55` — `<HomeIndicatorsView indicators={indicators} />`; `page.test.tsx:76-83` asserts 3 real labels+values; live HTML: `data-testid="home-indicators"` present | ✅ PASS |
| **HOME-06** Como Funciona (3 passos) | overline "Como Funciona" + h2 "Simples, rápido e gratuito" + 3 named steps | `home-how-it-works.tsx:72-97,99-131`; `home-how-it-works.test.tsx`; live HTML h2 "Simples, rápido e gratuito" + h3 "Crie seu perfil"/"Busque e filtre"/"Conecte-se" | ✅ PASS |
| **HOME-07** Para Quem (2 personas) | overline "Para Quem" + h2 "Uma plataforma, duas perspectivas" + 2 cards, 4 features each, CTAs to seam hrefs (default `/cadastro`) | `home-personas.tsx:66-153`; `home-personas.test.tsx`; live HTML h2 present, `href="/cadastro">Criar Meu Perfil`, `href="/cadastro">Cadastrar Empresa` | ✅ PASS |
| **HOME-08** Serviços (3 categorias + CTA) | overline "Serviços" + h2 "Precisa de um profissional?" + 3 categories linking `servicosHref` (default `/servicos`) + "Ver Todos os Serviços" CTA | `home-services.tsx:72-135`; `home-services.test.tsx`; live HTML h2 present, 6× `href="/servicos"` (3 cards + CTA + duplicated by hero jobs link... verified via grep count), "Ver Todos os Serviços" text present | ✅ PASS |
| **HOME-09** faixa de CTA final | h2 "Faça parte dessa iniciativa social" + 2 CTAs to `/cadastro`, gradient token background | `home-cta.tsx:18-54`; `home-cta.test.tsx`; live HTML h2 present, 2 CTAs `href="/cadastro"` | ✅ PASS |
| **HOME-10** composition order + no `<main>` + revalidate=600 | hero→HowItWorks→Personas→Services→Cta, no `<main>` re-declared, `revalidate=600` preserved | `src/app/(public)/page.tsx:14,49-56`; `page.test.tsx:36-56` (order assertions) — **killed by Mutation 5** (section-swap) confirming discrimination; live HTML: exactly 1 `<main>`, heading order matches | ✅ PASS |
| **HOME-11** responsive collapse | grid `grid-cols-1` → `sm:/lg:grid-cols-N` across all sections | `home-hero.tsx:34` (`lg:grid-cols-2`), `home-how-it-works.tsx:116` (`sm:grid-cols-3`), `home-personas.tsx:87` (`sm:grid-cols-2`), `home-services.tsx:115` (`sm:grid-cols-3`) | ✅ PASS |
| **HOME-12** dark-mode tokens-only, no `@media` | no `@media (prefers-color-scheme)` in any `home-*.tsx` | Verified via `grep -rn "@media" src/app/(public)/_components/home-*.tsx` → 0 matches | ✅ PASS |
| **HOME-13** a11y (sections named, 1 h1, SVG aria-hidden) | each section is `<section aria-label(ledby)>`; single h1; decorative SVGs `aria-hidden` | `home-hero.tsx:33` (`aria-label="Apresentação"`), `home-how-it-works.tsx:101`, `home-personas.tsx:72`, `home-services.tsx:100`, `home-cta.tsx:24` (`aria-labelledby`); all inline SVGs carry `aria-hidden="true"` (verified by reading all 4 icon-bearing files); live HTML: exactly 1 `<h1>` | ✅ PASS |
| **HOME-14** seams as props with real-route defaults | every href/action/jobs prop has a working default, overridable | All 7 components export `*Props` interfaces with optional seam props defaulting to real routes (`/vagas`, `/servicos`, `/cadastro`); live HTML: `grep -c 'href="#"'` → **0** | ✅ PASS |

**Status**: ✅ All 14 functional ACs covered — no spec-precision gaps found (every AC had a precise, checkable outcome and a matching `file:line` + observed DOM/test evidence).

---

## Discrimination Sensor

Sensor depth: **Full mutation run** (this USP carries must-nots per the ICE-mode-independent sizing floor — must-not-bearing features get ≥5 mutations). All mutations applied directly to the working tree (feature branch, no uncommitted changes pre-existed for these paths), then reverted via file restore; verified `git diff --stat` on the feature paths is empty after each restore.

| # | File:line | Mutation | Targets | Killed? |
|---|---|---|---|---|
| 1 | `home-how-it-works.tsx:107-109` | Changed section `<h2>` → `<h1>` (second h1 on page) | HOME-MN-04 | ✅ Killed — `page.test.tsx` "renderiza exatamente um `<h1>`" failed (2 vs 1) |
| 2 | `page.tsx:1` | Injected `import { getCurrentPerson } from '@/modules/identity'` | HOME-MN-01 | ✅ Killed — `home-page-static.test.ts` "page.tsx não referencia 'getCurrentPerson'" failed |
| 3 | `home-cta.tsx:27` | Injected raw hex `#1D4ED8` into className string | HOME-MN-02 | ✅ Killed — `casca-uses-tokens.test.ts` "nenhum arquivo contém hex cru" failed, correctly identifying `home-cta.tsx` — **confirms the `casca-*` guards do recursively cover the new `home-*.tsx` files** |
| 4 | `page.tsx:14` | `revalidate = 600` → `revalidate = 86400` | HOME-MN-03 (ISR floor) | ✅ Killed — `home-revalidate.test.ts` both assertions failed |
| 5 | `page.tsx` composition body | Swapped `<HomeServices/>`/`<HomePersonas/>` order | HOME-10 | ✅ Killed — `page.test.tsx` order assertion failed (`servicesIndex` not > `personasIndex`) |
| 6 | `home-personas.tsx:67` | `candidatoHref` default `'/cadastro'` → `'#'` (dead link) | HOME-07/HOME-14 (no dead seam defaults) | ✅ Killed — `home-personas.test.tsx` "os CTAs usam os defaults de seam" failed |

**Result**: 6/6 killed — **PASS**. No surviving mutants; no fix tasks required.

---

## 🧬 Must-Not Verification (adapted — greenfield-mode must-nots, `HOME-MN-NN`)

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| HOME-MN-01 | Import session/`getCurrentPerson`/View Models/Prisma/Server Actions, or render PII, in `page.tsx`/`_components/home-*.tsx` | `src/shared/__tests__/home-page-static.test.ts:57-59` (page.tsx scan) + `casca-no-auth-pii.test.ts` (recursive `_components/**` scan) | ✅ | ✅ (Mutation 2) |
| HOME-MN-02 | Raw hex / fixed-palette utility / `system-ui` / external CDN in home files | `home-page-static.test.ts:65-83` (page.tsx) + `casca-uses-tokens.test.ts`/`casca-no-external-cdn.test.ts` (recursive) | ✅ | ✅ (Mutation 3) |
| HOME-MN-03 | Re-implement counting, show raw number below threshold, or raise ISR floor above 600s | `page.test.tsx:85-97` (cold-start → "Em breve"×3, no raw "0") + `reporting/__tests__/home-revalidate.test.ts:16-20` (revalidate ≤ 600) | ✅ | ✅ (Mutation 4) |
| HOME-MN-04 | Second `<main>` landmark or >1 `<h1>` | `page.test.tsx:58-68` (`queryByRole('main')` absent + `getAllByRole('heading',{level:1})` length 1) | ✅ | ✅ (Mutation 1) |

**Status**: ✅ All 4 must-nots proven — every guard is present, green, and empirically kills its targeted fault.

**Sanity claim verified**: The `casca-*` guards (`casca-uses-tokens`, `casca-no-auth-pii`, `casca-no-external-cdn`, `casca-no-icon-state-lib`) each recursively `readdirSync` the entire `src/app/(public)/_components` directory tree (confirmed by reading all four files — no hardcoded file list), so the new `home-*.tsx` files are automatically in scope. Empirically confirmed by Mutation 3 (hex injected into `home-cta.tsx` was caught by `casca-uses-tokens.test.ts`, a USP-046 guard never modified by this USP).

---

## Concern-by-Concern Findings (from orchestrator brief)

1. **Prototype fidelity** — verified line-by-line against `docs/prototipo/index.html` L842-1034 pointers cited in spec.md (L847-849, L851-855, L873-900, L906-938, L943-980, L983-1021, L1023-1033) against the 7 components read in full. Copy matches exactly (headline, step titles/descriptions, persona features/CTAs, service categories, CTA copy). No deviation found.
2. **Indicators embed** — `home-hero.tsx:55` passes `indicators` straight to unmodified `<HomeIndicatorsView>` (imported from `@/modules/reporting`, not redefined). No counting logic re-implemented anywhere in the diff (`grep` of the 7 new files shows no arithmetic on `activeJobs`/`activeCandidates`/`verifiedCompanies`). `page.test.tsx` retains and extends the pre-existing indicator/fallback assertions (cold-start "Em breve", DB-failure fallback) — confirmed still green and confirmed to anchor the real contract (Mutation 4 killed by the *unmodified* `home-revalidate.test.ts`).
3. **HOME-MN-04** — confirmed structurally: `page.tsx` renders no `<main>` (comes only from `(public)/layout.tsx`, unmodified in this diff range); single `<h1>` only in `HomeHero`. Confirmed both in unit test and in the actual built HTML (`next build` + `next start` + `curl http://127.0.0.1:3000/`: exactly 1 `<main>`, exactly 1 `<h1>`). `revalidate = 600` byte-for-byte unchanged from before USP-047 (only the JSX body was rewritten, per `git diff` on `page.tsx` — the export and `loadIndicators`/`FALLBACK_INDICATORS` block is untouched).
4. **047/048 seam boundary** — every href/action/jobs prop across all 7 components has a working default pointing at a real, existing route (`/vagas`, `/servicos`, `/cadastro`); confirmed 0 occurrences of `href="#"` in the rendered production HTML. All seam props are optional (`?`) with defaults, not hardcoded — USP-048 can override any of them via props without touching the component bodies (no internal state/logic depends on the default value beyond passing it to `<Link href>`/`action`).
5. **HomeCta light/ghost button overrides** — `home-cta.tsx:40,43-46` uses `bg-white`, `text-primary`, `bg-white/15`, `border-white/40`, `hover:bg-white/90`, `hover:bg-white/25` — all Tailwind utility classes (color name `white`, not a numbered palette token like `bg-blue-600`). The `FIXED_PALETTE_PATTERN` regex in both `casca-uses-tokens.test.ts` and `home-page-static.test.ts` explicitly excludes `white` from its forbidden-color list (`blue|orange|slate|gray|grey|red|green|yellow|purple|pink|indigo|cyan|teal|amber|lime|emerald|sky|violet|fuchsia|rose|zinc|neutral|stone`), and Mutation 3 empirically confirmed the guard fires on any raw hex. This exactly mirrors the precedent in `site-header.tsx`/`site-footer.tsx` (both already use `text-white`/`bg-white/...` and pass the same guards). **Not a DS-MN-02 violation**; no raw hex slipped in.
6. **`JSX.Element` → `ReactElement` swap** — confirmed sound: `grep` shows zero remaining `JSX.Element` references in `home-how-it-works.tsx`/`home-services.tsx`, both now import `type { ReactElement }` from `react` and use it for the `icon: ReactElement` field. `npm run typecheck` (`tsc --noEmit`) passes clean with no errors, confirming type-soundness of the swap (this is the React 19 / `@types/react` convention where `JSX.Element` is deprecated in favor of importing `ReactElement` directly).

---

## Interactive UAT

Not performed — no user-facing ambiguity requiring human judgment beyond what static/RTL/build checks + live-HTML inspection already cover (per skill guidance, automated checks suffice when fidelity is checkable against a concrete prototype source, which it is here).

---

## Code Quality

| Principle | Status |
|---|---|
| No features beyond what was asked | ✅ — 7 components + page rewrite + 1 guard, matching tasks.md 1:1 |
| No abstractions for single-use code | ✅ |
| No unnecessary "flexibility" added | ✅ — seam props are the explicitly-specced USP-048 handoff, not speculative |
| Only touched files required for task | ✅ — diff is exactly the 7 new components + their tests + `page.tsx`/`page.test.tsx` + 1 new guard (17 files) |
| Didn't "improve" unrelated code | ✅ — `HomeIndicatorsView`/`getHomeIndicators` untouched; casca (`site-header`/`site-footer`/`public-nav`) untouched |
| Matches existing patterns/style | ✅ — Server Components, `Button asChild`+`Link`, `StepIcon`, `cn`, inline SVG `aria-hidden` — all precedent from USP-046 |
| Would senior engineer approve? | ✅ |
| Tests map to ACs, non-shallow | ✅ — spot-checked `home-hero.test.tsx` and `page.test.tsx`; assertions target concrete text/attributes/roles, not just "renders without crashing" |
| Spec-anchored outcome check | ✅ — see table above |
| Every test maps to a spec AC/edge case/Done-when — no unclaimed tests | ✅ |

---

## Edge Cases

- [x] `getHomeIndicators()` throws (DB unavailable) → page loads, indicators fall back to "Em breve" — `page.test.tsx:100-112`, green.
- [x] Counters below threshold (cold start) → "Em breve" ×3, not raw numbers — `page.test.tsx:85-97`, green; also empirically observed live (local Supabase dev DB currently has low seed counts, live HTML shows "Em breve" for all 3 indicators).
- [x] No seam passed by USP-048 yet → every CTA/search/highlight uses its real-route default — confirmed live (0 `href="#"`).
- [x] Viewport crosses breakpoint with wide content → grids collapse to 1-column via `grid-cols-1`/`sm:`/`lg:` responsive classes (no horizontal-scroll guard test exists, but Tailwind grid pattern matches the established USP-046 precedent; no dedicated automated check — noted as inherited practice, not a gap since out of the constrained test surface for `.tsx` per Test Coverage Matrix).
- [x] `className` seam merges via `cn` without duplicating/contradicting tokens — confirmed by code read (`cn(...)` used consistently in all components accepting `className`).

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**: typecheck 0 errors; lint 0 errors/warnings; test 243 files / 1618 tests passed, 0 failed, 0 skipped; build succeeded (`/` static, revalidate 10m, 356 B / 178 kB First Load JS).
- **Live verification**: `next start` + `curl http://127.0.0.1:3000/` → HTTP 200; exactly 1 `<h1>`, exactly 1 `<main>`; all 5 sections present in correct order; 0 `href="#"`; search form `role="search"` with `action="/vagas"` and `name="q"`; `data-testid="home-indicators"` present.
- **Test count before feature**: not independently re-derived (no pre-USP-047 baseline captured by this Verifier), but the diff shows +8 new test files and 0 deleted, with `page.test.tsx` migrated (not deleted) — consistent with the tasks.md plan; no evidence of weakened or removed assertions in the migrated file (indicator/fallback assertions retained and extended).
- **Skipped tests**: none observed in this suite run (0 skipped reported).
- **Failures**: none.

---

## Fix Plans

None — no gaps found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| HOME-01 | Pending | ✅ Verified |
| HOME-02 | Pending | ✅ Verified |
| HOME-03 | Pending | ✅ Verified |
| HOME-04 | Pending | ✅ Verified |
| HOME-05 | Pending | ✅ Verified |
| HOME-06 | Pending | ✅ Verified |
| HOME-07 | Pending | ✅ Verified |
| HOME-08 | Pending | ✅ Verified |
| HOME-09 | Pending | ✅ Verified |
| HOME-10 | Pending | ✅ Verified |
| HOME-11 | Pending | ✅ Verified |
| HOME-12 | Pending | ✅ Verified |
| HOME-13 | Pending | ✅ Verified |
| HOME-14 | Pending | ✅ Verified |
| HOME-MN-01 | Pending | ✅ Verified (guard green + mutation killed) |
| HOME-MN-02 | Pending | ✅ Verified (guard green + mutation killed) |
| HOME-MN-03 | Pending | ✅ Verified (guard green + mutation killed) |
| HOME-MN-04 | Pending | ✅ Verified (guard green + mutation killed) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 14/14 functional ACs matched spec-defined outcome, 0 spec-precision gaps
**Sensor**: 6/6 mutations killed
**Must-nots**: 4/4 `eval(−)` green
**Gate**: typecheck ✅ / lint ✅ / test 1618 passed, 0 failed ✅ / build ✅

**What works**: Full home composition fiel ao protótipo, all 5 sections in correct order, indicators embedded without regression, seams in place for USP-048 with zero dead links, must-not guards proven to actually discriminate (not just present), a11y structure (1 `<h1>`, 1 `<main>`, named sections) confirmed both in tests and live rendered HTML.

**Issues found**: None.

**Next steps**: None — ready for Dev Sênior / `pr-review` pass and merge.
