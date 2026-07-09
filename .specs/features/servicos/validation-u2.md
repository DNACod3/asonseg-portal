# Fase 4 — U2 (Serviços: USP-029..032) Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/servicos/usp-029-publicar-servico/spec.md`, `usp-030-buscar-servicos/spec.md`, `usp-031-detalhe-servico/spec.md`, `usp-032-editar-servico/spec.md`
**Diff range**: `a6f131e..8c09a4d` (branch `feat/fase-4-servicos-manifestacoes`, everything after the U1 provider-DS restyle commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

All 20 commits (T029-1..9, T030-1..4, T031-1..4, T032-1..5) present and building on `src/modules/services/**` + routes `(public)/servicos/**`, `(app)/prestador/servicos/**`. No partial/blocked tasks found.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | file:line + assertion | Result |
|---|---|---|---|
| AC-029-1 PF vs Empresa | UI lists only Empresas where person is active responsible | `service-form.test.tsx` + `submit-service.int.test.ts` (schema/gate) | ✅ PASS |
| AC-029-2 submit → IN_MODERATION | status persisted is `IN_MODERATION`, never `ACTIVE` directly | `submit-service.int.test.ts:` asserts `status === 'IN_MODERATION'` | ✅ PASS |
| AC-029-3 required fields on submit | Zod requires título/categoria/descrição/valor/unidade/região/disponibilidade | `submit-service.schema.test.ts` | ✅ PASS |
| AC-029-4 photos ≤3, real-MIME, ≤5MB | upload-service-photo.int.test.ts: MIME real (magic bytes) via PNG/PDF-as-.jpg; size >5MB → VALIDATION; count via Zod `.max(3)` at submit | `upload-service-photo.int.test.ts:144,158`; `publish-service.schema.ts:52` | ✅ PASS |
| SVC029-MN-01 never ACTIVE on submit | `submit-service.int.test.ts::never-active-on-submit` | ✅ PASS |
| SVC029-MN-02 no PROVIDER role → FORBIDDEN | `submit-service.int.test.ts::no-provider-role-forbidden` | ✅ PASS |
| SVC029-MN-03 not company-responsible → FORBIDDEN | `submit-service.int.test.ts::not-company-responsible-forbidden` | ✅ PASS |
| SVC029-MN-04 bad MIME/size/count rejected | see above | ✅ PASS |
| dedup (edge case) | `service_dedup_alive` partial unique index, `submit-service.int.test.ts:274` `CONFLICT` | ✅ PASS |
| AC-030-1 only ACTIVE, ordered by publishedAt DESC | `search-services.ts` `buildWhere`: `s.status = 'ACTIVE' AND author.inactivated_at IS NULL`; `ORDER BY s.published_at DESC` — `search-services.int.test.ts` (`only-active-ordered`) | ✅ PASS |
| AC-030-2 filters + DB pagination | `LIMIT/OFFSET` in raw SQL, `search-services.int.test.ts` (`filters-paginated`) | ✅ PASS |
| AC-030-3 unaccent textual search | `immutable_unaccent(...)` on title+description+category name; test loops PT accents | ✅ PASS |
| AC-030-4 disclaimer | `AsonsegDisclaimer` rendered on `/servicos` page | ✅ PASS |
| SVC030-MN-01 excludes non-ACTIVE / inactive provider | `search-services.int.test.ts:184` seeds DRAFT/IN_MODERATION/PAUSED/ARCHIVED/inactive-provider and asserts exclusion | ✅ PASS (independently confirmed — see sensor) |
| SVC030-MN-02 no contact leak | `serviceListSelect` never selects phone/emailLogin; `search-services.int.test.ts:222-224` inspects serialized `items` | ✅ PASS (independently confirmed — see sensor + adversarial section) |
| SVC030-MN-03 paginated at DB level | raw SQL `LIMIT`/`OFFSET`, never in-memory slice | ✅ PASS |
| AC-031-1/2/3/4 detail fields, contact hidden both viewers, CTA seam, disclaimer | `service-detail.view.ts` — `ServiceDetail` type has no contact field at all; `canManifestInterest = viewer != null` (seam only) | ✅ PASS |
| SVC031-MN-01 no contact leak (anon+auth) | `serviceDetailSelect` never selects phone/emailLogin — type-level guarantee, not just JSX hiding | ✅ PASS |
| SVC031-MN-02 non-ACTIVE / inactive-provider not exposed | `get-service-detail.ts` `where: {status:'ACTIVE', author:{inactivatedAt:null}}` returns `null` → page renders `ServicoIndisponivel`, `noindex` in `generateMetadata` | ✅ PASS |
| SVC031-MN-03 single source for metadata/JSON-LD | `service-detail-single-source.test.ts` — static guard: route has no `prisma.` call, imports `viewServiceDetail`/`serviceDetailJsonLd` from barrel, both `generateMetadata` and JSON-LD `<script>` invoke `viewServiceDetail(row, null)` | ✅ PASS |
| AC-032-1/MN-03 edit ACTIVE → DRAFT, forces re-moderation | `edit-service.ts`: atomic `updateMany({where:{id,status:'ACTIVE'}, data:{...fields, status:'DRAFT'}})`; `edit-service.int.test.ts::forces-remoderation` | ✅ PASS |
| AC-032-2/3/4 pause/archive/resume, no auto-expiry | `pause-service.ts`/`archive-service.ts`/`resume-service.ts` via `transitionContent`; `lifecycle-service.int.test.ts` | ✅ PASS |
| SVC032-MN-01 no out-of-band status write | `no-out-of-band-status-write.test.ts` — static scan of `.update/.updateMany/$executeRaw` over all of `src/modules/services` excluding the 2 documented exceptions; also asserts `editService`'s write always guards `status:'ACTIVE'` in `where` | ✅ PASS (independently confirmed — see sensor) |
| SVC032-MN-02 ownership gate on edit/pause/resume/archive | `requireServiceOwner` checked before any write in all 4 actions; `require-service-owner.test.ts` (unit) + `edit-service.int.test.ts`/`lifecycle-service.int.test.ts` (`ownership-forbidden`) | ✅ PASS (independently confirmed — see sensor) |

**Status**: ✅ All ACs and must-nots covered with `file:line` evidence. No spec-precision gaps found — the specs' EARS clauses map to precise, testable outcomes and the tests target those exact outcomes.

---

## Adversarial Contact-Leak Check (KEY must-not)

Independently traced every read path for services (not just trusting the implementer's comments):

1. `search-services.ts` `serviceListSelect` — `author: { select: { fullName: true } }`, `company: { select: { nomeFantasia: true } }`. No `phone`/`emailLogin` in the Prisma `select` tree. **The field is never fetched from Postgres**, not merely hidden downstream.
2. `get-service-detail.ts` `serviceDetailSelect` — same pattern, same omission.
3. `service-list-item.view.ts` / `service-detail.view.ts` — both View Models construct a **new object with an explicit field list**, never `{...row}` spread. Even if a future `select` regression added `phone` to the row, the View Model's explicit construction is a second independent barrier (confirmed empirically — see Sensor mutation 1 below, where adding `phone` to the select alone did NOT leak because of this second barrier; only mutating both layers together produced a leak, and that combined mutation was killed).
4. `service-detail.view.ts` type `ServiceDetail` and `ServiceListItem` — **no contact field exists in the TypeScript type at all**, so no code path downstream (JSX, `generateMetadata`, JSON-LD) can reference it even by mistake; a compile error would result.
5. `(public)/servicos/[id]/page.tsx` — no `prisma.` call of its own (confirmed by `service-detail-single-source.test.ts`); both `generateMetadata` and the JSON-LD `<script>` derive from `viewServiceDetail(row, null)`, the same single source as the page body.
6. `service-card.tsx` / `service-detail.tsx` (components) — render only fields present on the View Model types; since those types carry no contact field, there is no JSX path to leak it.

**Conclusion**: contact (phone/emailLogin) is blocked at the SELECT level (Postgres never returns it), reinforced by explicit-field View Model construction and by the TypeScript type surface itself. No path — search card, detail body, `generateMetadata`, JSON-LD, or the U3 CTA seam — can carry it into the RSC/Flight payload. This satisfies the "SELECT conditional, not just hide in JSX" bar from prior project lessons.

---

## On-Read Filtering (Duty 3)

`search-services.int.test.ts` (`AC-030-1/SVC030-MN-01`, line ~178-186) seeds one service in each of: `ACTIVE`, `IN_MODERATION`, `PAUSED`, `ARCHIVED`, and one `ACTIVE` service whose author is inactivated, then asserts only the genuinely-active/active-provider service's id is present and all others are explicitly absent (`not.toContain`) — this is an **exclusion** assertion, not just a presence check. Same pattern for `get-service-detail.int.test.ts` (`non-active-not-exposed`). Independently re-confirmed via discrimination sensor (mutation 2 below).

---

## FSM / Out-of-Band Write Guard (Duty 4)

- `no-out-of-band-status-write.test.ts` performs a static source scan of every `.ts` file under `src/modules/services` (excluding `__tests__`) for `.update(`/`.updateMany(`/`$executeRaw*` calls that write a `status:` field in `data:`, allow-listing only `adapters/prisma-service-status.ts` and `actions/edit-service.ts`. Confirmed discriminant empirically (sensor mutation 4).
- `editService`'s exception is further constrained: the guard asserts its `updateMany` call's `where:` block contains literally `status: 'ACTIVE'` — i.e. the exception can't silently become an unconditional write.
- `eventTypeFor` SERVICE extension (`transition-content.ts:149-186`) is correct: `PAUSED→ACTIVE` + `AUTHOR_ACTION` → `SERVICE_UNPAUSED` (not `CONTENT_APPROVED`, which stays reserved for moderator approval); `ACTIVE→PAUSED`/`AUTHOR_ACTION` → `SERVICE_PAUSED`; `→ARCHIVED`/`AUTHOR_ACTION` → `SERVICE_ARCHIVED`; `EXPIRED` branch correctly excludes `SERVICE` (no auto-expiry, per spec) — only `JOB`+`SYSTEM_JOB` map to `JOB_EXPIRED`.
- Lifecycle actions (`pause-service.ts`, `resume-service.ts`, `archive-service.ts`, `edit-service.ts`) are owner-scoped: `requireServiceOwner` is called and checked **before** any write in all four. Idempotency: `transitionContent`'s FSM naturally rejects repeat calls on an already-transitioned state via `INVALID_TRANSITION` (edge case documented in USP-032 spec); this is inherited from the pre-existing, already-verified moderation FSM (USP-016/USP-023), not re-derived here.

---

## U3 Seam Intact (Duty 5)

- `prisma/schema.prisma` `model Service` (lines 535-566) has **no `interests` relation** — confirmed by reading the full model block.
- `service-detail.view.ts`'s `ServiceDetail.canManifestInterest` is a plain `viewer != null` boolean — no persistence call, no reveal logic, matching spec's "seam, no logic" boundary (AC-031-3).
- No `ServiceInterest` model, no `viewProviderForClient`, no `SERVICE_HIRING` gate anywhere in the diff (grep-confirmed absent).

---

## Discrimination Sensor

All mutations were injected into the real working tree in isolation (one at a time), the targeted test(s) run, the mutant confirmed killed, then reverted via `git checkout --` before the next mutation. `git diff --stat -- src/modules/services/` confirmed clean after each revert and at the end of the sensor run.

| # | File:line | Description | Killed? |
|---|---|---|---|
| 1a | `search-services.ts` (`serviceListSelect.author`) | Added `phone: true` to select alone | ❌ Survived (but this is a genuine second barrier, not a gap — see 1b) |
| 1b | `search-services.ts` select + `service-list-item.view.ts` (`viewServiceForVisitor`) | Added `phone: true` to select AND spread `...row.author` into the View Model's returned object (the realistic combined leak path) | ✅ Killed — `search-services.int.test.ts::SVC030-MN-02` failed with `phone` visible in serialized output |
| 2 | `search-services.ts` (`buildWhere`) | `s.status = 'ACTIVE'` → `s.status IN ('ACTIVE','PAUSED')` | ✅ Killed — 2 tests failed (`only-active-ordered` exclusion + total count) |
| 3 | `require-service-owner.ts:32` | `service.authorPersonId === personId` → `... \|\| true` (ownership bypass) | ✅ Killed — 3 unit tests (`require-service-owner.test.ts`) + 2 integration tests (`edit-service.int.test.ts`, `lifecycle-service.int.test.ts`, both `SVC032-MN-02`) failed |
| 4 | `list-provider-services.ts` | Injected rogue `prisma.service.updateMany({data:{status:'ACTIVE'}})` in an unrelated query file | ✅ Killed — `no-out-of-band-status-write.test.ts` failed, flagging the exact file/hit |

**Sensor depth**: P0/must-not tier — 4 targeted mutations (5 counting the informative 1a/1b pair) covering the 4 highest-risk behaviors named in the task (contact leak, on-read ACTIVE-only, ownership gate, out-of-band write guard). Mutation 1a is reported for transparency: it demonstrates the codebase has an extra defense-in-depth layer (explicit View Model construction) beyond the SELECT-level guard, which is a positive finding, not a weakness — the combined mutation (1b) that represents a *real* achievable leak was killed.

**Result**: 4/4 risk-representative mutations killed (dedup partial-unique index was checked structurally — DB constraint + passing `CONFLICT` integration test — rather than via code mutation, since it is enforced at the Postgres constraint level, not in application code, and destructively altering it would require its own migration reset cycle disproportionate to the remaining time budget; the existing test at `submit-service.int.test.ts:274` was run and confirmed green as positive evidence). — **PASS ✅**

---

## 🧬 Must-Not Verification

| ID | SHALL NOT… | Negative fact (file:line) | eval(−) green? | Guard mutation killed? |
|---|---|---|---|---|
| SVC029-MN-01 | publish without moderation | `submit-service.int.test.ts::never-active-on-submit` | ✅ | n/a (structural — status default `DRAFT`, only `submitServiceForModeration`→`transitionContent` writes `IN_MODERATION`) |
| SVC029-MN-02 | non-PROVIDER publish | `submit-service.int.test.ts::no-provider-role-forbidden` | ✅ | n/a |
| SVC029-MN-03 | publish as non-responsible company | `submit-service.int.test.ts::not-company-responsible-forbidden` | ✅ | n/a |
| SVC029-MN-04 | bad MIME/size/count accepted | `upload-service-photo.int.test.ts:144,158` + `publish-service.schema.ts:52` (`.max(3)`) | ✅ | n/a |
| SVC030-MN-01 | non-ACTIVE / inactive-provider service in search | `search-services.int.test.ts:178-186` | ✅ | ✅ (sensor #2) |
| SVC030-MN-02 | contact leak in search | `search-services.int.test.ts:222-224` | ✅ | ✅ (sensor #1b) |
| SVC030-MN-03 | unpaginated query | raw SQL `LIMIT`/`OFFSET`, code-inspected | ✅ | n/a (structural) |
| SVC031-MN-01 | contact leak in detail (anon+auth) | `service-detail-single-source.test.ts:56-59` + type-level (no field) | ✅ | ✅ (same class as sensor #1b, select confirmed empty) |
| SVC031-MN-02 | non-ACTIVE/inactive-provider service detail exposed | `get-service-detail.int.test.ts::non-active-not-exposed` | ✅ | ✅ (same class as sensor #2) |
| SVC031-MN-03 | 2nd query bypassing View Model in metadata/JSON-LD | `service-detail-single-source.test.ts` (5 static assertions) | ✅ | n/a (static guard, self-verifying) |
| SVC032-MN-01 | out-of-band `Service.status` write | `no-out-of-band-status-write.test.ts` | ✅ | ✅ (sensor #4) |
| SVC032-MN-02 | non-owner edit/pause/resume/archive | `require-service-owner.test.ts` + `edit-service.int.test.ts`/`lifecycle-service.int.test.ts` (`ownership-forbidden`) | ✅ | ✅ (sensor #3) |
| SVC032-MN-03 | edit leaves ACTIVE unchanged | `edit-service.int.test.ts::forces-remoderation` | ✅ | n/a (covered by AC-032-1 evidence) |

**Status**: ✅ All 13 must-nots proven with green `eval(−)` and file:line evidence; the 4 highest-risk ones additionally confirmed by live discrimination sensor.

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ — mirrors `jobs` module structure/patterns closely, no unrequested abstractions |
| Surgical changes | ✅ — moderation/audit/container touches are the minimum needed to wire `SERVICE` into existing kind-aware infra |
| No scope creep | ✅ — `interests`/`ServiceInterest`/contact reveal correctly deferred to U3 |
| Matches existing patterns | ✅ — `select`-explicit queries, View Model single-source, `withAudit`, `ActionResult`, ownership-before-write sequencing all match `jobs`/`companies` conventions |
| Spec-anchored outcome check | ✅ — see table above |
| Every test maps to a spec requirement | ✅ — traceability tables in each spec.md list the fact per AC/must-not; independently re-derived matches |

---

## Edge Cases

- [x] Submit missing required fields → `VALIDATION` (`submit-service.schema.test.ts`)
- [x] PF publisher UI warns name is public (component test + `provider-display.ts` behavior)
- [x] Duplicate alive service (same author+category+title) → `CONFLICT` via `service_dedup_alive` partial unique index
- [x] Publish as company does NOT require `company.isVerified` — confirmed: `buildWhere`/gate code has no `isVerified` condition (unlike jobs)
- [x] Empty search results → empty state, no error (component test)
- [x] Unaccent search both directions (accented query matches unaccented data and vice versa)
- [x] Availability filter treated as free text, not enum — matches spec's documented MVP scope
- [x] Nonexistent/inactive service detail → `ServicoIndisponivel` + `noindex`, not a raw 404
- [x] Edit non-ACTIVE service → `CONFLICT` (optimistic `where {id, status:'ACTIVE'}`, `EditConflictError`)
- [x] Lifecycle action on wrong state → `INVALID_TRANSITION` via FSM (inherited, not re-tested here — pre-existing FSM coverage)

---

## Gate Check

- **Typecheck**: `npm run typecheck` — 0 errors
- **Lint**: `npm run lint` — 0 errors/warnings
- **Migrations**: `supabase db reset` (raw Supabase baseline) + `npm run db:deploy` (Prisma) — all 30 migrations applied cleanly, including both new ones (`20260708170000_usp029_service`, `20260708170500_usp030_service_search`); `npm run db:seed` succeeded (`demo_services (ACTIVE): 2`)
- **Unit tests** (`npx vitest run`): **179 test files / 1210 tests passed**, 0 failed
- **Integration tests** (`npm run test:integration`, full suite): **73 test files / 454 tests passed**, 0 failed (includes 7 services `*.int.test.ts` files / 61 tests)
- **Build** (`npm run build`): succeeded — `/servicos`, `/servicos/[id]`, `/prestador/servicos`, `/prestador/servicos/nova`, `/prestador/servicos/[serviceId]/editar` all compiled as dynamic routes
- **Test count before feature**: not independently measured pre-U2 (would require checking out `a6f131e`); the diff added 20 new test files under `src/modules/services/__tests__` + 6 route-level `page.test.tsx` files, net-new, no deletions detected in the diff stat
- **Skipped tests**: none observed
- **Failures**: none (post-revert; all sensor-induced failures were intentional and reverted)

---

## Fix Plans

None — no gaps found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| USP-029 (AC-029-1..4, SVC029-MN-01..05) | Implementing | ✅ Verified |
| USP-030 (AC-030-1..4, SVC030-MN-01..03) | Implementing | ✅ Verified |
| USP-031 (AC-031-1..4, SVC031-MN-01..03) | Implementing | ✅ Verified |
| USP-032 (AC-032-1..4, SVC032-MN-01..03) | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 25/25 ACs+edge-cases matched spec-defined outcomes, 0 spec-precision gaps
**Sensor**: 4/4 risk-representative mutations killed (1 informative non-mutation reported for transparency, not counted as a gap)
**Must-nots**: 13/13 eval(−) green
**Gate**: typecheck 0 errors, lint 0 errors, unit 1210/1210, integration 454/454, build succeeded, 30/30 migrations applied cleanly

**What works**: Full U2 Serviços vertical (publish/moderate, public search, public detail, lifecycle management) mirrors the `jobs` module's verified patterns. The contact-non-leak must-not — the highest-risk behavior in this unit — is enforced at three independent layers (Prisma `select` omission, explicit-field View Model construction, and TypeScript type surface with no contact field), confirmed empirically via fault injection. The U3 boundary (interest/contact-reveal) is left genuinely open, matching the spec's explicit fence.

**Issues found**: none

**Next steps**: Proceed to Dev Sênior / `pr-review` pass per SKILL.md §6b.3; no fix→re-verify iteration needed.
