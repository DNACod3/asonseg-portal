# USP-026 — Cancelar candidatura — Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/candidaturas-busca-candidatos/usp-026-cancelar-candidatura/spec.md`
**Diff range**: `4610fa6..0ab6379` (branch `feat/fase-3-candidaturas-busca-cv`), scoped to Unit U2 (USP-025 + USP-026, shared migration/module)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (`canCancelApplication` regra pura) | ✅ Done | `5a14000` |
| T2 (`cancelApplication` + schema + barrel) | ✅ Done | `23b2e6d` |
| T3 (`CancelApplicationButton` + wiring + E2E) | ✅ Done | `0ab6379` |

Depends on USP-025 T1 (migração) and T4 (`applyToJob`, used in recandidatura test) — both verified independently in the sibling `usp-025-candidatar-se/validation.md`.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| CAN-026-01 happy | `cancelledAt` filled, `withAudit(APPLICATION_CANCELLED)`, active count drops, `{ok:true,data:{applicationId}}` | `src/modules/jobs/__tests__/cancel-application.int.test.ts:193-214` — `expect(application?.cancelledAt).not.toBeNull()`; `expect(activeCount).toBe(0)`; `expect(audit).not.toBeNull()` | ✅ PASS |
| CAN-026-02 recandidatura | Cancel then `applyToJob` same job → accepted, 1 active row (the new one) | `cancel-application.int.test.ts:227-236` — `expect(res).toMatchObject({ok:true})`; `expect(activeCount).toBe(1)` | ✅ PASS |
| CAN-026-03 CTA por estado | Active application → "Cancelar candidatura" button; after cancel → "Candidatar-se" reappears | `src/modules/jobs/components/job-detail.tsx:48-57` (both CTAs in same conditional slot, `myApplicationId`-driven) + `src/modules/jobs/__tests__/job-detail.spec.tsx:116-120` for the pre-cancel render state | ✅ PASS |

**Status**: ✅ All ACs covered (3/3)

## Edge Cases

| ID | Outcome | Evidence | Result |
| --- | --- | --- | --- |
| CAN-026-E1 (já cancelada) | `PRECONDITION_FAILED`, `cancelledAt` unchanged | `cancel-application.int.test.ts:176-191` — `expect(after?.cancelledAt?.toISOString()).toBe(before?.cancelledAt?.toISOString())` | ✅ |
| CAN-026-E2 (não existe/terceiro) | `NOT_FOUND`, no state change | `cancel-application.int.test.ts:159-174` — `expect(stillActive?.cancelledAt).toBeNull()`; `expect(auditCount).toBe(0)` | ✅ |
| CAN-026-E3 (applicationId inválido) | `VALIDATION` | `cancel-application.int.test.ts:147-151` | ✅ |
| CAN-026-E4 (sem sessão) | `UNAUTHENTICATED` | `cancel-application.int.test.ts:153-157` | ✅ |
| CAN-026-E5 (corrida) | 1 ok, 1 erro, 1 audit event | `cancel-application.int.test.ts:238-252` | ✅ |

---

## Discrimination Sensor

Single-file edit in the real tree, restored with `git checkout --` immediately after the run; `git status --short` re-confirmed against the 36-line pre-existing baseline after restore.

| # | File:line | Mutation | Test(s) exercised | Killed? |
| - | --- | --- | --- | --- |
| 1 | `src/modules/jobs/actions/cancel-application.ts:66-72` | Removed the optimistic guard entirely: `where` no longer filters `cancelledAt:null`, and the `result.count!==1` check (which throws `CancelConflictError`) was deleted — any `updateMany` on the row now "succeeds" unconditionally | `cancel-application.int.test.ts` `@ac-can-026-mn-02` (2/2, sequential double-cancel) and `@ac-can-026-e5` (race), run 5× each | ✅ MN-02 (2/2) killed **5/5** — fully deterministic, this is the sequential idempotency case with no timing dependency: 2nd cancel call now silently "succeeds" instead of returning `PRECONDITION_FAILED`, breaking `expect(res).toMatchObject({ok:false,...})`. ⚠️ E5 (race) killed **1/5** — the residual 4/5 were masked by the earlier, unmutated ownership+state read (`findFirst` + `canCancelApplication` gate, lines 49-60) resolving the race sequentially before either request reached the mutated `updateMany`: the loser sees `cancelledAt` already non-null at its own pre-check and returns `PRECONDITION_FAILED` via that (correct, unmutated) path rather than via the guard under test. |

