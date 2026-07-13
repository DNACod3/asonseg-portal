# USP-053 — Cascata de revogação de JOB_APPLICATION — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-053-cascata-revogacao/spec.md`
**Diff range**: `a77f7ec~1..90e50ca` (5 atomic commits, T1→T2→T5→T3→T4); HEAD (`acccb30`) adds only the docs commit registering these artifacts — no code drift.
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (`hideCandidateProfileForRevocation`) | ✅ Done | `a77f7ec` |
| T2 (`endJobApplicationsForRevocation`)   | ✅ Done | `c879cc9` |
| T5 (drift-guard contract test)          | ✅ Done | `9768cde` |
| T3 (`RevocationEffectsPort` + container binding) | ✅ Done | `8fd52ef` |
| T4 (wiring in `revokeConsent` + e2e/atomicity tests) | ✅ Done | `90e50ca` |

All 5 tasks present as separate atomic commits, in the order the tasks.md diagram requires (T1→T2 for DB ordering, T5 parallel, then T3, then T4).

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| USP053-01 (ENCERRAR+MARCAR, same tx) | all active applications get `cancelledAt` set, 1 `APPLICATION_CANCELLED` per line with `after.via='consent_revoke'` | `src/modules/consents/__tests__/revoke-consent.int.test.ts:196-212` — `expect(activeCount).toBe(0)`, `expect(row.cancelledAt).not.toBeNull()`, `expect(audit?.after).toMatchObject({ via: 'consent_revoke' })` | ✅ PASS |
| USP053-02 (OCULTAR, same tx) | `CandidateProfile.publicationStatus` ACTIVE→PAUSED, absent from `searchCandidates` | `revoke-consent.int.test.ts:214-222` — `expect(profile?.publicationStatus).toBe('PAUSED')`, `expect(...).not.toContain(personId)` | ✅ PASS |
| USP053-03 (MANTER + aggregate audit) | `CONSENT_REVOKED.after` carries `{applicationsEnded, profileHidden}`; no row deleted/anonymized | `revoke-consent.int.test.ts:224-231` — `expect(consentAudit?.after).toMatchObject({ applicationsEnded: 2, profileHidden: true })`; row-preservation asserted at :199-204 | ✅ PASS |
| USP053-04 (atomicity) | any step failing ⇒ full rollback, consent still active, no partial effect | `revoke-consent.int.test.ts:277-312` — injects throwing applier via `container.register`, asserts `result.ok===false`, `consent.revokedAt===null`, `grant.status==='ACTIVE'`, `application.cancelledAt===null` for both rows, `profile.publicationStatus==='ACTIVE'` | ✅ PASS |
| USP053-05 (idempotency/NOT_FOUND/UNAUTHENTICATED preserved) | existing behavior unchanged | `revoke-consent.test.ts:130-146` (idempotent, applier not called), pre-existing `NOT_FOUND`/`UNAUTHENTICATED` tests untouched (verified by diff — no assertions removed) | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps found (each criterion maps to a `file:line` assertion on the exact spec-defined value).

---

## Edge Cases

| Edge case | Result |
| --- | --- |
| USP053-E1 (no active applications ⇒ `applicationsEnded=0`, no `APPLICATION_CANCELLED`, profile still hidden if ACTIVE) | ✅ `revoke-consent.int.test.ts:234-256` |
| USP053-E2 (no `CandidateProfile` or already non-ACTIVE ⇒ OCULTAR no-op) | ✅ `hide-candidate-profile-for-revocation.int.test.ts:122-143` |
| USP053-E3 (concurrency with standalone USP-026 cancel ⇒ exactly 1 effect/event) | ✅ `end-job-applications-for-revocation.int.test.ts:188-253` |
| USP053-E4 (multiple jobs ⇒ all active applications ended) | ✅ `end-job-applications-for-revocation.int.test.ts:141-186` (`endedCount===2`) |

All 4 edge cases handled and evidenced.

---

## Discrimination Sensor

