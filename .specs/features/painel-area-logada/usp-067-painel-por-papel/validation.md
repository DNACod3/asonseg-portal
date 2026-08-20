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
