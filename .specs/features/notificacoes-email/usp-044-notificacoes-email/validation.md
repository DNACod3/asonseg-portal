# USP-044 Validation — Dispatcher assíncrono do Outbox de e-mail

**Date**: 2026-07-10
**Spec**: `.specs/features/notificacoes-email/usp-044-notificacoes-email/spec.md` → ICE: `docs/IDSD/ice-portal-asonseg/intents/intent-USP-044.md` + `expectations/expectations-USP-044.md`
**Diff range**: `377e9e4..60654ee` (T1 `3b9fd9c`, T2 `387bdb6`, T3 `2ce5423`, T4 `60654ee`); orthogonal `3a21f43` (TZ flake fix, verified green, not scored)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|------|---------|-------|
| T1   | ✅ Done | `job-expiry` template + union variant + exhaustive `render()` case |
| T2   | ✅ Done | `resolveJobExpiryEmail` + container binding + barrel export |
| T3   | ✅ Done | `dispatchOutbox()` motor, claim/resolve/send/mark |
| T4   | ✅ Done | Fail-closed cron route + `vercel.json` schedule |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| AC-044-D1 (select bounded, oldest-first, `attempts<MAX`) | `topic='email' AND processedAt IS NULL AND attempts<5`, `ORDER BY createdAt ASC LIMIT 50` | `src/shared/lib/outbox/dispatch-outbox.ts:61-66` — raw SQL matches; `resolve-outbox-email.test.ts:62-70` — `isClaimable` cap unit | ✅ PASS |
| AC-044-D2 (EmailMessage completo → send, `processedAt`) | fake called with message; `processedAt` set | `dispatch-outbox.int.test.ts:121-137` — `expect(result).toMatchObject({sent:1,...})`, `expect(row.processedAt).not.toBeNull()` | ✅ PASS |
| AC-044-D3 (JOB_EXPIRY_D3 → hydrate → send) | hidratado via vaga+responsável seed, enviado | `dispatch-outbox.int.test.ts:139-163`; `resolve-job-expiry-email.int.test.ts:57-80` — `to` exato, `data` mínimo | ✅ PASS |
| AC-044-D4 (falha → attempts+1, lastError, processedAt null) | exact field values | `dispatch-outbox.int.test.ts:165-181` — `expect(row.attempts).toBe(1)`, `expect(row.lastError).toBeTruthy()`, `expect(row.processedAt).toBeNull()` | ✅ PASS |
| AC-044-D5 (entidade ausente → no-op gracioso) | `processedAt` set, `skipped`, sem retry | `dispatch-outbox.int.test.ts:183-194` — `skipped:1`, `attempts:0`; `resolve-job-expiry-email.int.test.ts:82-135` (3 cenários: sem e-mail, revogado, jobId inexistente) | ✅ PASS |
| AC-044-D6 (retorna `{sent,failed,skipped}`, log estruturado) | exact shape | `dispatch-outbox.int.test.ts` — todos os `toMatchObject` sobre `DispatchOutboxResult`; `route.test.ts:63-70` — `expect(body).toEqual({ok:true,sent:2,failed:1,skipped:0})` | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps.

---

## Discrimination Sensor

