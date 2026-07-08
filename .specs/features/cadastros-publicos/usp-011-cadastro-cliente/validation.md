# USP-011 (Fase 4, Unidade U1 — reconciliação) Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/cadastros-publicos/usp-011-cadastro-cliente/spec.md`
**Diff range**: `a4f914c..HEAD` — **no product-code diff for USP-011** (verify-only unit; `ClientProfile`/`ensureClientRole` predate this branch)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| V1 — verify `ClientProfile` schema + migration | ✅ Done (no gap) | verify-only, no commit expected |
| V2 — verify `ensureClientRole` (idempotency, P-001 ordering, audit, barrel) | ✅ Done (no gap) | verify-only, no commit expected |

`git log --oneline -- prisma/schema.prisma src/modules/persons/actions/ensure-client-role.ts src/modules/persons/domain/client.ts` shows no commit on this branch touching these files — consistent with the "already implemented, reconciliation only" claim. Independently re-derived below rather than trusted.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + evidence | Result |
| --- | --- | --- | --- |
| Schema shape (`client_profiles`, design §1 / ADR-0008) | `personId` PK `@db.Uuid`, `cityId` nullable **without FK**, `createdAt @db.Timestamptz`, no `publicationStatus`, `@@map("client_profiles")` | `prisma/schema.prisma:603-611` — `model ClientProfile { personId String @id ...; cityId String? @map("city_id") @db.Uuid; createdAt DateTime @default(now()) @db.Timestamptz(6); person Person @relation(...); @@map("client_profiles") }` — no `publicationStatus` field present; `cityId` has no `@relation`/FK on the Prisma side | ✅ PASS |
| Migration matches model | Applied migration matches current schema, `city_id` has no FK to a `cities` table | `prisma/migrations/20260611165807_usp011_client_profile/migration.sql` — `CREATE TABLE client_profiles (person_id UUID PK, city_id UUID nullable, created_at TIMESTAMPTZ NOT NULL DEFAULT ...)`; only FK is `client_profiles_person_id_fkey → persons(id)` — no FK on `city_id`, consistent with "no `City` model exists yet" | ✅ PASS |
| Reverse relation | `Person.clientProfile ClientProfile?` present | `prisma/schema.prisma:206` — `clientProfile ClientProfile?` | ✅ PASS |
| `ensureClientRole` signature (design §2, ADR-0020) | `(tx: Prisma.TransactionClient, {personId, term, ip, userAgent})`, no self-opened transaction | `src/modules/persons/actions/ensure-client-role.ts:36-39` — function receives `tx` as first param, never calls `prisma.$transaction` or `withAudit` internally | ✅ PASS |
| P-001 ordering (consent before ACTIVE, same tx) | Consent `SERVICE_HIRING` persisted strictly before `PersonRoleGrant.status` flips to `ACTIVE` | `ensure-client-role.ts:89-120` (consent create, step 4) precedes `ensure-client-role.ts:130-144` (status→ACTIVE, step 6) — read top-to-bottom in the same function body, same `tx` | ✅ PASS |
| P-001 PORTAL_ACCESS precondition | Missing base consent aborts before any write | `ensure-client-role.ts:65-73` — `if (!portalConsent) throw ...` occurs before the `AWAITING_CONSENT` grant create (step 3) | ✅ PASS |
| E-002 idempotency | 2nd call on already-ACTIVE CLIENT is a no-op (`activated:false`), no duplicate grant/consent/profile | `ensure-client-role.ts:52-59` (`decideClientActivation` short-circuit) + `ensure-client-role.int.test.ts:136-156` (asserts `grantCount===1`, `consentCount===1`, `profileCount===1` after 2nd call) | ✅ PASS |
| Audit events | `CLIENT_ROLE_ACTIVATED` only on real activation (not on no-op); `CONSENT_GRANTED` alongside consent creation | `ensure-client-role.ts:146-164` (activation-only path) + `events.ts:40,53` catalog entries; `ensure-client-role.int.test.ts:158-169` asserts no new `CLIENT_ROLE_ACTIVATED` row on no-op | ✅ PASS |
| Barrel export | `ensureClientRole`, `decideClientActivation`, types exported from `@/modules/persons` | `src/modules/persons/index.ts:71-73` | ✅ PASS |
| Scope decision coherence (no self-service client UI) | No cadastro/UI/route for "become a client" exists | `find src/app -iname "*cliente*"` → empty; `grep -rn "activateClientRole\|ClientForm"` → empty | ✅ PASS |

**Status**: ✅ All ACs covered with file:line evidence — no spec-precision gaps.

---

## Discrimination Sensor

