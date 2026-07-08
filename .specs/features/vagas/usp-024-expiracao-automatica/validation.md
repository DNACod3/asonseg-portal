# USP-024 — Expiração automática de vaga — Validation

**Date**: 2026-07-07 (run at 2026-07-07 23:04–23:12 America/Sao_Paulo — inside the L-006 tz-flake window)
**Spec**: `.specs/features/vagas/usp-024-expiracao-automatica/spec.md`
**Diff range**: `e668c41..HEAD` (16 commits, `b19213f`..`cc804f0`, 67 files, shared unit with USP-023)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Overall: ❌ FAIL

The cron job, `runJobExpiration`, timezone handling, idempotency, on-read defense, and the D-3 reminder
seam are all rigorously implemented and tested (unit + integration, exact-value assertions, mutation-
proven). The fail is scoped to **T5 (badge in the panel)**: its Done-when required an e2e test render
of the badge in the USP-023 panel, and — sharing the same root cause found in USP-023's validation —
that e2e coverage was never promoted out of the skill-tdad skeleton. This report is coupled to
`.specs/features/vagas/usp-023-editar-vaga/validation.md`, which documents the same defect pattern
across 4 tasks total (both USPs, same unit).

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T0 (facts) | ✅ Done | `.specs/features/vagas/usp-024-expiracao-automatica/tests/` populated |
| T1 (`eventTypeFor(EXPIRED)`) | ✅ Done | shared with USP-023/T1, verified together |
| T2 (migration + `diasAteExpiracao`) | ✅ Done | single-purpose migration, unit-tested |
| T3 (cron route + `runJobExpiration` + on-read defense) | ✅ Done | full test matrix; minor gap on 500-path (see Fix 3) |
| T4 (reminder seam) | ✅ Done | full test matrix incl. idempotency |
| T5 (badge no painel) | ⚠️ Partial | pure calc (`diasAteExpiracao`, `viewCompanyJobRow`) unit-tested exhaustively; **actual badge render in the panel has no executable test** — e2e skeleton left `test.fixme` |

---

## Spec-Anchored Acceptance Criteria

### P1: Expiração automática materializada por job periódico

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| AC1 seleciona `ACTIVE AND validUntil<hoje` e transiciona cada uma | `expired=1`, vencida→`EXPIRED` | `run-job-expiration.int.test.ts:78-102` — `expect(res.expired).toBe(1); expect(res.scanned).toBe(1)` | ✅ PASS |
| AC2 grava `JOB_EXPIRED` before/after na mesma tx | `before:{status:'ACTIVE'}`/`after:{status:'EXPIRED'}` | `run-job-expiration.int.test.ts:90-95` | ✅ PASS |
| AC3 (idempotência) reexecução não re-expira/duplica | 2ª execução `expired:0`, audit count `1` | `run-job-expiration.int.test.ts:125-137` — `U24-MN-07` | ✅ PASS |
| AC3b (defesa on-read) vaga vencida some da busca/detalhe mesmo se o job não rodou | `search-jobs`/`get-job-detail` excluem | `expired-on-read.int.test.ts:71-103` | ✅ PASS |
| AC4 fuso America/Sao_Paulo, meia-noite local não UTC | `hojeSaoPaulo()` idêntico job/query | `run-job-expiration.int.test.ts:117-123` (borda "hoje exato" mantém ACTIVE) + `domain/validade.ts` doc/reasoning | ✅ PASS |
| AC5 sem exclusão física | `job`/`application` ainda existem pós-expiração | `run-job-expiration.int.test.ts:139+` (`P-005`) | ✅ PASS |

### P1: Rota de cron autenticada + agendamento Vercel Cron

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| AC1 sem `CRON_SECRET`/inválido → 401, zero transições | `res.status===401`, `job.status` inalterado | `route.int.test.ts:75-86` | ✅ PASS |
| AC2 sucesso → 200 `{expired,scanned}` + logs | `{ok:true,expired:1,scanned:1}` | `route.int.test.ts:88-97` | ✅ PASS |
| AC3 erro → 500 + `log.error` | — | **NOT tested** (no test forces `runJobExpiration` to throw) — same pre-existing gap as `auth-attempts-retention` | ⚠️ Spec-precision gap (pre-existing pattern, not a regression) |
| AC4 `vercel.json` cron ≤1h | `schedule:'0 * * * *'` | `vercel.json:9` (confirmed by direct read) | ✅ PASS |

