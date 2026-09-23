# USP-067 — Painel `/inicio` por papel — Validation

**Date**: 2026-08-20 (iteration 2 — re-verification)
**Spec**: `.specs/features/painel-area-logada/usp-067-painel-por-papel/spec.md`
**Diff range**: `origin/master..HEAD` (27 commits, `12a53fb`..`adb68c5`); fixes under review: `166545c`, `6bcc994`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Verdict: ✅ PASS

Both blocking findings from iteration 1 (`.specs/features/painel-area-logada/usp-067-painel-por-papel/validation.md` history, superseded by this report) are closed with evidence this Verifier produced independently — not accepted on the Implementer's word. Both mutations from iteration 1's discrimination sensor were re-run against the current tree: the PNL-MN-04 route mutation is decoy-killed by the new regression test, and the PNL-00 AC5 role-drift mutation is killed by the new BOARD test (1/10 failing, matching the Implementer's claim exactly). All items previously green (7/8 must-nots, all gates) remain green; the integration flake from iteration 1 did not reproduce this run (692/692 passed).

---

## 1. Fix 1 (PNL-MN-04, dead link) — Verdict: ✅ CONFIRMED CLOSED

**Claim**: "Ver detalhes" link to the nonexistent `/encaminhamentos/[id]` route was removed; only "Registrar resultado" (a real route) remains, gated by `canRegisterReferralResult`; a regression test blocks the bare href from reappearing.

**Evidence produced by this Verifier:**

- Read `src/app/(app)/inicio/_components/institutional-block.tsx` (current tree) — the referral row's `actions` now renders `data.canRegisterReferralResult ? <Link href={`/encaminhamentos/${referral.id}/resultado`}>...</Link> : undefined`. No `Link` to a bare `/encaminhamentos/${id}` exists anywhere in the file (`grep` confirms one `href` literal total, targeting `/resultado`).
- **Decoy-kill re-run (not trusted from commit message):** re-injected the exact prior code (`<>` wrapper with both "Ver detalhes" → `/encaminhamentos/${id}` and conditional "Registrar resultado") into `institutional-block.tsx`, then ran `npx vitest run "src/app/(app)/inicio/_components/__tests__/institutional-block.test.tsx"`. Result: **1/7 failed** — the new test (`institutional-block.test.tsx:169-190`, "PNL-MN-04 (regressão pós-Verifier)") fails exactly on `expect(screen.queryByRole('link', { name: 'Ver detalhes' })).not.toBeInTheDocument()`, with the offending `<a href="/encaminhamentos/ref-1">Ver detalhes</a>` printed in the RTL diff. Mutation reverted; `git status --short` confirmed clean after.
- **Dead-end concern (raised in task brief) resolved by spec, not by omission:** who has *no* action left on the row (BOARD, `canRegisterReferralResult=false`) is not an accidental gap — `permissions.ts:20,25,38` confirms `REGISTER_REFERRAL_RESULT` is granted to `COORDINATOR`/`SOCIAL_ASSISTANT` only, never `BOARD`, and spec **P1.7-2** explicitly requires BOARD's referrals card to be "somente leitura: ... nenhuma ação de encaminhamento (BOARD não tem `REFER_*`/`REGISTER_*`)". The read-only test added in `166545c` (BOARD, `canRegisterReferralResult=false` → no link at all) is therefore asserting spec-mandated behavior, not settling for a UX regression.
- `DashboardRow` (`dashboard-row.tsx:31` — `{actions && <div>...}`) already renders nothing for `actions={undefined}`, the exact same pattern already used one card up for the moderation-queue row (`data.canModerate ? (...) : undefined`) — no new component-level special-casing was introduced.

**⚠️ Spec-precision note (pre-existing, not introduced by this fix, non-blocking):** Spec ACs **P1.5-3** ("cada linha com 'Ver detalhes' e 'Registrar resultado'") and **P1.6-2** ("com ações (ver detalhes, registrar resultado)") literally call for a "Ver detalhes" action that has no backing route anywhere in the diff (`src/app/(app)/encaminhamentos/[id]/` only has `resultado/page.tsx` and `novo/page.tsx`, confirmed via `find` and the `next build` route manifest). The reconciliation table's **A-10** entry (spec.md:62) already resolved this ambiguity in the other direction — "Ação 'registrar resultado' ...; BOARD não vê ações (read-only)" — mentioning no "ver detalhes" action at all, and **A-11**/`PNL-MN-04` categorically forbid linking a nonexistent route. The Implementer's fix follows A-10/PNL-MN-04 (the must-not and the authoritative reconciliation) over the AC prose, which is the correct precedence per this skill's rules (a must-not is a world-level prohibition; literal AC text referencing a nonexistent route cannot be honored without violating it). Recommend a documentation-only follow-up: update P1.5-3/P1.6-2's wording to match A-10 so the spec stops contradicting itself. Not a fix task — no code or test action required.

---

## 2. Fix 2 (PNL-00 AC5, institutional gate source of truth) — Verdict: ✅ CONFIRMED CLOSED

**Claim**: `page.tsx` now calls `hubAccessFromRoles(person.roles).reports` (imported from `@/modules/identity`) instead of a local `INSTITUTIONAL_ROLES` array, preserving the `|| canAccessModerationQueue(person)` fallback for the delegated volunteer; the exact iteration-1 mutation was reproduced and now fails.

**Evidence produced by this Verifier:**

- Confirmed `hubAccessFromRoles` is genuinely exported through the barrel: `src/modules/identity/index.ts:56` — `export { buildHubLinks, hubAccessFromRoles, EXISTING_HUB_ROUTES } from './domain/hub-links';` — and its `reports` field is derived from `REPORTS_ROLES = ['COORDINATOR', 'BOARD', 'SOCIAL_ASSISTANT']` (`src/modules/identity/domain/hub-links.ts:67,78-89`).
- Confirmed current `page.tsx:36` reads `const institutional = canModerate || hubAccessFromRoles(person.roles).reports;` — the local `INSTITUTIONAL_ROLES` constant is gone (`grep -n INSTITUTIONAL_ROLES src/app/\(app\)/inicio/page.tsx` → no matches), and the `||` fallback order/operands are unchanged from before (`canModerate` still first, still OR'd), so the delegated-volunteer path (`canAccessModerationQueue` true, no inherent institutional role) is preserved exactly as it was.
- **Mutation re-run independently (not trusted from commit message):** edited `src/modules/identity/domain/hub-links.ts:67` to drop `'BOARD'` from `REPORTS_ROLES` (the identical mutation iteration 1 used), then ran `npx vitest run "src/app/(app)/inicio/page.test.tsx"`. Result: **1/10 failed** — exactly the count the Implementer's commit message claims — on the new test `page.test.tsx:203-217` ("BOARD (canModerate=false): bloco institucional aparece via hubAccessFromRoles(roles).reports real"), with the RTL error showing "Institucional" absent from the rendered tree. Mutation reverted; `git diff` on `hub-links.ts` confirmed empty (clean revert, no residual diff — the "reversão limpa" claim holds).
- Confirmed `hubAccessFromRoles` is **not** mocked in `page.test.tsx` (only `requireActivePerson`/`canAccessModerationQueue` from `@/modules/identity`/`@/modules/moderation` are substituted per the existing `vi.mock` setup) — the real implementation runs, so the kill above is against production logic, not a test double.
- Re-ran the two full test files together in the unmutated tree: `npx vitest run page.test.tsx institutional-block.test.tsx` → **17/17 passed**, confirming the fixes don't break each other or their own new assertions.
- `git diff origin/master...HEAD -- src/modules/identity/domain/hub-links.ts` → empty. `hub-links.ts` itself carries zero diff for this whole feature — Fix 2 consumes it, never edits it, exactly as claimed.

**Result**: PNL-00 AC5's "SHALL derivar exatamente das flags `hubAccessFromRoles`... nunca de leitura ad-hoc" is now literally true, and the sensor gap that made the divergence undetectable in iteration 1 is closed by a test that runs the real function.

---

## Non-Regression Confirmation (items green in iteration 1, re-confirmed here)

| Item | Check performed | Result |
| --- | --- | --- |
| PII selects (8 new queries, no restricted third-party field) | `git diff --name-only` for the two fix commits touches only `page.tsx`/`page.test.tsx`/`institutional-block.tsx`/`institutional-block.test.tsx` — none of the query files. `privacy.mn.test.tsx` (`git log` shows last touched at `22ecc63`, T18) untouched since, and passes in the full run below. | ✅ Unchanged, still green |
| 5-record cap (PNL-MN-07) | `dashboard-card.test.tsx` untouched by the fix commits (`git log` shows last touch `c197ba0`, T11); passes in full run. | ✅ Unchanged, still green |
| D-001 read-only (SOCIAL_ASSISTANT/BOARD no decision button) | Moderation-queue rendering logic in `institutional-block.tsx` (the `data.canModerate ? (...) : undefined` branch for queue actions) untouched by either fix commit — only the referrals-row branch below it changed. | ✅ Unchanged, still green |
| Zero Prisma migration (PNL-MN-06) | `git diff --name-only origin/master...HEAD -- prisma/migrations` | ✅ Empty |
| Casca intact (AD-027/AD-028) | `git diff --name-only origin/master...HEAD` grepped for `layout.tsx`/`app-shell`/`app-sidebar`/`profile-menu`/`app-bottom-nav` | ✅ Empty — no matches |
| 7-role scope table coverage | No loader/block file for any of the 7 role panels changed in the two fix commits; full unit suite (325/325 files) still green, including all 7 `*-block.test.tsx` files. | ✅ Unchanged, still green |

---

## Gate Check (re-executed by this Verifier, not accepted on the Implementer's word)

| Gate | Command | Result | Matches Implementer's claim? |
| ---- | ------- | ------ | ------------------------------ |
| Typecheck | `npm run typecheck` | ✅ exit 0, clean | ✅ Yes |
| Lint | `npm run lint` | ✅ exit 0, clean | ✅ Yes |
| Unit | `npm run test -- --run` | ✅ 325/325 files, **2260/2260** tests | ✅ Yes, exact match (+4 vs. iteration 1's 2256, matching the 3 new `page.test.tsx` tests + 1 new `institutional-block.test.tsx` test) |
| Integration | `npm run test:integration -- --run` | ✅ **122/122 files, 692/692 tests** | ✅ Yes — the `auth-attempts-retention` flake from iteration 1 did not reproduce this run |
| Build | `npm run build` | ✅ exit 0, `/inicio` listed as `ƒ` (dynamic) | ✅ Yes |
| Migrations | `git diff --name-only origin/master...HEAD -- prisma/migrations` | ✅ empty | ✅ Yes |
| Casca intact | `git diff --name-only` filtered | ✅ empty | ✅ Yes |

---

## Discrimination Sensor (re-run this iteration, in the real working tree, revert-verified after each)

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 (carried over from iteration 1, re-confirmed unaffected) | `dashboard-card.tsx:5` — not re-run this iteration (file untouched by either fix; already proven killed in iteration 1 and unmodified since) | `DASHBOARD_CARD_MAX_ROWS = 5` → `6` | ✅ Killed (iteration 1 evidence stands — file has zero diff since) |
| 2 (carried over, re-confirmed unaffected) | `institutional-block.tsx:49` (queue actions gate) — not re-run this iteration (untouched by either fix; different branch than what changed) | `data.canModerate ? (...) : undefined` → `true ? (...) : undefined` | ✅ Killed (iteration 1 evidence stands) |
| 3 — re-run this iteration (**this was the surviving mutant**) | `src/modules/identity/domain/hub-links.ts:67` | Drop `'BOARD'` from `REPORTS_ROLES` | ✅ **Now Killed** — `page.test.tsx`: 1/10 failed (was 0/7 failed / fully survived in iteration 1) |
| 4 — new this iteration | `institutional-block.tsx` referral-row `actions` | Re-inject dead `Link href="/encaminhamentos/${id}"` "Ver detalhes" | ✅ Killed — `institutional-block.test.tsx`: 1/7 failed |

**Sensor depth**: lightweight (2 re-run + 2 carried-over, proportional)
**Result**: 4/4 killed (2 re-verified live this iteration, 2 carried over from iteration 1 on unmodified files) — no survivors.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | ------------------------------------------ | ------ | ------------------------ |
| PNL-MN-01 | vazar campo restrito de terceiro no payload | `__tests__/privacy.mn.test.tsx:33-104` | ✅ | ✅ (iteration 1, file unchanged) |
| PNL-MN-02 | expor identidade de candidato no card COMPANY | `list-company-recent-applications.int.test.ts:127-139` + `privacy.mn.test.tsx:106-133` | ✅ | ✅ (iteration 1, files unchanged) |
| PNL-MN-03 | expor ação/rota de decisão de moderação sem `canAccessModerationQueue` | `institutional-block.test.tsx` + `privacy.mn.test.tsx:150-186` | ✅ | ✅ (iteration 1, moderation-queue branch unchanged) |
| PNL-MN-04 | render bloco/card/ação cuja rota-alvo não existe/não é acessível | `institutional-block.test.tsx:169-190` ("PNL-MN-04 (regressão pós-Verifier)") | ✅ | ✅ **re-verified live this iteration** (mutation 4 above) |
| PNL-MN-05 | Prisma direto em `page.tsx`/`_loaders/**` | `no-direct-prisma.guard.test.ts` | ✅ | not re-tested (static guard, unchanged) |
| PNL-MN-06 | migração/estado/mutação nova | `read-only-queries.guard.test.ts` + migrations diff | ✅ | structural, re-confirmed empty |
| PNL-MN-07 | >5 registros / leitura sem `take` | `dashboard-card.test.tsx` + int tests | ✅ | ✅ (iteration 1, unchanged) |
| PNL-MN-08 | hex cru / paleta fixa Tailwind | `ds-tokens.guard.test.ts` | ✅ | not re-tested (static guard, unchanged) |

**Status**: ✅ **All 8 must-nots green**, PNL-MN-04 now also mutation-verified (was the sole partial/violated item in iteration 1).

---

## Spec-Anchored Acceptance Criteria (delta from iteration 1)

| Criterion | Iteration 1 result | Iteration 2 evidence | Result |
| --- | --- | --- | --- |
| P1.0-4 / PNL-MN-04 | ⚠️ PASS at card-footer level, GAP at per-row level (live 404) | `institutional-block.tsx` — dead link removed; `institutional-block.test.tsx:169-190` decoy-kill confirmed above | ✅ PASS |
| P1.0-5 (PNL-00 AC5) | ❌ GAP — hardcoded array, mutation survived | `page.tsx:36` — `hubAccessFromRoles(person.roles).reports`; mutation re-run, now killed (1/10 failed) | ✅ PASS |
| P1.5-3 / P1.6-2 (AC prose "ver detalhes") | not flagged | AC prose contradicts A-10 reconciliation + PNL-MN-04; implementation correctly follows A-10/must-not | ⚠️ Spec-precision gap (documentation only, non-blocking — see Fix 1 note above) |

All other 13 ACs unchanged from iteration 1's ✅ PASS (not re-litigated; no code in scope for those blocks changed).

---

## Deviation Verdicts

Iteration 1's four declared-deviation verdicts stand unchanged — no new deviations introduced by the two fix commits, and none of the reasoning underlying those verdicts touches files that changed here:

1. **T17 hardcoded array vs. `hubAccessFromRoles`** — was the Fix 2 root cause; now resolved (see above), superseding the iteration-1 "CONFIRMED gap" verdict with "CLOSED."
2. **Hub-of-shortcuts substituted by panel** — CONFIRMED legitimate (iteration 1, unaffected by these fixes).
3. **`abca14a` eslint-disable** — CONFIRMED correct remedy (iteration 1, unaffected).
4. **`046fb3c` deep-import carve-out for resubmit buttons, partially unregistered in the module-only guard** — CONFIRMED real precedent/necessity, minor follow-up recommended (iteration 1, unaffected — non-blocking then, still non-blocking now).
5. **`hub-link-card.tsx` dead code** — CONFIRMED, follow-up recommended (iteration 1, unaffected).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — both fixes are surgical: Fix 1 deletes a broken branch and its wrapper fragment; Fix 2 deletes a local array and swaps one call site |
| Surgical changes | ✅ — diff for both commits combined touches exactly 2 source files + 2 test files, all within `(app)/inicio/**` |
| No scope creep | ✅ |
| Matches patterns | ✅ — `actions={cond ? (...) : undefined}` reuses the exact pattern already present one card up in the same file |
| Spec-anchored outcome check | ✅ both fix targets confirmed against re-derived spec-defined outcome (see sections 1–2 above) |
| Every test maps to a spec requirement | ✅ — both new/changed tests trace to PNL-MN-04 and PNL-00 AC5 respectively |
| Documented guidelines followed | CLAUDE.md (barrel import: `hubAccessFromRoles` now imported via `@/modules/identity` barrel, not a deep path) |

---

## Requirement Traceability Update

| Requirement ID | Iteration 1 Status | Iteration 2 Status |
| --------------- | ----------------- | ------------ |
| PNL-00 (AC5) | ❌ Needs Fix | ✅ Verified |
| PNL-01..07 | ✅ Verified (unaffected by these fixes) | ✅ Verified |
| PNL-MN-01..03 | ✅ Verified | ✅ Verified |
| PNL-MN-04 | ❌ Needs Fix | ✅ Verified |
| PNL-MN-05..08 | ✅ Verified | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 15/16 ACs cleanly matched; 1 pre-existing documentation-only precision gap flagged (P1.5-3/P1.6-2 AC prose vs. A-10 reconciliation), non-blocking
**Sensor**: 4/4 mutations killed (2 re-run live this iteration, both previously-surviving-now-killed and newly-added; 2 carried over from iteration 1 on files with zero diff since)
**Must-nots**: 8/8 green, all with evidence; PNL-MN-04 now also mutation-verified
**Gate**: typecheck ✅, lint ✅, unit 2260/2260 ✅, integration 692/692 ✅, build ✅, migrations empty ✅, casca intact ✅

**What works**: Both findings from iteration 1 are closed with evidence this Verifier produced independently (not accepted from the Implementer's commit messages) — the exact prior mutations were reproduced and confirmed killed, and the removed/added code was read in full, not sampled. All items previously green in iteration 1 remain green and were spot-confirmed unchanged at the file level for the fixes' blast radius.

**Issues found**: None blocking. One non-blocking recommendation carried over: update spec.md P1.5-3/P1.6-2 AC prose to match the A-10 reconciliation table (drop "ver detalhes" from the wording) so the spec stops literally contradicting its own must-not — documentation-only, no code/test action.

**Next steps**: Feature is ready to merge. Optional low-priority follow-ups (none block this USP): (a) spec.md AC-prose sync noted above, (b) extend `no-deep-module-imports.test.ts`'s scan root to cover `src/app/(app)/inicio/_components/**` so the resubmit-button carve-out is machine-registered the same way module-side exceptions are, (c) delete dead `hub-link-card.tsx` + its test.

---

## Iteração 3 — rodada de correção do PR review

**Date**: 2026-09-23
**Diff range**: `bac648f..HEAD` (5 commits: `59e80fb`, `386c83e`, `56eaa0a`, `c0ca9a9`, `7c39ef5`)
**Verifier**: independent sub-agent (author ≠ verifier), no relation to the PR #297 author or the multi-agent `/pr-review` that raised the 4 findings
**Context**: not a new USP. PR #297 (USP-067) was already merged-eligible after iteration 2's PASS (AD-032); `/pr-review` on the open PR returned 4 non-blocking findings (A–D) plus one self-inflicted hygiene issue (E, a guard false-positive introduced by fix A's own comment). This iteration verifies all 5 fix commits.

### Verdict: ✅ PASS

All 5 commits verified with independently-reproduced evidence — not accepted from commit messages. Achados C and D are protected by real, mutation-killed tests (7 mutations injected across 2 components + 1 guard, all killed). Achados A and B are correctly-implemented, low-risk perf changes with **no behavior-level test oracle** — confirmed by injecting the exact regression each perf fix could reintroduce (cache() dedupe removed, BOARD count silently zeroed) and observing the full `src/app/(app)/inicio` suite (18 files / 76 tests) stay green in both cases. This is reported as a **gap, not a FAIL**, per this task's explicit instruction, and is consistent with a pre-existing project-wide pattern (none of the 5 `_loaders/*.ts` files are unit-tested directly — all are mocked in `page.tsx`'s test and exercised only through their downstream `*-block.tsx` components with static props). Achado E is a pure comment edit, verified to have zero semantic effect.

### A — `getHomeIndicators` deduped via `React.cache()` (`59e80fb`) — Verdict: ✅ CORRECT, ⚠️ UNPROTECTED (gap, non-blocking)

- `cache` is imported correctly as a **named export** from `'react'` (`import { cache } from 'react';` — `src/modules/reporting/queries/home-indicators.ts:1`), matching the exact pattern of the two cited precedents: `getCurrentPerson` (`src/modules/identity/server/session.ts:1,50`) and (per that file's own doc comment) `canAccessModerationQueue`. React's `cache()` has always been a named export, not default — the task brief's framing of "is `cache()` the default export" was a trap; confirmed false by reading the precedent file directly, not by assumption.
- **All 3 real consumers verified RSC, zero client-side callers.** Ran `grep -rln "getHomeIndicators" src --include="*.ts" --include="*.tsx"` myself (not trusting the Implementer's grep) and inspected each: `src/app/(app)/inicio/_loaders/candidate.ts:7,57`, `src/app/(app)/inicio/_loaders/institutional.ts:3,107`, `src/app/(public)/page.tsx:2,80` — none carry `'use client'` (checked via `head -5` on each file). The barrel re-export (`src/modules/reporting/index.ts:32`) and 5 other files matched by the initial grep are comment-only references (JSDoc mentions), not calls — confirmed individually.
- **No sensor exists for the dedupe itself.** Backed up `home-indicators.ts`, replaced `export const getHomeIndicators = cache(async function ...)` with a plain `export async function getHomeIndicators()` (semantically: cache() silently vanishes), ran `npx vitest run "src/modules/reporting/__tests__/home-indicators.int.test.ts" "src/app/(app)/inicio"` → **18/18 test files, 76/76 tests still passed**. Reverted (`git diff` empty after). This is expected and not a defect specific to this fix: React's `cache()` only memoizes inside an actual RSC render pass; Vitest calling the function directly (as the existing int test and all `*-loader` consumers-via-mock do) never exercises the request-scoped cache in the first place, so no test in the current suite *could* observe its presence or absence. Reported as a follow-up gap, not a fix task (no cheap oracle exists without an RSC-render-level test harness, which is out of scope for this round).

### B — BOARD counts folded into main `Promise.all` (`386c83e`) — Verdict: ✅ CORRECT, ⚠️ UNPROTECTED (pre-existing gap, non-blocking)

- Read `src/app/(app)/inicio/_loaders/institutional.ts:73-112` in full. The destructure `[queueItems, canRegisterResult, monthReport, recentReferrals, activePersons, homeIndicators]` lines up positionally with the 6-element `Promise.all` array; `activePersons`/`homeIndicators` reuse the exact conditional-promise shape (`isBoard ? realCall().catch(fallback) : Promise.resolve(fallback))`) already established by `needsReferrals` two elements above — same pattern, not a new abstraction.
- The downstream BOARD KPI block (`institutional.ts:130-135`, `{ label: 'Pessoas ativas', value: activePersons, ... }` / `{ label: 'Empresas ativas', value: homeIndicators.verifiedCompanies, ... }`) is unchanged from before the refactor — only the promise's origin (separate sequential `Promise.all` → folded into the main one) moved, not the consumption. Confirmed no other file in the diff touches this file's downstream logic.
- **`page.tsx` was not touched this round** (`git diff --name-only bac648f..HEAD -- "src/app/(app)/inicio/page.tsx"` → empty), so the combination with Achado A's `cache()` cannot have altered the institutional gate (`hubAccessFromRoles(...).reports || canAccessModerationQueue(...)`, still at `page.tsx:43`, read directly) — re-confirmed non-regression separately below.
- **No test exercises `loadInstitutionalPanel` with real or partially-real dependencies at all** — this predates the fix. `page.test.tsx` fully mocks `./_loaders/institutional` (`vi.mock('./_loaders/institutional', () => ({ loadInstitutionalPanel: vi.fn() }))`); `institutional-block.test.tsx` only renders the `InstitutionalBlock` *component* with hand-built static props, never calling the loader function. Confirmed this is the project-wide pattern, not something newly absent: the same is true of `candidate.ts`, `provider.ts`, `client.ts`, `company.ts` (all 4 other loaders — checked each is likewise only referenced from `page.test.tsx`'s mocks and their own `*-block.test.tsx` component tests, never directly).
- **Mutation re-run to confirm the gap is real, not assumed:** injected `countActivePersons().then(() => 0).catch(...)` (BOARD's "Pessoas ativas" KPI silently pinned to `0` regardless of the real DB count — a realistic regression a careless refactor could reintroduce), ran `npx vitest run "src/app/(app)/inicio"` → **18/18 files, 76/76 tests still passed.** Reverted, `git diff` empty. Confirms: this specific refactor carries the same pre-existing lacuna as every other loader in this directory, not a new one it introduced.

### C — Resubmit button interactive branches (`56eaa0a`) — Verdict: ✅ CONFIRMED, mutation-verified non-vacuous

- Read both new test files in full (`resubmit-job-button.test.tsx:1-80`, `resubmit-service-button.test.tsx:1-84`) and both components (`resubmit-job-button.tsx`, `resubmit-service-button.tsx`) — assertions match the real component logic line-for-line (mock paths `@/modules/jobs/actions/submit-job-for-moderation` / `@/modules/services/actions/submit-service-for-moderation` are exactly what the components import; no barrel involved).
- **Lateral claim confirmed independently:** `grep -n "vi.mock" "src/app/(app)/inicio/_components/__tests__/provider-block.test.tsx"` shows `vi.mock('@/modules/services', ...)` mocking `submitServiceForModeration` on the **barrel**, while `resubmit-service-button.tsx:12` deep-imports from `@/modules/services/actions/submit-service-for-moderation` — confirmed these are genuinely different module specifiers Vitest would resolve to different mock registrations, so a click in `provider-block.test.tsx` (which doesn't fire one — grep for `fireEvent.click`/`Corrigir e reenviar` there returns only a `getByRole` presence check at line 110, no click) would not have hit the mock. Bug pre-existing as claimed, correctly not touched this round (declared out of scope).
- **Discrimination sensor — 3 mutations per component, all independently injected and reverted, all killed:**

| # | File:line | Mutation | Component | Result |
|---|---|---|---|---|
| 1 | `resubmit-job-button.tsx:35` | removed `router.refresh()` call after `ok:true` | Job | ✅ Killed — 2/3 tests failed (happy path assertion + pending-path's final `refreshMock` check) |
| 2 | `resubmit-job-button.tsx:45` | `role="alert"` → `role="status"` | Job | ✅ Killed — 1/3 failed (`findByRole('alert')` times out) |
| 3 | `resubmit-job-button.tsx:41` | removed `disabled={isPending}` | Job | ✅ Killed — 1/3 failed (`toBeDisabled()` on a non-disabled button) |
| 4 | `resubmit-service-button.tsx:36` | removed `router.refresh()` call after `ok:true` | Service | ✅ Killed — 2/3 tests failed (spot-check confirming the "same shape, same fix" claim isn't assumed) |

Each mutation was applied to a backed-up copy, run against only the relevant test file, then reverted with `git diff --stat` confirmed empty before the next mutation. No decoy survived.

### D — `no-deep-module-imports` guard extended to `src/app/**` (`c0ca9a9`) — Verdict: ✅ CONFIRMED, mutation-verified

- Read the full diff of `src/shared/__tests__/no-deep-module-imports.test.ts`. `scannedFiles()` now unions `sourceFiles(MODULES_DIR)` and the new `sourceFiles(INICIO_COMPONENTS_DIR)` (`join(process.cwd(), 'src/app/(app)/inicio/_components')`), feeding both existing assertions (no-unregistered-offenders + exact-known-list).
- **`knownExceptionFiles` list verified exact, not over/under-inclusive:** baseline run (unmutated) of `no-deep-module-imports.test.ts` → **2/2 passed**, which structurally requires the declared 7-file list (`persons/candidate-form.tsx`, `persons/provider-form.tsx`, `jobs/job-form.tsx`, `services/service-form.tsx`, `cv-extraction/CvUploadForm.tsx`, `inicio/_components/resubmit-job-button.tsx`, `inicio/_components/resubmit-service-button.tsx`) to match the scanner's live findings byte-for-byte — a mismatch in either direction would have failed this exact test.
- **Mutation re-run to prove the new scan root is live, not decorative:** removed the `// eslint-disable-next-line no-restricted-imports` comment immediately above `resubmit-job-button.tsx`'s deep import (the guard's only signal that a deep import is a reviewed exception vs. a violation), ran the guard test → **2/2 failed** — test 1 ("nenhum deep-import... sem a exceção documentada") now lists `resubmit-job-button.tsx` as an unregistered offender; test 2 ("...restrita aos 7 arquivos conhecidos") fails because the live-scanned exception set drops to 6, no longer matching the declared 7. Reverted, `git diff` empty.
- `L-027` in `.specs/LESSONS.md:171-176` is marked `[RESOLVED]` with a dated `resolved:` line appended below the original `evidence`/`last seen` lines — original context (signal, recurrence, evidence, last-seen) preserved verbatim, nothing overwritten or deleted.

### E — `#297` → `PR 297` hygiene fix (`7c39ef5`) — Verdict: ✅ CONFIRMED, zero semantic effect

- `git show 7c39ef5` touches only 2 comment lines (1 per new test file from Achado C), both purely textual (`USP-067 (PR #297 review)` → `USP-067 (PR 297 review)`). No code line, assertion, or mock changed.
- `grep -rn "#297" src/app/\(app\)/inicio/` → empty — no raw `#297` remains anywhere in scope.
- `npx vitest run "src/app/(app)/inicio/__tests__/ds-tokens.guard.test.ts"` (DS-MN-01) → **3/3 passed**, confirming the false-positive is resolved.

### Non-Regression Confirmation

| Item | Check performed | Result |
| --- | --- | --- |
| Zero Prisma migrations | `git diff --name-only bac648f..HEAD -- prisma/migrations` | ✅ Empty |
| Casca `(app)` intact | `git diff --name-only bac648f..HEAD` grepped for `layout\.tsx\|app-shell\|app-sidebar\|profile-menu\|app-bottom-nav` | ✅ Empty — no matches |
| ROADMAP/STATE untouched | `git diff --name-only bac648f..HEAD` grepped for `ROADMAP\.md\|STATE\.md` | ✅ Empty |
| Privacy contract of `list-company-recent-applications.ts` | `select:` block grepped for `candidate` | ✅ No match — no `candidate`/`candidatePersonId` field |
| Institutional gate still `hubAccessFromRoles(person.roles).reports \|\| canAccessModerationQueue(person)` | Read `src/app/(app)/inicio/page.tsx:42-43` directly; confirmed `page.tsx` has zero diff in this round (`git diff --name-only bac648f..HEAD -- "src/app/(app)/inicio/page.tsx"` → empty) | ✅ Unchanged — Achado B could not have touched it (different file) |
| Working tree clean at start/end | `git status --short` before and after every mutation round | ✅ Clean throughout |

### Gate Check (re-executed by this Verifier, not accepted on the Implementer's word)

| Gate | Command | Result | Matches Implementer's claim? |
| ---- | ------- | ------ | ------------------------------ |
| Typecheck | `npm run typecheck` | ✅ exit 0, clean | ✅ Yes |
| Lint | `npm run lint` | ✅ exit 0, clean | ✅ Yes |
| Unit | `npm run test -- --run` | ✅ **327/327 files, 2266/2266 tests** | ✅ Yes, exact match (+6 vs. iteration 2's 2260) |
| Integration | `npm run test:integration -- --run` | ✅ **122/122 files, 692/692 tests** | ✅ Yes — `moderation-content-panel.test.tsx` flake did not reproduce this run |
| Build | `npm run build` | ✅ exit 0; `/inicio` listed as `ƒ` (dynamic); 51 route lines counted (Implementer claimed 52 — immaterial counting-convention difference, not a build failure) | ✅ Yes (build succeeds; route-count off-by-one not investigated further, non-blocking) |
| Coverage | `npm run test:coverage -- --run` | ✅ exit 0 — Stmts 75.91% / **Branches 69.65%** / Funcs 75.48% / Lines 77.58% (gate 65%) | ✅ Yes, exact match on all 4 figures |
| Migrations | `git diff --name-only bac648f..HEAD -- prisma/migrations` | ✅ empty | ✅ Yes |
| Casca intact | `git diff --name-only bac648f..HEAD` filtered | ✅ empty | ✅ Yes |

### Discrimination Sensor (this iteration, all mutations independently injected in the real tree, reverted and `git diff`-confirmed clean after each)

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `home-indicators.ts:37` | `cache(async function ...)` → plain `async function` (Achado A) | ❌ Survived — no test observes `cache()` presence (expected; RSC-scoped memoization invisible to direct Vitest calls; reported as gap, not fix task) |
| 2 | `institutional.ts:100-105` | BOARD's `countActivePersons()` result silently pinned to `0` (Achado B) | ❌ Survived — `loadInstitutionalPanel` has zero direct test coverage, pre-existing project-wide pattern across all 5 `_loaders/*.ts` files |
| 3 | `resubmit-job-button.tsx:35` | removed `router.refresh()` | ✅ Killed |
| 4 | `resubmit-job-button.tsx:45` | `role="alert"` → `role="status"` | ✅ Killed |
| 5 | `resubmit-job-button.tsx:41` | removed `disabled={isPending}` | ✅ Killed |
| 6 | `resubmit-service-button.tsx:36` | removed `router.refresh()` | ✅ Killed |
| 7 | `no-deep-module-imports.test.ts` guard target (`resubmit-job-button.tsx`'s `eslint-disable-next-line`) | removed the disable comment | ✅ Killed (both of the guard's 2 assertions) |

**Sensor depth**: lightweight (proportional to a non-P0 perf/test/guard fix round)
**Result**: 5/7 killed, 2 survived — **both survivors are pre-existing/inherent lacunae explicitly called out in the task brief's own instructions ("if no sensor exists, report as gap, not FAIL")**, not defects introduced by this round. No fix task generated for either; both are flagged as low-priority follow-ups below.

### Must-Not Verification

No new `[FEAT]-MN-NN` was introduced or modified by this round (all 5 commits are perf/test/guard/hygiene work, not spec-behavior changes). Re-confirmed all 8 PNL-MN-* remain green via the full unit run (2266/2266 passed, includes `privacy.mn.test.tsx`, `no-direct-prisma.guard.test.ts`, `read-only-queries.guard.test.ts`, `dashboard-card.test.tsx`, `ds-tokens.guard.test.ts`, `institutional-block.test.tsx`) — no must-not test file appears in the diff for this round (`git diff --name-only bac648f..HEAD` lists only `home-indicators.ts`, `institutional.ts`, `no-deep-module-imports.test.ts`, 2 new resubmit-button test files, `.specs/LESSONS.md`).

**Status**: n/a for new must-nots this round; 8/8 pre-existing must-nots re-confirmed green, unaffected.

### Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — each commit is surgical and scoped to its single named finding |
| Surgical changes | ✅ — 6 files touched total across 5 commits, all within declared scope (`reporting/queries`, `inicio/_loaders`, `inicio/_components/__tests__`, `shared/__tests__`, `.specs/LESSONS.md`) |
| No scope creep | ✅ — Achado D explicitly declined to extend to `src/app/(app)/_components/**` (L-021, out of scope), Achado C explicitly declined to fix `provider-block.test.tsx`'s wrong-path mock (out of scope) — both correctly deferred, not silently done |
| Matches patterns | ✅ — `cache()` matches `getCurrentPerson`/`canAccessModerationQueue`; conditional-promise matches `needsReferrals`; deep-import carve-out matches the 5 pre-existing module-side exceptions |
| Spec-anchored outcome check | n/a — no spec ACs in scope this round (pure perf/test/guard work, not behavior) |
| Every test maps to a requirement | ✅ — new tests trace to PNL-04/P1.4-2 (job button) and PNL-02/P1.2-3 (service button); guard test traces to F0-MN-02/L-027 |
| Documented guidelines followed | CLAUDE.md (barrel import rule respected everywhere except the pre-existing documented carve-out, which this round is specifically about machine-verifying) |

### Summary

**Overall**: ✅ Ready

**Gate**: typecheck ✅, lint ✅, unit 2266/2266 ✅, integration 692/692 ✅, build ✅, coverage 75.91/69.65/75.48/77.58% ✅ (all > 65% gate), migrations empty ✅, casca intact ✅
**Sensor**: 5/7 mutations killed; 2 survivors are pre-existing, project-wide, explicitly-acknowledged-as-acceptable lacunae (RSC `cache()` has no test-visible effect outside a real render; loaders are project-wide untested directly) — not regressions introduced by this round
**Must-nots**: 8/8 pre-existing, re-confirmed green, unaffected by this round (no new must-not in scope)

**What works**: All 4 `/pr-review` findings (A–D) are correctly implemented and, where a test oracle is feasible (C, D), independently proven non-vacuous via 5 killed mutations. The hygiene fix (E) has zero semantic footprint, verified directly. Non-regression is intact across privacy, casca, migrations, and the institutional gate (the last of which wasn't even touched this round).

**Issues found**: None blocking. Two non-blocking gaps (both explicitly pre-existing/inherent, not introduced by this round):
1. Achado A's `cache()` dedupe has no test that would catch its silent removal — inherent to React's RSC-scoped memoization being invisible to direct Vitest function calls; no cheap fix exists without an RSC-render-level test harness (would need `next/experimental/testmode` or an E2E-level check, disproportionate to a perf micro-optimization).
2. Achado B's `loadInstitutionalPanel` (and, by the same project-wide pattern, all 4 other `_loaders/*.ts` files) has zero direct unit/integration coverage — only exercised via fully-mocked `page.test.tsx` and static-prop component tests. A future task could add one integration-style test per loader (calling the real function with mocked module-level dependencies) to close this; out of scope for this fix round (would be new test infrastructure, not a review-finding fix).

**Next steps**: Merge-ready. Carried-over low-priority follow-ups from iteration 2 (a, spec.md AC-prose sync; c, delete dead `hub-link-card.tsx`) remain open and non-blocking. New optional follow-ups from this iteration: (d) consider a loader-level integration test pattern for `_loaders/*.ts` (would also close Achado B's gap above) — project-wide, not USP-067-specific, low priority.
