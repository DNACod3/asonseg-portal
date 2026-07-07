# USP-045 Reativar Pessoa - Restyle ao DS - Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-045-reativar-pessoa/spec.md` (BACKFILL)
**Diff range**: `636fb3d..HEAD` (commit `ab3f1ec`, plus shared T1 `a00e57e` from USP-007)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (restyle reactivate-person-dialog.tsx) | Done | `ab3f1ec` - markup/classes only |

---

## Backfill Accuracy Assessment (special check)

The spec's ACs 1-14 and must-nots B01-B03 were checked line-by-line against the actual behavior in `src/modules/persons/actions/reactivate-person.ts`, `src/modules/persons/domain/person-reactivation.ts`, and `src/modules/persons/schemas/reactivate-person.schema.ts`. Result: **the backfill is accurate — no invented requirements, no missed guarantees.**

| Backfilled AC | Code evidence | Verdict |
| --- | --- | --- |
| AC1-2 (R1: `rank(ator) >= rank(inativador)`; rank 0 -> `NOT_AUTHORIZED`) | `person-reactivation.ts:86-89` — `if (actorRank === 0) return { allowed: false, reason: 'NOT_AUTHORIZED' }` | Matches exactly |
| AC3 (`rank(ator) < rank(inativador)` -> `FORBIDDEN`/`INSUFFICIENT_RANK`) | `person-reactivation.ts:91-94` — `if (actorRank < inactivatorRank) return { allowed: false, reason: 'INSUFFICIENT_RANK' }` | Matches exactly |
| AC4 (unknown inativador or no institutional role -> rank 0) | `reactivate-person.ts:96-107` — `inactivatorRoles` defaults to `[]` when `inactivatedByPersonId` is null or the record is not found; `institutionalRank([])` = 0 (`person-reactivation.ts:60-64`) | Matches exactly |
| AC5 (FORBIDDEN before idempotency, actor doesn't learn person is already active) | `reactivate-person.ts:109-124` — step 3 (`authz`) executes and can `return fail('FORBIDDEN', ...)` at line 118, strictly before step 4's idempotency check at line 122 | Matches exactly, confirmed by code order |
| AC6 (idempotency CONFLICT) | `reactivate-person.ts:122-124` | Matches |
| AC7 (status ATIVO + metadata cleared) | `reactivate-person.ts:142-153` — `updateMany` sets `status: 'ATIVO'`, `inactivatedAt: null`, `inactivatedByPersonId: null`, `inactivationReason: null` | Matches exactly |
| AC8 (R2: same-tx grant zeroing, ACTIVE->REVOKED, stamps, returns `grantsRevoked`) | `reactivate-person.ts:162-171` — `tx.personRoleGrant.updateMany({ where: {status:'ACTIVE'}, data: {status:'REVOKED', revokedAt, revokedBy, revocationReason} })`; `grantsRevoked = revoked.count` | Matches exactly — this is the highest-risk guarantee and was directly mutation-tested (see Sensor below) |
| AC9 (concurrency guard `updateMany where status=INATIVO`) | `reactivate-person.ts:142-156` | Matches exactly (same pattern as `inactivate-person.ts`) |
| AC10 (P-003: consents not reinstated) | `reactivate-person.ts` never references `prisma.consent`/`tx.consent` anywhere in the transition | Matches — absence is the evidence |
| AC11 (`withAudit('PERSON_REACTIVATED')`, before/after, justification) | `reactivate-person.ts:136-181` | Matches exactly |
| AC12 (justification min 5 chars, Zod) | `reactivate-person.schema.ts:20-27` — `REACTIVATION_REASON_MIN = 5` | Matches exactly |
| AC13 (login accepted on next revalidation window, ADR-0030) | Not directly in this file — inferred from the general session-revalidation mechanism (`getCurrentPerson`/ADR-0030) that is out of this action's scope | System-level guarantee correctly attributed, not fabricated by this action |
| AC14 (never throws, `UNAUTHENTICATED`/`NOT_FOUND`, always `ActionResult`) | `reactivate-person.ts:65-207` — full `try/catch` wrapping, `fail()`/`ok()` returns at every branch, catch-all returns `INTERNAL` | Matches exactly |

**D-005 (controlled reason catalog)** is correctly flagged in the spec's Assumptions table and Entry Gate section as an *external, non-blocking* open item (owner: "dono do intent / gate Fase 0", `Confirmed? = n`), consistent with the schema's free-text implementation and the explicit `❓ (D-005 / gate Fase 0)` comment at `reactivate-person.schema.ts:11`. This is the correct treatment — not a fabricated requirement, and correctly does not block the restyle unit.

**Conclusion**: the backfilled spec is a faithful, non-inflated description of the shipped behavior. No AC overstates a guarantee the code doesn't provide, and no guarantee in the code (rank precedence order, grant-zeroing atomicity, consent preservation) is missing from the spec.

---

## Spec-Anchored Acceptance Criteria

### P1: Reativar Pessoa inativada (comportamento - backfill, preservado)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| R1 rank authz (AC1-4) | `INSUFFICIENT_RANK`/`NOT_AUTHORIZED` per rank table | `src/modules/persons/__tests__/person-reactivation.test.ts:14-83` — unit coverage of all rank combinations, incl. `institutionalRank` boundary values | PASS |
| AC5 (FORBIDDEN before idempotency) | order-dependent | `reactivate-person.int.test.ts:346-367` ("papel sem privilégio recebe FORBIDDEN") implicitly confirms order via code path; explicit ordering also confirmed by direct source read | PASS |
| AC6 idempotência | `CONFLICT` | `reactivate-person.int.test.ts:277-292` — `expect(result.error.code).toBe('CONFLICT')` | PASS |
| AC7 status+metadata clear | `status='ATIVO'`, null metadata | `reactivate-person.int.test.ts:158-163` — `expect(person?.inactivatedAt).toBeNull()` etc. | PASS |
| AC8 R2 grant-zeroing | `ACTIVE->REVOKED` same tx, `grantsRevoked` count | `reactivate-person.int.test.ts:176-208` — `expect(result.data.grantsRevoked).toBe(2)`, `expect(activeAfter).toBe(0)`, `expect(revokedAfter).toBe(2)` | PASS |
| AC9 concurrency guard | one winner, one CONFLICT | `reactivate-person.int.test.ts:294-320` | PASS |
| AC10 P-003 consents untouched | consent record unmodified | `reactivate-person.int.test.ts:210-224` — `expect(consent?.revokedAt).toBeNull()` | PASS |
| AC11 audit | `PERSON_REACTIVATED`, before/after, justification | `reactivate-person.int.test.ts:145-174` | PASS |
| AC12 justification min 5 | `VALIDATION` | `reactivate-person.int.test.ts:369-380`; `person-reactivation.test.ts:105-149` (schema-level) | PASS |
| AC14 never throws | `ActionResult` always | `reactivate-person.int.test.ts:322-344` (`NOT_FOUND`/`UNAUTHENTICATED` branches) | PASS |

### P1: Restyle da UI de reativação (local)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| U45-01: primitives via barrel, casca tokens | `Button`(primary/outline)/`Textarea`/`Label` from `@/shared/ui`; token classes | `reactivate-person-dialog.tsx:7` (import), `:80` (`variant="primary"` trigger), `:139` (`variant="outline"` cancel), `:145` (`variant="primary"` submit), `:90` (`bg-surface`) | PASS |
| U45-02: grants-zeroing warning preserved, restyled with token | text unchanged, new token classes | `reactivate-person-dialog.tsx:99` — `bg-[color-mix(in_srgb,var(--color-cta)_10%,transparent)] p-3 text-sm text-cta`; text "todos os papéis e permissões anteriores serão removidos" unchanged | PASS |
| U45-03: accessible selectors preserved | button names, `role="dialog"`, `htmlFor`, `role="alert"` | `reactivate-person-dialog.tsx:89-91` (`role="dialog" aria-labelledby="reactivate-dialog-title"`), `:119` (`Label htmlFor="reactivation-reason"`), `:133`/`:143` (`role="alert"`); `ReactivatePersonDialog.test.tsx` unmodified, 6/6 green including the warning assertion at line 56 | PASS |

**Status**: All ACs covered — no spec-precision gaps.

---

## Discrimination Sensor

Both mutations were injected directly into the tracked, git-clean source files (`git diff --quiet` confirmed clean pre-mutation), run against the relevant test file, confirmed as killed, then reverted with `git checkout -- <file>` and independently re-confirmed byte-identical to the pre-mutation state.

| # | file:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `src/modules/persons/actions/reactivate-person.ts:162-171` | **R2 grant-zeroing removed** — replaced the `tx.personRoleGrant.updateMany(...)` revocation call with a no-op `{ count: 0 }` | **Killed** — `reactivate-person.int.test.ts` > "E-003/P-001: grants ATIVOS são zerados na mesma transação" failed: `expected +0 to be 2` |
| 2 | `src/modules/persons/domain/person-reactivation.ts:92` | Flipped rank comparison `actorRank < inactivatorRank` -> `actorRank <= inactivatorRank` (opens reactivation to equal-rank actors it should still allow, but over-restricts by rejecting legitimate equal-rank reactivations) | **Killed** — `person-reactivation.test.ts` 2 failures: "BOARD reativa Pessoa inativada por outro BOARD (rank igual)" and "COORDINATOR reativa Pessoa inativada por COORDINATOR (rank igual)" both now incorrectly return `INSUFFICIENT_RANK` |

**Sensor depth**: lightweight (default tier), with mutation #1 deliberately targeting the highest-risk guarantee per the task brief (R2 grant-zeroing).
**Result**: 2/2 killed. No survivors.

---

## Must-Not Verification

| ID | SHALL NOT... | Negative test (file:line + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U45-MN-B01 | return active grants that existed before reactivation (ACTIVE must end REVOKED in same tx) | `reactivate-person.int.test.ts:176-208` — `expect(activeAfter).toBe(0)`, `expect(revokedAfter).toBe(2)` | Yes | **Yes** — mutation #1 above directly killed this test |
| U45-MN-B02 | reinstate revoked/absent LGPD consents | `reactivate-person.int.test.ts:210-224` — `expect(consent?.revokedAt).toBeNull()` (unchanged pre/post) | Yes | Not directly mutated (code never touches `prisma.consent`; absence-of-call is the guarantee — mutating "add a consent restore call" was judged lower-value than the R2 mutation given the 1-3 lightweight-tier budget) |
| U45-MN-B03 | allow reactivation when actor rank < inativador rank | `person-reactivation.test.ts:52-56` (unit) + `reactivate-person.int.test.ts:226-243` (integration, `expect(result.error.code).toBe('FORBIDDEN')`) | Yes | **Yes** — mutation #2 above directly killed the unit tests for this guard |
| U45-MN-R01 | change behavior under the restyle label (R1/R2/P-003/concurrency/`withAudit`) | Full behavior suite (`person-reactivation.test.ts`, `reactivate-person.int.test.ts`) absent from diff, all green | Yes | Covered by mutations #1 and #2 (both target files are entirely absent from `git diff --name-only 636fb3d..HEAD`, confirming zero touch) |
| U45-MN-R02 | remove the grant-zeroing warning text | `ReactivatePersonDialog.test.tsx:56` — `getByText(/todos os papéis e permissões anteriores serão removidos/i)` green, unmodified test file | Yes | Not separately mutated — text presence directly confirmed by grep + unmodified passing test |
| U45-MN-R03 | introduce a dialog/modal dependency | `grep -c "radix-ui/react-dialog" reactivate-person-dialog.tsx` = 0; `package.json` has no dialog dependency | Yes | n/a (absence-based guard, no meaningful mutation to inject) |

**Status**: All must-nots proven, including the flagged-as-critical U45-MN-B01 (R2 grant-zeroing) which was the primary target of the discrimination sensor per the verification brief.

---

## Interactive UAT

Not performed — this is a style-only refactor of already-shipped, already-UAT'd behavior; the spec's own Independent Test criterion is `npm run test` (RTL) + `typecheck`/`lint`/`build`, not interactive walkthrough.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | Yes — single file touched (`reactivate-person-dialog.tsx`), markup/className only |
| Surgical changes | Yes |
| No scope creep | Yes — `reactivate-person.ts`, `person-reactivation.ts`, `reactivate-person.schema.ts` all absent from diff |
| Matches patterns | Yes — same token vocabulary as the sibling `inactivate-person-dialog.tsx` restyle (USP-007 T2), same `color-mix()` pattern for the tinted alert blocks |
| Spec-anchored outcome check | Yes — see AC tables above |
| Per-layer coverage expectation met | Yes — dialog: unit RTL regression (6/6 tests, unmodified) |
| Every test maps to a spec requirement | Yes — no new tests added in this unit (T1 has no new assertions per its Done-when; the deliverable is the restyle + the backfilled spec.md itself) |
| Documented guidelines followed | `CLAUDE.md` (barrel imports), AD-014 (Design System tokens), ADR-0025 (LGPD re-consent is titular's act — respected by the absence of consent-touching code) |

---

## Edge Cases

- [x] Inativador lost BOARD role since inactivation: rank recalculated from current ACTIVE grants — confirmed by `person-reactivation.test.ts:68-76` ("inativador desconhecido (rank 0)")
- [x] No ACTIVE grants at reactivation time: `grantsRevoked=0` vacuously — confirmed by code (`updateMany` on empty set returns `count: 0`); not separately asserted by a dedicated test, but logically entailed by the `updateMany` semantics already exercised
- [x] Dark mode: tokens re-resolve, no `dark:` classes added
- [x] `FORBIDDEN` (insufficient rank) keeps dialog open with message — same `serverError` pattern as `inactivate-person-dialog.tsx`, preserved

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:integration`
- **Result**: identical single gate run covering both USP-007 and USP-045 (same commit range) —
  - `npm run typecheck` — clean
  - `npm run lint` — clean
  - `npm run test` — **118 files / 859 tests passed**, including `ReactivatePersonDialog.test.tsx` (6/6, unmodified)
  - `npm run build` — succeeded
  - `npm run test:integration` — **39 files / 219 tests passed**, including `reactivate-person.int.test.ts` (11/11) and `person-reactivation.test.ts` (unit, included in the 859)
- **Test count before/after**: `ReactivatePersonDialog.test.tsx` = 6 tests (matches tasks.md's exact Done-when count), 0 deletions
- **Skipped tests**: none observed
- **Failures**: none

---

## Fix Plans

None — no issues found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| R45-01 (R1 authz) | Implemented (backfill/preserve) | Verified |
| R45-02 (R2 grant-zeroing) | Implemented (backfill/preserve) | Verified |
| R45-03 (idempotência + concorrência) | Implemented (backfill/preserve) | Verified |
| R45-04 (P-003 consents) | Implemented (backfill/preserve) | Verified |
| R45-05 (auditoria) | Implemented (backfill/preserve) | Verified |
| R45-06 (justificativa) | Implemented (backfill/preserve) | Verified |
| R45-07 (login volta) | Implemented (backfill/preserve) | Verified (system-level, ADR-0030 attribution correct) |
| U45-01 | In Tasks | Verified |
| U45-02 | In Tasks | Verified |
| U45-03 | In Tasks | Verified |
| U45-MN-B01..B03 | Implemented (preserve) | Verified |
| U45-MN-R01..R03 | In Tasks | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 13/13 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 2/2 mutations killed, including the priority R2 grant-zeroing mutation explicitly requested in the verification brief
**Must-nots**: 6/6 green
**Gate**: typecheck clean, lint clean, 859/859 unit tests, 219/219 integration tests, build succeeded

**What works**: The USP-045 backfill spec is an accurate, non-inflated transcription of the shipped `reactivatePerson` behavior — every AC and must-not was cross-checked against the actual source and found faithful, including the correct non-blocking treatment of the open D-005 item. The restyle itself is isolated to `reactivate-person-dialog.tsx` markup/classes only; the grant-zeroing warning text and all accessible selectors are preserved verbatim.

**Issues found**: none.

**Next steps**: none — ready to merge as part of Group E.
