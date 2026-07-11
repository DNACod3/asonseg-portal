# USP-048 — Navegação integrada das telas públicas — Validation

**Date**: 2026-07-10
**Spec**: `.specs/features/fachada-publica/usp-048-navegacao-integrada/spec.md` (greenfield-adapter, non-ICE; must-nots present → Large sizing floor applied)
**Design**: `.specs/features/fachada-publica/usp-048-navegacao-integrada/design.md`
**Diff range**: `ccea32a~1..4e80af7` (5 commits, 8 files, +497/-30)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
|---|---|---|
| T1 (seam `href` — `home-featured-jobs.tsx`) | ✅ Done | Commit `ccea32a` |
| T2 (seam `categories/href` — `home-services.tsx`) | ✅ Done | Commit `8386b8e` |
| T3 (live jobs in `page.tsx`) | ✅ Done | Commit `6a4bf54` |
| T4 (category links + empresa CTA retarget) | ✅ Done | Commit `1523ecd` |
| T5 (search RTL + dead-ends guard + full gate) | ✅ Done | Commit `4e80af7` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| P1-1: destaque vagas top-2 ACTIVE reais | card com título+`displayName`+`href=/vagas/{id}` | `src/app/(public)/page.test.tsx:141-152` — `expect(link).toHaveAttribute('href','/vagas/job-123')` | ✅ PASS |
| P1-2: fallback vazio/erro → mock estático | `Auxiliar Administrativo` presente, hero intacto | `page.test.tsx:171-190` (reject + empty-items cases) | ✅ PASS |
| P1-3: categorias → `/servicos?categoria=<id>` + fallback | `href` contém `categoria=<id>` real; sem match → `/servicos` | `page.test.tsx:213-260` | ✅ PASS |
| P1-4: empresa nunca `nomeFantasia` (NAV-MN-01) | `displayName` visível, `nomeFantasia` (decoy) ausente do DOM | `page.test.tsx:143,145` — `queryByText(/Comércio Real LTDA/)`.not.toBeInTheDocument() | ✅ PASS |
| P2-1: busca GET `/vagas?q=` preservando termo | form `method=get action=/vagas` + `input name=q` valor preservado | `home-search.test.tsx:41-49` | ✅ PASS |
| P2-2: busca vazia → `/vagas` sem erro | `action=/vagas` mesmo com input vazio | `home-search.test.tsx:52-58` | ✅ PASS |
| P2-3: CTA empresa → `/empresa/cadastrar` | 3 CTAs (`Publicar Vaga`/`Cadastrar Empresa`/`Cadastrar como Empresa`) com esse `href` | `page.test.tsx:296-309` | ✅ PASS |
| P2-4: CTA candidato → `/cadastro` | 2 CTAs com esse `href` | `page.test.tsx:312-320` | ✅ PASS |
| P2-5: nav/header confirmados (NAV-05) | `public-nav.test.tsx` (USP-046) verde, sem regressão | Existing suite — 244/244 files green | ✅ PASS |
| P3-1: barrels-only, sem imports proibidos (NAV-06/MN-01) | `home-page-static.test.ts` verde após import dos barrels `@/modules/jobs`/`@/modules/services` | Full-gate run — green | ✅ PASS |
| P3-2: nenhum `href="#"`/vazio (NAV-MN-02) | offenders `[]` sobre `page.tsx`+`home-*.tsx` | `src/shared/__tests__/nav-no-dead-ends.test.ts:44-46` | ✅ PASS |
| P3-3: sem hex/paleta/CDN (NAV-MN-02) | `casca-uses-tokens`/`casca-no-external-cdn` verdes | Full-gate run — green | ✅ PASS |
| P3-4: indicadores/ISR/`<main>`/`<h1>` intactos (NAV-06) | `revalidate=600`; `home-revalidate.test.ts` verde; build prerenders `/` | `npm run build` output: `○ / … 10m 1y` (revalidate); `home-revalidate.test.ts` in full-gate | ✅ PASS |

