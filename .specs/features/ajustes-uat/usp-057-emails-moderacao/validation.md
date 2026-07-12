# USP-057 — E-mails de decisão de moderação — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-057-emails-moderacao/spec.md`
**Diff range**: `7d459e6~1..7485100` (4 commits: T1 templates, T2 tx-threading, T3 adapter+container, T4 integration)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|------|---------|-------|
| T1 (templates + registro) | ✅ Done | `7d459e6` — 3 templates + union + `render()` + `KNOWN_TEMPLATES` |
| T2 (thread `tx` pelo port) | ✅ Done | `5191156` — port/stub/call-site + mechanical fix to `inactivate-content.int.test.ts` (declared deviation 1) |
| T3 (adapter real + container) | ✅ Done | `24f0247` — `OutboxModerationNotification` + binding swap in `container.ts` |
| T4 (integração e2e) | ✅ Done | `7485100` — 4 integration tests, container real, no override of notification token |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| USP057-01 (aprovação→e-mail, sem motivo) | Outbox row, `template='moderation-approved'`, `to`=emailLogin, `data.motivo` absent | `outbox-moderation-notification.test.ts:92-113` — `expect(arg.data.payload).toMatchObject({to:'author@example.com', template:'moderation-approved', data:{...}})`; `expect(...motivo).toBeUndefined()`. Int: `outbox-moderation-notification.int.test.ts:77-101` | ✅ PASS |
| USP057-02 (devolução→e-mail com motivo) | `template='moderation-returned'`, `data.motivo`=justification | `outbox-moderation-notification.test.ts:115-128`; int `:103-126` — `expect(payload.data.motivo).toBe(MOTIVO)` | ✅ PASS |
| USP057-03 (rejeição→e-mail com motivo) | `template='moderation-rejected'`, `data.motivo`=justification | `outbox-moderation-notification.test.ts:130-148`; int `:128-151` | ✅ PASS |
| USP057-04 (destinatário/título por `ContentKind`) | JOB→`title`/`authorPersonId`; SERVICE idem; CANDIDATE_PROFILE→`headline ?? "Perfil de candidato"`/`personId` | `outbox-moderation-notification.test.ts:150-194` (JOB, SERVICE, CANDIDATE_PROFILE with/without headline) | ✅ PASS |
| USP057-05 (enqueue via `tx`, mesma tx, passthrough AC-044-D2) | `tx.outbox.create`, payload = `EmailMessage` completo, `resolveOutboxEmail` reconhece | `outbox-moderation-notification.test.ts:234-243` (mn-02); `resolve-outbox-email.test.ts:21-53` (passthrough dos 3 templates); int `:99-100,124-125,149-150` (`resolveOutboxEmail(row.payload)` retorna `EmailMessage` válido) | ✅ PASS (enqueue-same-tx literal test); ⚠️ see Gap 1 below re: rollback-removes-row not independently proven |
| USP057-06 (gating: só as 3 decisões) | Transições fora do gate ⇒ nenhuma linha | `outbox-moderation-notification.test.ts:49-88` (unit, 4 non-decision cases incl. reenvio/inativação); int `:153-179` (reenvio real, `emailCount` before/after igual) | ✅ PASS |
| USP057-07 (sem `emailLogin`/CV → no-op) | Sem linha, decisão conclui `ok` | `outbox-moderation-notification.test.ts:197-230` (CV, not-found, no-email, person-not-found) | ✅ PASS |
| USP057-08 (soft-fail no enqueue) | Enqueue falha ⇒ decisão `ok` mesmo assim | `transition-content.test.ts:340` "R2: falha de notificação é soft-fail" — preserved verde (part of full run, 1930/1930 passed) | ✅ PASS |
| USP057-09 (PT-BR, escapeHtml, sem PII) | Assunto/corpo PT-BR; `escapeHtml`; sem CPF/moderador | `moderation-rejected.test.ts:7-59` (assunto/corpo, PII, anti-injeção); análogas p/ approved/returned | ✅ PASS |

