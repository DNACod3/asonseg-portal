# USP-027 — Empresa ver lista de candidatos da vaga — Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/candidaturas-busca-candidatos/usp-027-empresa-ver-candidatos/spec.md`
**Diff range**: `8b81b39..5013418` (base `a39f300`, Unit U3 of Fase 3)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1: View Model `viewCandidateForEmployer` | ✅ Done | `src/modules/persons/views/view-candidate-for-employer.ts`, commit `c1216b0` |
| T2: Signed URL do CV | ✅ Done | `resolveCvUrl` in `list-job-applicants.ts`, commit `d561cbf` |
| T3: Query `listJobApplicants` | ✅ Done | commit `0ebd807` |
| T4: Página + componente | ✅ Done | commits `bdcda3a` |
| T5: E2E crítico | ✅ Done (documented deviation — session-gate only) | commit `a932494` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| USP027-01: lista candidaturas ativas ordenadas, via VM | nome, contato, CV, `viewCandidateForEmployer` | `src/modules/jobs/__tests__/list-job-applicants.int.test.ts:218-235` — `expect(res.data.applicants.map(a=>a.candidatePersonId)).toEqual([withCv,noCv,referral])` (ordem `appliedAt asc`) | ✅ PASS |
| USP027-02: badge de encaminhamento | `viaEncaminhamento=true` → badge | `list-job-applicants.int.test.ts:231-234` — `expect(referralItem?.viaEncaminhamento).toBe(true)`; render: `job-applicants-list.test.tsx:41-44` — `getByText('Candidato encaminhado pela ASONSEG')` | ✅ PASS |
| USP027-03: data/hora em `America/Sao_Paulo` | conversão -03:00 exibida | `src/shared/lib/__tests__/time.test.ts:48-57` (utility `formatSaoPaulo` proven: `15:00 UTC → 12:00 SP`) + wiring `src/modules/jobs/components/job-applicants-list.tsx:60` (`formatSaoPaulo(applicant.appliedAt)`) | ✅ PASS (component-level render not independently asserted on exact string — shared utility is precisely proven; low-risk composition) |
| USP027-04: audita ambos os eventos, só via VM | `APPLICATION_VIEWED_BY_EMPLOYER` (job) + `SENSITIVE_FIELD_VIEWED` (person) por candidato | `list-job-applicants.int.test.ts:289-307` — `auditLog.findFirst` for both event types, not null | ✅ PASS |
| USP027-06: outra Empresa → FORBIDDEN, nada carregado | `res.error.code==='FORBIDDEN'`, audit count unchanged | `list-job-applicants.int.test.ts:258-269` | ✅ PASS |
| USP027-07 (edge): vaga inexistente → NOT_FOUND | `res.error.code==='NOT_FOUND'` | `list-job-applicants.int.test.ts:271-279` | ✅ PASS |
| USP027-08 (edge): sem candidaturas ativas → vazio sem erro | `applicants=[]`, `total=0` | `list-job-applicants.int.test.ts:281-287`; render `job-applicants-list.test.tsx:25-28` | ✅ PASS |

**Status**: ✅ All ACs covered (1 low-risk composition note on AC3, not a gap — the timezone conversion itself is precisely unit-tested).

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `src/modules/jobs/queries/list-job-applicants.ts:143-155` | Spread raw `row.candidate.cpf` (SELECT extended + row-leak) into `applicants.push` — simulates USP027-MN-01/MN-05 violation | ✅ Killed — `list-job-applicants.int.test.ts` sensor test failed: `expected ... not to contain '52998224725'` |
| 2 | `src/modules/jobs/queries/list-job-applicants.ts:119` | `if (!authorized && false)` — disabled the FORBIDDEN ownership guard (USP027-MN-02) | ✅ Killed — `USP027-06/MN-02` test failed: `expect(res.ok).toBe(false)` received `true` |
| 3 | `src/modules/persons/actions/activate-candidate-role.ts:76` | Removed `tx.person.update({ phone })` — phone-persistence fix (USP-027 dependency, see below) | ✅ Killed — `candidate-actions.test.ts` happy-path assertion `expect(txState.personUpdate).toHaveBeenCalledWith(...)` failed (0 calls) |

**Sensor depth**: lightweight (privacy-critical path — 3 targeted mutations covering the raw-row leak, the ownership bypass, and the phone-persistence dependency; all real-tree mutations were applied then reverted via `git checkout --`, confirmed via `git status --short` after each).
**Result**: 3/3 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| USP027-MN-01 | carregar/emitir `cpf`/`birthDate`/`fullAddress` ao empregador | unit `view-candidate-for-employer.test.ts` (Row/View shape has no forbidden keys) + int `list-job-applicants.int.test.ts:309-317` — `expect(serialized).not.toContain(CPF_SENSOR)` / `ENDERECO_SENSOR` | ✅ | ✅ (Mutation 1) |
| USP027-MN-02 | ver candidatos de vaga de outra Empresa | `list-job-applicants.int.test.ts:258-269` — `FORBIDDEN`, audit count unchanged | ✅ | ✅ (Mutation 2) |
| USP027-MN-03 | incluir candidaturas canceladas | `list-job-applicants.int.test.ts:251-256` — `expect(...some(a=>a.candidatePersonId===candidateCancelledId)).toBe(false)` | ✅ | not separately mutated this cycle — `where: { cancelledAt: null }` is a single-line static filter, structurally low-risk; negative test evidence is green and direct |
| USP027-MN-04 | servir contato/CV sem auditar | `list-job-applicants.int.test.ts:258-269` (denied → 0 events) + `:289-307` (served → both events present) | ✅ | covered by Mutation 2 (guard removal path also proven not to audit when access should have been denied) |
| USP027-MN-05 | retornar linha crua do Prisma ao cliente | Type-level: `EmployerCandidateRow`/`EmployerCandidateView` structurally exclude `cpf`/`birthDate`/`fullAddress`; runtime: `list-job-applicants.int.test.ts:309-317` sensor; component: `JobApplicantsList` typed to `EmployerCandidateView[]` only | ✅ | ✅ (Mutation 1 — bypassing the type system to spread the raw field was required to produce a leak, proving the structural guarantee holds under normal typed usage) |

