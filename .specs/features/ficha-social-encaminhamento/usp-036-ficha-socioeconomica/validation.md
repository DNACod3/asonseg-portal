# USP-036 — Ficha socioeconômica — Validation

**Date**: 2026-07-09
**Spec**: `.specs/features/ficha-social-encaminhamento/usp-036-ficha-socioeconomica/spec.md`
**Diff range**: `8cd2d80..HEAD` (`bb7f02c`..`5a9b604`, 8 commits, T1–T8)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|---|---|---|
| T1 | ✅ Done | `SocioeconomicRecord` model + `IncomeBracket`/`HousingSituation` enums + migration `20260709151509_usp036_socioeconomic_record`. |
| T2 | ✅ Done | `SOCIAL_SHEET_CREATED`/`SOCIAL_SHEET_UPDATED` in `AuditEvent`; correctly **not** in `JUSTIFICATION_REQUIRED_EVENTS`. |
| T3 | ✅ Done | `canManageSocioeconomicRecord` + `INCOME_BRACKETS`/`HOUSING_SITUATIONS` + `isEmptyRecord`, no `@prisma/client` runtime import. |
| T4 | ✅ Done | `socioeconomicRecordSchema`, all 4 fields optional, `''`→`undefined`. |
| T5 | ✅ Done | `saveSocioeconomicRecord` — full sensitive-action sequence, upsert + `withAudit` same tx. |
| T6 | ✅ Done | `getSocioeconomicRecord` + `viewSocioeconomicRecord` — role guard before `SELECT`, audit-on-read. |
| T7 | ✅ Done | `SocioeconomicRecordForm` — RHF+Zod, ADR-0017 carve-out (relative import, not barrel). |
| T8 | ✅ Done | `(app)/pessoas/[id]/ficha-social/page.tsx` — route guard (`notFound()`), page test + E2E spec. |

All 4 declared deviations reviewed and accepted as faithful (see below).

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| **AC-036-1** WHEN AS/BOARD acessa o cadastro social THEN exibe os 4 campos | Form renders labeled fields for renda, benefício, moradia, composição | `src/modules/persons/__tests__/SocioeconomicRecordForm.test.tsx:34-40` — `getByLabelText(/renda aproximada/i)` ... 4x `toBeInTheDocument()` | ✅ PASS |
| **AC-036-2** WHEN AS edita a ficha THEN persiste (upsert, 1/Pessoa) + audita autor+data via `withAudit(CREATED\|UPDATED)` | 1st save → `SOCIAL_SHEET_CREATED` w/ `actorPersonId`; 2nd save on same person → `SOCIAL_SHEET_UPDATED`, exactly 1 of each | `src/modules/persons/__tests__/save-socioeconomic-record.int.test.ts:108-135` (create), `:137-161` (update: `expect(createdAudits).toBe(1); expect(updatedAudits).toBe(1)`) | ✅ PASS |
| **AC-036-3** WHEN non-AS/BOARD tenta acessar THEN `FORBIDDEN`, nenhum campo sensível | `result.ok===false`, `error.code==='FORBIDDEN'`, no sensitive value in payload | `save-socioeconomic-record.int.test.ts:177-194` (action, 0 rows persisted); `get-socioeconomic-record.int.test.ts:131-150` (query, `JSON.stringify(result)).not.toMatch(/FROM_1_TO_2_MW\|Bolsa Família\|OWNED/)`, no `SENSITIVE_FIELD_VIEWED` audit); `src/app/(app)/pessoas/[id]/ficha-social/page.test.tsx:56-64` (route → `notFound()`, `getSocioeconomicRecord` never called) | ✅ PASS |
| **AC-036-4** WHEN persistida THEN criptografia em repouso | Satisfeita-por-plataforma (Supabase managed disk encryption), ADR-0012 precedent (`candidate_profiles`) | design.md §Tech Decisions + spec.md Assumption #1 (explicit gap-residual documented, not code-testable) | ✅ Satisfied-by-platform — no code test required per spec's own instruction |

**Status**: ✅ All ACs covered, no spec-precision gaps.

---

## Edge Cases