**Status**: ✅ All ACs covered — 1 spec-precision-adjacent gap flagged (see Gap 1), not an AC failure per se.

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
|---|---|---|---|
| 1 (MN-01 guard) | `outbox-moderation-notification.ts:86` | `if (notice.from !== IN_MODERATION \|\| !DECISION_TARGETS.has(notice.to))` → `if (false)` (removes the gate entirely) | ✅ Killed — `outbox-moderation-notification.test.ts` "PAUSED→ACTIVE" case fails (`tx.job.findUnique` called when it shouldn't be) |
| 2 (MN-02 guard) | `outbox-moderation-notification.ts:136` | `tx.outbox.create(...)` → `prisma.outbox.create(...)` (global client) on the ACTIVE branch | ✅ Killed — explicit `@usp057-mn-02` test fails (`tx.outbox.create` called 0 times) + 3 other happy-path assertions on `tx.outbox.create` fail |
| 3 (MN-04 guard) | `outbox-moderation-notification.ts:121-126` | Added `actorPersonId: notice.actorPersonId` to the `base` payload object (moderator/actor leak) | ✅ Killed — explicit `@usp057-mn-04` test fails (`Object.keys(data)` includes `actorPersonId`) |

All mutations applied/reverted in the real working tree (git diff confirmed empty before and after each mutation — no worktree/stash needed, single-file edits reverted in place) and re-verified clean via `git status --short` / `git diff --stat` after each.

**Sensor depth**: lightweight (3 targeted mutations, one per gate/guard must-not: MN-01, MN-02, MN-04)
**Result**: 3/3 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| USP057-MN-01 | Enfileirar e-mail fora das 3 decisões | `outbox-moderation-notification.test.ts:49-88` (unit, 4 cases) + int `:153-179` (reenvio real) | ✅ | ✅ (Mutation 1) |
| USP057-MN-02 | Usar `prisma` global (não `tx`) | `outbox-moderation-notification.test.ts:234-243` (`prismaOutboxCreate` not called) + int (row exists in same successful tx) | ✅ | ✅ (Mutation 2) |
| USP057-MN-03 | Enviar/despachar sincronamente (resolver `EmailSender`) | `outbox-moderation-notification.test.ts:245-255` — `expect(resolveSpy).not.toHaveBeenCalledWith(EMAIL_SENDER_TOKEN)` | ✅ | Not separately mutated (spot-checked by code read: adapter never imports/resolves `EMAIL_SENDER_TOKEN`) |
| USP057-MN-04 | PII indevida / dado do moderador no payload | `outbox-moderation-notification.test.ts:257-272` (`Object.keys(data)` closed list, no `actorPersonId`) + `moderation-*.test.ts` (no CPF/`moderador` string) | ✅ | ✅ (Mutation 3) |
| USP057-MN-05 | Migração/dep/dispatch novo | `git diff --stat -- package.json package-lock.json prisma/` → empty; `resolve-outbox-email.ts` diff → only `KNOWN_TEMPLATES` additions, no new `kind` branch | ✅ (verified directly on diff, no code to mutate) | n/a (absence-of-artifact check) |
| USP057-MN-06 | Reverter a decisão por falha do enqueue | `transition-content.test.ts:340` "R2: falha de notificação é soft-fail" — green in full run (1930/1930) | ✅ | Not re-mutated this round (pre-existing test, behavior/wiring unchanged by this feature — `runSoftFail` wrapper untouched) |

**Status**: ✅ All 6 must-nots proven (evidence-or-zero; MN-05 verified by diff inspection rather than a unit assertion, which is the correct evidence form for an absence-of-artifact prohibition).

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code (surgical, no scope creep) | ✅ — touches exactly the files named in tasks.md; stub kept only because `adapters.test.ts` still exercises it |
| No abstractions for single-use code | ✅ |
| Matches existing patterns | ✅ — mirrors `apply-to-job.ts`/`create-referral.ts` (eager enqueue, `satisfies EmailMessage`), `CompanyVerifyHookPort` (tx-threading) |
| Spec-anchored outcome check | ✅ — see AC table above, exact values (template names, `to`, `data.motivo`) asserted, not just "called" |
| Per-layer coverage (unit domain 1:1, integration happy+gating+no-op) | ✅ |
| Every test maps to a spec requirement | ✅ — every test file/case is tagged `@usp057-NN` or `@usp057-mn-NN` |
| Documented guidelines followed | CLAUDE.md §Testing Requirements, `tasks.md` Test Coverage Matrix — followed |

---

## Edge Cases

- [x] Autor sem `emailLogin` → no-op — `outbox-moderation-notification.test.ts:216-222`
- [x] `ContentKind === CV` → no-op — `outbox-moderation-notification.test.ts:198-206`
- [x] `CANDIDATE_PROFILE` sem `headline` → fallback "Perfil de candidato" — `outbox-moderation-notification.test.ts:181-194`
- [x] Enqueue lança (falha de banco) → soft-fail preservado — `transition-content.test.ts` "R2" (pre-existing, still green)
- [ ] ⚠️ Rollback da decisão ⇒ linha do Outbox não persiste — **not independently proven** (see Gap 1)
- [x] Reenvio do autor (`AWAITING_ADJUSTMENTS→IN_MODERATION`) → nenhum e-mail — int `:153-179` (declared deviation 3, in lieu of a CANDIDATE_PROFILE pause scenario — FSM-legitimate substitute, still proves MN-01 end-to-end)
- [ ] ⚠️ Dois moderadores concorrentes → no máximo 1 e-mail — not directly tested in this diff (the existing R3 concurrency test in `transition-content.int.test.ts:289-312` fails at `updateStatus` *before* the enqueue is ever reached, so it doesn't exercise "second decision aborts before enqueue" as a race against an in-flight enqueue; it does correctly prove the earlier-arriving conflict never reaches the notification port)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build` + scoped `npm run test:integration` (isolated to `outbox-moderation-notification.int.test.ts`, `inactivate-content.int.test.ts`, `transition-content.int.test.ts`)
- **typecheck**: ✅ clean (`tsc --noEmit`, 0 errors)
- **lint**: ✅ clean (`eslint .`, 0 errors)
- **unit (`npm run test`)**: ✅ 273 files / 1930 tests passed, 0 failed
- **build**: ✅ `next build` succeeded, all routes compiled
- **integration (scoped, isolated container real)**: ✅ 3 files / 26 tests passed (`outbox-moderation-notification.int.test.ts` alone: 4/4 passed)
- **Skipped tests**: none observed in scope
- **Failures**: none in scope. (Pre-existing jobs/identity flakes mentioned in the deviation summary were not encountered in this run — out of scope regardless per instructions.)

---

## Fix Plans

None required to reach PASS. One recommended follow-up (non-blocking):

### Recommendation 1: Explicit atomicity (rollback) test for the Outbox enqueue

- **Gap**: No test forces a failure *after* `tx.outbox.create` succeeds but *before* the `withAudit` transaction commits (e.g., mock `CompanyVerifyHookPort.onContentActivated` to throw for a `to===ACTIVE` transition), then asserts the Outbox row is gone. The existing R3 concurrency test (`transition-content.int.test.ts:289-312`) rolls back *before* reaching the enqueue step, so it doesn't cover this specific direction of P-007/MN-02.
- **Why non-blocking**: The property is inherited for free from Prisma's `$transaction` semantics (any throw inside the callback rolls back every write in it) — the same guarantee already relied upon, untested, for the pre-existing `CompanyVerifyHookPort` writes in the same tx. This isn't new risk introduced by USP-057; it's a pre-existing untested edge of the transaction boundary.
- **Suggested fix task**: Add one integration case to `outbox-moderation-notification.int.test.ts`: override `COMPANY_VERIFY_HOOK_TOKEN` with a hook that throws on `onContentActivated`, approve a `CANDIDATE_PROFILE` (jk — hook only fires for JOB per USP-017; use a `JOB` fixture instead), assert `transitionContent` returns `{ok:false}` and `prisma.outbox.count({where:{topic:'email'}})` is unchanged (no orphan row).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| USP057-01 | Pending | ✅ Verified |
| USP057-02 | Pending | ✅ Verified |
| USP057-03 | Pending | ✅ Verified |
| USP057-04 | Pending | ✅ Verified |
| USP057-05 | Pending | ✅ Verified (enqueue-in-tx literal test green; rollback-removes-row not independently tested — see Recommendation 1) |
| USP057-06 | Pending | ✅ Verified |
| USP057-07 | Pending | ✅ Verified |
| USP057-08 | Pending | ✅ Verified |
| USP057-09 | Pending | ✅ Verified |
| USP057-MN-01 | Pending | ✅ Verified |
| USP057-MN-02 | Pending | ✅ Verified |
| USP057-MN-03 | Pending | ✅ Verified |
| USP057-MN-04 | Pending | ✅ Verified |
| USP057-MN-05 | Pending | ✅ Verified |
| USP057-MN-06 | Pending | ✅ Verified |

---

## Declared Deviations — Verifier Assessment

1. **Fix to `inactivate-content.int.test.ts` assertion (tx as 1st arg, folded into T4 commit)** — Verified correct: `sendModerationDecision` signature changed to `(tx, notice)` in T2; this pre-existing spy-based test needed the mechanical update to `expect(notifySpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(...))`. Confirmed via diff and green run. ✅ Legitimate.
2. **`{...} satisfies EmailMessage` inline instead of a typed variable** — Verified as matching the exact existing precedent in `apply-to-job.ts:119` (`} satisfies EmailMessage;` on the object literal, not on an annotated variable declaration). ✅ Legitimate, not a deviation from convention.
3. **T4 non-decision scenario uses reenvio (`AWAITING_ADJUSTMENTS→IN_MODERATION`) instead of a `CANDIDATE_PROFILE` pause** — Verified: `CandidateProfile`'s FSM does not expose a pause/unpause transition in this scope (only JOB/SERVICE do); reenvio is a legitimate, spec-listed non-decision edge case (`from ≠ IN_MODERATION`) and exercises the same MN-01 gate end-to-end with a real Postgres transition. ✅ Legitimate substitute.
4. **Flakes pre-existing in jobs/identity, out of scope** — Not encountered during this verification's runs (full unit suite: 0 failures; scoped integration: 0 failures). Accepted as declared, unaffected by this feature's diff surface.

---

## Summary

**Overall**: ✅ **PASS**

**Spec-anchored check**: 9/9 ACs matched spec outcome (1 noted as partially-evidenced re: rollback direction, not a failure)
**Sensor**: 3/3 mutations killed
**Must-nots**: 6/6 green
**Gate**: typecheck ✅ · lint ✅ · unit 1930/1930 ✅ · build ✅ · integration (scoped) 26/26 ✅

**What works**: All 3 templates render PT-BR content correctly with `escapeHtml` and no PII/moderator leakage; the adapter correctly gates on `from=IN_MODERATION → {ACTIVE,AWAITING_ADJUSTMENTS,REJECTED}`; enqueue uses the transactional client (never the global `prisma`); no email is sent synchronously; the container binds the real adapter (`OutboxModerationNotification`) in production, with the stub retained only for `adapters.test.ts`; zero migration, zero new dependency, zero new dispatch path; `runSoftFail` and the R2 soft-fail guarantee are intact; integration tests against real Postgres (container real, no notification-port override) confirm all 3 decisions enqueue the correct row and `resolveOutboxEmail` passthrough works for all 3 templates.

**Issues found**: None blocking. One non-blocking recommendation (Recommendation 1 above) to add a forced-failure integration test proving the Outbox row rolls back together with the decision when a later step in the same transaction throws — currently this is only guaranteed structurally (same `tx`), not empirically tested, for this specific direction of atomicity.

**Next steps**: Ready to merge as-is. Recommendation 1 can be picked up as a small hardening follow-up (does not block this USP).
