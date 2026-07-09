# USP-037 + USP-038 (agregado `Referral`) Validation

**Date**: 2026-07-09
**Spec**: `.specs/features/ficha-social-encaminhamento/usp-037-encaminhar-vaga/spec.md` + `.specs/features/ficha-social-encaminhamento/usp-038-registrar-resultado/spec.md`
**Diff range**: `5a9b604..0df2ab7` (13 commits, USP-036 commits before `5a9b604` out of scope)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

### USP-037 (T1–T8)

| Task | Status  | Notes |
|------|---------|-------|
| T1 Schema + migração `Referral`/`ReferralResult` | ✅ Done | `prisma/migrations/20260709160000_usp037_referral/migration.sql`; applies clean (`prisma migrate status` → up to date) |
| T2 Scaffolding módulo + `createReferralSchema` | ✅ Done | `src/modules/referrals/schemas/referral.schema.ts` |
| T3 Regra pura `isProfessionalSummaryRequired` | ✅ Done | `src/modules/referrals/domain/referral-rules.ts` |
| T4 Helper `createReferralApplication` | ✅ Done | `src/modules/jobs/actions/create-referral-application.ts` |
| T5 Helper `ensureCandidateRole` | ✅ Done | `src/modules/persons/actions/ensure-candidate-role.ts` |
| T6 Server Action `createReferral` | ✅ Done | `src/modules/referrals/actions/create-referral.ts` |
| T7 E-mail template `referral-notification` | ✅ Done | `src/shared/lib/email/templates/referral-notification.ts` |
| T8 UI `ReferralForm` + página `novo` | ✅ Done | `src/modules/referrals/components/referral-form.tsx`, `src/app/(app)/encaminhamentos/novo/page.tsx` |

### USP-038 (T1–T3)

| Task | Status  | Notes |
|------|---------|-------|
| T1 Zod `registerReferralResultSchema` | ✅ Done | co-located in `referral.schema.ts` |
| T2 Server Action `registerReferralResult` | ✅ Done | `src/modules/referrals/actions/register-referral-result.ts` |
| T3 UI `ResultForm` + página `resultado` | ✅ Done | `src/modules/referrals/components/result-form.tsx`, `src/app/(app)/encaminhamentos/[id]/resultado/page.tsx` |

### Implementer-declared deviation

`ApplyConflictError` relocated from `jobs/actions/apply-to-job.ts` (`'use server'`) to
`jobs/domain/apply-errors.ts` (plain module), commit `b435609`. Confirmed via
`git diff 5a9b604..HEAD -- src/modules/jobs/actions/apply-to-job.ts`: the class body is
byte-identical, only its location moved; `apply-to-job.ts` now imports it. This is a real
build-gate requirement — Next.js Server Action files (`'use server'`) may only export async
functions, and exporting a class from one breaks the production build. The class is reused
unchanged by `applyToJob`, `createReferralApplication`, and `create-referral.ts`'s outer
catch. **Faithful pure move — not a regression.**

---

## Spec-Anchored Acceptance Criteria

### USP-037

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| AC-037-1 (persist Referral) | `Referral` row created, actor as `referrerPersonId` | `create-referral.int.test.ts:244-272` — `expect(referral).toMatchObject({ personId, jobId, referrerPersonId: asId, ... })` | ✅ PASS |
| AC-037-2 (papel candidato + aceite tácito) | `CANDIDATE` grant ACTIVE + consent `SOCIAL_REFERRAL_TO_JOB` in same tx | `create-referral.int.test.ts:286-294` — grant + consent both non-null after happy path | ✅ PASS |
| AC-037-3 (resumo obrigatório sem CV) | `VALIDATION`, zero rows | `create-referral.int.test.ts:189-199` — `error.code:'VALIDATION'`, `referral.count`/`application.count` = 0 | ✅ PASS |
| AC-037-4 (justification opcional) | persisted when provided | `create-referral.int.test.ts:264-272` — `justification: 'Perfil alinhado...'` matched | ✅ PASS |
| AC-037-5 (candidatura vinculada + badge + e-mail) | `Application.viaReferralId`/`viaEncaminhamento=true`; Outbox row `template:'referral-notification'` | `create-referral.int.test.ts:274-326` — both asserted exactly | ✅ PASS |
| AC-037-6 (múltiplos encaminhamentos, vagas diferentes) | 2 `Referral` rows, both `ok:true` | `create-referral.int.test.ts:351-365` | ✅ PASS |
| AC-037-7 (vaga não ativa bloqueada) | `PRECONDITION_FAILED`, zero rows | `create-referral.int.test.ts:201-223` (PAUSED, expired ACTIVE) | ✅ PASS |
| EC-2 (sem e-mail → no-op) | `ok:true`, Outbox count unchanged | `create-referral.int.test.ts:329-340` | ✅ PASS |
| EC-3 (flip @persist) | blocked, zero rows | `create-referral.int.test.ts:225-242` | ✅ PASS |
| EC-5 (Zod inválido) | `VALIDATION`, no DB touch | `create-referral.int.test.ts:157-161` | ✅ PASS |