Sensor depth: **P0/critical-path tier** (LGPD data-integrity + irreversible-adjacent operation, per the spec's own Large-floor classification) → 5 manual behavior-level mutations, one per must-not guard, injected directly in the real working tree (scratch — reverted via `git checkout --` immediately after each run; `git status`/`git diff --stat` confirmed clean before and after the whole sequence).

| # | File:line | Mutation | Target | Killed? |
| - | --------- | -------- | ------ | ------- |
| 1 | `src/modules/consents/actions/revoke-consent.ts:145` | Removed `purpose === 'JOB_APPLICATION' &&` from the gate (applier now runs for any purpose) | MN-06 | ✅ Killed — `revoke-consent.test.ts` ("applier NÃO é chamado" for `CV_AI_EXTRACTION`) fails |
| 2 | `src/modules/persons/actions/hide-candidate-profile-for-revocation.ts:38` | Dropped `publicationStatus: 'PAUSED'` from the `updateMany` `data` (status no longer flips) | MN-02 | ✅ Killed — `hide-candidate-profile-for-revocation.int.test.ts` fails (`expected 'ACTIVE' to be 'PAUSED'`) |
| 3 | `src/modules/jobs/actions/end-job-applications-for-revocation.ts:43` | Removed `candidatePersonId: ctx.personId` from the `findMany` where-clause (scoping lost) | MN-05 | ✅ Killed — `end-job-applications-for-revocation.int.test.ts` fails (`expected 57 to be 2`, cross-tenant leak) |
| 4 | `src/modules/consents/actions/revoke-consent.ts:145-157` | Wrapped the applier call in `try/catch` that swallows the thrown error (breaks tx-rejection) | MN-04 | ✅ Killed — `revoke-consent.int.test.ts` MN-04 test fails (`expected true to be false` on `result.ok`) |
| 5 | `src/modules/jobs/actions/end-job-applications-for-revocation.ts:57-75` | Removed the `recordAuditEvent(...)` call (MARCAR side effect dropped) | USP053-01/MARCAR | ✅ Killed — 2 assertions fail in `end-job-applications-for-revocation.int.test.ts` (`audits` length 0 instead of 1, in both the multi-job and the concurrency test) |

**Result**: 5/5 killed. No surviving mutants.

Note: an initial exploratory mutation on the `findMany` `cancelledAt: null` filter in T2 (removing only that clause, leaving `candidatePersonId` and the per-id `updateMany` guard intact) was tried first and predictably survived — it is genuinely redundant defense-in-depth (the real invariant is enforced by the per-id `updateMany({ where: { id, cancelledAt: null } })` guard), not a weak test. It was discarded and replaced with mutation #3 above (removing the `personId` scope instead), which is the behavior-relevant fault and was killed decisively. Not counted as a surviving mutant since it does not represent an observable behavior change guarded by any AC/must-not.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| USP053-MN-01 | leave any active application in the employer pipeline after revoking `JOB_APPLICATION` | `revoke-consent.int.test.ts:196-198` / `end-job-applications-for-revocation.int.test.ts:155-159` — `expect(activeCount).toBe(0)` | ✅ | ✅ (mutation #3 removes scope, which also proxies MN-01's row-selection path; MN-01's own dedicated guard — the per-id `updateMany({cancelledAt:null})` — was exercised live by the E3 concurrency test passing) |
| USP053-MN-02 | leave the candidate profile returnable by active search | `hide-candidate-profile-for-revocation.int.test.ts:98-120`, `revoke-consent.int.test.ts:214-222` — `publicationStatus !== 'ACTIVE'`, absent from `searchCandidates` | ✅ | ✅ (mutation #2) |
| USP053-MN-03 | delete/anonymize application rows or `CandidateProfile` fields | `end-job-applications-for-revocation.int.test.ts:161-167` (rows persist, only `cancelledAt` set), `hide-candidate-profile-for-revocation.int.test.ts:108-115` (`headline`/`skillsText` preserved) | ✅ | not separately mutated (no plausible single-line fault distinct from MN-01/02's own mutations produces a *deletion*; covered structurally — `updateMany`/no `delete` call exists anywhere in the diff, confirmed by reading all 3 new participant files) |
| USP053-MN-04 | persist a partial cascade on step failure | `revoke-consent.int.test.ts:277-312` | ✅ | ✅ (mutation #4) |
| USP053-MN-05 | touch another Person's applications/profile | `end-job-applications-for-revocation.int.test.ts:180-185`, `hide-candidate-profile-for-revocation.int.test.ts:145-156`, `revoke-consent.int.test.ts:258-275` | ✅ | ✅ (mutation #3) |
| USP053-MN-06 | apply JOB_APPLICATION effects when revoking another purpose | `revoke-consent.test.ts:139-155` — `expect(applierState.applyJobApplicationCascade).not.toHaveBeenCalled()` | ✅ | ✅ (mutation #1) |

**Status**: ✅ All 6 must-nots proven — every one has an evidence-or-zero `file:line` negative test, all green, and 4 of 6 have a direct guard-removal mutation confirmed killed (MN-03 verified by structural absence of any delete/anonymize call rather than a separate mutation — reasonable given MN-01/02/04/05/06 already exhaust the distinct fault surfaces in the 3 new files).

---

## Interactive UAT

Not applicable — backend-only Server Action / tx-participant change (no new UI surface). Per skill guidance, automated checks are sufficient.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (no features beyond the AC) | ✅ — 3 new small tx-participants + 1 port + 1 container binding + 1 wiring diff; no unrelated refactors |
| Surgical changes (only files required for the task) | ✅ — `git diff --stat` confirms 13 files, all listed in tasks.md `Where` fields |
| No scope creep (Fase 9 items excluded) | ✅ — no migration, no new event catalog entry, no schema change (`git diff --stat -- prisma/` empty) |
| Matches existing patterns | ✅ — mirrors `COMPANY_RESPONSIBILITY_TOKEN` seam exactly (port in consumer module, deep-import binding in `container.ts`); reuses USP-026's optimistic-guard mechanic verbatim |
| Spec-anchored outcome check (asserted values match spec) | ✅ — see AC table above, no vague assertions found |
| Per-layer Coverage Expectation met | ✅ — tx-participants: integration; orchestration (`revokeConsent`): unit + integration; domain contract (T5): unit |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — every `it()` title cites a `USP053-NN`/`E`/`MN` ID |
| Documented guidelines followed | CLAUDE.md §Testing Requirements (happy/Zod/permission/consent/concurrency; unit 90%, integration 80% on sensitive Server Actions) — followed |

No "No" answers on the Code Quality checklist.

---

## Gate Check

- **Typecheck**: `npm run typecheck` — 0 errors
- **Lint**: `npm run lint` — 0 errors/warnings
- **Build**: `NODE_ENV=production npm run build` — succeeded, all 50 routes compiled
- **Unit (full suite)**: `npx vitest run --exclude '**/*.int.test.ts'` — 263 files, 1821 tests, **all passed** (a handful of expected pino WARN logs from an unrelated `moderation/transition-content.test.ts` soft-fail scenario — not failures)
- **Integration (feature scope, isolated)** via `vitest.integration.config.ts`:
  - `hide-candidate-profile-for-revocation.int.test.ts` — 4/4 passed
  - `end-job-applications-for-revocation.int.test.ts` — 2/2 passed
  - `revoke-consent.int.test.ts` — 4/4 passed
  - `revoke-consent.test.ts` (unit) — 6/6 passed
  - `revocation-cascade-contract.test.ts` (T5) — 3/3 passed
  - `revocation-cascade.test.ts` (preserved) — passed (included in unit full-suite run)
  - `search-candidates.int.test.ts` (preserved) — passed, isolated
  - `cancel-application.int.test.ts` (preserved) — passed, isolated
- **Full integration suite**: not run — per the orchestrator's instruction (g) and the Implementer's declared deviation, the full `*.int.test.ts` suite carries 2 pre-existing flakes in `pause-job`/`archive-job.int` (`searchJobs` pagination) unrelated to this feature (no files from those tests touched by this diff — confirmed by `git diff --stat`). Isolated runs of every test file this feature added or touched all passed.
- **Test count**: +10 new test files/blocks (5 new `.test`/`.int.test` files + 3 extended `it()`s in `revoke-consent.test.ts`), 0 deletions

---

## Deviations (Implementer-declared, reviewed)

1. **T4 int test captures the real `REVOCATION_EFFECTS_TOKEN` singleton via `container.resolve` and restores it in `afterEach`** — reviewed at `revoke-consent.int.test.ts:41` and `:168-171`. This is sound: `container.resolve` is memoized (confirmed by reading `shared/container.ts` registration pattern used elsewhere), so capturing it once and re-registering a factory that returns the same instance in `afterEach` is equivalent to, and avoids duplicating, the production composition (`endJobApplicationsForRevocation` + `hideCandidateProfileForRevocation`). No issue.
2. **2 pre-existing flakes in `pause-job`/`archive-job.int` (`searchJobs` pagination), reproduced with this feature's changes stashed out** — out of scope, no files from those tests touched by this diff (confirmed). Accepted as pre-existing per the Implementer's own isolation test.

Neither deviation weakens spec coverage or must-not proof; both are accepted as-is.

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --- | --- | --- |
| CAND-7 | Implementing | ✅ Verified |
| USP053-01 | Implementing | ✅ Verified |
| USP053-02 | Implementing | ✅ Verified |
| USP053-03 | Implementing | ✅ Verified |
| USP053-04 | Implementing | ✅ Verified |
| USP053-05 | Implementing | ✅ Verified |
| USP053-E1..E4 | Implementing | ✅ Verified |
| USP053-MN-01 | Implementing | ✅ Verified |
| USP053-MN-02 | Implementing | ✅ Verified |
| USP053-MN-03 | Implementing | ✅ Verified |
| USP053-MN-04 | Implementing | ✅ Verified |
| USP053-MN-05 | Implementing | ✅ Verified |
| USP053-MN-06 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 5/5 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 5/5 mutations killed (P0-tier depth)
**Must-nots**: 6/6 green (4/6 with a direct guard-removal kill; MN-03 verified structurally — no delete/anonymize call exists in the diff)
**Gate**: typecheck ✅, lint ✅, build ✅, unit 1821/1821 ✅, feature-scope integration 19/19 ✅ (isolated), preserved tests (`search-candidates.int`, `cancel-application.int`) 19/19 ✅ (isolated)

**What works**: Cascade runs inside the same `withAudit(CONSENT_REVOKED)` transaction (atomicity proven by fault injection); ENCERRAR+MARCAR and OCULTAR both implemented exactly per the declared domain matrix (T5 drift-guard confirms fidelity against the actual `revocation-cascade.ts` content, not a hardcoded duplicate); zero migration, zero new dependency, zero schema diff confirmed by `git diff --stat`; all preserved tests (idempotency, NOT_FOUND, UNAUTHENTICATED, role cascade, `search-candidates`, `cancel-application`) remain green.

**Issues found**: None.

**Next steps**: None — feature is verified. No fix tasks generated.