**Status**: ✅ All 5 must-nots proven (negative test green; the two highest-risk guards — PII leak and ownership bypass — independently killed via mutation).

---

## Interactive UAT

Not performed — backend + RSC feature, automated checks (unit/integration/component/E2E) are sufficient per skill guidance (no complex interactive UI flow warranting human judgment beyond what E2E session-gate + component tests already cover).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ |
| Surgical changes | ✅ (touched only `persons/views`, `jobs/queries`, `jobs/components`, `jobs/server` reuse, app route, e2e, + the pre-existing `activateCandidateRole` phone fix explicitly called out as a documented dependency) |
| No scope creep | ✅ |
| Matches patterns | ✅ (molded on `viewJobForVisitor`, `access-report.ts` audit sequencing, `submit-job-for-moderation.ts` ownership gate) |
| Spec-anchored outcome check | ✅ (see table above) |
| Per-layer Coverage Expectation met | ✅ — domain/VM unit 1:1, query integration covers happy+ownership+audit+empty+NOT_FOUND+sensor |
| Every test maps to a spec requirement | ✅ — every `it()` title in `list-job-applicants.int.test.ts` and `job-applicants-list.test.tsx` is tagged with a USP027-NN/MN-NN id |
| Documented guidelines followed | `docs/arch/project-guideline.md` §5 (View Models), §12 (testing DoD), `CLAUDE.md` Server Action / audit sequence (adapted for a sensitive read) |

---

## Edge Cases

- [x] Vaga inexistente → `NOT_FOUND` sem vazar existência
- [x] Vaga sem candidaturas ativas → estado vazio, sem erro
- [x] Candidatura cancelada excluída da lista
- [x] Candidato sem `CandidateProfile`/CV → `cv.available=false`, sem quebrar, sem auditar acesso a CV inexistente (viewedFields só inclui `'cv'` quando disponível — `list-job-applicants.ts:179`)
- [x] Telefone `null` → "não informado" (`job-applicants-list.test.tsx:51-54`)
- [x] Responsável com vínculo revogado/pendente → `FORBIDDEN` (coberto estruturalmente por `requireActiveResponsible`'s `status: 'ACTIVE', revokedAt: null` filter, exercised by the ownership-deny test)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && NODE_ENV=production npm run build && npm run test:e2e` (bare `npm run build` fails on a pre-existing `/500` prerender unrelated to this diff — used `NODE_ENV=production` per orchestrator instruction)
- **Result**:
  - typecheck: 0 errors
  - lint: 0 errors
  - unit/component (`npm run test`): 153 files, 1063 tests passed
  - integration (`npm run test:integration`): 61 files, 362 tests passed
  - build: succeeded, both new routes (`/empresa/[empresaId]/vagas/[jobId]/candidatos`, `/empresa/[empresaId]/candidatos`) present in the route manifest
  - e2e (scoped to U3 specs): 4/4 passed
- **Migration coherence** (scrutinized, see USP-028 report for the shared migration `20260708150000_usp028_candidate_search` — this feature depends on it for `Application`/`Person` fields only, no schema change of its own)
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| USP027-01 | Pending | ✅ Verified |
| USP027-02 | Pending | ✅ Verified |
| USP027-03 | Pending | ✅ Verified |
| USP027-04 | Pending | ✅ Verified |
| USP027-06 | Pending | ✅ Verified |
| USP027-07 | Pending | ✅ Verified |
| USP027-08 | Pending | ✅ Verified |
| USP027-MN-01 | Pending | ✅ Verified |
| USP027-MN-02 | Pending | ✅ Verified |
| USP027-MN-03 | Pending | ✅ Verified |
| USP027-MN-04 | Pending | ✅ Verified |
| USP027-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 7/7 ACs matched spec outcome (1 low-risk composition note on AC3 timezone display, not a gap)
**Sensor**: 3/3 mutations killed
**Must-nots**: 5/5 green
**Gate**: all green (typecheck, lint, 1063 unit/component, 362 integration, production build, 4 e2e)

**What works**: Privacy two-barrier holds end-to-end — the `EmployerCandidateRow`/`View` types structurally exclude `cpf`/`birthDate`/`fullAddress`, the Prisma `select` never requests them, and the runtime sensor (seeded CPF/address strings) confirmed absence in the serialized payload; bypassing the type system to force a leak was required to break it, and doing so killed the test. Ownership gate (`requireActiveResponsible`) is checked before any candidate data loads, and disabling it was caught immediately. Audit trail (`APPLICATION_VIEWED_BY_EMPLOYER` + `SENSITIVE_FIELD_VIEWED`) is recorded in the same transaction and verified both for the served and denied paths. The `activateCandidateRole` phone-persistence fix (a documented cross-cutting dependency of this USP) is proven by a unit test that goes red when the `tx.person.update` call is removed.

**Issues found**: None blocking. Minor note: AC3 (timezone display) is proven via the shared `formatSaoPaulo` utility's own precise unit tests plus visual wiring in the component, rather than a dedicated assertion of the exact rendered string in `job-applicants-list.test.tsx` — low risk, not flagged as a gap.

**Next steps**: None required for this unit.