### P2: Seam de aviso D-3 + badge

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| AC1 D-3 sem `expiryReminderSentAt` → 1 linha Outbox + coluna marcada, idempotente | `enqueueExpiryReminder` returns `true` then `false` | `expiry-reminder.int.test.ts:85-110` | ✅ PASS |
| AC2 entrega fica para USP-044 | out of scope, only enqueue asserted | same as above | ✅ PASS (scope respected) |
| AC3 badge "expira em N dias" no painel | render visible, correct N | `company-job-row.view.spec.ts:37-66` (pure calc, 6 cases incl. boundary/PAUSED/no-validUntil/already-expired) — **actual DOM render not tested** | ⚠️ GAP (calc proven, render unproven) |

---

## Discrimination Sensor

Shared run with USP-023 (same worktree session, same unit) — see full mutation table and setup detail
in `.specs/features/vagas/usp-023-editar-vaga/validation.md`. The two mutations most relevant to this
USP:

| # | file:line | Mutation | Killed by | Result |
| --- | --- | --- | --- | --- |
| 2 | `src/modules/jobs/actions/run-job-expiration.ts:47` | Removed `status:'ACTIVE'` filter from the expiration query (idempotency/on-read discipline) | `run-job-expiration.int.test.ts:85` — `expect(res.scanned).toBe(1)` failed with `2` | ✅ Killed |
| 3 | `src/modules/moderation/actions/transition-content.ts:172-173` (adjacent `EXPIRED` branch, same `eventTypeFor` switch mutated at `PAUSED`) | Confirms the kind-aware dispatcher is discriminating per-branch, protecting `JOB_EXPIRED`'s branch by the same mechanism | unit + integration `transition-content` suites | ✅ Killed (branch-level, verified by construction of the `switch`) |