- [x] Pessoa `INATIVO` — edit persists, no block: `save-socioeconomic-record.int.test.ts:196-210`.
- [x] Pessoa sem credencial — implicitly covered: all int-test `Person` rows are created bare (no Supabase Auth linkage), and saves against them succeed unconditionally; no code path in `saveSocioeconomicRecord`/`getSocioeconomicRecord` checks credential presence.
- [x] Composição familiar como texto/número (sem entidade Família) — schema treats as plain string; no `Family` model touched anywhere in the diff.
- [x] Campos vazios/parciais aceitos — `socioeconomic-record-schema.test.ts:28-52`.

---

## Discrimination Sensor

Scratch method: direct edit of the already-committed, working-tree-clean target file, run the targeted test file(s), then `git checkout HEAD -- <file>` to discard (confirmed clean via `git status --short` before and after each mutation — no other files touched).

| # | File:line | Description | Targets | Killed? |
|---|---|---|---|---|
| 1 | `src/modules/persons/domain/socioeconomic-record.ts:32` | `return true \|\| roles.some(...)` — neutralized the role guard | **SOC-036-MN-01** guard | ✅ Killed at 3 layers: domain unit (`socioeconomic-record-domain.test.ts`, 7 failures), action int (`save-socioeconomic-record.int.test.ts` MN-01 case), query int (`get-socioeconomic-record.int.test.ts` MN-01 case) |
| 2 | `src/modules/persons/actions/save-socioeconomic-record.ts:109-147` | Replaced `withAudit(event, async (tx) => {...upsert...})` with a bare `prisma.socioeconomicRecord.upsert(...)` outside any audit wrapper | **SOC-036-MN-02** guard | ✅ Killed: 4 failures in `save-socioeconomic-record.int.test.ts` — both happy-path audit assertions and both explicit MN-02 tests (missing audit row; and the forced-audit-failure/rollback test now fails because the write is no longer atomic with the audit) |
| 3 | `src/modules/persons/schemas/socioeconomic-record.schema.ts:33` | Removed `.max(SOCIAL_BENEFIT_MAX, ...)` from `socialBenefit` | AC-036 validation (general) | ✅ Killed: `socioeconomic-record-schema.test.ts` — "rejeita socialBenefit acima de 200 caracteres" fails |

**Sensor depth**: lightweight (default tier), 3/3 killed — includes one targeted mutation per must-not's guard per §6b rule 4, plus one general-behavior mutation.
**Result**: 3/3 killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| **SOC-036-MN-01** | Retornar/selecionar/expor campo sensível da ficha a viewer sem `SOCIAL_ASSISTANT`/`BOARD` | Domain: `socioeconomic-record-domain.test.ts:21-30` (7 non-authorized roles → `false`); Action: `save-socioeconomic-record.int.test.ts:177-194` (`FORBIDDEN`, 0 rows); Query: `get-socioeconomic-record.int.test.ts:131-150` (`FORBIDDEN`, no sensitive value in JSON, no audit row); Route: `page.test.tsx:56-64` (`notFound()`, downstream calls never made) | ✅ | ✅ (mutation 1) |
| **SOC-036-MN-02** | Persistir alteração da ficha sem registro de auditoria append-only (autor+data, mesma tx) | `save-socioeconomic-record.int.test.ts:212-224` (exactly 1 `audit_log` row w/ `actorPersonId`+timestamp) and `:226-244` (forced audit failure → upsert rolled back, 0 rows, 0 audits) | ✅ | ✅ (mutation 2) |

