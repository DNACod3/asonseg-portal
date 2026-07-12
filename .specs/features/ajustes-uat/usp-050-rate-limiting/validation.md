# USP-050 — Rate limiting: Validation

**Date**: 2026-07-12 (re-verification, fix→re-verify iteration 3 — final)
**Spec**: `.specs/features/ajustes-uat/usp-050-rate-limiting/spec.md`
**Diff range**: `d36762c..a3196b7` (8 commits: `d36762c`, `162d8ea`, `977507e`, `cfcc787`, `6e489e8`, `4bda4e1`, `781c49b`, `a3196b7`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Verdict: PASS ✅ (iteration 3 of fix→re-verify — closes both prior findings)

**Iteration 1 finding** (PREF-01/02/03, RL-MN-01 dead against real Next.js request handling — the
documented `Next-Router-Prefetch` header never reached `request.headers` inside `middleware.ts`) —
**fixed in iteration 2**, confirmed live with `curl` and a real Chromium browser.

**Iteration 2 finding** (the iteration-2 fix traded a dead signal for a *forgeable* one — `Next-Url` — and
implemented a hard bypass, so any `curl` request with a spoofed `Next-Url` header completely defeated the
anonymous rate limiter) — **fixed in iteration 3**, confirmed live below. The hard bypass was removed
entirely and replaced with a new, explicit `routerData` category (`RATE_LIMITS.routerData = { limit: 60,
windowMs: 60_000 }`) that GET/HEAD requests carrying `Next-Url` are routed to — this category runs through
the **exact same** `rateLimiter.check`/429/header pipeline as every other category. Nothing bypasses the
rate limiter anymore; the "fix" is a properly-sized ceiling, not an exemption.

**Both the 60/min ceiling and the AC rewrite are legitimate, not a weakening**: the ceiling reuses the
already-accepted `authenticated` limit (not an invented number), is justified by measured volume (a real
page load fires ~8-15 router-fetches, confirmed empirically in iteration 2's own outcome-check — 8/10 of
the *old* anonymous bucket consumed by prefetches alone), gives ~4-7x headroom over a single page load
(covering realistic multi-page browsing per minute), and — critically — **still bounds an adversarial
forged-header scraper to a finite 60 req/min** (≈1 req/s sustained) instead of the previous unlimited
opt-out. `RL-MN-07`'s reconciliation ("no change to inherited category values, but adding a new category to
close a security gap is not the same as altering the existing design") is directly supported by the diff
evidence below: every pre-existing category value is byte-identical; only a new key was added.

---

## Live Outcome-Check (mandatory, real server) — re-run from scratch, adversarial scenario reproduced and closed

Build (`RATE_LIMIT_DISABLED` unset) → `npm run build` succeeded → `npm run start -p 3000` boots clean (200 on `/vagas`). Server killed at the end of each block; final tree left clean (`git status` shows only `.specs` bookkeeping + this report).

| # | Scenario | Result | Evidence |
| - | -------- | ------ | -------- |
| **b′** (the one that failed in iteration 2) | `curl -H "Next-Url: /" .../vagas` in a loop, same IP | ✅ **FIXED** | Exactly 60 requests → 200, the 61st onward → 429. `X-RateLimit-Limit: 60`, `X-RateLimit-Remaining: 0` on the 429. The previous "15/15 → 200, unlimited bypass" result no longer reproduces. |
| a | Real Chromium (Playwright): load `/`, real `<Link>` click-through nav, then a hard doc nav | ✅ PASS | Zero 429s anywhere. The 8 real router-fetches (carrying genuine `Next-Url: /`) are now billed to `routerData` (`remaining` 59→58→…→52), **not** to `anonymous`. The two genuine document-level navigations billed to `anonymous` (`remaining` 9→8), leaving the 10/min anonymous bucket almost entirely intact after a full page load + navigation. |
| c | POST `/cadastro` × 4, same IP | ✅ PASS | 200/200/200/429 — registration bucket intact. |
| c (adversarial) | POST `/cadastro` × 4 **with forged** `Next-Url: /cadastro` | ✅ PASS | 200/200/200/429 — identical to the non-forged case; the method gate (`routerData` only applies to GET/HEAD) still holds, forging the header on a mutation buys nothing. |
| d | GET `/cadastro` × 5, same IP | ✅ PASS | All 5 → 200. |
| e | `RATE_LIMIT_DISABLED=1` at build+start, then 65 GETs with forged `Next-Url` | ✅ PASS | 65× 200, zero 429 — the flag correctly disables all categories, including the new `routerData`. |
| e | `RATE_LIMIT_DISABLED=banana` | ✅ PASS | `npm run build` → exit 1, `Error: Variáveis de ambiente inválidas ou ausentes: RATE_LIMIT_DISABLED: Expected boolean, received string`. |

**Residual, explicitly-accepted trade-off (not a gap):** a client that forges `Next-Url` can now sustain up
to 60 req/min per IP against public GET routes (vs. 10 req/min for a plain anonymous scraper). This is a
conscious, documented widening of the abuse ceiling in exchange for not penalizing real navigation, reusing
a limit the codebase already accepts elsewhere (`authenticated`). It is bounded and finite — a categorical
improvement over iteration 2's unlimited bypass — and is recorded in `spec.md`'s Assumptions with its
rationale, not left as a silent gap.

---

## Spec-Anchored Acceptance Criteria (delta from iteration 2)

| Criterion | Spec-defined outcome | Evidence | Result |
| --- | --- | --- | --- |
| PREF-01/02/03 (rewritten) | `Next-Url` GET/HEAD → `routerData` (60/min), counted & bounded, not exempted | `middleware.test.ts:281-317` (unit) + live scenarios (a)/(b′) | ✅ PASS |
| **RL-MN-08 (new)** | forged `Next-Url` exceeding 60/min → 429, not an infinite opt-out | `middleware.test.ts:310-320` (unit) + live scenario (b′) | ✅ PASS |
| RL-MN-01 | router-fetch volume doesn't 429 nor penalize a later document nav | `middleware.test.ts:281-289` + live scenario (a) | ✅ PASS |
| RL-MN-02/03, REG-* | registration only on mutation; `/cadastro-assistido` excluded — unaffected by this iteration | `middleware.test.ts:222-260` + live scenarios (c)/(d) | ✅ PASS |
| RL-MN-06, P429-* | unaffected by this iteration, still green | `middleware.test.ts:369+` | ✅ PASS |
| **RL-MN-07 (reconciled)** | inherited categories byte-identical; `routerData` is an authorized addition | `git diff master...HEAD -- src/shared/lib/rateLimit.ts` — pure addition, zero lines changed/removed from existing categories | ✅ PASS |
| FLAG-*, VERCEL-* | unaffected, still green | live scenarios (e) | ✅ PASS |

**Status**: ✅ All AC/must-not items green — both prior findings (iteration 1's dead signal, iteration 2's
forgeable-bypass gap) are closed with live, adversarial evidence, not just unit tests.

---

## Discrimination Sensor (re-run against the iteration-3 fix)

| # | Must-Not / behavior | File:line mutated | Mutation | Killed? |
| - | --- | --- | --- | --- |
| 1 | **RL-MN-08 (new)** | `src/shared/lib/rateLimit.ts:68` | `routerData.limit` 60→200 | ✅ Killed (3/40 failed) |
| 2 | RL-MN-01 / routerData routing | `src/middleware.ts:148` | `if (!isMutation && isRouterDataRequest(...))` → `if (false && ...)` (disable routing to `routerData`) | ✅ Killed (3/40 failed — falls back to `anonymous`, hits 429 far earlier than 60) |
| 3 | RL-MN-02 | `src/middleware.ts:153` | `isPublicCadastro && isMutation` → `isPublicCadastro` | ✅ Killed (3/40 failed) |
| 4 | RL-MN-03 | `src/middleware.ts:152` | segment-exact match → `startsWith('/cadastro')` (old bug) | ✅ Killed (1/40 failed) |
| 5 | **Method-gate defense-in-depth** | `src/middleware.ts:146` | `isMutation` forced `false` | ✅ Killed (5/40 failed — cascades broadly, as expected) |
| 6 | RL-MN-04 | `src/shared/lib/env-flags.ts:35` | sentinel `return raw` → `return false` | ✅ Killed (4/41 failed) |
| 7 | RL-MN-05 | `src/shared/env.ts:103` | `isVercelDeploy` forced `false` | ✅ Killed (3/22 failed) |
| 8 | RL-MN-06 | `src/shared/lib/rateLimitResponse.ts:66` | `isDocumentRequest` forced `true` | ✅ Killed (4/54 failed) |

All mutations run in the real working tree, `git diff --stat` confirmed empty before/after each; full suite re-run green after final revert (260 files / 1784 tests).

**Sensor depth**: lightweight (8 mutations: 7 must-nots incl. the new RL-MN-08, plus the method-gate defense-in-depth)
**Result**: 8/8 killed — ✅ PASS.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test | Green (unit)? | Guard mutation killed? | Live-confirmed? |
| --- | --- | --- | --- | --- | --- |
| RL-MN-01 | router-fetch volume 429s or penalizes doc nav | `middleware.test.ts:281-289` | ✅ | ✅ | ✅ (scenario a) |
| RL-MN-02 | GET/prefetch `/cadastro` vira registration | `middleware.test.ts:227-232` | ✅ | ✅ | ✅ (scenario d) |
| RL-MN-03 | `/cadastro-assistido` vira registration | `middleware.test.ts:250-260` | ✅ | ✅ | not re-tested live this iteration (unchanged, unit+sensor strong) |
| RL-MN-04 | valor desconhecido vira `false` silencioso | `env.test.ts:145`, `env-flags.test.ts:35` | ✅ | ✅ | ✅ (scenario e) |
| RL-MN-05 | guard Vercel regride | `env.test.ts:178-198` | ✅ | ✅ | not re-tested live (deploy-only, unchanged) |
| RL-MN-06 | 429 RSC/fetch vira HTML | `middleware.test.ts:369+` | ✅ | ✅ | unchanged from iteration 2 |
| RL-MN-07 | categorias herdadas/lib/dep/migração alterados | `middleware.test.ts:373-383` | ✅ | ✅ | ✅ (`git diff` shows pure addition) |
| **RL-MN-08 (new)** | `Next-Url` forjado vira opt-out infinito | `middleware.test.ts:310-320` | ✅ | ✅ | ✅ (scenario b′ — the exact adversarial repro from iteration 2) |

**Status**: ✅ All 8 must-nots (7 original + 1 new) proven, both in unit and live.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — fix scoped to `middleware.ts`, `rateLimit.ts` (pure addition), tests, specs |
| Surgical changes | ✅ |
| No scope creep | ✅ — no new deps/migrations; inherited categories untouched |
| Honest risk logging | ✅ — `design.md`/`spec.md` explicitly document both prior findings as materialized, not swept under the rug, and record the residual 60-vs-10 trade-off with rationale |
| AC/must-not-change legitimacy | ✅ — anchored to PUB-1b's intent and ADR-0029's anti-scraping intent simultaneously; the 60/min figure reuses an existing accepted ceiling, not invented; `RL-MN-07`'s "addition vs. alteration" reconciliation is directly supported by the diff |
| Adversarial re-test of the exact prior failure | ✅ — scenario b′ is the literal repro from iteration 2, now closed |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run build && npm run test`
- **Result**: typecheck ✅ 0 errors; lint ✅ 0 errors; build ✅ (clean env, confirmed failing loud under `RATE_LIMIT_DISABLED=banana`); test ✅ 260 files / 1784 tests passed, 0 failed (+2 vs iteration 2: the `routerData` regression test + the adversarial RL-MN-08 test)
- **`rateLimit.ts` diff vs `master`**: pure addition of the `routerData` key; every pre-existing category (`anonymous`, `authenticated`, `registration`, `passwordReset`, `responsibleLookup`) byte-identical; algorithm (`rateLimiter`/sliding window) untouched
- **`superRefine` (VERCEL_ENV guard)**: textually intact, confirmed by direct read of `src/shared/env.ts:96+`

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| PUB-1a / FLAG-* / VERCEL-* / RL-MN-04/05 | ✅ Verified | ✅ Verified (unchanged) |
| PUB-1c / P429-* / RL-MN-06 | ✅ Verified | ✅ Verified (unchanged) |
| PUB-2, SOC-1 / REG-* / RL-MN-02/03 | ✅ Verified | ✅ Verified (unchanged) |
| PUB-1b / PREF-* / RL-MN-01 | ✅ Verified (iter. 2) | ✅ Verified — routerData design confirmed sound & non-bypassable |
| RL-MN-07 | ✅ Verified | ✅ Verified — reconciled to permit the `routerData` addition |
| **RL-MN-08 (new)** | ❌ Needs Fix (iter. 2 finding) | ✅ **Verified** — forged-header bypass closed, confirmed live |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: all items PASS across both prior-iteration findings
**Sensor**: 8/8 mutations killed
**Must-nots**: 8/8 green (unit + live), including the new RL-MN-08
**Gate**: typecheck/lint/build/test all green (260 files, 1784 tests)

**What works**: the complete arc across three fix→re-verify iterations is now closed with live,
adversarial evidence at each step — not just unit tests, which is what let the iteration-1 and iteration-2
gaps slip past a green test suite in the first place. Prefetch/soft-nav no longer breaks real navigation
(confirmed with a real browser). Neither the dead-header version (iteration 1) nor the forgeable-bypass
version (iteration 2) of the fix survives; the current design routes router-data GETs through the same
rate-limiting pipeline as everything else, at a deliberately-sized, non-infinite ceiling. Registration/
mutation protection (PUB-2/SOC-1) was unaffected throughout all three iterations, confirmed adversarially
each time. `rateLimit.ts`'s inherited categories and sliding-window algorithm remain untouched; the one new
category is an explicit, reasoned, reviewed addition.

**Issues found**: none blocking. The residual "forged-`Next-Url` scraper gets 60/min instead of 10/min"
trade-off is a conscious, documented, bounded design choice — not a silent gap — and is noted above for
visibility, not as a required fix.

**Next steps**: Close USP-050. No further fix→re-verify iterations needed.
