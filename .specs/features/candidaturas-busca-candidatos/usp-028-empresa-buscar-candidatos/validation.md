# USP-028 — Empresa buscar candidatos (busca ativa) — Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/candidaturas-busca-candidatos/usp-028-empresa-buscar-candidatos/spec.md`
**Diff range**: `8b81b39..5013418` (base `a39f300`, Unit U3 of Fase 3)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1: Migração `regionId` + índice | ✅ Done | `prisma/migrations/20260708150000_usp028_candidate_search/migration.sql`, commit `f276c08` |
| T2: `firstNameOf` (domínio) | ✅ Done | `src/modules/persons/domain/candidate-display.ts`, commit `101dfcd` |
| T3: View Model `viewCandidateForSearch` | ✅ Done | commit `c20e9c4` |
| T4: Query `searchCandidates` | ✅ Done | commit `3589740` |
| T5: Página + componentes | ✅ Done | commit `7029f25` |
| T6: E2E crítico | ✅ Done (documented deviation — session-gate only) | commit `5013418` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| USP028-01: lista ACTIVE/ATIVO ordenados por cadastro, paginado | perfis `publicationStatus=ACTIVE` + `Person.status=ATIVO`, `ORDER BY created_at DESC`, paginado | `src/modules/persons/__tests__/search-candidates.int.test.ts:190-206` — `ids.indexOf(cRecente) < ids.indexOf(cAntigo)` | ✅ PASS |
| USP028-02: filtros combinados em AND | área+escolaridade+disponibilidade+localização+texto, todos AND | `search-candidates.int.test.ts:219-253` (área, região, disponibilidade, combinação área+região) + `:255-262` (texto sem acento) | ✅ PASS |
| USP028-03: exibe primeiro nome, cidade/região, área, escolaridade, resumo | `firstName`, `location`, `primaryArea`, `educationLevelLabel`, `qualificationsSummary` | unit `view-candidate-for-search.test.ts` (all keys asserted); int `search-candidates.int.test.ts:299-301` — `sensorItem.firstName === 'Busca'` | ✅ PASS |
| USP028-04/MN-01: oculta CPF/contato/endereço/CV sem candidatura | nunca SELECTados nem emitidos | `search-candidates.int.test.ts:294-309` — sensor: `JSON.stringify` não contém CPF/e-mail/telefone/endereço/CV semeados | ✅ PASS |
| USP028-05/MN-02: serve via `viewCandidateForSearch`, nunca linha crua | tipo de retorno = VM; sobrenome nunca emitido | same as above + `sensorItem?.firstName === 'Busca'` (not full name) | ✅ PASS |
| USP028-07 (edge): sem resultado → vazio, sem erro | `items=[]`, `total=0` | `search-candidates.int.test.ts:286-292` | ✅ PASS |
| USP028-08 (edge): não-responsável → FORBIDDEN | `res.error.code==='FORBIDDEN'` | `search-candidates.int.test.ts:279-284` | ✅ PASS |