**Status**: ✅ Both must-nots proven — evidence-or-zero satisfied, guards independently mutation-tested.

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ — 19 files, all directly attributable to T1–T8 |
| Surgical changes | ✅ |
| No scope creep | ✅ — `git diff 8cd2d80..HEAD --name-only` contains only USP-036 paths; unrelated working-tree churn (`.claude/skills/idsd-spec-driven/*` deletions, `.agents/.skill-lock.json`, `src/app/layout.tsx`) is pre-existing and NOT in these 8 commits |
| Matches patterns | ✅ — mirrors `register-person-by-assistant.ts` (sensitive-action sequence), `CandidateProfile`/`ProviderProfile` (1:1 model), `view-candidate-for-employer.ts` (pure serializer), `EDUCATION_LEVELS` (local-literal-array carve-out) |
| Spec-anchored outcome check | ✅ — see table above |
| Per-layer Coverage Expectation met | ✅ — domain 1:1 role-branch coverage; action/query cover happy+Zod-fail+FORBIDDEN+NOT_FOUND+UNAUTHENTICATED+edge(inactive)+MN-02(happy+forced-failure) |
| Every test maps to a spec requirement | ✅ — no unclaimed tests found |
| Documented guidelines followed | `CLAUDE.md`, `docs/arch/project-guideline.md` §4/§9/§12 (sensitive Server Action sequence, View Models, test policy) |

---

## Deviation Review (Implementer-declared)

| # | Deviation | Verdict |
|---|---|---|
| 1 | `canManageSocioeconomicRecord(roles: readonly string[])` instead of `Role[]` | ✅ Faithful — matches `CurrentPerson.roles: string[]` (identity/server/session.ts) and precedent `canRegisterAssisted`/`hasInactivationPrivilege`. No behavior change, confirmed by mutation 1 exercising the exact guard. |
| 2 | `IncomeBracket`/`HousingSituation` re-derived as local literal arrays | ✅ Faithful — `INCOME_BRACKETS`/`HOUSING_SITUATIONS` values match the Prisma enum 1:1 (`socioeconomic-record-domain.test.ts:46-59`); necessary for the ADR-0017 client-component carve-out (confirmed by production build succeeding with route `(app)/pessoas/[id]/ficha-social` at 176 kB First Load JS, same order of magnitude as sibling routes — no Prisma bleed into the client bundle). |
| 3 | Route at `(app)/pessoas/[id]/ficha-social` instead of `social/pessoas/[personId]/ficha` | ✅ Faithful — design.md explicitly caveated "ajustar à convenção... se já houver área AS"; the chosen path reuses the existing Person-management route family (USP-007/USP-045). |
| 4 | Form action import via relative path instead of deep barrel path | ✅ Faithful — matches `candidate-form.tsx` precedent for the ADR-0017 client/server carve-out; no lint escape-hatch needed (lint gate green). |

None of the 4 deviations weaken a must-not, an AC, or introduce scope creep.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && NODE_ENV=production npm run build`
- **Result** (independently re-run):
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors/warnings
  - `npm run test` — **193 files / 1288 tests passed**
  - `npm run test:integration` — **83 files / 512 tests passed** (Postgres local via `supabase start`, `DATABASE_URL`/`DIRECT_URL` at `127.0.0.1:55322`)
  - `NODE_ENV=production npm run build` — succeeded; `/pessoas/[id]/ficha-social` compiled at 345 B / 176 kB First Load JS
  - `npx prisma migrate status` — "Database schema is up to date!" (31 migrations, including `20260709151509_usp036_socioeconomic_record`, applies clean)
- **Skipped tests**: none observed
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| SOC-01 | Pending | ✅ Verified |
| SOC-02 | Pending | ✅ Verified (AC-036-4 satisfied-by-platform) |
| SOC-036-MN-01 | Pending | ✅ Verified |
| SOC-036-MN-02 | Pending | ✅ Verified |

(`spec.md` traceability table updated to match.)

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 4/4 ACs matched spec outcome (AC-036-4 satisfied-by-platform per spec's own instruction, not a gap)
**Sensor**: 3/3 mutations killed (1 per must-not guard + 1 general)
**Must-nots**: 2/2 green, both guard-mutation-tested
**Gate**: typecheck + lint + 1288 unit + 512 integration + production build — all green; migration applies clean

**What works**: Full vertical slice — schema/migration, domain guard, Zod schema, audited upsert action, guarded+audited-on-read query, pure serializer, client form (ADR-0017-safe), route with defense-in-depth guard, page test, E2E gate-of-session spec. Both must-nots defended in depth (domain + action + query + route) and independently mutation-tested.

**Issues found**: none

**Next steps**: none — USP-036 (U1, Phase 5) is ready to merge.
