# USP-018 — Inativar conteúdo já publicado — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: activate it by name and follow its Execute flow and Critical Rules. Do not search for skill files by filesystem path. Test-source (facts) generation follows **`skill-tdad`** from the ACs/must-nots below.

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

**Design**: `.specs/features/moderacao-conteudo/usp-018-inativar-conteudo/design.md`
**Status**: Draft

> **NO Prisma migration in this feature.** `ContentStatus.INACTIVATED`, the `ACTIVE→INACTIVATED` rule, the audit event `CONTENT_INACTIVATED_BY_COORDINATOR` (in `JUSTIFICATION_REQUIRED_EVENTS`), and `PermissionId.INACTIVATE_PUBLISHED_CONTENT` all already exist. If you find yourself writing a migration, stop and re-read the design.

---

## Test Coverage Matrix

> Generated from codebase + project guidelines + spec. Guidelines found: `CLAUDE.md` (Testing Requirements — Server Action tests must cover happy/validation/permission/consent/concurrency; unit 90% domain, integration 80% sensitive actions), `package.json` scripts, `vitest.integration.config.ts`, `playwright.config.ts`, existing `moderation/__tests__/*.int.test.ts` + `actions/__tests__/*.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain (transition-rules) | unit | All branches; INACTIVATED terminal + inactivation only from ACTIVE | `src/modules/moderation/domain/__tests__/*.test.ts` | `npm run test` |
| Schema (Zod) | unit | valid ≥20 meaningful accepted; empty/short/generic rejected | `src/modules/moderation/schemas/__tests__/*.test.ts` | `npm run test` |
| Server Action | unit + integration | happy + validation + permission-denied + non-ACTIVE + concurrency + audit-in-tx | unit: `src/modules/moderation/actions/__tests__/*.test.ts`; integ: `src/modules/moderation/__tests__/*.int.test.ts` | `npm run test` / `npm run test:integration` |
| Query / server guard | integration | ACTIVE-only listing; guard true for coordinator/delegate, false otherwise | `src/modules/**/__tests__/*.int.test.ts` | `npm run test:integration` |
| Adapter (cache) | unit | revalidates `/vagas` + `/vagas/[id]` on INACTIVATED(JOB); no-op on non-visibility transitions | `src/modules/moderation/adapters/__tests__/*.test.ts` | `npm run test` |
| Public read (search/detail) | integration | INACTIVATED job excluded from `searchJobs` + `getActiveJobDetail` | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test:integration` |
| Component (client) | unit (component) | render rows + inactivate flow + min-length guard + inline error | `src/modules/moderation/components/__tests__/*.spec.tsx` | `npm run test` |
| Route / page | e2e | coordinator inactivates a job → it leaves `/vagas` | `e2e/moderacao/*.spec.ts` | `npm run test:e2e` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit / component / adapter | Yes | Pure/mocked; no shared store | `actions/__tests__/decide.test.ts`, `domain/__tests__/transition-rules.test.ts` |
| integration (`*.int.test.ts`) | No | Shared real Postgres; delete-based cleanup (memory: jobs cleanup can wipe seed on shared CNPJ) | `moderation/__tests__/transition-content.int.test.ts` |
| e2e | No | Shared dev server + DB | `e2e/moderacao/*`, `playwright.config.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit/component/adapter tests only | `npm run typecheck && npm run test` |
| Full | After tasks with integration tests | `npm run typecheck && npm run test && npm run test:integration` |
| Build | After the final task / route wiring / e2e | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (e2e: `npm run test:e2e` when infra provisioned) |

---

## Execution Plan

### Phase 1: Foundation (Parallel OK)
```
T1 [P]   inactivateSchema
T2 [P]   domain terminal/administrative-transition test lock
T3 [P]   NextCacheInvalidation extension (detail path)
```

### Phase 2: Core action + reads (Parallel OK, integration serialized)
```
T1 ──→ T4   inactivateContent action
        T5 [P]   canManagePublishedContent guard
        T6 [P]   listActivePublishedJobs query
        T7 [P]   public-surface exclusion negative tests
```

### Phase 3: UI + wiring (Sequential)
```
T4 ──→ T8   PublishedContentManager component
T4,T5,T6,T8 ──→ T9   route page + barrel + e2e
```

---

## Task Breakdown

### T1: Create `inactivateSchema` [P]
**What**: Zod schema `{ contentKind, contentId, justification }` with mandatory meaningful justification.
**Where**: `src/modules/moderation/schemas/inactivate.ts` (+ `__tests__/inactivate.test.ts`); export via barrel.
**Depends on**: None
**Reuses**: `schemas/decision.ts` (`contentRef`, `justification` = min 20 + `isMeaningfulJustification`).
**Requirement**: INACT-02, INACT-MN-02 (schema level)
**Tools**: MCP: NONE · Skill: `skill-tdad` (facts)
**Done when**:
- [ ] `inactivateSchema` accepts a valid input (justification ≥20 meaningful) and rejects empty / <20 / punctuation-only.
- [ ] `InactivateContentInput` type exported through `@/modules/moderation`.
- [ ] Quick gate passes: `npm run typecheck && npm run test`; test count: ≥4 unit tests pass.

**Tests**: unit · **Gate**: quick

---

### T2: Domain test-lock — INACTIVATED terminal + inactivation only from ACTIVE [P]
**What**: Unit tests asserting the FSM already forbids leaving `INACTIVATED` and only allows entering it from `ACTIVE` via `COORDINATOR_INACTIVATION`. No production code change expected (rules exist in `content-status.ts` L73); if a test goes red, the rule table has drifted — fix the table, not the test.
**Where**: `src/modules/moderation/domain/__tests__/transition-rules.test.ts` (extend).
**Depends on**: None
**Reuses**: `isValidTransition`, `findTransition`, `TRANSITIONS`.
**Requirement**: INACT-MN-06, INACT-07 (domain layer)
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] Test: `isValidTransition(kind, INACTIVATED, to, trigger)` is `false` for every `to` and trigger (all `ContentKind`).
- [ ] Test: `ACTIVE→INACTIVATED` valid only with trigger `COORDINATOR_INACTIVATION` and `requiresJustification === true`; invalid from any non-ACTIVE state.
- [ ] Quick gate passes; test count: ≥3 new assertions pass.

**Tests**: unit · **Gate**: quick

---

### T3: Extend `NextCacheInvalidation` to revalidate the job detail path [P]
**What**: On INACTIVATED (or ACTIVE) for `ContentKind.JOB`, revalidate `/vagas/${contentId}` in addition to `/vagas`.
**Where**: `src/modules/moderation/adapters/next-cache-invalidation.ts` (+ `adapters/__tests__/` cache test).
**Depends on**: None
**Reuses**: existing `revalidateForContent` + `publicPathsFor`; keep soft-fail.
**Requirement**: INACT-05
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] `revalidateForContent({ contentKind: JOB, contentId, to: INACTIVATED })` calls `revalidatePath('/vagas')` **and** `revalidatePath('/vagas/'+contentId)`.
- [ ] Non-visibility transitions (e.g. `to: PAUSED`) still no-op.
- [ ] Quick gate passes (mock `next/cache`); test count: ≥3 tests.

**Tests**: unit · **Gate**: quick

---

### T4: Create `inactivateContent` Server Action
**What**: `'use server'` action — Zod → `requirePermission('INACTIVATE_PUBLISHED_CONTENT')` → `transitionContent(to=INACTIVATED, trigger='COORDINATOR_INACTIVATION', justification, actorPersonId)`. Generic over `ContentKind`.
**Where**: `src/modules/moderation/actions/inactivate.ts` (+ unit `actions/__tests__/inactivate.test.ts`, + integration `__tests__/inactivate-content.int.test.ts`); export via barrel.
**Depends on**: T1
**Reuses**: `actions/decide.ts` pattern (mirror `rejectContent`), `transitionContent`, `requirePermission`.
**Requirement**: INACT-01, INACT-03, INACT-04, INACT-07, INACT-08, INACT-MN-01, INACT-MN-02, INACT-MN-03, INACT-MN-05
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] Unit (mock container/`requirePermission`): happy → calls `transitionContent` with correct args; validation fail → `VALIDATION`; permission denied → returns `FORBIDDEN` (INACT-MN-03).
- [ ] Integration (real DB, seed an `ACTIVE` job): inactivate with valid motive → job `status = INACTIVATED` **and** exactly 1 `audit_log CONTENT_INACTIVATED_BY_COORDINATOR` with `before/after/justification/actorPersonId` (INACT-03, INACT-MN-05).
- [ ] Integration negative: motive absent/short → status unchanged (INACT-MN-02); job not `ACTIVE` → `INVALID_TRANSITION`, unchanged (INACT-07/INACT-MN-01); concurrent second call → `INVALID_TRANSITION` (no double audit).
- [ ] Integration: notification seam invoked (spy on `MODERATION_NOTIFICATION_TOKEN`) — soft-fail (INACT-04).
- [ ] Full gate passes: `npm run typecheck && npm run test && npm run test:integration`; test count: ≥8 (unit+integration) pass.

**Tests**: integration · **Gate**: full
**Commit**: `feat(moderation): inactivateContent — inativar conteúdo publicado (USP-018)`

---

### T5: Create `canManagePublishedContent` server guard [P]
**What**: `true` if person is coordinator or has active delegated `INACTIVATE_PUBLISHED_CONTENT`.
**Where**: `src/modules/moderation/server/moderation-access.ts` (add function; + integration test); export via barrel.
**Depends on**: None
**Reuses**: `isCoordinator`, `prisma.delegatedPermission.findFirst` (mirror `canAccessModerationQueue`).
**Requirement**: INACT-06 (access), INACT-MN-03 (surface guard)
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] Coordinator → `true`; person with active `INACTIVATE_PUBLISHED_CONTENT` grant → `true`; revoked/absent grant + non-coordinator → `false`.
- [ ] Full gate passes; test count: ≥3 integration assertions.

**Tests**: integration · **Gate**: full

---

### T6: Create `listActivePublishedJobs` query [P]
**What**: Paginated read of `jobs` where `status = ACTIVE`, explicit `select` (id, title, publishedAt, company.nomeFantasia, area.name), `take` mandatory.
**Where**: `src/modules/jobs/queries/list-active-published-jobs.ts` (+ integration test); export via `@/modules/jobs` barrel.
**Depends on**: None
**Reuses**: pagination convention from `search-jobs.ts`.
**Requirement**: INACT-06 (listing)
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] Returns only `ACTIVE` jobs (seed one ACTIVE + one INACTIVATED + one DRAFT → only ACTIVE returned).
- [ ] Pagination (`take`, `total`, `page`) works.
- [ ] Full gate passes; test count: ≥3 integration assertions.

**Tests**: integration · **Gate**: full

---

### T7: Public-surface exclusion negative tests (INACT-MN-04) [P]
**What**: Assert an `INACTIVATED` job is absent from every public read path. No production code change (both queries already filter `status='ACTIVE'`); this locks the must-not.
**Where**: `src/modules/jobs/__tests__/search-jobs.int.test.ts` + `get-job-detail.int.test.ts` (extend).
**Depends on**: None
**Reuses**: `searchJobs`, `getActiveJobDetail` (existing filters).
**Requirement**: INACT-MN-04
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] Seed a job, set `status = INACTIVATED`, verified company, `validUntil` future → `searchJobs` does NOT return it and `total` excludes it.
- [ ] `getActiveJobDetail(id)` for the INACTIVATED job returns `null` (→ 404 upstream).
- [ ] Full gate passes; test count: ≥2 integration assertions.

**Tests**: integration · **Gate**: full

---

### T8: Create `PublishedContentManager` client component (DS)
**What**: Client component listing ACTIVE jobs with an inline "Inativar" flow (mandatory motive) calling `inactivateContent`.
**Where**: `src/modules/moderation/components/published-content-manager.tsx` (+ `components/__tests__/published-content-manager.spec.tsx`); export via barrel.
**Depends on**: T4
**Reuses**: `@/shared/ui` (`Button variant="danger"`, `Textarea`, `Card`, `Badge`, `Label`, `cn`), `MIN_JUSTIFICATION_LENGTH`, inline-reason pattern from `moderation-queue.tsx`. Tokens only (DS-MN-02); no new dep (DS-MN-05); no `dark:`.
**Requirement**: INACT-06 (UI)
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] Renders one card per job (title, company via `Badge`); "Inativar" opens a `<Textarea>` motive block + Confirmar/Cancelar.
- [ ] Client-side min-length guard blocks <20; on ok → row removed; on error → inline `role="alert"`.
- [ ] Imports only from `@/shared/ui` (no raw hex, no `dark:`); component test uses Testing Library.
- [ ] Quick gate passes; test count: ≥4 component tests.

**Tests**: unit (component) · **Gate**: quick

---

### T9: Route `(app)/moderacao/publicados` + barrel exports + E2E
**What**: Server Component page (guard + query + render) and the moderation barrel exports; happy-path E2E.
**Where**: `src/app/(app)/moderacao/publicados/page.tsx`; update `src/modules/moderation/index.ts`; `e2e/moderacao/inativar-conteudo.spec.ts`.
**Depends on**: T4, T5, T6, T8
**Reuses**: `(app)/moderacao/page.tsx` pattern (`requireActivePerson` → guard → `notFound()` → query → component); `force-dynamic`.
**Requirement**: INACT-06 (end-to-end)
**Tools**: MCP: NONE · Skill: `skill-tdad`
**Done when**:
- [ ] Page: non-authorized viewer → 404; authorized → lists ACTIVE jobs and renders `PublishedContentManager`.
- [ ] Barrel exports `inactivateContent`, `inactivateSchema`/`InactivateContentInput`, `canManagePublishedContent`, `PublishedContentManager` (and `listActivePublishedJobs` via `@/modules/jobs`).
- [ ] E2E: coordinator opens `/moderacao/publicados`, inactivates an ACTIVE job with a motive, then `/vagas` no longer lists it.
- [ ] Build gate passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`.

**Tests**: e2e · **Gate**: build
**Commit**: `feat(moderation): superfície de inativação de conteúdo publicado (USP-018)`

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ Match |
| T2 | None | Phase 1 start | ✅ Match |
| T3 | None | Phase 1 start | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | None | Phase 2 [P] | ✅ Match |
| T6 | None | Phase 2 [P] | ✅ Match |
| T7 | None | Phase 2 [P] | ✅ Match |
| T8 | T4 | T4 → T8 | ✅ Match |
| T9 | T4,T5,T6,T8 | (T4,T5,T6,T8) → T9 | ✅ Match |

## Test Co-location Validation

| Task | Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | ---------------------- | --------------- | --------- | ------ |
| T1 | Schema | unit | unit | ✅ OK |
| T2 | Domain (test-lock) | unit | unit | ✅ OK |
| T3 | Adapter (cache) | unit | unit | ✅ OK |
| T4 | Server Action | unit + integration | integration | ✅ OK |
| T5 | Server guard | integration | integration | ✅ OK |
| T6 | Query | integration | integration | ✅ OK |
| T7 | Public read (must-not lock) | integration | integration | ✅ OK |
| T8 | Component (client) | unit (component) | unit | ✅ OK |
| T9 | Route/page | e2e | e2e | ✅ OK |

## Must-Not Ownership (💠 Check 4)

| Must-Not | Owning task(s) | Negative test |
| -------- | -------------- | ------------- |
| INACT-MN-01 (via FSM only) | T4 | non-ACTIVE → `INVALID_TRANSITION` (proves FSM routing) |
| INACT-MN-02 (no motive → no change) | T1, T4 | empty/short motive rejected, status unchanged |
| INACT-MN-03 (no permission → no inactivation) | T4, T5 | `FORBIDDEN`, status unchanged |
| INACT-MN-04 (INACTIVATED not public) | T7 | search/detail exclude it |
| INACT-MN-05 (audit in same tx) | T4 | audit row exists; audit-fail → rollback |
| INACT-MN-06 (INACTIVATED terminal) | T2 | no valid transition out of INACTIVATED |

## Tools per task
- **MCPs**: none required. (Context7 optional if consulting Next `revalidatePath` semantics for T3.)
- **Skills**: `skill-tdad` to derive facts (Gherkin + red Vitest + E2E skeleton + AC→test matrix) before implementing each task; `bravi-spec-driven` Execute for the per-task cycle + commit.
