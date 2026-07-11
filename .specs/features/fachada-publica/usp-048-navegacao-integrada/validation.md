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