USP-011 is verify-only for this unit (no lines changed in product code). Per the skill, a sensor is proportional to new code introduced — there is none. In lieu of fault-injecting unchanged code (which would test pre-existing USP-011 construction, not this unit's work), the check here is: **do the existing anchor tests actually exercise the claimed invariants**, confirmed by direct read of `ensure-client-role.int.test.ts`:

| Invariant | Test that would catch a regression | Verified by reading assertion |
| --- | --- | --- |
| P-001 ordering | `ensure-client-role.int.test.ts:171-202` ("P-001 rollback: se a tx for revertida, nenhum dado persiste") | Forces a mid-transaction throw after `ensureClientRole` runs; asserts grant/profile/consent are all `null` post-rollback — proves atomicity, not just presence |
| PORTAL_ACCESS guard | `ensure-client-role.int.test.ts:204-227` | Asserts `rejects.toThrow('PORTAL_ACCESS_CONSENT_MISSING')` AND that zero rows were written |
| Idempotency (no duplication) | `ensure-client-role.int.test.ts:136-156` | Counts rows (`===1`), not just presence — would catch a duplicate-insert regression |
| No audit on no-op | `ensure-client-role.int.test.ts:158-169` | Before/after count comparison — would catch an unconditional audit-emit regression |

**Sensor depth**: n/a (no new/changed code in scope) — anchor-test rigor confirmed by direct read instead of fault injection, per "evidence-or-zero" for a verify-only unit.
**Result**: N/A — no mutation applicable; anchor tests independently confirmed non-shallow.

---

## 🧬 Must-Not Verification (ICE mode)

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Note |
| --- | --- | --- | --- | --- |
| P-001 | activate CLIENT to ACTIVE without SERVICE_HIRING consent in the same tx | `ensure-client-role.int.test.ts:171-202` (rollback proves atomicity) + code order `ensure-client-role.ts:89→130` | ✅ | |
| P-003 | activate role for an unauthenticated Person | Delegated to caller (USP-033) per design; documented in JSDoc `ensure-client-role.ts:23-27` ("Deve ser chamado DENTRO da transação do chamador... resolver a Pessoa autenticada... P-003") | ✅ (delegated, documented) | Correctly out of this unit's boundary per spec's own "Fronteira de escopo" — not a gap |
| P-002 | implicit consent (no term shown/accepted) | UI lives in USP-033, out of scope here | ➡️ USP-033 | Coherent with spec §"Fronteira de escopo" — verified this unit introduces no UI that would violate P-002 |

**Status**: ✅ All must-nots owned by this unit are proven; the two delegated to USP-033 (P-002, P-003's UI half) are correctly scoped out and documented, not silently dropped.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (zero product-code diff — genuinely verify-only) | ✅ |
| No abstractions for single-use code | ✅ (unchanged) |
| Matches existing patterns (`activate-additional-role.ts` twin, per code comment) | ✅ |
| Spec-anchored outcome check | ✅ |
| No fabricated ACs beyond the matrix card's pointers | ✅ |

---

## Gate Check

- **Gate command**: `npm run test && npm run test:integration` (scoped to `src/modules/persons`)
- **Result**:
  - `client-domain.test.ts` — 1 test file / 4 tests passed
  - `ensure-client-role.int.test.ts` — 1 test file / 7 tests passed
  - Full unit suite (`npm run test`) — 166 files / 1123 tests passed, 0 failed (includes both above)
  - Full persons integration suite — 6 files / 53 tests passed, 0 failed
  - `npm run typecheck` / `npm run lint` — 0 errors
- **Failures**: none.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| `client_profiles` schema | DONE (claimed) | ✅ Verified (independently re-derived) |
| `ensureClientRole` (idempotent, tx-composed) | DONE (claimed) | ✅ Verified |
| P-001 (consent before ACTIVE, same tx) | DONE (claimed) | ✅ Verified (eval(−) green) |
| P-003 (caller's responsibility) | DONE (claimed, delegated) | ✅ Verified (delegation documented, not a gap) |
| Barrel export | DONE (claimed) | ✅ Verified |
| Scope decision (no self-service UI) | Fixed in spec.md | ✅ Verified coherent with codebase (no client cadastro route/UI exists) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/10 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: N/A (no code change in scope) — anchor-test rigor independently confirmed by direct read
**Must-nots**: 3/3 accounted for (1 owned+green, 2 correctly delegated to USP-033 and documented)
**Gate**: typecheck/lint/test/test:integration all green

**What works**: `ClientProfile` schema/migration match the ICE contract exactly (no FK on `cityId`, no moderation fields); `ensureClientRole` correctly orders consent-before-ACTIVE inside the caller's transaction, is idempotent (row-counted, not just presence-checked), emits audit events conditionally, and is barrel-exported for USP-033 to consume. No client-facing UI exists, consistent with the "no self-service cadastro" scope decision.

**Issues found**: none. The reconciliation's "no gap" claim holds under independent re-derivation.

**Next steps**: none — U1/USP-011 is done. USP-033 (separate Fase 4 unit) is the consumer of `ensureClientRole`.