### USP-038

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| AC-038-1 (persist result+observação+data) | all 3 set | `register-referral-result.int.test.ts:176-205` | ✅ PASS |
| AC-038-2 (enum restrito) | invalid value → `VALIDATION`, column unchanged | `register-referral-result.int.test.ts:137-146` | ✅ PASS |
| AC-038-3 (autor+data) | `resultRegisteredBy`/`resultRegisteredAt` always set | `register-referral-result.int.test.ts:191-196` | ✅ PASS |
| EC-1 (referralId inexistente) | `NOT_FOUND`, no write | `register-referral-result.int.test.ts:170-174` | ✅ PASS |
| EC-4 (re-registro) | overwrite + audit before→after | `register-referral-result.int.test.ts:207-244` — 2 audit rows, `before:{result:'UNDER_REVIEW'}`→`after:{result:'HIRED'}` | ✅ PASS |

**Status**: ✅ All ACs covered, no spec-precision gaps.

---

## Discrimination Sensor

Sensor tier: **P0/critical-path** (must-not-bearing, auth + concurrency + data-integrity) →
7 targeted mutations, one per must-not guard, run in the real working tree (each mutation
applied, targeted test re-run, then `git checkout --` to restore — no scratch worktree was
needed since every mutated file was already fully committed at HEAD, so restoration is exact).