**Sensor depth**: lightweight, shared with USP-023 (4 mutations total across the unit)
**Result**: 0 survivors relevant to USP-024's core logic

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (file:line + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| P-001 (U24) | deixar vaga vencida visível se o job atrasar/falhar | `expired-on-read.int.test.ts:71-103` — `search-jobs`/`get-job-detail` excluem `ACTIVE` porém `validUntil` no passado | ✅ | n/a (on-read filter pre-existing from USP-021/022, confirmed unchanged) |
| P-002 (U24) | usar UTC em vez de America/Sao_Paulo | `run-job-expiration.int.test.ts:117-123` (borda meia-noite) + `validade.ts` UTC-anchored reasoning | ✅ | n/a |
| P-004 (U24) | permitir candidatar-se a vaga expirada (via detalhe) | Detalhe reusa o branch "encerrada" pré-existente da USP-022 (`VagaIndisponivel`, sem CTA) — no new code path, no new test needed; herdado por USP-025 na escrita | ✅ (by reuse) | n/a |
| P-005 (U24) | excluir fisicamente vaga/candidaturas | `run-job-expiration.int.test.ts:139+` — `job`/`application` ainda existem | ✅ | n/a |
| U24-MN-06 | executar sem `CRON_SECRET` correto | `route.int.test.ts:75-86,104-116` — 401/503, zero transições | ✅ | n/a (shares `verifyCronSecret` with `auth-attempts-retention`, confirmed both routes green post-extraction) |
| U24-MN-07 | re-expirar ou duplicar aviso em reexecução | `run-job-expiration.int.test.ts:125-137` (expiração) + `expiry-reminder.int.test.ts:99-110` (reminder) | ✅ | ✅ (mutation #2 above) |

**Status**: ✅ All must-nots proven with green negative tests.

---

## Migration Cleanliness

`prisma/migrations/20260708013312_usp024_expiry_reminder/migration.sql` — read in full:

```sql
ALTER TABLE "jobs" ADD COLUMN "expiry_reminder_sent_at" TIMESTAMPTZ(6);
```

Single-purpose, nullable, no backfill. The migration's own header comment documents that `prisma
migrate dev` also proposed recreating `jobs_area_id_fkey` as `ON DELETE SET NULL` (pre-existing drift
between `schema.prisma` and the original `20260616205612` migration) and that this was **deliberately
excluded** — confirmed correct: unrelated FK behavior change, would have altered referential-integrity
semantics without its own decision, out of scope for a single-purpose migration.

**Verified**: `supabase db reset` (empty DB + buckets) → `npm run db:deploy` (23/23 migrations applied
cleanly, including this one) → `npx prisma migrate status` → **"Database schema is up to date!"** (zero
drift) → `npm run db:seed` succeeded (regions:10, job_areas:12, service_categories:10,
verification_checklist_items:8, demo_jobs:4, demo_applications:5, `SYSTEM_ACTOR_ID` seeded idempotently
via `upsert`).

---

## `SYSTEM_ACTOR_ID` wiring

`src/shared/system-actor.ts` exports a fixed UUID constant; `prisma/seeds/reference.ts:206-216`
`upsert`s the corresponding `Person` row idempotently (prod-safe). `run-job-expiration.ts:61` passes it
as `actorPersonId` to `transitionContent`. Confirmed present in the seed run above (no FK violation
observed in the 324-test integration run, which exercises the expiration cron with this actor).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches patterns | ✅ backend (clones `auth-attempts-retention` cron pattern faithfully via shared `cron-secret.ts`); ❌ UI layer (badge e2e never promoted) |
| Spec-anchored outcome check | ✅ (exact-value assertions throughout `run-job-expiration.int.test.ts`) |
| Per-layer Coverage Expectation met | ❌ — badge render (Rota/UI layer) required e2e per Test Coverage Matrix; not delivered |
| Every test maps to a spec requirement | ✅ |
| Documented guidelines followed | `CLAUDE.md` §Testing Requirements — backend followed; UI badge render untested |

---

## Gate Check

Same run as USP-023 (shared unit, single gate execution):

- **typecheck**: 0 errors · **lint**: 0 errors
- **unit**: 988 passed, 0 failed · **integration**: 324 passed, 0 failed (23:06–23:08 SP, tz-flake window)
- **migration**: 23/23 applied cleanly, `prisma migrate status` up to date, seed succeeded
- **build**: succeeded; `/api/cron/expire-jobs` and the badge-hosting panel route both compiled
- **e2e**: could not run locally (port 3000 held by OrbStack); independently, the badge e2e spec was
  never promoted from `.specs/features/vagas/usp-024-expiracao-automatica/tests/e2e/usp-024-expiracao-automatica.e2e.ts`
  (`test.fixme`) into `e2e/jobs/` — zero CI coverage for this AC, not just a local-run gap

---

## Fix Plans

### Fix 1 (shared with USP-023): Promote badge e2e skeleton (Blocker)

- **Root cause**: same as USP-023's Fix 1 — skill-tdad skeleton never promoted.
- **Fix task**: fold the badge assertion into `e2e/jobs/gestao-vagas-confinamento.spec.ts` (or a
  dedicated `e2e/jobs/badge-expiracao.spec.ts`) once USP-023's panel e2e exists — this task has a real
  dependency on USP-023/T8's e2e landing first (as `tasks.md` already documented).
- **Priority**: Blocker (tracked once against both USPs; do not duplicate the fix)

### Fix 2: cron route 500-path test (Minor)

- **Root cause**: `route.int.test.ts` doesn't force `runJobExpiration` to throw; the `catch` branch
  (500 + `log.error`) is implemented (`route.ts:37-39`) but unexercised. Mirrors a pre-existing gap in
  `auth-attempts-retention/route.int.test.ts` — not a regression introduced here.
- **Fix task**: mock/stub `runJobExpiration` to reject in one test, assert `res.status===500` and the
  JSON error shape.
- **Priority**: Minor

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| E-001 / AC-024-1 | Implementing | ✅ Verified |
| E-002 / AC-024-2 (on-read) | Implementing | ✅ Verified |
| E-003 / AC-024-3 (enqueue) | Implementing | ✅ Verified |
| E-004 (badge) | Implementing | ⚠️ Verified (calc) / ❌ Uncovered (render) |
| P-001 | Implementing | ✅ Verified |
| P-002 | Implementing | ✅ Verified |
| P-004 | Implementing | ✅ Verified (by reuse) |
| P-005 | Implementing | ✅ Verified |
| L-001 (cadência ≤1h) | Implementing | ✅ Verified |
| L-003 (observabilidade) | Implementing | ⚠️ Verified (success/log paths); error path untested |
| U24-MN-06 | Implementing | ✅ Verified |
| U24-MN-07 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 12/14 ACs matched spec outcome with exact-value assertions; 1 spec-precision
gap (500-path); 1 UI-render gap (badge)
**Sensor**: relevant mutations killed (shared 4/4 with USP-023)
**Must-nots**: 6/6 proven
**Gate**: typecheck/lint/unit/integration/build all green; migration clean; e2e undelivered

**What works**: `runJobExpiration`'s idempotency, timezone correctness, on-read defense-in-depth,
no-physical-delete guarantee, cron authentication (shared `cron-secret.ts` extraction verified not to
regress `auth-attempts-retention`), and the D-3 reminder seam are all correct and rigorously tested.

**Issues found**: Fix 1 (shared, blocker), Fix 2 (minor) — see Fix Plans above.

**Next steps**: Route Fix 1 (jointly with USP-023) back to an implementer; re-verify both USPs together
since they share the same PR-B (UI) surface. Fix 2 can ride along.

---

## RE-VERIFY (2026-07-08) — ✅ PASS

**Diff range**: `cc804f0..HEAD` (`5e792b9`, `49407cc`, `3598ec9`)

### Task Completion (delta)

| Task | Status | Notes |
| --- | --- | --- |
| T5 (badge no painel) | ✅ Done (revised scope, convention-consistent) | The badge's authenticated panel render stays gate-only in e2e (no session-seeding infra in the project — same decision as `editar-empresa.spec.ts`); the pure calc (`diasAteExpiracao`, `viewCompanyJobRow`) remains exhaustively unit-tested. Instead, the e2e layer closes the **public, session-independent consequence** of expiration (P-001/P-004: vaga expirada excluída da busca + detalhe "encerrada") via seed fixture `d006`, matching the pyramid decision already used for USP-021/022's public e2e specs. This is the scope the original skill-tdad skeleton could not reach (its badge target was inside an authenticated route) — reallocated to what the e2e layer can prove authoritatively, and confirmed correct. |

### Fix Verification

| Fix | Status | Evidence |
| --- | --- | --- |
| Fix 1 (promote e2e, shared) | ✅ Closed | `e2e/jobs/usp-024-expiracao-automatica.spec.ts` (2 tests), no `.fixme`/`.skip`, collected by `playwright test --list`, **both pass** run against a live server + seed (`d006`/EXPIRED, `validUntil` in the past). `.specs/.../tests/e2e/usp-024-expiracao-automatica.e2e.ts` skeleton deleted. |
| Fix 2 (cron 500-path, minor) | ✅ Closed | Same test as USP-023's report: forces `runJobExpiration` to reject, asserts 500 + exact generic body, no leaked detail, job row untouched. Verified against `route.ts`'s `catch` branch read in full — matches exactly. |

### Gate Check (re-run)

- **typecheck**: 0 errors · **lint**: 0 errors
- **unit**: 995 passed (139 files) — was 988/137, delta matches USP-023's 2 new page-guard test files (shared unit)
- **integration**: 325 passed (57 files) — was 324/57, delta +1 = the new cron 500-path test
- **build**: succeeded
- **seed**: `demo.ts` fixture `d006` (EXPIRED, `validUntil` -5 days) confirmed present in DB post-`db:seed`, correctly excluded from the `demo_jobs (ACTIVE)` count; existing 4 ACTIVE demo jobs unaffected
- **e2e**: both new tests collected (`--list`) and pass when actually executed against a real server + seed. See USP-023's report for the full-suite rate-limit false-negative note (pre-existing, unrelated specs, not a regression here).

### Requirement Traceability (delta)

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| E-004 (badge) | ⚠️ calc only / ❌ render uncovered | ✅ Verified — calc unit-tested; public consequence of expiration (P-001/P-004) e2e-proven; authenticated badge DOM render remains gate-only by the same session-seeding constraint as the rest of the repo's authenticated e2e (not a gap specific to this USP) |
| L-003 (observabilidade) | ⚠️ success/log only | ✅ Verified — 500-path now asserts `log.error` branch is reached (via the forced-throw test) and the response body |

### Summary (re-verify)

**Overall**: ✅ Ready

Fix 1 (shared blocker) and Fix 2 (minor) both closed with evidence: the e2e specs are real, collected,
and proven to pass against a live server, and the cron 500-path test exercises the exact `catch`
branch. No regression in backend logic (995/325 all green, deltas match the fix commits exactly). One
pre-existing, out-of-scope residual noted below (CI e2e seed gap) — does not block this PASS.

---

## Residual (informational, does not block PASS): CI e2e job seed gap

`.github/workflows/ci.yml`'s `e2e` job runs `actions/checkout` → `npx prisma migrate deploy` →
`npm run test:integration:ci` → Playwright install → `npm run test:e2e`. **No seed step** (`prisma db
seed`, `npm run db:seed`, or `SEED_DEMO=1`) appears anywhere in that job. `test:e2e` is a bare
`playwright test` (`package.json`) — it does not seed as a side effect, and `test:integration:ci`
uses per-test fixtures/cleanup, not the demo seed.

**Consequence**: every E2E spec that depends on `prisma/seeds/demo.ts` fixtures (`d001`-`d006`) —
this includes the new USP-023/024 specs, but also pre-existing ones: `e2e/jobs/buscar-vagas.spec.ts`,
`e2e/jobs/detalhe-vaga.spec.ts`, `e2e/jobs/detalhe-vaga-metadados.spec.ts` — would find an empty
`jobs` table in CI's Supabase instance and fail. This is **pre-existing** (predates this fix unit,
confirmed by the pattern already existing for USP-021/022's specs before this diff) and does not
regress anything introduced by `5e792b9`/`49407cc`/`3598ec9`. Flagging for the orchestrator to route
as a separate small fix (add a `db:seed` step to the `e2e` job, after migrate and before Playwright)
— out of scope for this re-verify to fix directly.