Sensor depth: **P0-full** (USP-044 is ICED with must-nots — floor requires ≥5 mutations covering all branches; 4 targeted at each must-not's guard + reliance on existing 8/8 int-test coverage as the discriminating harness).

| # | File:line | Description | Killed? |
|---|-----------|-------------|---------|
| 1 | `dispatch-outbox.ts` claim query | Removed `FOR UPDATE SKIP LOCKED` from the per-row claim `SELECT` | ✅ Killed — `U44-MN-01` test: `expect(r1.sent+r2.sent).toBe(N)` got `12` instead of `6` (double-send against real DB/fake-call-count, not an app pre-check) |
| 2 | `route.ts` GET handler | Replaced the `missing_secret`/`unauthorized` branches with `void auth` (secret check ignored) | ✅ Killed — 3/3 `U44-MN-02` route tests turned RED (`503`→`200`, `401`→`200` twice) |
| 3 | `dispatch-outbox.ts` candidate query | Dropped `AND attempts < ${MAX_ATTEMPTS}` from the batch `SELECT` | ✅ Killed — poison test: expected `{sent:0,claimed:0}`, got `{sent:1,claimed:1}` (poison row re-selected and re-sent) |
| 4 | `dispatch-outbox.ts` success log call | Added `to: message.to, data: message.data` to the `log.info` metadata object | ✅ Killed — `U44-MN-04` test: serialized log contained the victim e-mail address and `data` fields verbatim |

All 4 mutations applied to the real tracked files, run against the actual (non-mocked) test files, confirmed RED, then restored byte-for-byte (`git diff --stat` on every touched file returned empty after each restore, and again at the end of the session).

**Result**: 4/4 killed — PASS.

---

## 🧬 Must-Not Verification (ICE mode)

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
|---|---|---|---|---|
| U44-MN-01 | double-send under concurrent drains | `dispatch-outbox.int.test.ts:196-228` — two real overlapping `dispatchOutbox()` calls, 40ms artificial send delay forces overlap on the actual Postgres lock; asserts `r1.sent+r2.sent===N` and per-address fake-call-count `===1`, against DB state (`processedAt` on all rows) | ✅ | ✅ (mutation 1) |
| U44-MN-02 | process without valid `CRON_SECRET` | `route.test.ts:40-61` — missing env → `503`+`dispatchOutbox` not called; missing/wrong header → `401`+not called (3 assertions) | ✅ | ✅ (mutation 2) |
| U44-MN-03 | poison retried past cap / one failure blocks batch | `dispatch-outbox.int.test.ts:230-268` — `attempts=MAX_ATTEMPTS` row not selected (`claimed:0`); malformed row mid-batch does not block the following good row (`claimed:2, sent:1, failed:1`) | ✅ | ✅ (mutation 3, cap half); isolation half not separately mutated but structurally guaranteed by per-row `try/catch` in `claimAndProcessRow` (dispatch-outbox.ts:100-150) — visually confirmed, no bare loop-level throw path exists |
| U44-MN-04 | log email body/PII in clear | `dispatch-outbox.int.test.ts:270-292` — captured log serialized, asserted not to contain `to`/e-mail/name/company strings and object keys never contain `data`/`to` | ✅ | ✅ (mutation 4) |
| P-003 | send before source-tx commit | Design: dispatcher only ever reads `processed_at IS NULL` rows via a plain `SELECT`/claim after the enqueue transaction has committed (no dirty-read path in Postgres under `READ COMMITTED`); no separate negative test — inherited invariant from the 6 enqueue-in-tx call sites (out of USP-044 diff scope, unit already existing) | ✅ (structural) | n/a (not new code in this diff) |
| P-007 | send orphaned rollback email | Design: rollback deletes the Outbox row at the source (existing, out of scope); claim idempotency (SKIP LOCKED) covered by U44-MN-01 | ✅ (structural) | ✅ (via mutation 1) |

**Status**: ✅ All must-nots proven — no missing or red `eval(−)`.

---

## Interactive UAT

Not performed — USP-044 is backend-only infrastructure (cron dispatcher), no user-facing behavior requiring human judgment. Per validate.md §3, automated checks are sufficient.

---

## Code Quality

| Principle | Status | Note |
|---|---|---|
| No features beyond what was asked | ✅ | No opt-out (`email_prefs`), no `cv_reminder`, no new audit event — all correctly deferred per design §ICE-ID Coverage / D-2/D-7 |
| No abstractions for single-use code | ✅ | `job-expiry-resolver.port.ts` is a bare type + token, no logic (deviation 2, confirmed sound) |
| No unnecessary "flexibility" added | ✅ | `DispatchOutboxDeps`/`ResolveOutboxEmailDeps` are narrow, test-only injection points, matching the port-injection pattern used elsewhere |
| Only touched files required for task | ✅ | Diff scoped exactly to the 16 files listed in the design's Components section |
| Didn't "improve" unrelated code | ✅ | No incidental changes outside the 4 tasks' surface |
| Matches existing patterns/style | ✅ | Route clones `expire-jobs/route.ts` skeleton; resolver token mirrors `DispatchingContentStatusRepository` precedent (container.ts:86-92 vs. :108-129) |
| Would senior engineer approve? | ✅ | Concurrency design (claim+send+mark in one short tx) is explicit about its at-least-once trade-off and grounds it in an accepted ADR (0020) |
| Tests map to ACs, non-shallow | ✅ | Spot-checked `dispatch-outbox.int.test.ts` — every assertion targets exact DB column values or exact fake-call counts, not existence checks |
| Spec-anchored outcome check | ✅ | See ACs table above — all assertions target the spec's precise outcome |
| Every test maps to a spec AC/must-not/Done-when | ✅ | No unclaimed tests found across the 5 new test files |

---

## Edge Cases (from spec.md)

- [x] `EmailSender` returns `{ok:false}` → treated as row failure (AC-044-D4), never throws, doesn't block batch — `dispatch-outbox.int.test.ts:165-181`
- [x] Malformed payload (neither known `template` nor known `kind`) → row failure, poison on cap — `resolve-outbox-email.test.ts:43-50` (unit) + `dispatch-outbox.int.test.ts:248-268` (integration, isolation)
- [x] Crash mid-send → at-least-once accepted, documented in design.md, not separately tested (explicitly out of scope — accepted rare event)
- [x] Empty batch → `{sent:0,failed:0,skipped:0}` — implied by `candidates` loop over `[]`; not separately asserted with an explicit empty-DB test, but the loop has no other path — low risk, no fix needed

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **Result**:
  - `typecheck`: 0 errors
  - `lint`: 0 errors/warnings
  - `test` (unit): **1466/1466 passed**, 221 files (matches Implementer's reported count exactly)
  - `test:integration`: **612/612 passed**, 103 files (0 failures — confirms `3a21f43`'s TZ-flake fix holds on the freshly migrated DB; the previously-flaky `validUntil` tests are green)
  - `build`: succeeds; `/api/cron/dispatch-outbox` compiles as `ƒ` (dynamic) route alongside `expire-jobs`/`auth-attempts-retention`
- **Test count before feature**: not independently re-derived (Implementer-reported baseline not re-verified pre-USP-044) — the in-scope delta is the 5 new test files (T1: `job-expiry.test.ts` +3, T2: `resolve-job-expiry-email.int.test.ts` +4, T3: `resolve-outbox-email.test.ts` +7 / `dispatch-outbox.int.test.ts` +8, T4: `route.test.ts` +6) = **+28 new tests**, all present and passing.
- **Skipped tests**: none observed in USP-044 surface files.
- **Failures**: none.

---

## Additional checks (per orchestrator brief)

| Check | Result | Evidence |
|---|---|---|
| `resolveJobExpiryEmail` returns `null` on missing job / missing-or-revoked/emailless responsible, without crashing the batch | ✅ | `resolve-job-expiry-email.int.test.ts` — 3 null-path scenarios (no email, revoked grant, nonexistent jobId); `dispatch-outbox.int.test.ts:183-194` proves a `null` resolution flows through the batch as `skipped`, not a crash |
| DI isolation — `shared/lib/outbox/**` does not import `@/modules/jobs` | ✅ | `grep -rn "modules/jobs" src/shared/lib/outbox/` returns only a doc-comment mention in `job-expiry-resolver.port.ts:6`, zero import statements |
| Auth flows (`registerPerson`, `request-password-reset`, `verify-credential-claim`) remain synchronous, not rerouted through Outbox | ✅ | All three call `container.resolve(EMAIL_SENDER_TOKEN).send(...)` inline (`registerPerson.ts:181-182`, `request-password-reset.ts:105-106`, `verify-credential-claim.ts:221-222`); none reference `outbox`/`Outbox` |

---

## Deviations (from Implementer's summary) — verdict

1. **`diasRestantes` hardcoded to `3`** in `resolveJobExpiryEmail` — ✅ **Sound**. Grep confirms the codebase enqueues exactly one `kind` value, `JOB_EXPIRY_D3`, from `enqueue-expiry-reminder.ts`/`run-job-expiration.ts` (both USP-024, unchanged by this diff), and `resolve-outbox-email.ts` only routes `kind==='JOB_EXPIRY_D3'` to this resolver. The constant is correct-by-construction, not a latent bug; the code comment documents the constraint explicitly.
2. **`job-expiry-resolver.port.ts`** — ✅ **Sound**. Confirmed minimal: one type alias (`JobExpiryEmailResolver`) + one `createToken` call, zero logic, zero I/O.
3. **Concurrency test wipes `topic='email'` in `beforeEach`** — ✅ **Sound**. The wipe (`dispatch-outbox.int.test.ts:88-91`) runs before every test in an isolated integration DB (`skipIfNoDb`, no shared prod traffic); mutation 1 above proves the exact-count assertions (`r1.sent+r2.sent===N`, per-address call count `===1`) still discriminate a real double-send — the wipe does not mask a leak, it only prevents cross-test contamination.
4. **`container.ts` deep import + `eslint-disable no-restricted-imports`** — ✅ **Sound**. Confirmed at `container.ts:89-92`: same shape as the existing `DispatchingContentStatusRepository` precedent (`container.ts:108-129`) — one disable comment per deep import line, no change to the ESLint rule's allowlist itself (`.eslintrc`/flat config not touched by this diff).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| E-001 | Implementing | ✅ Verified |
| P-003 | Implementing | ✅ Verified (eval(−) green, structural) |
| P-007 | Implementing | ✅ Verified (eval(−) green, via U44-MN-01) |
| U44-MN-01 | Implementing | ✅ Verified (eval(−) green, mutation-killed) |
| U44-MN-02 | Implementing | ✅ Verified (eval(−) green, mutation-killed) |
| U44-MN-03 | Implementing | ✅ Verified (eval(−) green, mutation-killed) |
| U44-MN-04 | Implementing | ✅ Verified (eval(−) green, mutation-killed) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 4/4 mutations killed
**Must-nots**: 4/4 unit-level `eval(−)` green + P-003/P-007 structurally verified
**Gate**: typecheck 0 errors, lint 0 errors, unit 1466/1466, integration 612/612, build succeeds

**What works**: Full dispatcher lifecycle (claim → resolve → send → mark), concurrency safety proven against the real Postgres lock (not a pre-check), fail-closed cron auth, poison-row exclusion with batch isolation, PII-safe logging, clean DI boundary between `shared` and `jobs`, auth flows correctly left synchronous.

**Issues found**: None blocking.

**Next steps**: None — ready to proceed (merge / next unit). Working tree confirmed restored to pre-verification state (only pre-existing, unrelated dirt remains: `.claude/skills/idsd-spec-driven` deletions, `.agents/.skill-lock.json*`, `src/app/layout.tsx`, `.wolf/task-timer.json`, `.gitignore`, and various untracked `.specs`/`.claude` scaffolding — none touched by this verification session).