| # | Must-not | File:line | Mutation | Killed? |
|---|---|---|---|---|
| 1 | REF-MN-01 | `jobs/actions/create-referral-application.ts:42` + `referrals/actions/create-referral.ts:208` | Both P2002-detection sites changed to a bogus code (`P9999`), defeating the `ApplyConflictError` mapping at both layers simultaneously | ✅ Killed — `@ref-mn-01 corrida` (concurrent `Promise.all`) went red: `expected +0 to be 1` CONFLICT results. Confirms the real DB unique-index guard (not just app pre-check) — the L-010 pattern. |
| 2 | REF-MN-02 | `referrals/actions/create-referral.ts:135-153` | Removed in-tx revalidation block entirely | ✅ Killed — `@ref-mn-02 corrida` (flip ACTIVE→PAUSED mid-tx) went red: `expected true to be false` |
| 3 | REF-MN-03 | `referrals/domain/referral-rules.ts:17` | Flipped `!hasCvAttachment` → `hasCvAttachment` | ✅ Killed — 4/6 `referral-rules.spec.ts` assertions failed |
| 4 | REF-MN-04 | `referrals/actions/create-referral.ts:53-55` | Bypassed `requirePermission` short-circuit, fabricated actor on failure | ✅ Killed — `@ref-mn-04` test: expected FORBIDDEN, got `ok:true` |
| 5 | REF38-MN-01 | `referrals/schemas/referral.schema.ts:46` | Replaced `z.nativeEnum(ReferralResult)` with `z.string()` | ✅ Killed — Zod layer defeated, but PG enum column independently rejected `'APPROVED'` (surfaced as `INTERNAL` instead of expected `VALIDATION`) — test still went red, and additionally empirically proves the dual-layer (Zod + PG-enum) claim in REF38-MN-01 |
| 6 | REF38-MN-02 | `referrals/actions/register-referral-result.ts:40-42` | Bypassed `requirePermission` short-circuit | ✅ Killed — `@ref38-mn-02` test: expected FORBIDDEN, got `INTERNAL` (write attempt failed at DB, not cleanly authorized, but still proves the guard's necessity) |
| 7 | REF38-MN-03 | `referrals/actions/register-referral-result.ts:61-62` | Removed `resultRegisteredBy`/`resultRegisteredAt` from the `update` data | ✅ Killed — happy-path test: `resultRegisteredBy: null` where `asId` expected |

**Sensor depth**: P0-full (7/7 must-not guards individually targeted)
**Result**: 7/7 killed — PASS ✅
**Scratch state discipline**: every mutation reverted via `git checkout -- <file>` immediately after its targeted test run; `git status --porcelain` on `src/modules/referrals`, `src/modules/jobs`, `src/modules/persons` confirmed clean before concluding. Full referral/jobs/persons integration suite (29 tests) re-run green after all mutations reverted.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| REF-MN-01 | create 2nd active Application / orphan Referral | `create-referral.int.test.ts:367-407` (sequential + **concurrent** `Promise.all`) — 1 CONFLICT, 1 active Application, 1 Referral (no orphan) | ✅ | ✅ (real unique index exercised, not just pre-check) |
| REF-MN-02 | create Referral/Application when job not ACTIVE (incl. TOCTOU) | `create-referral.int.test.ts:201-242` (PAUSED, expired, and mid-tx flip) — `PRECONDITION_FAILED`, zero rows | ✅ | ✅ |
| REF-MN-03 | create referral without professional summary when no CV | `referral-rules.spec.ts` (pure) + `create-referral.int.test.ts:189-199` — `VALIDATION`, zero rows | ✅ | ✅ |
| REF-MN-04 | create referral without `REFER_PERSON_TO_JOB` | `create-referral.int.test.ts:163-173` — `FORBIDDEN`, zero rows | ✅ | ✅ |
| REF38-MN-01 | persist `result` outside the enum | `register-referral-result.int.test.ts:137-146` — `VALIDATION`, column unchanged | ✅ | ✅ (dual-layer: Zod + PG enum type independently) |
| REF38-MN-02 | register/modify result without `REGISTER_REFERRAL_RESULT` | `register-referral-result.int.test.ts:154-168` — `FORBIDDEN`, no column written | ✅ | ✅ |
| REF38-MN-03 | persist `result` with null `resultRegisteredBy`/`resultRegisteredAt` | `register-referral-result.int.test.ts:176-205` — both non-null after registration | ✅ | ✅ |

**Status**: ✅ All 7 must-nots proven (negative test green + guard mutation killed).

---

## Transaction Atomicity (all-or-nothing)

Confirmed by direct code read (`create-referral.ts:124-203`, single `withAudit(...)` tx
wrapping `ensureCandidateRole` → job re-check → `Referral` insert → `createReferralApplication`
→ `APPLICATION_CREATED` audit → Outbox enqueue) plus empirical evidence:
- REF-MN-01 concurrent test: losing attempt leaves **zero** Referral rows (rollback, no orphan) — `create-referral.int.test.ts:404-406`.
- REF-MN-02 flip test: **zero** Referral/Application rows on precondition failure inside the tx — `create-referral.int.test.ts:240-241`.
- `ensure-candidate-role.int.test.ts:150-177` — explicit rollback test: throwing inside the caller's tx after `ensureCandidateRole` leaves grant/profile/consent all null.

**Result**: ✅ Confirmed all-or-nothing; no partial-write path found.

---

## Consent-semantics note (context, not a defect)

`ensureCandidateRole` deliberately omits the `PORTAL_ACCESS` gate that `ensureClientRole`
enforces — verified spec-faithful: `usp-037-encaminhar-vaga/spec.md` Assumptions table row
4 documents this as an intentional divergence mandated by the epic's edge case (Pessoa sem
credencial deve ser encaminhável), base legal LGPD art. 7º IX via the tácito
`SOCIAL_REFERRAL_TO_JOB` consent. Empirically confirmed by
`ensure-candidate-role.int.test.ts:76-107` (`EC-2`), which explicitly asserts `PORTAL_ACCESS`
remains absent after activation. E-mail enqueue no-op (not an error) confirmed at
`create-referral.int.test.ts:329-340`. **Not a defect.**

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ — diff `5a9b604..HEAD` touches 35 files, all under `referrals/`, `jobs/{apply-to-job.ts,create-referral-application.ts,apply-errors.ts,index.ts}`, `persons/{ensure-candidate-role.ts,index.ts}`, `shared/lib/email/*`, `app/(app)/encaminhamentos/**`, `prisma/*`, `e2e/referrals/*` — no unrelated churn |
| Matches patterns | ✅ — `ensureCandidateRole` mirrors `ensureClientRole`; `createReferralApplication` mirrors `applyToJob`'s tx-participant shape; route guards mirror `moderation`'s 404-on-unauthorized pattern |
| Spec-anchored outcome check | ✅ — all ACs traced above |
| Per-layer Coverage Expectation met | ✅ — domain 1:1 (`referral-rules.spec.ts`), Server Actions cover happy+Zod+permission+precondition+concurrency+must-nots |
| Every test maps to a spec requirement | ✅ — all test names carry `@ac-0xx`/`@ref-mn-0x`/`@ref38-mn-0x`/`EC-x` tags |
| Documented guidelines followed | ✅ — `CLAUDE.md` Server Action sequence (Zod→permission→consent-N/A-justified→precondition→`withAudit`), `docs/arch/project-guideline.md` conventions |