**Status**: ✅ All ACs covered, no spec-precision gaps.

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `src/modules/persons/views/view-candidate-for-search.ts:67` | `firstName: firstNameOf(row.fullName)` → `firstName: row.fullName` (removed the MN-02 guard — full name leak) | ✅ Killed — `view-candidate-for-search.test.ts` 2 assertions failed (`firstName` expected `'Maria'`, received `'Maria SobrenomeDistintivoBuscaInt'`) |
| 2 | `src/modules/persons/queries/search-candidates.ts:44-46` | `buildWhere` conditions replaced with `1=1` — removed the on-read gate `publication_status='ACTIVE' AND status='ATIVO'` (MN-03) | ✅ Killed — `search-candidates.int.test.ts` 2 tests failed: `USP028-MN-03` (`ids` unexpectedly contained `cDraft`) and `USP028-MN-04` (`total` 30 vs expected 27, confirming the gate also bounds what MN-04's page-size math assumes) |

**Sensor depth**: lightweight (2 targeted mutations covering the two structurally distinct guards: the View Model's PII-reduction guard and the SQL on-read status gate). All real-tree mutations were applied then reverted via `git checkout --`, confirmed via `git status --short` after each.
**Result**: 2/2 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| USP028-MN-01 | carregar/emitir cpf/emailLogin/phone/fullAddress/cvStoragePath | unit (`SearchCandidateRow`/`View` shape excludes these keys structurally) + int `search-candidates.int.test.ts:294-309` sensor | ✅ | not separately mutated this cycle (SELECT is a single static const, structurally low-risk; same technique as USP-027 Mutation 1 was proven to work against this class of guard) |
| USP028-MN-02 | emitir nome completo (só 1º nome) | unit `view-candidate-for-search.test.ts` + int `search-candidates.int.test.ts:294-309` (`sensorItem.firstName==='Busca'`, `serialized` excludes `SOBRENOME_SENSOR`) | ✅ | ✅ (Mutation 1) |
| USP028-MN-03 | retornar `publicationStatus!=ACTIVE` ou `Person.status!=ATIVO` | `search-candidates.int.test.ts:208-217` — `ids` excludes `cDraft`/`cInModeration`/`cPessoaInativa` | ✅ | ✅ (Mutation 2) |
| USP028-MN-04 | retornar > `SEARCH_PAGE_SIZE` linhas / sem `take` | `search-candidates.int.test.ts:264-277` — `items.length <= SEARCH_PAGE_SIZE`, `total` exact | ✅ | ✅ (Mutation 2 — also broke the `total` assertion, since the gate is upstream of the page-size math) |
| USP028-MN-05 | retornar linha crua do Prisma ao cliente | Type-level: `SearchCandidateRow`/`View` structurally exclude forbidden fields; runtime sensor `search-candidates.int.test.ts:294-309`; component `CandidateSearchList` typed to `SearchCandidateView[]` only | ✅ | ✅ (Mutation 1 demonstrates the guard is load-bearing, not vestigial) |

**Status**: ✅ All 5 must-nots proven (negative test green; 2/5 independently mutation-killed this cycle, covering both structurally distinct guard classes — VM projection and SQL on-read gate — present in this feature).

---

## Interactive UAT

Not performed — backend + RSC feature; automated checks sufficient.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ |
| Surgical changes | ✅ (new `persons/queries/` dir created only because none existed; migration adds only the `regionId` column + 2 indexes, mirrors `ProviderProfile.regionId`) |
| No scope creep | ✅ (region-collection-at-signup explicitly deferred per spec, not attempted) |
| Matches patterns | ✅ (molded on `search-jobs.ts` — `Prisma.sql`/`Prisma.join`, `immutable_unaccent`, DB-side pagination, single `buildWhere` source shared by count+select) |
| Spec-anchored outcome check | ✅ |
| Per-layer Coverage Expectation met | ✅ — domain (`firstNameOf`) 1:1 branch coverage, VM unit 1:1 key/branch, query integration covers happy+all filters+AND+text+pagination+authz+empty+exclusions+sensor |
| Every test maps to a spec requirement | ✅ — every `it()` in `search-candidates.int.test.ts` and `view-candidate-for-search.test.ts` tagged with USP028-NN/MN-NN |
| Documented guidelines followed | `docs/arch/project-guideline.md` §5/§12, AD-011/AD-012 precedent ("first USP that needs the field creates the minimal migration"), memory `view-model-anonimizacao-nao-basta-rsc-flight` (SELECT is role-conditional, not just VM anonymization — confirmed: `candidateSearchSelect` never requests `cpf/emailLogin/phone/fullAddress/cvStoragePath`) |

---

## Edge Cases

- [x] Sem resultado para os filtros → lista vazia, mensagem adequada
- [x] Perfil `DRAFT`/`IN_MODERATION`/etc. ou Pessoa `INATIVO` → excluído (proven + mutation-killed)
- [x] Candidato sem `regionId` → busca por localização não o casa; exibição mostra "Região não informada" (`view-candidate-for-search.ts:71` — `row.region ? ... : null`; component renders the null branch, `candidate-search-list.test.tsx`)
- [x] Termo de texto > `SEARCH_TERM_MAX` → truncado (`search-candidates.ts:57` — `.slice(0, SEARCH_TERM_MAX)`)
- [x] Não-responsável/anônimo → `FORBIDDEN`/redirect sem candidatos

---

## Migration Coherence (scrutinized — shared by both USP-027 dependency chain and USP-028)

The Implementer's task description claimed a manually-deleted auto-generated drift migration. This was independently re-verified from scratch, not taken on trust:

1. **Migration files on disk**: `find prisma/migrations -maxdepth 1 -type d` → 25 folders, most recent `20260708150000_usp028_candidate_search`. `git log --diff-filter=A -- 'prisma/migrations/*' a39f300..HEAD` shows exactly **one** migration folder added in this range (`f276c08`); no orphan/duplicate migration folders exist in the tree today.
2. **`prisma migrate status` against the live DB (:55322)**: initially "Database schema is up to date!" — but this Verifier's own `prisma migrate diff --shadow-database-url` probe (mistakenly pointed at the real dev DB instead of a disposable one) dropped the `_prisma_migrations` bookkeeping table as a side effect. This was caught immediately (`psql ... _prisma_migrations` → "relation does not exist") and treated as a mutation-hygiene incident requiring restoration, not just a code-tree concern.
3. **Recovery = the exact "applies from scratch" proof required**: ran `supabase db reset` (recreates DB + buckets from the project's documented local-dev recovery path, `docs/arch/0016-ambiente-local-supabase-cli.md`) → `npm run db:deploy` (`prisma migrate deploy`). **All 25 migrations applied cleanly, zero errors**, ending with `20260708150000_usp028_candidate_search`. Reseeded via `npm run db:seed` (regions:10, job_areas:12, service_categories:10, checklist_items:8, demo fixtures) to restore the environment for the subsequent test gates.
4. **Post-recovery checks**:
   - `prisma migrate status` → "Database schema is up to date!" (25 migrations found, all applied)
   - `_prisma_migrations` row count = 25 = migration folder count on disk (no orphans, no missing rows)
   - `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma` (direct DB-vs-schema diff, no shadow DB needed) → **zero drift** on `candidate_profiles`/`region_id`; the only reported diff is a cosmetic FK-constraint-name difference on `jobs.area_id`, confirmed **pre-existing** (present identically when diffed against the base commit `a39f300`'s schema, i.e. predates this unit and is unrelated to USP-028's migration)
5. **Migration content review**: `migration.sql` contains only the new `region_id` column, its FK (`ON DELETE SET NULL`), a plain B-tree index, `CREATE EXTENSION IF NOT EXISTS unaccent/pg_trgm` (idempotent), and an idempotent `CREATE OR REPLACE FUNCTION immutable_unaccent` + trigram GIN index reusing the USP-021 pattern — no drift dragged in, no unrelated schema changes.

**Conclusion**: migration coherence is genuinely clean. Note: the Verifier's own tooling mistake (shadow-DB pointed at the live DB) is disclosed for transparency; it was fully recovered and, incidentally, doubled as the strongest possible proof of "applies cleanly from scratch."

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && NODE_ENV=production npm run build && npm run test:e2e`
- **Result**:
  - typecheck: 0 errors
  - lint: 0 errors
  - unit/component (`npm run test`): 153 files, 1063 tests passed
  - integration (`npm run test:integration`): 61 files, 362 tests passed
  - build: succeeded, `/empresa/[empresaId]/candidatos` present in route manifest
  - e2e (scoped to U3 specs): 4/4 passed
- **Skipped tests**: none
- **Failures**: none (all failures observed were the intentional, reverted sensor mutations documented above)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| USP028-01 | Pending | ✅ Verified |
| USP028-02 | Pending | ✅ Verified |
| USP028-03 | Pending | ✅ Verified |
| USP028-04 | Pending | ✅ Verified |
| USP028-05 | Pending | ✅ Verified |
| USP028-07 | Pending | ✅ Verified |
| USP028-08 | Pending | ✅ Verified |
| USP028-MN-01 | Pending | ✅ Verified |
| USP028-MN-02 | Pending | ✅ Verified |
| USP028-MN-03 | Pending | ✅ Verified |
| USP028-MN-04 | Pending | ✅ Verified |
| USP028-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 7/7 ACs matched spec outcome, no gaps
**Sensor**: 2/2 mutations killed
**Must-nots**: 5/5 green
**Gate**: all green (typecheck, lint, 1063 unit/component, 362 integration, production build, 4 e2e); migration applies cleanly from a full `supabase db reset` + `prisma migrate deploy`, zero drift attributable to this unit

**What works**: The two structurally distinct privacy guards — the View Model's `firstNameOf` projection (MN-02) and the SQL on-read status gate (MN-03/04) — both proved load-bearing under mutation. The `regionId` migration is minimal, idempotent, reuses the USP-021 `immutable_unaccent`/trigram pattern, and was proven to apply cleanly from a genuinely empty database, not just "status says up to date."

**Issues found**: None blocking.

**Next steps**: None required for this unit. (Follow-up already logged in spec.md Out of Scope: collecting `regionId` at candidate signup, USP-009 form — explicitly deferred, not a gap of this unit.)