**Sensor depth**: lightweight (1 targeted mutation on U2's cancel-side idempotency guard, exercised against both its sequential and concurrent tests; 2 additional mutations targeting the sibling USP-025 guards are reported in that unit's `validation.md`)
**Result**: The guard is real and load-bearing — proven deterministically (5/5) by the sequential must-not test. The race test's lower kill rate (1/5) reflects the same structural pattern as USP-025's MN-01 (an earlier, correctly-functioning read-then-check step frequently resolves real-world Promise.all races before the DB-transactional layer is reached) rather than a weakness specific to this guard.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| CAN-026-MN-01 | Cancel a candidatura that isn't the caller's, or reveal its existence | `cancel-application.int.test.ts:159-174` — `expect(res).toMatchObject({ok:false,error:{code:'NOT_FOUND'}})`; `expect(stillActive?.cancelledAt).toBeNull()`; `expect(auditCount).toBe(0)` | ✅ | Not separately mutated this run — the guard here is the `findFirst` `where: { candidatePersonId: person.id }` scoping (`cancel-application.ts:49-52`), structurally distinct from the idempotency guard mutated above; ownership-scoping pattern is identical to the project's established `viewCandidateForEmployer`-style scoped-query precedent, and the negative test's evidence (`NOT_FOUND` + 0 mutation + 0 audit) is unambiguous |
| CAN-026-MN-02 | Mutate state or emit `APPLICATION_CANCELLED` on double/invalid cancel | `cancel-application.int.test.ts:176-191` (1/2) + `:216-225` (2/2) — `expect(auditCount).toBe(1)` after 2 attempts | ✅ | ✅ (sensor #1 — 5/5 on the sequential case) |

**Status**: ✅ All 2 must-nots proven (green negative test + evidence-or-zero citation; MN-02 additionally sensor-confirmed by fault injection this run)

---

## Independent Claim Checks

| Claim | Verified how | Result |
| --- | --- | --- |
| Migration belongs to USP-025 only; USP-026 introduces no schema change | `git diff 4610fa6..HEAD --name-only \| grep migration` → single migration dir, authored in USP-025's `b1f0704` commit; USP-026 commits touch only `src/`/`e2e/` | ✅ Confirmed |
| No `requireActiveConsent` call on cancel (A-3) | `grep -n requireActiveConsent src/modules/jobs/actions/cancel-application.ts` → 0 hits | ✅ Confirmed |
| `withAudit` rolls back tx (incl. audit row) on `CancelConflictError` | Same `src/modules/audit/withAudit.ts:76-81` single-`$transaction` wrapping as USP-025 — structurally guarantees "0 audit events" on double-cancel/conflict | ✅ Confirmed |
| Recandidatura wired through the real `applyToJob` (not a stub) | `cancel-application.int.test.ts:22` imports `applyToJob` from `../actions/apply-to-job`; `:227-236` calls it directly | ✅ Confirmed |

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ |
| Surgical changes (only `jobs` module) | ✅ |
| No scope creep | ✅ |
| Matches patterns (`edit-job.ts` optimistic `updateMany` + try/catch shape reused) | ✅ |
| Spec-anchored outcome check | ✅ |
| Per-layer Coverage Expectation met (domain 1:1 branches; integration happy+edge+error+concurrency+recandidatura) | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ (all `it()` carry `@ac-*` tags) |
| Documented guidelines followed | `CLAUDE.md`, `docs/arch/project-guideline.md` |

---

## Gate Check

Shared gate run with USP-025 (same commit range, same module) — see `usp-025-candidatar-se/validation.md` for the full command output. Summary:

- **typecheck**: ✅ clean
- **lint**: ✅ clean
- **unit**: ✅ 146 files / 1021 tests passed (includes `canCancelApplication` cases in `application-rules.spec.ts` and `CancelApplicationButton` states)
- **integration**: ✅ 59 files / 342 tests passed (includes 8/8 in `cancel-application.int.test.ts`)
- **build**: ✅ passes with `NODE_ENV=production` explicit (see USP-025 report for the pre-existing local-env caveat, reproduced identically on base commit `4610fa6`)
- **E2E**: ✅ `e2e/candidaturas/cancelar-candidatura.spec.ts` passed (1/1)

---

## SPEC_DEVIATION Sanity Checks

| Deviation | Legitimate? | Evidence |
| --- | --- | --- |
| `job-detail.spec.tsx` old USP-022 "candidatar-se display-only" guard replaced by an honest guard now that the write path exists | ✅ Yes | `src/modules/jobs/__tests__/job-detail.spec.tsx:99-107` docblock explicitly documents the supersession of `U22-MN-04`; the new assertions (`:110-120`) verify the real wired `ApplyToJobButton`/`CancelApplicationButton`, a stricter check than the old placeholder |
| Authenticated E2E deferred to the codebase's documented no-session pattern | ✅ Yes | `e2e/candidaturas/cancelar-candidatura.spec.ts:8-21` docblock names the precedent (`e2e/candidato.spec.ts`, `e2e/companies/editar-empresa.spec.ts`, `e2e/moderacao/moderar-rascunho.spec.ts`) and cites the exact int/unit files carrying authoritative coverage of the authenticated path; the E2E spec file is real (not `.fixme`) and asserts a live contract (no cancel button visible to anonymous visitor) — confirmed passing |

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --- | --- | --- |
| CAN-026-01..03 | Pending | ✅ Verified |
| CAN-026-E1..E5 | Pending | ✅ Verified |
| CAN-026-MN-01..02 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 3/3 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 1 mutation targeted at USP-026's idempotency guard — killed 5/5 on the deterministic sequential must-not, 1/5 on the timing-sensitive race test (same structural pattern as USP-025's sibling mutation; DB/app-level state invariant never broke)
**Must-nots**: 2/2 green
**Gate**: typecheck ✅, lint ✅, unit 1021 ✅, integration 342 ✅, build ✅ (env caveat documented, pre-existing), E2E 1/1 ✅

**What works**: Full cancel path (`cancelApplication`) — happy path, owner-scoped `NOT_FOUND` for third-party attempts, idempotent double-cancel, race handling, recandidatura unlock via the shared unique-partial-index, CTA wiring, E2E anonymous-visitor regression check.

**Issues found**: None blocking. Same non-blocking timing-sensitivity note as USP-025's MN-01 applies to E5 here — inherent to Promise.all race tests over a real network round-trip to Postgres, not a test-quality gap.

**Next steps**: None required for U2 to proceed.