---

## Edge Cases

- [x] EC-1 (sem CV + resumo vazio → bloqueio) — REF-MN-03
- [x] EC-2 (sem credencial → encaminhamento OK, e-mail no-op)
- [x] EC-3 (flip ACTIVE→não-ACTIVE @persist) — REF-MN-02
- [x] EC-4 (duplicata ativa → CONFLICT) — REF-MN-01
- [x] EC-5 (Zod inválido → VALIDATION sem escrita)
- [x] USP-038 EC-1 (referralId inexistente → NOT_FOUND)
- [x] USP-038 EC-2 (result fora do enum → VALIDATION) — REF38-MN-01
- [x] USP-038 EC-3 (sem permissão → FORBIDDEN) — REF38-MN-02
- [x] USP-038 EC-4 (re-registro sobrescreve, audita before→after)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && NODE_ENV=production npm run build`
- **Result**:
  - `typecheck`: clean, 0 errors
  - `lint`: clean, 0 errors
  - `test` (unit): 201 files / 1330 tests passed
  - `test:integration`: 87 files / 541 tests passed (includes all referrals/jobs/persons int suites)
  - `build` (`NODE_ENV=production`): succeeded; both new routes present as `ƒ` (force-dynamic): `/encaminhamentos/novo`, `/encaminhamentos/[id]/resultado`
  - `prisma migrate status` (local Supabase, `127.0.0.1:55322`): "Database schema is up to date!" — 32 migrations, `20260709160000_usp037_referral` applied clean
- **Test count before feature**: not independently re-derived (feature builds atop USP-036 baseline already on branch); no deletions observed in this diff — only additions (see diffstat: `+2827/-6`, the `-6` being the `apply-to-job.ts` relocation)
- **Skipped tests**: none unjustified — `describe.skipIf(!process.env.DATABASE_URL)` guards int suites (ran with DB up in this session, none skipped)
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| SOC-03 | Pending | ✅ Verified |
| SOC-04 | Pending | ✅ Verified |
| SOC-05 | Pending | ✅ Verified |
| REF-MN-01 | Pending | ✅ Verified |
| REF-MN-02 | Pending | ✅ Verified |
| REF-MN-03 | Pending | ✅ Verified |
| REF-MN-04 | Pending | ✅ Verified |
| REF38-MN-01 | Pending | ✅ Verified |
| REF38-MN-02 | Pending | ✅ Verified |
| REF38-MN-03 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 15/15 ACs+ECs matched spec outcome, 0 spec-precision gaps
**Sensor**: 7/7 mutations killed (P0-full tier)
**Must-nots**: 7/7 green
**Gate**: 5/5 commands passed (typecheck, lint, unit, integration, build) + migration verified clean

**What works**: Full `Referral` aggregate — encaminhamento institucional with tácito role
activation, linked Application with badge, audited 4-event transaction, Outbox email
(no-op when no e-mail), and manual result registration with provenance and re-registration
history — all verified against the real local Postgres, including a genuine concurrent-write
exercise of the DB unique index (not masked by the app pre-check, per lesson L-010).

**Issues found**: none.

**Next steps**: none — ready to merge as-is.
