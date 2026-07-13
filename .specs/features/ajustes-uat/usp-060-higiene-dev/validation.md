# USP-060 — Higiene de dev/seed Validation

**Date**: 2026-07-13
**Spec**: `.specs/features/ajustes-uat/usp-060-higiene-dev/spec.md`
**Diff range**: `0b39b3a~1..24c1daf` (14 commits: 12 task commits + 2 flakiness fixes + 2 extension commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | ✅ Done | `publishedAt` set on ACTIVE fixtures (archive-job:114, pause-job:112, incl. PAUSED for despause branch) |
| T2   | ✅ Done | credential-claim count scoped to `requestedEmail` (:191) |
| T3   | ✅ Done | search-jobs.int cleans JobArea + 2 Regions (:233-236) |
| T4   | ✅ Done | search-services.int cleans 2 Regions (:178-179) |
| T5   | ✅ Done | submit-job-for-moderation.int cleans Region (:166-167) |
| T6   | ✅ Done | submit-service.int cleans Region (:182-183) |
| T7   | ✅ Done | delegated-permissions.int: new `afterEach` teardown ×2 blocks (:76-84, :188-196) |
| T8   | ✅ Done | `FIXED_PASSWORD='asonseg2026'`, docs, guard test (37 lines, 3 assertions) |
| T9   | ✅ Done | `EMAIL_DEV_SMTP` + fence in `env.ts` (:88, :137-145) |
| T10  | ✅ Done | `DevSmtpEmailSender` (dynamic `import('nodemailer')`, never throws, no PII log) |
| T11  | ✅ Done | container ternary binding (`container.ts:83-85`) |
| T12  | ✅ Done | `supabase/config.toml` smtp_port exposed, `.env.example`, `docs/operacao/harness-email-dev.md` |
| Extension (undeclared as tasks, disclosed as deviation) | ✅ Done | search-candidates USP028-01 marker-scoped; create-referral race hardened against infra timeout; container-email-sender timeout bump |

All 14 commits present in range and match their stated task/commit-message mapping. No task partial or blocked.

---

## Spec-Anchored Acceptance Criteria

### P2: Suíte de integração determinística

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: fixtures ACTIVE setam `publishedAt` | vaga aparece na página 1 mesmo sob volume | `archive-job.int.test.ts:114`, `pause-job.int.test.ts:112` — `publishedAt: new Date()`; live-verified with 663 tests green across 3 full suite runs incl. one after genuine `supabase db reset` | ✅ PASS |
| AC2: remoção pós-pausa/arquivamento preservada | `not.toContain` continua real | `archive-job.int.test.ts:136`, `pause-job.int.test.ts:134` — unchanged; **sensor**: loosening `search-jobs.ts` status filter killed both (see Sensor #3) | ✅ PASS |
| AC3: contagem anti-enum escopada | `count({where:{requestedEmail}})`, não global | `credential-claim.int.test.ts:191` — `expect(...count({where:{requestedEmail: REQUESTED_EMAIL}})).toBe(0)` | ✅ PASS |
| AC4: suíte inteira verde pós-reset+reseed | `npm run test:integration` 0 falhas | 3 full runs, all green: run1 663/663, run2 (no reset) 663/663, run3 (after genuine `supabase db reset` + `prisma migrate deploy` + `db:seed`) 663/663 | ✅ PASS |

### P2: Harness de e-mail local

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: flag on ⇒ DevSmtp resolvido | container resolve `DevSmtpEmailSender` | `container-email-sender.test.ts` "flag on ⇒ ... DevSmtpEmailSender" — passed in full unit run | ✅ PASS |
| AC2: flag off ⇒ Resend (prod idêntico) | container resolve `ResendEmailSender` | `container-email-sender.test.ts` "flag off ..." — passed | ✅ PASS |
| AC3: cron local drena com `CRON_SECRET` | sem 503 | Not independently re-driven live (route unchanged, `verifyCronSecret` untouched); doc `harness-email-dev.md` documents curl command; **not exercised end-to-end this pass** | ⚠️ Spec-precision gap (not re-driven live; low risk — route/guard code untouched) |
| AC4: adapter entrega e não loga corpo/PII | `{ok:false}` nunca lança; sem corpo/destinatário no log | `dev-smtp-email-sender.test.ts:46-59, 61-75` — asserts `sigiloso@example.com`/`SEGREDO`/`Sigiloso` absent from all logged payloads, success and failure paths | ✅ PASS |
| AC5: build de prod passa sem nodemailer no caminho de prod | build succeeds; adapter never selected in prod | `NODE_ENV=production npm run build` exit 0 (build succeeds). **But**: `nodemailer` package IS present in webpack chunk `.next/server/chunks/5112.js` (219KB) and is traced into 46/56 `.nft.json` serverless-function bundles (incl. `dispatch-outbox` route, most pages) — because Next.js/webpack still resolves and chunks a dynamic `import()` at build time, it isn't eliminated by the flag being false at runtime. This is the exact scenario spec.md's own Edge Cases table pre-approved ("é apenas peso de trace, não falha... contingência: promover a dependency") | ⚠️ Spec-precision gap — literal wording "sem nodemailer no caminho de produção" is not strictly true (package ships in the trace); build itself does not fail, matching the documented risk/edge-case. Recommend contingency (promote to `dependency`) or accept as known trace-weight, same shape as the `@react-pdf` lesson in project MEMORY |

### P3: Cleanup de fixtures

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: search-jobs.int limpa JobArea+2 Regions | count==0 pós afterAll | `search-jobs.int.test.ts:233-236` | ✅ PASS |
| AC2: search-services.int limpa 2 Regions | count==0 | `search-services.int.test.ts:178-179` | ✅ PASS |
| AC3: submit-job-for-moderation.int limpa Region | count==0 | `submit-job-for-moderation.int.test.ts:166-167` | ✅ PASS |
| AC4: submit-service.int limpa Region | count==0 | `submit-service.int.test.ts:182-183` | ✅ PASS |
| AC5: delegated-permissions.int limpa Pessoas | `listEligibleVolunteers` sem fixture | `delegated-permissions.int.test.ts:76-84, 188-196` — `afterEach` deletes + count==0 assertion; empirically confirmed via direct DB query post-suite (`select count(*) from persons where full_name ilike 'Pessoa-%'` → 0, 3× across all 3 integration runs) | ✅ PASS |
| AC6: cleanup nunca toca canônica/CNPJ demo/audit_log | deletes keyed by fixture name; `seed.integration.test.ts` green; no audit_log DELETE/UPDATE | All 5 cleanups keyed by literal fixture-name constants (never a broad `deleteMany({})`); `seed.integration.test.ts` passed in all 3 runs; grep confirms zero `audit_log`/`auditLog` references added in T3-T7; DB trigger independently confirmed to reject any DELETE without `app.audit_purge` (see Sensor evidence) | ✅ PASS |

### P3: Senha do seed válida

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: senha satisfaz política estrita | ≥8, ≤72(128), ≥1 letra, ≥1 número | `bulk.ts:40` `FIXED_PASSWORD='asonseg2026'`; `seed-password.test.ts:14-36` — 3 passing assertions against `changePasswordFirstAccessSchema`/`resetPasswordSchema` | ✅ PASS |
| AC2: docs/log citam a nova senha | zero refs a `12345678` (exceto nota histórica) | `docs/operacao/contas-de-teste-seed.md:9` cites `asonseg2026`; `prisma/seed.ts:59` derives from exported `FIXED_PASSWORD`; grep across `prisma/`+`docs/` finds only 1 historical mention inside the re-seed note (expected) | ✅ PASS |
| AC3: teste-guarda passa | guard test green | `seed-password.test.ts` — 3/3 green in full unit run (2003/2003 total) | ✅ PASS |
| **Live verification** (beyond spec wording) | new seed accounts can actually log in | after genuine `supabase db reset` + `prisma migrate deploy` + `db:seed`, `POST /auth/v1/token?grant_type=password` for `coordenador01@seed.asonseg.dev` / `asonseg2026` → `200` with `access_token` | ✅ PASS (empirical) |

**Status**: ✅ All ACs covered; 2 spec-precision gaps flagged (cron-drain not re-driven live; nodemailer trace-weight — both pre-approved by spec's own edge cases / low materiality).

---

## Discrimination Sensor

All mutations executed in the real working tree (git-tracked, HEAD clean before/after) and reverted via `git checkout --` immediately after observing the kill; DB-level fixture leaks from mutations were manually cleaned and re-verified as zero before continuing.

| # | Must-Not targeted | File:line mutated | Description | Killed? |
| - | --- | --- | --- | --- |
| 1 | HYG-MN-04 | `src/shared/env.ts:137` | `if (isVercelDeploy && env.EMAIL_DEV_SMTP)` → `if (false && ...)` (disables the fence) | ✅ Killed — `env.test.ts` "HYG-MN-04 (negativo)" failed as expected |
| 2 | HYG-MN-05 | `prisma/seeds/bulk.ts:40` | `FIXED_PASSWORD` reverted to legacy `'12345678'` | ✅ Killed — all 3 `seed-password.test.ts` assertions failed |
| 3 | HYG-MN-01 | `search-jobs.int.test.ts:233-234` | Removed the `jobArea.deleteMany`/`region.deleteMany` calls, kept the count==0 assertions | ✅ Killed — suite failed with `expected 1 to be +0` |
| 4 | HYG-MN-03 | `src/modules/jobs/queries/search-jobs.ts:72` | `j.status = 'ACTIVE'` → `j.status IN ('ACTIVE','PAUSED','ARCHIVED')` (simulates a regression where pausing/archiving no longer removes the job from public search) | ✅ Killed — both `archive-job.int.test.ts` and `pause-job.int.test.ts` removal (`not.toContain`) assertions failed |
| 5 | HYG-MN-02 | N/A (DB-level guard, not app code) | Direct `DELETE FROM audit_log WHERE id = (...)` via `psql`, no `app.audit_purge` set | ✅ Killed — Postgres itself raised `audit_log é append-only: DELETE bloqueado (ADR-T-0004)`; confirms the guard is structural (independent of any test author's diligence) |

**Sensor depth**: default tier, but escalated to cover every must-not (5/5) per rule 6b(4) given this feature carries 5 must-nots touching security/data-integrity invariants.
**Result**: 5/5 killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | --- | --- | --- | --- |
| HYG-MN-01 | Delete canonical taxonomy / demo CNPJ | Deletes keyed by fixture-name constants (T3-T7); `seed.integration.test.ts` green in all 3 runs | ✅ | ✅ (sensor #3) |
| HYG-MN-02 | DELETE/UPDATE `audit_log` outside `app.audit_purge` | No `audit_log`/`auditLog` touch added in T3-T7 (grep-confirmed); `append-only.int.test.ts` green in all 3 runs; DB trigger independently verified to block raw DELETE | ✅ | ✅ (sensor #5, DB-level) |
| HYG-MN-03 | Weaken removal assertion or anti-enum property | `archive-job.int.test.ts:136`, `pause-job.int.test.ts:134` (`not.toContain`, unchanged); `credential-claim.int.test.ts:191` (scoped, still asserts zero) | ✅ | ✅ (sensor #4) |
| HYG-MN-04 | Resolve dev adapter or leak flag in a real Vercel deploy | `env.test.ts` "HYG-MN-04 (negativo)" (:225-236); `container-email-sender.test.ts` (flag→adapter mapping) | ✅ | ✅ (sensor #1) |
| HYG-MN-05 | Ship a seed password that fails the real password policy | `seed-password.test.ts:14-36` | ✅ | ✅ (sensor #2) |

**Status**: ✅ All 5 must-nots proven (negative test green + guard mutation killed for each).

---

## Determinism Check (core objective of this USP)

| Run | Precondition | Result |
| --- | --- | --- |
| 1 | Existing dev DB (already accumulated volume from prior sessions) | 113 files / 663 tests, 0 failures |
| 2 | Same DB, **no reset** between runs (volume from run 1 accumulated on top) | 113 files / 663 tests, 0 failures |
| 3 | Genuine full reset: `supabase db reset` (recreates `auth` + `public` schemas) → `prisma migrate deploy` → `npm run db:seed` (SEED_DEMO=1, full volume) | 113 files / 663 tests, 0 failures |

**AC4 + Independent Test satisfied**: both the "twice without reset" requirement and the optional "after a full reset" bonus check are green.

**Notable finding during this check (not a regression, informational):** an intermediate attempt at "full reset" using `dotenv-cli -- npx prisma migrate reset --force` did **not** actually reset Supabase Auth users (Prisma only owns the `public` schema; `auth` is GoTrue-managed) — a stale pre-existing seed account still failed to log in with the new password immediately after that reset, exactly matching the edge case documented in spec.md ("re-seed com Auth users pré-existentes... Supabase reusa por e-mail... não re-aplica a senha"). This is not a defect of the implementation — it is the documented, pre-accepted behavior, and it disappeared once a true `supabase db reset` was used. Worth keeping in mind operationally: `prisma migrate reset` alone is insufficient to fully validate Auth-dependent changes locally.

---

## Cleanup / Pollution Check (HYG-09/10/11)

Direct DB queries after each of the 3 integration runs (see Determinism Check above), against the actual tables backing the public query functions (`listActiveRegions` → `regions`, `listApprovedJobAreas` → `job_areas`, `listServiceCategories` → `service_categories`, `listEligibleVolunteers` → `persons`, confirmed via source read):

- `regions` matching `%int%`/`%busca%`/`%centro%`: **0** (all 3 runs)
- `job_areas` matching `%int%`/`%busca%`: **0** (all 3 runs)
- `persons` matching `Pessoa-%`: **0** (all 3 runs)

**Already-dirty-DB scenario**: the DB was already clean of fixture pollution *before* this Verifier session started (no pre-existing stale rows found). This means the "does a one-off cleanup exist for a DB that was already dirty before Fase 8" question could not be empirically exercised this pass. Per spec.md's own Out-of-Scope table, a retroactive/global cleanup mechanism was explicitly rejected (blast-radius reasons) and the Success Criteria only require no *new* pollution after the suite runs — not retroactive remediation of historical pollution. This is an accepted gap per the spec's own scoping, not a defect of this USP.

---

## Extension Commits (undeclared as formal tasks — reviewed as disclosed deviations)

| Commit | Change | Invariant preserved? |
| --- | --- | --- |
| `ac4a543` | `search-candidates.int.test.ts` USP028-01 scoped via unique `q` marker instead of exhaustive-count-of-2-pages | ✅ — same WHERE/ORDER BY path exercised, same ordering assertion (`cRecente` before `cAntigo`), only the dataset-size assumption removed. Not a security/must-not test. |
| `24c1daf` | `create-referral.int.test.ts` race test retried up to 3× with **fresh** fixtures on infra-timeout-shaped failures only | ✅ — final assertion unchanged (`exactly 1 ok + 1 CONFLICT`); retry triggers only when the observed shape deviates from that invariant, and a systematic violation would still exhaust the 3 retries and fail. Does not mask a genuine race-condition regression. |
| `ad77e20` | `container-email-sender.test.ts` timeout 5000ms→20000ms | ✅ — no assertion touched, only wall-clock budget for `vi.resetModules()` re-import cost under parallel-suite CPU contention |

No must-not or security/anti-enumeration property was weakened by the extension commits.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (no features beyond what was asked) | ✅ — every change traces to a HYG-NN/HYG-MN-NN requirement or a disclosed flakiness fix |
| Surgical changes (only files required) | ✅ — 25 files changed, all named in design.md's Location column |
| No scope creep | ✅ — `search-jobs.ts`/`search-services.ts` production queries untouched (confirmed by diff) |
| Matches existing patterns | ✅ — cleanup mirrors `submit-service.int.test.ts:166-180`; env/container seam mirrors `CV_EXTRACTOR_FAKE`/`CV_EXTRACTOR_TOKEN` |
| Spec-anchored outcome check | ✅ — see AC tables above; 2 precision gaps flagged, not silently passed |
| Per-layer coverage (domain 1:1; adapters happy+edge+error) | ✅ — `DevSmtpEmailSender` covers success/failure/no-PII-success/no-PII-failure (4 tests); env covers default/parse/fence-trip/custom-host |
| Every test maps to a spec requirement (no unclaimed tests) | ✅ |
| Documented guidelines followed | `CLAUDE.md` Testing Requirements + `vitest.integration.config.ts` (`fileParallelism:false`) — followed (no `[P]` on int-test phases) |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && NODE_ENV=production npm run build`, plus `npm run test:integration` ×3
- **typecheck**: ✅ exit 0 (re-verified after all sensor mutations reverted)
- **lint**: ✅ exit 0
- **unit (`npm run test`)**: ✅ 284 files / 2003 tests passed, 0 failed
- **build (`NODE_ENV=production npm run build`)**: ✅ exit 0, all 47 routes generated
- **integration (`npm run test:integration`)**: ✅ 113 files / 663 tests passed × 3 consecutive runs (2 without reset, 1 after genuine full reset)
- **Test count before feature**: not independently measured pre-branch; test-file diff stat shows +1 new unit file (`seed-password.test.ts`), +1 new unit file (`container-email-sender.test.ts`), +1 new unit file (`env` additions to existing file), +1 new unit file (`dev-smtp-email-sender.test.ts`) — all additive, zero deletions of existing test files
- **Skipped tests**: none observed
- **Failures**: none (post-revert)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| HYG-01 | Implementing | ✅ Verified |
| HYG-02 | Implementing | ✅ Verified |
| HYG-03 | Implementing | ✅ Verified |
| HYG-04 | Implementing | ✅ Verified (⚠️ nodemailer trace-weight noted, non-blocking) |
| HYG-05 | Implementing | ✅ Verified |
| HYG-06 | Implementing | ⚠️ Verified (cron-drain doc reviewed; not re-driven live this pass) |
| HYG-07 | Implementing | ✅ Verified |
| HYG-08 | Implementing | ⚠️ Verified (build passes; trace-weight matches pre-approved edge case) |
| HYG-09 | Implementing | ✅ Verified |
| HYG-10 | Implementing | ✅ Verified |
| HYG-11 | Implementing | ✅ Verified |
| HYG-12 | Implementing | ✅ Verified (incl. live login proof) |
| HYG-13 | Implementing | ✅ Verified |
| HYG-MN-01 | Implementing | ✅ Verified |
| HYG-MN-02 | Implementing | ✅ Verified |
| HYG-MN-03 | Implementing | ✅ Verified |
| HYG-MN-04 | Implementing | ✅ Verified |
| HYG-MN-05 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (PASS)

**Spec-anchored check**: 21/23 ACs matched spec outcome exactly; 2 spec-precision gaps flagged (cron-drain not re-driven live; nodemailer build-trace weight) — both pre-approved by spec.md's own Edge Cases table and non-blocking.
**Sensor**: 5/5 mutations killed (one per must-not).
**Must-nots**: 5/5 green with guard-mutation confirmation.
**Gate**: typecheck ✅ · lint ✅ · unit 2003/2003 ✅ · prod build ✅ · integration 663/663 × 3 runs ✅.

**What works**: Determinism objective fully met (green twice without reset + green after a genuine `supabase db reset`+migrate+reseed); all 5 int-test cleanups verified empirically (zero fixture pollution across 3 runs); seed password verified both by unit guard and by a real Supabase Auth login; dev email harness fully unit-tested with no PII/body leakage; prod build unaffected; all extension/flakiness-fix commits preserve their original invariants.

**Issues found** (both non-blocking, already anticipated by spec.md):
1. `nodemailer` (219KB) is traced into 46/56 serverless function bundles despite the dynamic import — matches the exact "trace-weight, not build failure" scenario spec.md pre-approved; recommend tracking as a lesson (same shape as the existing `@react-pdf`/nft-leak lesson in project MEMORY) and considering the documented contingency (promote to `dependency`) if Vercel bundle-size limits are ever hit.
2. HYG-06's cron-drain-locally AC was reviewed via code/doc inspection, not re-driven live end-to-end (no email was actually enqueued + cron-triggered + observed in Mailpit this pass) — low risk since `verifyCronSecret` and the route handler are untouched by this USP.

**Next steps**: No fix tasks required to reach PASS. Optional follow-ups (not blocking): (1) record a lesson entry for the nodemailer nft-trace pattern; (2) if desired, a quick manual Mailpit smoke test of the full email+cron path before considering the harness "field-verified" rather than "unit-verified."

---

## Fase 8 Status

USP-060 is the **last unit of Fase 8** (`ajustes-uat`). With this PASS, all Fase 8 remediation items (PUB-6, SVC-3, AUTH-8, AUTH-9/REL-4, plus the determinism defect found during Fase 8 execution) are closed. **Fase 8 is complete.**
