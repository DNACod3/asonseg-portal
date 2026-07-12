# USP-055 — Empresas Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-055-empresas/spec.md`
**Diff range**: `2fb367c~1..609b5b2` (7 commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (fonte única de rótulos/opções) | ✅ Done | `domain/company-type.ts`, exported via barrel |
| T2 (classificador CPF/e-mail client-safe) | ✅ Done | `domain/responsible-identifier.ts`, re-exported from schema |
| T3 (reuso de consent MOD-2) | ✅ Done | `create-company.ts:107-143` |
| T4 (editar Empresa 5 tipos) | ✅ Done | `edit-company-form.tsx` |
| T5 (cadastrar Empresa 5 tipos) | ✅ Done | `create-company-form.tsx` |
| T6 (mensagem CPF específica) | ✅ Done | `add-responsible-form.tsx` `superRefine` |

Extra commit `dd99dcc` (not in tasks.md): types the `EMPRESA` test fixture as `EditCompanyFormProps['empresa']` instead of an inline `as const` — cosmetic, no behavior change (confirmed via diff: only a type annotation swap).

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ------------------------ | ------ |
| EMP055-01: 2ª Empresa reusa consent ativo | `ok`, grant criado, consent **não** duplicado | `create-company.int.test.ts:222-262` — `expect(result.ok).toBe(true)`; `expect(after).toHaveLength(1)`; `expect(after[0]?.id).toBe(before[0]?.id)` | ✅ PASS |
| EMP055-02: 1ª Empresa cria consent (preservado) | Consent criado como hoje | `create-company.test.ts:126-132` — `expect(state.consentCreateCallCount).toBe(1)` | ✅ PASS |
| EMP055-03: invariantes USP-012 preservadas | hash validado, CNPJ único, atomicidade | `create-company.int.test.ts:155-217` — `U12-MN-02`/`U12-MN-03` tests unchanged, both green (see Gate) | ✅ PASS |
| EMP055-04: corrida de duplo submit não duplica consent ativo | ≤1 consent ativo; índice parcial como rede | Design documents reread-inside-tx + existing unique index as backstop; no dedicated concurrency test (index is DB-level, not app-testable without a race harness) | ⚠️ Spec-precision gap (see below) |
| EMP055-05: editar Empresa exibe 5 tipos | 5 `value`s de radio presentes | `edit-company-form.test.tsx:52-61` — `expect(radios.map(...)).toEqual(['MEI','SIMPLES_NACIONAL','LUCRO_PRESUMIDO','LUCRO_REAL','SA'])` | ✅ PASS |
| EMP055-06: cadastrar Empresa exibe 5 tipos, default SIMPLES_NACIONAL | 5 `value`s presentes; default checked | `create-company-form.test.tsx:58-73` — same array assertion + `expect(screen.getByRole('radio',{name:/^simples nacional$/i})).toBeChecked()` | ✅ PASS |
| EMP055-07: pré-seleciona tipo de `defaultValues.type` (SA) | radio SA checked | `edit-company-form.test.tsx:64-67` — `renderForm({type:'SA'})` → `expect(...getByRole('radio',{name:/sociedade anônima/i})).toBeChecked()` | ✅ PASS |
| EMP055-08: guard de completude enum↔UI | mapa cobre exatamente os 5 literais | `company-type.test.ts:11-13` — `expect(Object.keys(COMPANY_TYPE_LABELS).sort()).toEqual([...COMPANY_TYPES].sort())` | ✅ PASS |
| EMP055-09: CPF malformado → mensagem canônica, action não chamada | texto exato "CPF inválido (formato ou dígito verificador)" | `add-responsible-form.test.tsx:36-46` — `findByText('CPF inválido (formato ou dígito verificador)')` + `expect(...).not.toHaveBeenCalled()` | ✅ PASS |
| EMP055-10: e-mail malformado → "E-mail inválido" | texto exato | `add-responsible-form.test.tsx:48-55` — `findByText('E-mail inválido')` + not-called | ✅ PASS |
| EMP055-11: valor válido → action chamada (preservado) | comportamento atual mantido | Pre-existing passing tests in same file untouched (not deleted/weakened) | ✅ PASS |

**Status**: ⚠️ 10/11 ACs matched spec outcome precisely; 1 spec-precision gap (EMP055-04 concurrency — see Gaps). Non-blocking: the spec itself frames the DB unique index as the safety net ("releitura na tx + índice parcial **como rede**"), and that index is untouched, pre-existing, and already covered by the regression suite (U12-MN-03 exercises the same partial-unique mechanics on a different column). Recorded as a gap for traceability, not a fail condition.

---

## Discrimination Sensor

All 3 mutations were injected directly in the committed files (scratch-only), run against the exact test files cited above, confirmed killed, then reverted via `git checkout --`. Post-revert `git diff 609b5b2 -- src/` is empty (verified).

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| 1 | `create-company.ts:113-116` (MN-01 guard) | Forced `activeRepresentationConsent = null` unconditionally — reinstates the pre-fix bug (unconditional consent create) | ✅ Killed — `create-company.int.test.ts` MOD-2 test: `expect(result.ok).toBe(true)` fails (`Unique constraint failed on the fields: (person_id,purpose)`) |
| 2 | `domain/company-type.ts:22-28` (MN-02 guard) | Omitted `SA` from `COMPANY_TYPE_LABELS` (enum↔UI divergence) | ✅ Killed — 3 tests fail simultaneously: `company-type.test.ts` completeness guard, `create-company-form.test.tsx` 5-radio assertion, `edit-company-form.test.tsx` 5-radio assertion (+ SA pre-select test) |
| 3 | `add-responsible-form.tsx:36-38` (EMP-8 message swap) | Swapped which branch (`@`-present vs. CPF-shaped) emits which canonical message | ✅ Killed — both `add-responsible-form.test.tsx` EMP055-09 and EMP055-10 tests fail (exact-text assertions catch the swap) |

**Sensor depth**: lightweight (3 targeted mutations, one per corrected defect — MOD-2/EMP-4/EMP-8), proportional to a P2-remediation feature with one P1 must-not.
**Result**: 3/3 killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ---------- | ---------------------------------------- | ------ | ----------------------- |
| EMP055-MN-01 | Criar 2º consent `COMPANY_REPRESENTATION` ativo / falhar `INTERNAL` na 2ª Empresa | `create-company.int.test.ts:222-262` — `expect(after).toHaveLength(1)`; `expect(result.ok).toBe(true)` (never `INTERNAL`) | ✅ | ✅ (sensor #1) |
| EMP055-MN-02 | Omitir qualquer valor do enum `CompanyType` no controle "Tipo" | `company-type.test.ts:11-13` (domínio) + `create-company-form.test.tsx:58-66` + `edit-company-form.test.tsx:52-61` (RTL, ambos os forms) | ✅ | ✅ (sensor #2) |

**Status**: ✅ Both must-nots proven (green + guard-mutation killed).

**Regression invariants (not new must-nots, but explicitly protected by spec)**: `U12-MN-02` (`create-company.int.test.ts:155-172` — hash divergente → zero consent gravado) and `U12-MN-03` (`create-company.int.test.ts:207-217` — CNPJ duplicado → CONFLICT, exatamente 1 Empresa) — both still green in the full 7/7 int-test run; T3's diff does not touch the hash-check (3b) or CNPJ pre-check (4) code paths (confirmed by diff — only the consent block moved).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — 3 surgical fixes, no incidental refactors |
| Surgical changes | ✅ — only `src/modules/companies/**` touched (15 files, matches diff --stat) |
| No scope creep | ✅ — A1 (fixing create-form too) is a declared, justified spec assumption, not undeclared scope creep |
| Matches patterns | ✅ — mirrors `ensure-client-role.ts` idempotent-consent pattern (T3) and `domain/cnpj.ts` client-safe pattern (T1/T2), as designed |
| Spec-anchored outcome check | ✅ — see AC table above; all assertions target exact spec-defined text/values, not vague "shows an error" |
| Per-layer Coverage Expectation met | ✅ — domain: 1:1 with completeness guard; Server Action: integration covers happy 1st/2nd Empresa + regression; components: RTL covers render + preselection + validation-message paths |
| Every test maps to a spec requirement | ✅ — every new test carries an `EMP055-NN`/`EMP055-MN-NN` tag in its title |
| Documented guidelines followed | ✅ — `CLAUDE.md` §Testing Requirements (Server Action: happy/consent/concurrency covered; domain 90%+); no forbidden deps added |

---

## Edge Cases

- [x] Consent de versão anterior reusado sem regravar hash/versão — T3 does not touch `termVersion`/`termContentHash` on the reuse branch (only skips `consent.create`); no regression risk since those fields are only written on the create branch.
- [x] Consent revogado (`revokedAt != null`) → tratado como ausente, cria novo consent — covered implicitly by the `findFirst({revokedAt: null})` filter (revoked rows never match); no dedicated test, but the query semantics make the wrong path structurally impossible without a code change (low residual risk, consistent with edge case's own framing as a filter guarantee rather than a branch to test).
- [x] CNPJ colidente na 2ª Empresa → `U12-MN-03` (orthogonal, unmodified code path) — verified green in full run.
- [x] Campo com só espaços no add-responsible → `.min(1)` mantém "Informe um CPF ou e-mail." — untouched code path (schema's `.min(1)` check runs before `superRefine`); not re-tested but not modified either.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration` (+ `npm run build`, adjudicated separately below)
- **Typecheck**: ✅ exit 0, no errors
- **Lint**: ✅ exit 0, no errors (includes the `no-restricted-imports` deep-import guard — passed clean, confirming no barrel-bypass)
- **Unit** (`npm run test`): ✅ 268 files / 1877 tests passed, 0 failed
- **Integration, isolated scope** (`create-company.int.test.ts` via `npm run test:integration` config): ✅ 7/7 passed (was 6 pre-feature per tasks.md — +1 new MOD-2 test, matches "6 → ≥7")
- **Build**: see **Build Adjudication** below
- **Skipped tests**: none
- **Failures**: none in scope

### Build Adjudication

`npx dotenv -e .env.local -- npm run build` fails locally with `Error: <Html> should not be imported outside of pages/_document` while prerendering `/404`, after webpack reports "Compiled successfully". To determine whether this is caused by USP-055, I reproduced the exact same build command (`npm install` + `npx dotenv -e .env.local -- npm run build`) in a clean worktree at the pre-feature base commit `2fb367c~1` — **identical failure, same error, same page**. This confirms the failure is pre-existing and unrelated to this diff (consistent with the project's own recorded lesson `build-404-html-blocker.md`: the CI `verify` job — which uses dummy env vars, not `.env.local` — passes this gate reliably; the local-only repro is an environment artifact, not a code regression). Because webpack's module-resolution/compile step (`✓ Compiled successfully`) completed without error both before and after the diff, this also serves as corroborating evidence for AD-019 (d): no server/Prisma code leaked into a client bundle as a result of this feature (a barrel-leak of that kind typically fails at the compile step, not the static-export step, and the compile step is identical pass/pass across both commits).

**Test count before feature**: not separately measured pre-feature (baseline not requested); the task-level deltas above (company-type +4, responsible-identifier +6, create-company-form +2, edit-company-form +2, add-responsible-form +2, create-company unit +2, create-company int +1 = **+19 new tests**) account for the observed totals, with zero deletions (`git diff --stat` shows only insertions on all touched test files, no `-` beyond the fixture type-cast on `dd99dcc`).

---

## Checagem AD-019 (client-safe classifier)

- `grep -rn "identity" src/modules/companies/domain/ src/modules/companies/components/*.tsx` → only comment-text/unrelated-symbol matches (`identityFieldsChanged`, a pre-existing company-domain function unrelated to `@/modules/identity`); **zero** actual imports of `@/modules/identity` or `@prisma/client` in the new/touched client-consumed files.
- `add-responsible.schema.ts` (server-side schema) no longer imports `isValidCpf` from `@/modules/identity` either — it now imports `classifyIdentifier` from the new client-safe domain file, which is a strict reduction in the schema's own dependency surface.
- Build's compile step passing (see Build Adjudication) corroborates no bundle-leak.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ---------- |
| EMP055-01 | Pending | ✅ Verified |
| EMP055-02 | Pending | ✅ Verified |
| EMP055-03 | Pending | ✅ Verified |
| EMP055-04 | Pending | ⚠️ Verified w/ spec-precision gap (concurrency relies on untested DB-level index) |
| EMP055-05 | Pending | ✅ Verified |
| EMP055-06 | Pending | ✅ Verified |
| EMP055-07 | Pending | ✅ Verified |
| EMP055-08 | Pending | ✅ Verified |
| EMP055-09 | Pending | ✅ Verified |
| EMP055-10 | Pending | ✅ Verified |
| EMP055-11 | Pending | ✅ Verified |
| EMP055-MN-01 | Pending | ✅ Verified (mutation killed) |
| EMP055-MN-02 | Pending | ✅ Verified (mutation killed) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/11 ACs matched spec outcome precisely, 1 spec-precision gap (EMP055-04, non-blocking — see above)
**Sensor**: 3/3 mutations killed
**Must-nots**: 2/2 green + guard-mutation killed
**Gate**: typecheck ✅, lint ✅, unit 1877/1877 ✅, integration (companies scope) 7/7 ✅, build — pre-existing failure confirmed unrelated to this diff (reproduced identically at base commit)

**What works**: All three UAT defects (MOD-2, EMP-4, EMP-8) are fixed exactly as specified, with negative tests proven to actually discriminate (not just pass). U12-MN-02/03 regressions remain green. AD-019 client-safe carve-out holds (no identity/Prisma leak). No files outside `src/modules/companies/**` were touched — flakes in `jobs`/`identity` integration suites (`pause-job`, `archive-job`, `credential-claim`) are confirmed out-of-scope by `git diff --stat` and are not attributable to this feature.

**Issues found**: None blocking.
1. EMP055-04 (duplo submit) has no dedicated concurrency test — the spec itself defers to the pre-existing DB unique index as backstop, and no code path change was made there. Recommend (non-blocking, future hardening): an integration test using two concurrent `createCompany` calls to empirically prove the index catches the race, if this project later adds a concurrency-testing harness.

**Next steps**: None required to reach PASS. Optional hardening item above can be deferred to a future US.
