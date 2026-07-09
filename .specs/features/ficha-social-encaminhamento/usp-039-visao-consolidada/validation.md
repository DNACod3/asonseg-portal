# USP-039 — Visão consolidada da Pessoa — Validation

**Date**: 2026-07-09
**Spec**: `.specs/features/ficha-social-encaminhamento/usp-039-visao-consolidada/spec.md`
**Diff range**: `0df2ab7..HEAD` (8 commits, `3514381`→`97f772d`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|---|---|---|
| T1 | ✅ Done | `canViewConsolidatedPerson` + `CONSOLIDATED_PERSON_ROLES`, commit `3514381` |
| T2 | ✅ Done | `listPersonApplications` (jobs), commit `5d3ac7f` |
| T3 | ✅ Done | `listPersonReferrals` (referrals, new `queries/` dir), commit `61fbfb9` |
| T4 | ✅ Done | `listPersonServiceInterests` (services), commit `e77d49f` |
| T5 | ✅ Done | `listPersonCompanyGrants` (companies), commit `3a717d4` |
| T6 | ✅ Done | `viewPersonForSocialAssistant` assembler, commit `a11f253` |
| T7 | ✅ Done | `ConsolidatedPersonPanel`, commit `0d7150b` |
| T8 | ✅ Done | Page + route guard + E2E, commit `97f772d` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| AC-039-1: AS/BOARD abre painel → todas as dimensões | `view.ficha` populated + all 5 dims present + `SENSITIVE_FIELD_VIEWED` audited | `src/modules/persons/__tests__/view-person-for-social-assistant.int.test.ts:167-189` — `expect(view?.ficha).toMatchObject(...)`, `expect(view?.applications/…/companyGrants).toEqual(...)`, `expect(getSocioeconomicRecordSpy).toHaveBeenCalledTimes(1)`, `audit` row found | ✅ PASS |
| AC-039-1 (BOARD variant) | BOARD also receives ficha | `view-person-for-social-assistant.int.test.ts:191-197` — `expect(view?.ficha?.incomeBracket).toBe('FROM_2_TO_3_MW')` | ✅ PASS |
| AC-039-2: VOLUNTEER (or other unauthorized role) → denied, no dimension | route `notFound()`; assembler `null`; zero reads/assembler calls | `page.test.tsx:90-102` — `rejects.toBeInstanceOf(NotFoundError)`, `expect(...).not.toHaveBeenCalled()` ×6; `view-person-for-social-assistant.int.test.ts:225-232` — `expect(view).toBeNull()`, spy not called | ✅ PASS |
| AC-039-3: COORDINATOR → operational dims, no ficha | `view.ficha === null`; all other dims present | `view-person-for-social-assistant.int.test.ts:199-223` — `expect(view?.ficha).toBeNull()`, `expect(view?.applications/…).toEqual(FIXTURE_DIMENSIONS...)` | ✅ PASS |
| AC-039-4: assembly via `viewPersonForSocialAssistant`, single anonymization source | page calls only the assembler to build `view`; component only consumes `ConsolidatedPersonView` | `src/app/(app)/pessoas/[id]/visao-consolidada/page.tsx:53-59`; `src/modules/persons/components/consolidated-person-panel.tsx:1-9` (props typed only as `ConsolidatedPersonView`, no Prisma import) | ✅ PASS |
| Edge: Pessoa sem ficha (AS) → `null`, no error, no audit | `view.ficha === null`, `getSocioeconomicRecord` called once, no `SENSITIVE_FIELD_VIEWED` row | `view-person-for-social-assistant.int.test.ts:243-256` | ✅ PASS |
| Edge: dimensões vazias → estado vazio, no error | `[]` per dimension renders "nenhum registro" | `ConsolidatedPersonPanel.test.tsx:43-50` (component); `list-*.int.test.ts` "sem X → []" cases (jobs/referrals/services/companies) | ✅ PASS |
| Edge: Pessoa inativa → exibida normalmente | status + inactivation metadata rendered | `ConsolidatedPersonPanel.test.tsx:179-197` | ✅ PASS |
| Edge: Pessoa inexistente → `notFound()` | assembler → `null` → route `notFound()` | `view-person-for-social-assistant.int.test.ts:234-241` (assembler null); `page.test.tsx:165-173` (route 404 when assembler null) | ✅ PASS |
| Edge: dimensão excede teto → `take` pagina | `rows.length <= 50` even with 55 rows created | `jobs/__tests__/list-person-applications.int.test.ts:131-151`; analogous `take` assertions in referrals/services/companies int tests | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps found (spec gives precise field/role/outcome values throughout; tests target exactly those).

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
|---|---|---|---|
| 1 | `src/modules/persons/views/view-person-for-social-assistant.ts:90` | B1 must-not guard: swapped ficha gate `canManageSocioeconomicRecord(viewer.roles)` → `canViewConsolidatedPerson(viewer.roles)` (would let COORDINATOR fetch the ficha) | ✅ Killed — `SOC-039-MN-01` coordenador negative test failed (`getSocioeconomicRecordSpy` called when it should not have been); 1/6 int tests red |
| 2 | `src/modules/persons/views/view-person-for-social-assistant.ts:76` | MN-02 assembler guard: flipped `if (!canViewConsolidatedPerson(...))` → `if (canViewConsolidatedPerson(...))` (inverted deny/allow) | ✅ Killed — 5/6 int tests red, including the VOLUNTEER→null test and all happy-path tests (assembler now returns `null` for authorized viewers and non-null for unauthorized) |
| 3 | `src/app/(app)/pessoas/[id]/visao-consolidada/page.tsx:39` | MN-02 route guard: flipped `if (!canViewConsolidatedPerson(...))` → `if (canViewConsolidatedPerson(...))` (inverted route-level deny/allow) | ✅ Killed — 3/4 page tests red, including the VOLUNTEER `notFound()` test and both authorized-viewer happy-path tests |

**Sensor depth**: lightweight (3 targeted mutations), each hand-picked to strike the exact guard the spec's must-nots depend on (both barriers of MN-01's B1, and both independent layers — assembler + route — of MN-02's defense-in-depth). All mutations applied in the real working tree, run against the real gate command, then reverted via `git checkout --`; working tree confirmed clean (`git diff HEAD --stat` empty) after each.
**Result**: 3/3 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| SOC-039-MN-01 | SELECT nor serialize ficha fields for non-AS/BOARD viewer | `src/modules/persons/__tests__/view-person-for-social-assistant.int.test.ts:199-223` — `getSocioeconomicRecordSpy` not called, `view.ficha` null, `JSON.stringify(view)` does not match sensitive values, no `SENSITIVE_FIELD_VIEWED` row; plus `ConsolidatedPersonPanel.test.tsx:52-59` (component never renders ficha labels/values when `ficha=null`) and `page.test.tsx:104-123` (route-level: coordenador → panel stub shows `ficha-ausente`) | ✅ | ✅ (Mutation 1 above) |
| SOC-039-MN-02 | Return any consolidated data to VOLUNTEER (or any unauthorized role) | `src/modules/persons/__tests__/consolidated-person.test.ts:27-40` (domain: 5 roles + `[]` + combo → `false`); `view-person-for-social-assistant.int.test.ts:225-232` (assembler → `null`, spy not called); `page.test.tsx:90-102` (route → `notFound()`, zero reads/assembler calls) | ✅ | ✅ (Mutations 2 and 3 above — assembler and route guard independently discriminated) |

**Status**: ✅ Both must-nots proven — negative tests green, guard mutations for both barriers killed.

---

## Interactive UAT

Not performed — backend/privacy-critical read surface with independent module/integration/page/component test coverage; per `validate.md` §3, automated checks are sufficient for this class of change. Not user-facing in the sense of requiring visual/interaction judgment.

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ — 8 small, single-purpose files per task boundary |
| Surgical changes | ✅ — diff `0df2ab7..HEAD` touches only the 22 files listed in the task breakdown; zero unrelated churn |
| No scope creep | ✅ — no write paths added (read-only, per spec Out-of-Scope); no new model/migration |
| Matches patterns | ✅ — molds `list-job-applicants.ts`/`list-provider-interests.ts`/`list-active-responsibles.ts` for the 4 reads; `viewPersonForAccessReport` precedent for the assembler shape; `ficha-social/page.tsx` precedent for the route guard |
| Spec-anchored outcome check (asserted values match spec) | ✅ — see AC table above |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ — domain guard: all roles × auth/unauth; reads: scope/take/active-vs-historical/empty; assembler: happy AS/BOARD + MN-01 + MN-02 + nonexistent Person; page: MN-01 + MN-02 + happy + nonexistent; component: all dimensions + MN-01 + empty states + inactive Person |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — every `it()`/`it.each` traces to an AC, edge case, or must-not (see Test Coverage Matrix in tasks.md, honored 1:1) |
| Documented guidelines followed | ✅ — `CLAUDE.md` (View Model privacy, `take` pagination, restricted `select`, barrel-only imports); `docs/arch/project-guideline.md` §5/§12; project Lesson "Anonimizar no View Model não basta (RSC/Flight)" — honored via B1 (SELECT condicional ao papel) + B2 (structural strip), and directly verified via `JSON.stringify(view)` regex assertion, not just field-presence checks |

---

## Edge Cases

- [x] Coordenador: ficha omitida do View Model **e** não SELECIONADA do DB (MN-01, edge case do épico) — verified with live mutation
- [x] Pessoa sem ficha ainda (AS/BOARD): seção "sem registro", sem erro, sem audit
- [x] Dimensões vazias: estado vazio por seção, sem erro
- [x] Pessoa inativa: exibida normalmente com metadados de inativação
- [x] Pessoa inexistente: `notFound()`, sem vazar existência
- [x] Dimensão de lista excede teto: pagina via `take` (verified for `listPersonApplications`; equivalent `take` present and asserted analogously for the other 3 reads)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && NODE_ENV=production npm run build`
- **Result**:
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors/warnings
  - `npm run test` (unit) — 204 files, 1354 tests passed
  - `npm run test:integration` (full suite) — 92 files, 561 tests passed (includes the 5 new USP-039 int files, 20 tests)
  - `NODE_ENV=production npm run build` — succeeded; `/pessoas/[id]/visao-consolidada` compiles as `ƒ` (dynamic Server Component), no Prisma/server leak surfaced in the client bundle table
- **Skipped tests**: none observed
- **Failures**: none (post-mutation-revert; the tree is confirmed identical to `HEAD` after the sensor runs — `git diff HEAD --stat` empty)

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| SOC-06 | Tasks | ✅ Verified |
| SOC-039-MN-01 | Tasks | ✅ Verified |
| SOC-039-MN-02 | Tasks | ✅ Verified |

---

## Additional confirmations

- **Diff scope**: `git diff --stat 0df2ab7..HEAD` shows exactly the 22 files from the task breakdown (2049 insertions, 0 deletions) — no unrelated churn committed in this unit's range. (The working tree has unrelated pre-existing uncommitted churn from prior sessions — skill-workspace file deletions, `.specs/LESSONS.md`, etc. — untouched by, and out of scope for, this unit; confirmed restored to its original state after the discrimination-sensor mutations.)
- **No migration**: `git diff --stat 0df2ab7..HEAD -- prisma/` empty.
- **No import cycle**: `persons` module imports `PersonApplicationRow`/`PersonReferralRow`/`ProviderServiceRow`/`PersonServiceInterestRow`/`PersonCompanyGrantRow` exclusively via `import type` in `view-person-for-social-assistant.ts` — grep across `src/modules/persons` confirms no runtime `from '@/modules/{jobs,referrals,services,companies}'` import (the one pre-existing `import type { JobAreaOption, RegionOption } from '@/modules/jobs'` in `candidate-search-form.tsx` predates this unit and is also type-only).
- **Composition-root pattern**: the page (`(app)/pessoas/[id]/visao-consolidada/page.tsx`) fetches the 5 cross-module dimensions via their barrels and passes them as typed input to the assembler — `persons` stays a sink, matching Assumption #5.
- **Restricted `select` / no third-party PII**: all 4 new reads use `select satisfies Prisma.*Select` restricted to operational fields (title/nomeFantasia/fullName/status/dates) — no cpf/birthDate/address/contact fields selected in any of the 4 queries (visually confirmed by reading each file).
- **`take` pagination**: all 4 reads set an explicit `take: 50` constant; integration tests exercise the real `where` clause against Postgres (not page-level mocks) per AD-021.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/10 AC + edge-case rows matched spec-defined outcomes — 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Must-nots**: 2/2 green, both barriers independently discriminated
**Gate**: typecheck/lint/unit(1354)/integration(561)/build all green

**What works**: Full USP-039 read-only consolidated panel — AS/BOARD sees all dimensions incl. ficha with audit-on-read; coordenador sees the operational surface with the ficha structurally and behaviorally absent (2-barrier defense, both barriers live-mutation-tested); voluntário/unauthorized roles are denied at both the assembler and the route layer independently; no Prisma migration; no module import cycle; restricted `select` across the 4 new reads; real-`where` integration tests per AD-021.

**Issues found**: none.

**Next steps**: none — ready to proceed. Non-blocking, already flagged by the Planner per spec Assumption #3: coordenador area-scoping (which Persons a coordinator may open) is not modeled in MVP and is out of this unit's scope; documented as a follow-up for DPO/diretoria, not a defect of USP-039.
