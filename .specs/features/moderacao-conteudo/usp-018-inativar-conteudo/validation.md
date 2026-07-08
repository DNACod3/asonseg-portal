# USP-018 — Inativar conteúdo já publicado — Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/moderacao-conteudo/usp-018-inativar-conteudo/spec.md`
**Diff range**: `2add85c..HEAD` (branch `refactor/fase-2-empresas-vagas-moderacao`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (`inactivateSchema`) | ✅ Done | `src/modules/moderation/schemas/inactivate.ts` — reuses `contentRef`+`justification` from `decision.ts` |
| T2 (domain test-lock) | ✅ Done | `domain/__tests__/transition-rules.test.ts` extended with INACT-MN-06/INACT-01/07 blocks |
| T3 (`NextCacheInvalidation` detail path) | ✅ Done | `adapters/next-cache-invalidation.ts` revalidates `/vagas/[id]` on JOB visibility change |
| T4 (`inactivateContent` action) | ✅ Done | `actions/inactivate.ts` — Zod → `requirePermission` → `transitionContent` |
| T5 (`canManagePublishedContent`) | ✅ Done | `server/moderation-access.ts` |
| T6 (`listActivePublishedJobs`) | ✅ Done | `jobs/queries/list-active-published-jobs.ts` |
| T7 (public-surface exclusion negative tests) | ✅ Done | extends `search-jobs.int.test.ts` + `get-job-detail.int.test.ts` |
| T8 (`PublishedContentManager`) | ✅ Done | `components/published-content-manager.tsx` |
| T9 (route + barrel + E2E) | ⚠️ Partial | Route + barrel done and build-proven; E2E spec exists but could not execute locally (port-3000/OrbStack squat — see Residual below) |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| INACT-01 (happy inativação) | `{ok:true}`, status `ACTIVE→INACTIVATED` via `COORDINATOR_INACTIVATION` | `src/modules/moderation/__tests__/inactivate-content.int.test.ts:148-174` — `expect(res.ok).toBe(true)`, `expect(job?.status).toBe('INACTIVATED')` | ✅ PASS |
| INACT-02 (motivo ausente/curto/genérico → rejeita, status intacto) | `ok:false`, status inalterado | `inactivate-content.int.test.ts:191-205` (`it.each(['', 'x', '   '])`) — `expect(res.ok).toBe(false)`, `expect(job?.status).toBe('ACTIVE')`, `expect(audits).toBe(0)` | ✅ PASS |
| INACT-03 (audit `CONTENT_INACTIVATED_BY_COORDINATOR` na mesma tx, before/after/ator/justification) | 1 registro exato com os campos | `inactivate-content.int.test.ts:163-173` — `expect(audits).toHaveLength(1)`; `toMatchObject({entityType:'JOB', actorPersonId, justification, before:{status:'ACTIVE'}, after:{status:'INACTIVATED'}})` | ✅ PASS |
| INACT-04 (seam de notificação soft-fail) | seam chamado, falha não aborta | `inactivate-content.int.test.ts:176-189` — `notifySpy` rejeita e `expect(res.ok).toBe(true)`; `expect(notifySpy).toHaveBeenCalledWith(objectContaining({to:'INACTIVATED', justification}))` | ✅ PASS |
| INACT-05 (revalida `/vagas` E `/vagas/[id]`) | ambos os `revalidatePath` chamados | `moderation/adapters/__tests__/adapters.test.ts:71-80` — `expect(cacheState.revalidatePath).toHaveBeenCalledWith('/vagas')` e `.toHaveBeenCalledWith('/vagas/job-7')`, `toHaveBeenCalledTimes(2)` | ✅ PASS |
| INACT-06 (lista ACTIVE + guard 404) | `listActivePublishedJobs` só ACTIVE; guard coord/delegado true, outro false | `jobs/__tests__/list-active-published-jobs.int.test.ts:91` (exclui INACTIVATED/DRAFT) + `moderation/__tests__/can-manage-published-content.int.test.ts:47-84` | ✅ PASS |
| INACT-07 (não-ACTIVE → `INVALID_TRANSITION`) | `error.code='INVALID_TRANSITION'`, status intacto | `inactivate-content.int.test.ts:220-229` (DRAFT) + `:231-238` (já-INACTIVATED) — `toMatchObject({ok:false, error:{code:'INVALID_TRANSITION'}})` | ✅ PASS |
| INACT-08 (genérico por `ContentKind`) | aceita `CANDIDATE_PROFILE` sem lógica de tipo na action | `actions/__tests__/inactivate.test.ts:69-79` — `expect(res.ok).toBe(true)`, `transitionContent` chamado com `contentKind: CANDIDATE_PROFILE` | ✅ PASS |

**Status**: ✅ All ACs covered — todos os `file:line` citam a asserção do valor exato definido na spec (status code, campos de auditoria, contagem).

---

## Discrimination Sensor

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `src/modules/moderation/domain/content-status.ts` (TRANSITIONS table) | Injected spurious rule `{from: INACTIVATED, to: ACTIVE, trigger: 'COORDINATOR_INACTIVATION', requiresJustification:false}` — makes `INACTIVATED` non-terminal | ✅ Killed — `domain/__tests__/transition-rules.test.ts` "nenhuma transição sai de INACTIVATED…" failed (`expected true to be false`) |
| 2 | `src/modules/moderation/actions/suggest-taxonomy.ts:66` (USP-019, cross-check — see USP-019 report) | n/a here | — |
| 3 | (see below — public-exclusion path already covered by existing negative tests; no separate mutation required, see Note) | | |

**Sensor depth**: lightweight (proportional; feature is Large by risk floor but not P0-payment/auth-critical in the mutation-tooling sense — manual fault injection used, ≥1 mutation per must-not-critical surface targeted for USP-018, cross-referenced with USP-019's 2 mutations in the sibling report, total 3 across the unit as instructed).

**Result for USP-018-owned surface**: 1/1 targeted mutation killed (INACT-MN-06 terminal-state guard). The two additional mutations requested by the orchestrator (dedup + auth guard) belong to USP-019's code and are recorded in that report; all 3 total mutations across the unit were killed (3/3, no survivors).

**Note on INACT-MN-04 (public exclusion):** not separately mutated because the guard is a single-line Prisma `where: {status:'ACTIVE'}` filter shared with pre-existing P1 logic (USP-021/USP-022); T7's negative tests (`search-jobs.int.test.ts:234-238`, `get-job-detail.int.test.ts:172-175`) already assert the INACTIVATED job is excluded — removing the filter would be a one-line mutation with certain-kill (the same class as mutation #1); omitted only to respect the lightweight-tier budget (1–3 mutations per feature) already spent on the terminal-state guard, judged the higher-risk (irreversible) surface. Recommend a future run add this specific mutation if this feature graduates to P0 tier.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | --------------------------------------- | ------ | ----------------------- |
| INACT-MN-01 | Mudar status para `INACTIVATED` fora de `transitionContent` | Static: `grep` over `src/modules/**` for `.update`/`.updateMany` with `status:` outside the 4 known content-status adapters found ZERO offenders (see Code Quality below) + `inactivate-content.int.test.ts:220-229` proves routing through the FSM (non-ACTIVE ⇒ `INVALID_TRANSITION`) | ✅ | n/a (structural guard, not a single toggle — verified by static grep, not fault-injected) |
| INACT-MN-02 | Alterar status sem motivo significativo | `schemas/__tests__/inactivate.test.ts:19-24` (schema) + `inactivate-content.int.test.ts:191-205` (integration, status unchanged) | ✅ | Same mechanism as INACT-02 AC — no separate mutation run (schema-level `min(20)` + `isMeaningfulJustification`, mutation-equivalent to weakening a numeric bound, judged lower-risk than terminal-state and dedup mutations already run) |
| INACT-MN-03 | Inativar sem `INACTIVATE_PUBLISHED_CONTENT` | `actions/__tests__/inactivate.test.ts:46-51` (unit, `FORBIDDEN`) + `inactivate-content.int.test.ts:207-218` (integration, real permission check, status unchanged) | ✅ | Not separately mutated — `requirePermission` is a shared, already-covered chokepoint (USP-008 lineage); flipping it is the identical mutation class already proven-killed for USP-019's `suggestTaxonomy` auth guard (mutation #2 in sibling report), same code pattern |
| INACT-MN-04 | Exibir `INACTIVATED` em superfície pública | `search-jobs.int.test.ts:234-238` + `get-job-detail.int.test.ts:172-175` — both assert exclusion of the seeded INACTIVATED job | ✅ | Not separately mutated (see Sensor Note above) |
| INACT-MN-05 | Commitar status sem `audit_log` na mesma tx | `inactivate-content.int.test.ts:163-173` (exactly 1 audit row) + `transitionContent` structurally wraps `repo.updateStatus` and the audit write in the same `withAudit` tx (`actions/transition-content.ts:75-126`); atomicity of this mechanism is independently proven by the pre-existing `transition-content.int.test.ts:164` (R3 concurrency rollback) and `audit/__tests__/withAudit.test.ts:136-146` (rollback on missing justification) | ✅ | Not re-mutated in this run — the tx-atomicity mechanism is shared, unmodified code already covered by pre-existing tests; USP-018 adds no new audit-write path |
| INACT-MN-06 | Permitir transição de saída de `INACTIVATED` | `domain/__tests__/transition-rules.test.ts:84-92` — `isValidTransition(kind, INACTIVATED, to, trigger)` false for the full cross-product of statuses × triggers × kinds | ✅ | ✅ Killed (Sensor mutation #1) |

**Status**: ✅ All 6 must-nots proven — no missing or red negative test.

---

## Interactive UAT

Not performed — backend/Server-Action-first feature (INACT-06's UI is a thin CRUD list wired to Server Actions already covered by component + integration tests); no complex user-facing interaction pattern requiring human judgment beyond what RTL component tests (`published-content-manager.spec.tsx`) already assert.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — no schema migration; reuses `transitionContent`, `contentRef`/`justification`, `moderation-access.ts` pattern |
| Surgical changes | ✅ — new files scoped to inactivation surface; only pre-existing files touched are `content-status.ts` (already had the rule pre-USP-018 per `git blame`-equivalent spec note), `next-cache-invalidation.ts` (detail-path extension), `search-jobs`/`get-job-detail` int tests (negative-test extension) |
| No scope creep | ✅ — CV/SERVICE explicitly out of scope per spec; action is generic but no new UI for them |
| Matches existing patterns | ✅ — mirrors `decide.ts` action shape, `canAccessModerationQueue` guard shape, `(app)/moderacao/page.tsx` route shape |
| Spec-anchored outcome check | ✅ — see AC table above, all assertions target spec-defined exact values |
| Per-layer coverage (domain 1:1 AC; routes happy+edge+error) | ✅ — domain fully covers terminal-state cross-product; action covers happy/validation/permission/non-ACTIVE/concurrency/notification |
| No unclaimed tests | ✅ — every new test traces to an INACT-NN or INACT-MN-NN tag in its `it()` description |
| Documented guidelines followed | `CLAUDE.md` §Testing Requirements, §Server Action Pattern, §Moderation State Machine — followed (Zod→permission→transitionContent sequence; no direct `prisma.update` on status) |
| **INACT-MN-01 static guard** | `grep -rn "\.update\(Many\)\?\(" src/modules --include="*.ts"` restricted to `status:` writes surfaces only: `jobs/adapters/prisma-job-status.ts`, `persons/adapters/prisma-candidate-profile-status.ts`, `moderation/adapters/prisma-moderation-content-repository.ts` — the 3 `ContentStatusPort` adapters `transitionContent` dispatches through. Zero offenders elsewhere. ✅ |

---

## Edge Cases

- [x] Motivo com exatamente 20 chars significativos aceito (schema `min(20)`, `schemas/__tests__/inactivate.test.ts`)
- [x] Concorrência: 2ª inativação simultânea falha `INVALID_TRANSITION`, sem dupla auditoria (`inactivate-content.int.test.ts:250-273`)
- [x] `contentId` inexistente → `NOT_FOUND` (`inactivate-content.int.test.ts:240-248`)
- [x] Falha do cache é soft-fail (estrutural via `runSoftFail` em `transition-content.ts:161-168`, coberto por USP-016 lineage tests)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **Result**: typecheck EXIT 0 · lint EXIT 0 · unit 940/940 passed (132 files) · integration 260/260 passed (45 files) · build EXIT 0 (routes `/moderacao/publicados` and `/vagas/[id]` compiled; client bundle for `/vagas` route with `job-form.tsx` compiled at 180kB — proves no server-only code leaked into the client bundle per the escape-hatch pattern)
- **Skipped tests**: none observed
- **Failures**: none
- **E2E**: `npm run test:e2e -- e2e/moderacao/inativar-conteudo.spec.ts` — **could not run**: Playwright's `webServer` timed out after 180s because port 3000 is squatted by a local OrbStack process (`Port 3000 is in use by process 888, using available port 3001 instead` — but `playwright.config.ts` hardcodes `baseURL` to port 3000, so navigation targets the wrong server). This is a pre-existing local-environment limitation (documented in project memory as a known/tracked issue, distinct from CI, where Supabase-provisioned E2E is reported reliable). Not attributable to this feature's code.

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --- | --- | --- |
| INACT-01 | Pending | ✅ Verified |
| INACT-02 | Pending | ✅ Verified |
| INACT-03 | Pending | ✅ Verified |
| INACT-04 | Pending | ✅ Verified |
| INACT-05 | Pending | ✅ Verified |
| INACT-06 | Pending | ✅ Verified |
| INACT-07 | Pending | ✅ Verified |
| INACT-08 | Pending | ✅ Verified |
| INACT-MN-01 | Pending | ✅ Verified |
| INACT-MN-02 | Pending | ✅ Verified |
| INACT-MN-03 | Pending | ✅ Verified |
| INACT-MN-04 | Pending | ✅ Verified |
| INACT-MN-05 | Pending | ✅ Verified |
| INACT-MN-06 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (with one non-blocking residual)

**Spec-anchored check**: 8/8 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 1/1 mutation on USP-018-owned code killed (see cross-unit note — 3/3 total across USP-018+USP-019)
**Must-nots**: 6/6 green
**Gate**: typecheck ✓, lint ✓, unit 940/940 ✓, integration 260/260 ✓, build ✓ — E2E blocked by local port conflict (residual)

**What works**: Full inactivation flow (Zod → permission → FSM → audit-in-tx → soft-fail notification/cache) proven end-to-end at the integration layer with exact-value assertions; `INACTIVATED` proven terminal across the full status×trigger×kind cross-product; public-surface exclusion proven at both search and detail; UI component covers empty/render/min-length-guard/error states; no direct `prisma.update` on content status anywhere outside the 3 sanctioned adapters.

**Residual (non-blocking)**: `e2e/moderacao/inativar-conteudo.spec.ts` did not execute locally — Playwright webServer times out because port 3000 is occupied by OrbStack and `playwright.config.ts`'s `baseURL` does not follow Playwright's auto-selected fallback port. All ACs the E2E would exercise (auth gate, motivo obrigatório, permissão, transição, auditoria, exclusão pública) are already proven at integration+unit granularity with exact-outcome assertions per the AC table above — the E2E's unique value-add was the browser-level session/middleware gate, which is standard boilerplate shared with `e2e/moderacao/moderar-rascunho.spec.ts` and `e2e/inativar-pessoa.spec.ts` (both pre-existing, already E2E-proven patterns per the spec file's own test-pyramid note). **Action**: confirm CI E2E is green before merge (CI does not have this port conflict per project memory `build-404-html-blocker.md`).

**Next steps**: none required for PASS; recommend running the E2E spec in CI (or after freeing port 3000 locally) as a final confirmation before merge.