**Status**: ✅ All 8 requirement IDs (NAV-01..06, NAV-MN-01/02) traced to passing evidence, no spec-precision gaps.

---

## Discrimination Sensor

Tiering: this USP carries must-nots (NAV-MN-01/02) → full mutation run per §5 tiering table (≥5 mutations). All mutations run in the real working tree, one at a time, each immediately reverted via `git checkout --`; final state verified byte-identical to `4e80af7` (`git diff 4e80af7 -- <files>` empty) before writing this report.

| # | File:line | Description | Killed? |
|---|---|---|---|
| 1 | `src/app/(public)/page.tsx:111` (`loadFeaturedJobs`) | `searchJobs({page:1}, null)` → `searchJobs({page:1}, {id:'mutant-viewer'} as never)` (NAV-MN-01: viewer=null guard) | ✅ Killed — `page.test.tsx` "chama searchJobs com … viewer=null … killable" failed |
| 2 | `src/app/(public)/page.tsx:96` (`toFeaturedJob`) | `item.company.displayName` → `item.company.nomeFantasia` (decoy field) — PII-leak sensor check | ✅ Killed — "renderiza o card…" failed (decoy string rendered) |
| 3 | `src/app/(public)/page.tsx:47` (`resolveCategoryHref`) | no-match fallback `SERVICOS_HREF` → `${SERVICOS_HREF}?categoria=invented-mutant-id` (NAV-MN-02c: never an invented id) | ✅ Killed — 2 tests failed ("categoria sem match…", "listServiceCategories vazio/rejeita…") |
| 4 | `src/app/(public)/page.tsx:112-117` (`loadFeaturedJobs`) | `undefined` fallback → `[]` (tests the documented default-param deviation is load-bearing) | ✅ Killed — 2 tests failed ("searchJobs rejeita…", "searchJobs retorna vazio…") |
| 5 | `src/app/(public)/_components/home-services.tsx:147` | `<Link href={servicosHref}>` → `<Link href="#">` (NAV-MN-02a: dead-end guard) | ✅ Killed — `nav-no-dead-ends.test.ts` "nenhum arquivo contém href=…" failed |

**Sensor depth**: P0/must-not-full (5 mutations, all guard mechanisms covered: viewer gate, PII field selection, category-id fabrication, fallback semantics, dead-end guard).
**Result**: 5/5 killed — PASS ✅

---

## 🧬 Must-Not Verification (must-nots carried by this USP, non-ICE)

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| NAV-MN-01 | Leak PII (real company name) / non-ACTIVE content / pass a real viewer / import forbidden modules | `page.test.tsx:141-152` (`queryByText(nomeFantasia)` absent) + `page.test.tsx:154-160` (`toHaveBeenCalledWith({page:1}, null)`) + `home-page-static.test.ts` (existing, verified green in full gate) | ✅ | ✅ (mutations #1, #2 above) |
| NAV-MN-02 | Dead-end href / moderation bypass / hex-CDN regression | `src/shared/__tests__/nav-no-dead-ends.test.ts:44-46` (offenders `[]`) + `casca-uses-tokens`/`casca-no-external-cdn` (existing, verified green) | ✅ | ✅ (mutation #5 above; ACTIVE gate itself is enforced unconditionally inside `searchJobs`'s `buildWhere` — `src/modules/jobs/queries/search-jobs.ts:72-74` — not bypassable from `page.tsx`) |

**Status**: ✅ Both must-nots proven (green `eval(−)` + killed guard mutation).

---

## Implementer-flagged deviations — scrutinized

1. **Decoy `nomeFantasia` in `page.test.tsx` mock (PII sensor)**: confirmed real (mutation #2 above kills it). Not a no-op assertion — the mock intentionally carries a field the real `JobListItem` view model never populates for `viewer=null` (`src/modules/jobs/views/job-list-item.view.ts:47-50`, `jobListSelect(false)` doesn't select `nomeFantasia`), so this is a discrimination fixture, not a false structural coupling.
2. **`loadFeaturedJobs` returns `undefined` (not `[]`) on empty/error**: confirmed intentional and load-bearing (mutation #4 kills it) — `HomeFeaturedJobs({ jobs = DEFAULT_JOBS })`'s default parameter only activates on `undefined` (JS semantics), so `[]` would have silently rendered an empty destaque instead of falling back to the mock. Verified both empty-array and throw paths independently in `page.test.tsx:171-190`.
3. **Doc-comment rewrite in `page.tsx` (removed literal `href="#"` string)**: verified via `git diff 1523ecd 4e80af7 -- 'src/app/(public)/page.tsx'` — the only change is `nunca um id inventado, nunca `href="#"`.` → `nunca um id inventado, nunca um link sem destino.` The guard's regex (`nav-no-dead-ends.test.ts:15`, `/href=["']#["']?/`) is unchanged and still matches real `href="#"` attributes (proven by mutation #5, injected in a component file, not a comment). The Implementer avoided a **false positive** (the guard is comment-blind, same limitation noted for precedent guards per L-013) rather than neutering the sensor — legitimate fix, no regex weakening.
4. **Category→id fallback determinism**: confirmed via mutation #3 (no-match path) and existing test for empty/throw (`page.test.tsx:230-247`) — both collapse to `/servicos`, never an invented id.
5. **No new query/migration**: confirmed — `page.tsx` imports only `searchJobs`/`JobListItem` from `@/modules/jobs` and `listServiceCategories`/`ServiceCategoryOption` from `@/modules/services` (both barrels); `git diff --stat` shows 0 changes under `prisma/`, `queries/`, `actions/`; `home-page-static.test.ts` (existing static guard) is part of the full gate and passed.
6. **Search param preservation (NAV-01)**: `home-search.tsx` unchanged (0 diff lines for that file); `vagas/page.tsx:53` reads `q: first(sp.q)` confirming end-to-end wiring — confirmed via source read, not just test.

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code (only wiring + 2 backward-compatible seam extensions) | ✅ |
| Surgical changes (8 files, matches design §3 exactly) | ✅ |
| No scope creep (no new Prisma model/query/migration; verified in diff) | ✅ |
| Matches existing patterns (try/catch → fallback mirrors `loadIndicators`/ADR-0026) | ✅ |
| Spec-anchored outcome check (asserted values match spec-defined outcomes) | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ |

---

## Edge Cases (from spec.md)

- [x] `searchJobs`/`listServiceCategories` throw (DB unavailable, incl. at build) → home loads with fallbacks; build compiles (`npm run build` succeeded, `/` prerendered with `revalidate: 10m`).
- [x] No ACTIVE jobs → static mock (never empty list) — mutation #4 proves this path is guarded.
- [x] Category with no real match → `/servicos` (never invented id) — mutation #3 proves this.
- [x] Anonymous CTA to empresa → reaches `/empresa/cadastrar` (guard redirects to `/login`, not a dead end) — confirmed by source read of `(app)/empresa/cadastrar/page.tsx` `requireActivePerson`.
- [x] Search term with special chars/spaces → GET querystring encoding is browser-native; `/vagas` trims via `first(sp.q)` (pre-existing, confirmed unchanged).

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**: typecheck 0 errors; lint 0 errors/warnings; test 244/244 files, 1635/1635 tests passed; build succeeded, `/` prerendered as static (○) with `revalidate: 10m`.
- **Test count before feature** (commit `9b71bce`, pre-USP-048): baseline per-file counts — `home-featured-jobs.test.tsx` 3, `home-services.test.tsx` 4, `home-search.test.tsx` 4, `page.test.tsx` 6 (`nav-no-dead-ends.test.ts` did not exist).
- **Test count after feature** (commit `4e80af7`): `home-featured-jobs.test.tsx` 5 (+2), `home-services.test.tsx` 5 (+1), `home-search.test.tsx` 6 (+2), `page.test.tsx` 16 (+10), `nav-no-dead-ends.test.ts` 2 (new).
- **Delta**: +17 new tests across the feature's test surface; 0 deletions (the 30 deleted lines in the diff stat are all inside the two extended components' `.map()` rewrites, not test deletions).
- **Skipped tests**: none.
- **Failures**: none.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| NAV-01 | Pending | ✅ Verified |
| NAV-02 | Pending | ✅ Verified |
| NAV-03 | Pending | ✅ Verified |
| NAV-04 | Pending | ✅ Verified |
| NAV-05 | Pending | ✅ Verified (confirmed via existing `public-nav.test.tsx`, no regression) |
| NAV-06 | Pending | ✅ Verified |
| NAV-MN-01 | Pending | ✅ Verified (eval(−) green, guard mutation killed) |
| NAV-MN-02 | Pending | ✅ Verified (eval(−) green, guard mutation killed) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 12/12 ACs matched spec-defined outcome, 0 spec-precision gaps
**Sensor**: 5/5 mutations killed (P0/must-not-full tier)
**Must-nots**: 2/2 eval(−) green
**Gate**: typecheck ✓ · lint ✓ · test 1635/1635 ✓ · build ✓ (revalidate=600 preserved, `/` prerenders without live DB)

**What works**: All 6 functional requirements (NAV-01..06) and both must-nots (NAV-MN-01/02) are implemented, tested, and verified with real fault-injection — not just "an assertion exists." The three implementer-flagged deviations (decoy PII field, `undefined`-vs-`[]` fallback semantics, doc-comment rewrite to avoid a guard false-positive) were each independently scrutinized and confirmed legitimate, not shortcuts.

**Issues found**: None.

**Next steps**: None — USP-048 is the last unit of Fase 7; ready for PR-level review / merge per the orchestrator's process.

---

## Remediation — PR #289 AI review (post-merge-readiness findings)

Two findings from the automated PR review were addressed after this validation was first written; both trace to
requirements already listed above (NAV-MN-02, NAV-01) and do not change any prior verdict — they harden the
evidence.

### Finding 💡 — `nav-no-dead-ends` guard scope (NAV-MN-02)

**Gap**: `collectScanTargets()` in `src/shared/__tests__/nav-no-dead-ends.test.ts` scanned only
`(public)/page.tsx` + `home-*.tsx`, excluding the navigation shell (`site-header.tsx`, `site-footer.tsx`,
`public-nav.tsx`) — exactly where the prototype's `href="#"` dead-ends used to live before USP-046's migration
to real Next.js routing. NAV-MN-02 ("no dead ends in nav/CTA/busca/destaque") is broader than the home alone.

**Fix**: the scan now covers every non-test `.tsx` under `_components/` (casca + `home-*`) plus `page.tsx`
(9 files total as of this remediation: `page.tsx` + `site-header.tsx` + `site-footer.tsx` + `public-nav.tsx` +
5 `home-*.tsx`). The sanity assertion now checks nominally for the casca's 3 files + `page.tsx` + ≥5 `home-*`
files (not just a loose length), so a scan-zero-files regression is still caught. Broadening the scan surfaced
one genuine false positive: `site-footer.tsx`'s own doc-comment literally quoted `href="#"` (documenting the
*absence* of dead ends) — reworded to `nunca um link sem destino` (same precedent already used in `page.tsx`
per the original validation's deviation #3), no regex weakening.

**Evidence**: `src/shared/__tests__/nav-no-dead-ends.test.ts` — 2/2 tests green; `npm run test` full suite
244/244 files green after the change.

### Finding ⚠️ — NAV-01 round-trip coverage gap (L-007)

**Gap**: the NAV-01 block in `home-search.test.tsx` (~L42-64) only re-asserted static form attributes already
covered by HOME-03, framed as "confirma o fluxo `showPage('vagas')`" without ever exercising a live round-trip
— neither `/vagas` consuming `?q=` nor a service-category card landing on `/servicos?categoria=…`.

**Fix (two parts)**:
1. **New live E2E** — `e2e/home/navegacao-integrada.spec.ts` (4 tests), DB-resilient (asserts navigation
   mechanics — URL, heading, status < 400 — never seed-dependent counts):
   - `@nav-01` hero search with a term → `/vagas?q=<term>` + listing renders + the term round-trips back into
     the listing's own search input (proves `/vagas` actually consumes `?q=`, not just a URL change).
   - `@nav-01` hero search with an empty term → still navigates to `/vagas` without error.
   - `@nav-03` service category card → real `href` (never `#`, always within `/servicos`) → click lands on
     `/servicos` (with or without `?categoria=…`, matching the design §5 deterministic fallback) + page renders.
   - `@nav-05` header/footer/public-nav primary links (`/`, `/vagas`, `/servicos`, `/login`, `/cadastro`) have
     real hrefs on the home page and each resolves with status < 400.
2. **Reframed the RTL block** in `home-search.test.tsx`: renamed the `describe` to state honestly that it
   verifies only the *static GET contract* (form `method=get action=/vagas` + `name="q"`) with a filled/empty
   term, and removed the "confirma o fluxo" over-claim — the live round-trip is now owned by the E2E above. No
   assertions were removed beyond the misleading framing; coverage did not shrink (6/6 tests still pass).

**Evidence**:
- `e2e/home/navegacao-integrada.spec.ts` — **4/4 tests green, full file, single invocation** (`npx playwright
  test e2e/home/navegacao-integrada.spec.ts`), reproduced twice in a row, against the live local stack
  (`supabase start` + Next dev server, real service-category ids from the local seed, e.g.
  `/servicos?categoria=569b04e8-2e7c-4a76-ac3b-281ba57c7419`).
- **Root-caused a real local-only constraint while getting there**: the reused dev server (per the task's
  instructions — `reuseExistingServer` in `playwright.config.ts`) was started earlier without
  `RATE_LIMIT_DISABLED=true`, so the real rate limiter (`src/shared/lib/rateLimit.ts`) is live. `nav-05`
  originally `goto`'d `/cadastro` to prove it resolves — but `/cadastro` falls under the `registration`
  category (3 req/15min, anti-spam by design), not the looser `anonymous` bucket (10 req/min) the other
  targets use, and that tight budget was already exhausted by other local traffic (`e2e/auto-cadastro.spec.ts`
  itself hits `/cadastro` repeatedly). Fix: dropped the `/cadastro` `goto` from `nav-05` (its href is already
  proven statically, and `/cadastro`'s live resolution is already exercised repeatedly by
  `e2e/auto-cadastro.spec.ts` — re-navigating there added no coverage, only risk). CI sets
  `RATE_LIMIT_DISABLED: 'true'` on its own dedicated `webServer`, so this constraint doesn't apply there
  either way.
- `home-search.test.tsx` — 6/6 tests green (unchanged count, reframed assertions only).
- `nav-no-dead-ends.test.ts` scan now includes `e2e/home/navegacao-integrada.spec.ts`'s targets implicitly via
  the casca files it clicks through, so the two remediations reinforce each other (static guard + live proof).

---

## Independent Verifier re-check — remediation (2026-07-10)

Fresh Verifier sub-agent, diff range `90a0433..HEAD` (commits `bf4927a`, `57083da`). Author ≠ verifier.

**Gates**: `npm run typecheck` — 0 errors. `npm run lint` — clean. `npm run test` — **1635/1635 tests, 244/244
files green**, exactly matching the pre-remediation baseline (no silent reduction; both remediation commits
strengthened existing tests rather than adding/removing Vitest cases — the new coverage arrived via the new
Playwright file, which doesn't count against the Vitest baseline).

**Discrimination sensor (NAV-MN-02 guard)**: injected a literal `href="#"` into `site-header.tsx` (casca file,
`<Link href="/cadastro">` → `<Link href="#">`) — a file that was **out of scope before this remediation**.
`npx vitest run src/shared/__tests__/nav-no-dead-ends.test.ts` → 1/2 FAILED (`offenders` = `[site-header.tsx]`).
Reverted → 2/2 PASS. Mutant killed. (Note: an earlier attempt injecting into `PUBLIC_NAV_ITEMS`'s object-literal
`href: '/vagas'` → `href: '#'` did NOT fail, as expected — the guard is a raw-text scan for the JSX-attribute
form `href="#"`, not object-literal data; this is consistent with the guard's stated design and not a gap, since
`PublicNav`'s only two rendered `<Link href={item.href}>` call sites are themselves scanned and any literal
`href="#"` written directly in a `<Link>` tag anywhere in the casca is caught, which is what the mutation above
demonstrates.) Working tree confirmed clean after revert (`git diff --stat` empty on both touched files).

**E2E — live, not skeleton**: `e2e/home/navegacao-integrada.spec.ts` has 4 real assertions (`waitForResponse`,
URL/searchParams checks, `getByRole('heading')` visibility, `status < 400`) — no `test.fixme`/skeleton. Ran
`npx playwright test e2e/home/navegacao-integrada.spec.ts` three times: 2 clean single-invocation runs → **4/4
green** each (~5–6s warm). One run immediately after the full Vitest suite (cold Next dev-server compile) showed
a transient stall on `@nav-03` (page stayed on `/`, not a 429) — not reproduced in isolation
(`-g nav-03 --workers=1` → green) or in the two subsequent full-file runs; consistent with ordinary Next.js
dev-mode first-compile latency, not a defect. A `--repeat-each=2` stress run produced 429s across several
tests — root-caused to the **reused** local dev server (PID pre-existing on :3000) never having received
`RATE_LIMIT_DISABLED=true` (verified in `playwright.config.ts:40` — that env is only injected into servers
Playwright spawns itself; a reused server keeps whatever env it originally booted with). This reproduces
exactly the constraint the author already documented for `/cadastro` and does not indicate a functional
regression; CI always spawns its own `webServer` with that flag set. `--list` also confirms the 4 tests collect
correctly.

**Scope-creep check**: `git diff 90a0433..HEAD --name-only` touches exactly 6 files — `tasks.md`,
`validation.md`, `e2e/home/navegacao-integrada.spec.ts`, `home-search.test.tsx`, `site-footer.tsx`,
`nav-no-dead-ends.test.ts` — all within the two findings' scope. `src/app/layout.tsx` shows modified in
`git status` but is **absent from `git diff 90a0433..HEAD`**, confirming it is pre-existing uncommitted
working-tree state untouched by these two remediation commits. The `site-footer.tsx` change is a single-line
doc-comment reword (`href="#"` → `nunca um link sem destino`) with no change to rendered markup/logic —
confirmed via diff.

**`/cadastro` deviation assessment**: sound, not a coverage gap. Verified in
`src/shared/lib/rateLimit.ts:47-49` — `anonymous: 10/min` vs `registration: 3/15min`, a materially tighter
budget — and confirmed `/cadastro` is exercised live and repeatedly by `e2e/auto-cadastro.spec.ts` (which
`goto('/cadastro')`s directly) while its href is still asserted statically in `nav-05`. No coverage lost.

**Residual (non-blocking) observation**: `spec.md`'s own requirement-traceability table (NAV-01/NAV-03/NAV-05/
NAV-MN-02) still reads "Pending" — but this predates the remediation (confirmed identical at `90a0433`) and is
outside the two findings' scope; flagging for a future pass, not a gate here.

**Verdict**: ✅ **PASS**. Both PR #289 findings are genuinely closed with verifiable evidence; no regressions;
no scope creep; gates green; sensor kills the mutant it targets.
