# USP-040 — Extração de CV via IA Generativa — Validation

**Date**: 2026-07-08
**Spec**: `.specs/features/extracao-cv-ia/usp-040-extracao-cv/spec.md`
**Design**: `.specs/features/extracao-cv-ia/usp-040-extracao-cv/design.md`
**Tasks**: `.specs/features/extracao-cv-ia/usp-040-extracao-cv/tasks.md`
**Diff range**: `99dff7a..993ebf7` (17 commits, U4 of Fase 3), branch `feat/fase-3-candidaturas-busca-cv`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
|---|---|---|
| T1 | ✅ Done | `AuditEvent.CV_UPLOADED` added, not justification-required |
| T2 | ✅ Done | `CvUploadAttempt` model + migration `20260708155331_usp040_cv_upload_attempts` |
| T3 | ✅ Done | `CVExtractor` port + tokens + barrel |
| T4 | ✅ Done | `domain/mime.ts` |
| T5 | ✅ Done | `domain/extracted-fields.ts` |
| T6 | ✅ Done | `domain/cost.ts` + `domain/rate-limit.ts` |
| T7 | ✅ Done | `FakeCVExtractor` |
| T8 | ✅ Done | `AnthropicCVExtractor` |
| T9 | ✅ Done | Container wiring + `CV_EXTRACTOR_FAKE` flag |
| T10 | ✅ Done | Static guard `no-external-llm-sdk.test.ts` |
| T11 | ✅ Done | Zod schemas |
| T12 | ✅ Done | `uploadCv` |
| T13 | ✅ Done | `extractCvFromUpload` |
| T14 | ✅ Done | `confirmCvFields` |
| T15 | ✅ Done | `CvUploadForm` + `(app)/candidato/page.tsx` wiring |
| T16 | ✅ Done | E2E happy + fallback (session-gate scope, documented deviation) |

All 16 tasks committed atomically (17 commits including the T1-T16 status-marker commit `993ebf7`).

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| CVE-01 (upload válido) | MIME real+size≤5MB → armazena `cvStoragePath/cvSha256/cvUploadedAt` + audita `CV_UPLOADED` | `src/modules/cv-extraction/__tests__/upload-cv.int.test.ts:185-213` — `expect(profile?.cvStoragePath).toMatch(...)`, `expect(audit).not.toBeNull()`, `expect(files.length).toBe(1)` | ✅ PASS |
| CVE-01 (upload inválido) | MIME real inválido OU >5MB → `VALIDATION`, sem storage, sem LLM | `upload-cv.int.test.ts:215-247` — `expect(res.error.code).toBe('VALIDATION')`, `expect(profile?.cvStoragePath).toBeNull()`, `expect(await listStorageFiles(...)).toHaveLength(0)` | ✅ PASS |
| CVE-02 (extração via porta) | Extração só via `CVExtractor.extract`, sem SDK direto | `extract-cv.int.test.ts:149-158` (`container.register(CV_EXTRACTOR_TOKEN, fakeExtractor)`, `expect(extractSpy).toHaveBeenCalledOnce()`) + `no-external-llm-sdk.test.ts:38-48` (guarda estática) | ✅ PASS |
| CVE-02 (auditoria extração) | `CV_EXTRACTION_REQUESTED` + `CV_EXTRACTION_COMPLETED` c/ metadados | `extract-cv.int.test.ts:160-177` — `expect(requested).not.toBeNull()`, `expect(after).toMatchObject({inputTokens,outputTokens,durationMs,estimatedCostUsd,model})` | ✅ PASS |
| CVE-03 (pré-preenchimento + flag IA) | Formulário pré-preenchido, sinalizado como sugerido pela IA | `src/modules/cv-extraction/components/__tests__/CvUploadForm.test.tsx:51-79` — `expect(screen.getByText(/sugeridos pela ia/i)).toBeInTheDocument()`, valores de campo assertados | ✅ PASS |
| CVE-04 (validação humana obrigatória / IA nunca grava) | Sem confirmação, IA não persiste | `extract-cv.int.test.ts:184-209` (CVE-MN-01) — `expect(profile).toEqual({...all null})` pós-extração | ✅ PASS |
| CVE-04 (confirmação persiste) | Confirmar grava os 5 campos + `cvLastConfirmedAt` + audita `CV_USER_CONFIRMED_FIELDS` + libera envio (não auto-submete, A-07) | `confirm-cv-fields.int.test.ts:79-103` — `expect(profile).toMatchObject(CONFIRM_INPUT)`, `expect(profile?.cvLastConfirmedAt).toBeInstanceOf(Date)`, `expect(audit).not.toBeNull()`; ausência de chamada a `submitCandidateForModeration` confirmada por leitura de `actions/confirm-cv-fields.ts:48-72` (nenhuma importação/chamada) | ✅ PASS |
| CVE-05 (fallback gracioso) | Falha/vazio/malformado → `CV_EXTRACTION_FAILED` + campos vazios + mensagem amigável, cadastro completável | `extract-cv.int.test.ts:226-240` + `CvUploadForm.test.tsx:81-99` (`expect(screen.queryByRole('alert')).not.toBeInTheDocument()`, campo vazio editável) | ✅ PASS |
| CVE-06 (consentimento LGPD) | `CV_AI_EXTRACTION` ativo exigido, termo cita provedor | `upload-cv.int.test.ts:249-259` (`CONSENT_REQUIRED`, sem storage) + `legal/consent-terms/cv-ai-extraction/v1.0.md:6,29` (`llm_provider: Anthropic Claude`) | ✅ PASS |
| CVE-07 (rate limit) | 4º upload/dia bloqueado, 3/dia permitidos | `upload-cv.int.test.ts:261-276` — `expect(res.error.code).toBe('PRECONDITION_FAILED')`, `expect(attemptCount).toBe(3)` (não incrementou) | ✅ PASS |
| CVE-08 (monitoramento de custo) | tokens/duração/custo registrados por extração | `extract-cv.int.test.ts:170-181` — `after` contém os 5 campos de metadados; `expect(after).not.toHaveProperty('educationLevel')` (nunca PII) | ✅ PASS |

**Status**: ✅ All 8 ACs covered with precise spec-defined outcomes — no spec-precision gaps.

---

## Discrimination Sensor

Sensor depth: **above-default** — 6 targeted behavior-level mutations (spec is Large/must-not-bearing; all 6 must-nots individually probed, exceeding the lightweight 1-3 floor). All executed in the real working tree as scratch edits, immediately reverted; `git status --short` confirmed clean after each.

| # | File:line | Description | Guards | Killed? |
|---|---|---|---|---|
| 1 | `actions/extract-cv.ts` (post-success return) | Injected direct `prisma.candidateProfile.update` write of `educationLevel` before returning the draft | CVE-MN-01 | ✅ Killed — `extract-cv.int.test.ts` "CVE-MN-01" test failed (`educationLevel` no longer `null`) |
| 2 | `actions/extract-cv.ts:53-62` | Removed the consent re-check guard (revocation between upload and extract) | CVE-MN-03 | ✅ Killed — `extract-cv.int.test.ts` "CVE-MN-03" test failed (expected `CONSENT_REQUIRED`, got `INTERNAL`) |
| 3 | `actions/upload-cv.ts:81-84` | Removed the MIME-null guard, defaulted to `'pdf'` | CVE-MN-02 | ✅ Killed — 2 tests in `upload-cv.int.test.ts` failed (MIME-invalid and >5MB cases both bypassed the guard) |
| 4 | `domain/rate-limit.ts:23-25` | Off-by-one: `count >= LIMIT` → `count > LIMIT` | CVE-MN-04 | ✅ Killed at both layers — `rate-limit.test.ts` unit (`isOverDailyLimit(3)`) and `upload-cv.int.test.ts` integration (4th upload no longer blocked) both failed |
| 5 | `adapters/fake-cv-extractor.ts` (import injection) | Added an `@anthropic-ai/sdk` type import to a non-allowlisted file | CVE-MN-05 | ✅ Killed — `no-external-llm-sdk.test.ts` offenders list caught the new file |
| 6 | `adapters/anthropic-cv-extractor.ts:121-124` | Replaced `catch { return {ok:false,...} }` with `catch(err) { throw err; }` | CVE-MN-06 | ✅ Killed — `anthropic-cv-extractor.test.ts` "SDK lança erro" test failed (uncaught `Error: network timeout`) |

**Result**: 6/6 killed. No surviving mutants — no fix tasks required.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| CVE-MN-01 | Persist AI-extracted fields without explicit confirmation | `extract-cv.int.test.ts:184-209` — `expect(profile).toEqual({...all null})` post-extract; `confirm-cv-fields.int.test.ts:70-77` — companion (pre-confirm fields null) | ✅ | ✅ (mutation #1) |
| CVE-MN-02 | Store/invoke LLM on invalid MIME or >5MB | `upload-cv.int.test.ts:215-247` — `expect(profile?.cvStoragePath).toBeNull()`, `expect(listStorageFiles(...)).toHaveLength(0)` | ✅ | ✅ (mutation #3) |
| CVE-MN-03 | Invoke LLM without active consent (incl. revoked between upload/extract) | `upload-cv.int.test.ts:249-259` (no storage) + `extract-cv.int.test.ts:211-224` — `expect(extractSpy).not.toHaveBeenCalled()` | ✅ | ✅ (mutation #2) |
| CVE-MN-04 | Accept a 4th valid upload same day | `upload-cv.int.test.ts:261-276` — `expect(attemptCount).toBe(3)`, no storage files | ✅ | ✅ (mutation #4) |
| CVE-MN-05 | Import `@anthropic-ai/sdk` outside the allowlisted adapter | `no-external-llm-sdk.test.ts:38-53` — offenders list empty + positive-control test (regex matches allowlisted file) | ✅ | ✅ (mutation #5) |
| CVE-MN-06 | Throw / block signup on extraction failure | `extract-cv.int.test.ts:226-240` + `anthropic-cv-extractor.test.ts:95-104` — `expect(result).toEqual({ok:false,reason:'PROVIDER_ERROR'})` (adapter contract) | ✅ | ✅ (mutation #6) |

**Status**: ✅ All 6 must-nots proven — every guard's negative test kills a mutation of its own guard (not just the incidental happy-path assertion).

---

## Deviation Sanity-Check (author-declared, independently confirmed)

| Deviation | Verified how | Verdict |
|---|---|---|
| (a) `EDUCATION_LEVELS` duplicated locally in 3 files (`schemas/confirm-cv-fields.schema.ts:13`, `adapters/anthropic-cv-extractor.ts:42`, `components/CvUploadForm.tsx:28`) instead of importing from `persons` | Confirmed no deep-import added: `src/shared/__tests__/no-deep-module-imports.test.ts:81-87` still asserts the exact 3 pre-existing exception files (`persons/components/candidate-form.tsx`, `persons/components/provider-form.tsx`, `jobs/components/job-form.tsx`) — `cv-extraction` files are NOT in that list, and the guard's first assertion (no undocumented deep-imports) also stayed green through the full unit run. Matches the established client/server-boundary carve-out pattern; does not weaken the guard. | ✅ Legitimate |
| (b) `cvStoragePath` stored bucket-relative (`${person.id}/${uuid}.ext}`, no `cvs/` prefix) | `actions/upload-cv.ts:99-104` comment cites `listJobApplicants`/USP-027 precedent; `.from(STORAGE_BUCKETS.CVS)` already scopes the bucket. Consistent internally (upload writes relative path, `extract-cv.ts:67-68` downloads using the same relative path via `.from(STORAGE_BUCKETS.CVS).download(profile.cvStoragePath)`) | ✅ Legitimate |
| (c) E2E covers only the session gate | `e2e/cv-extraction/upload-extrair-confirmar.spec.ts:12-33` and `fallback-extracao.spec.ts:9-21` explicitly document the SPEC_DEVIATION, citing the same no-session-seeding precedent as 4 prior specs (`candidato.spec.ts`, `candidatar-se.spec.ts`, `editar-empresa.spec.ts`, `moderar-rascunho.spec.ts`); write-path (upload/extract/confirm) is authoritatively covered by the 3 `*.int.test.ts` suites + `CvUploadForm.test.tsx` | ✅ Legitimate, consistent with project convention |

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ — 3 Server Actions, thin adapter, pure domain functions; no speculative abstraction |
| Surgical changes | ✅ — new module `cv-extraction/` self-contained; touches to `audit/events.ts`, `container.ts`, `env.ts`, `schema.prisma`, `candidato/page.tsx` are all directly required |
| No scope creep | ✅ |
| Matches patterns | ✅ — mirrors `AuthAttempt`, `TurnstileCaptchaVerifier`/container pattern, `no-external-verify.test.ts` template |
| Spec-anchored outcome check (asserted values match spec) | ✅ — see AC table above |
| Per-layer Coverage Expectation met (domain 1:1 ACs; Server Actions happy+Zod+consent+precondition+concurrency-N/A) | ✅ — see Test Coverage Matrix in `tasks.md`, cross-checked against actual test files read during this review |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — every test file inspected carries CVE-NN/CVE-MN-NN references in its own docblock |
| Documented guidelines followed | ✅ — `CLAUDE.md` §Critical Patterns (Server Action sequence, LLM abstraction, audit), ADR-0012, ADR-0005 |

---

## Edge Cases

- [x] `.pdf` extension with non-PDF bytes → rejected by real MIME (`upload-cv.int.test.ts:215-235`)
- [x] Consent revoked between upload and extraction → extraction interrupted, LLM never called (`extract-cv.int.test.ts:211-224`)
- [x] Malformed/partial JSON from LLM → treated as extraction failure (`adapters/__tests__/anthropic-cv-extractor.test.ts`, `domain/__tests__/extracted-fields.test.ts`)
- [x] New valid upload after a prior extraction respects the daily rate limit (`upload-cv.int.test.ts:261-276`)
- [x] Candidate closes form without confirming → nothing persisted (structural guarantee: only `confirmCvFields` writes; proven by CVE-MN-01)
- [x] AI returns unknown fields → ignored, only the 5 mapped fields kept (`domain/__tests__/extracted-fields.test.ts`)
- [x] Storage upload fails after validation → `{ok:false}`, no `CV_UPLOADED` (`upload-cv.int.test.ts:278-306`)
- [x] Candidate without `candidate_profiles` → blocked with `PRECONDITION_FAILED` (`upload-cv.int.test.ts:308-317`, `extract-cv.int.test.ts:242-250`)
- [ ] p95 ≤ 30s — not independently measurable in this review (no load test in scope); synchronous design + `max_tokens: 1024` cap makes the bound plausible but this AC is **not directly evidenced** by an automated test (spec-precision gap noted, non-blocking: spec itself frames this as "assíncrono aceitável", not a hard gate)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm test && npm run test:integration && NODE_ENV=production npm run build` (+ `npm run test:e2e` scoped to `e2e/cv-extraction/`)
- **typecheck**: exit 0
- **lint**: exit 0
- **unit (`npm test`)**: 164 files passed, **1121 tests passed**, 0 failed
- **integration (`npm run test:integration`)**: 65 files passed, **385 tests passed**, 0 failed (against local Supabase Postgres :55322, `cvs` bucket)
- **build (`NODE_ENV=production npm run build`)**: exit 0 (bare `npm run build` is documented to fail on a pre-existing `/500` prerender unrelated to this diff — not exercised here; `NODE_ENV=production` variant used per orchestrator instruction passed)
- **E2E (`npx playwright test e2e/cv-extraction/`)**: 2/2 passed (session-gate scope, both specs)
- **Migration**: `npx prisma migrate status` → "Database schema is up to date!" (26 migrations, including `20260708155331_usp040_cv_upload_attempts`); dedicated integration suite (`prisma/__tests__/cv-upload-attempt.integration.test.ts`) verifies insert, count-by-window, and `onDelete: Cascade`
- **Fake-adapter path confirmed**: `src/shared/container.ts:141-143` — `env.CV_EXTRACTOR_FAKE ? new FakeCVExtractor() : new AnthropicCVExtractor()`; all int/unit/E2E test runs above ran without `ANTHROPIC_API_KEY` set to a real key, using the fake/mocked seams exclusively (int tests via `container.register` override, unit tests via `vi.mock('@anthropic-ai/sdk')`)
- **Skipped tests**: none observed
- **Failures**: none

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
|---|---|---|
| CVE-01 | Implementing | ✅ Verified |
| CVE-02 | Implementing | ✅ Verified |
| CVE-03 | Implementing | ✅ Verified |
| CVE-04 | Implementing | ✅ Verified |
| CVE-05 | Implementing | ✅ Verified |
| CVE-06 | Implementing | ✅ Verified |
| CVE-07 | Implementing | ✅ Verified |
| CVE-08 | Implementing | ✅ Verified |
| CVE-MN-01 | Implementing | ✅ Verified |
| CVE-MN-02 | Implementing | ✅ Verified |
| CVE-MN-03 | Implementing | ✅ Verified |
| CVE-MN-04 | Implementing | ✅ Verified |
| CVE-MN-05 | Implementing | ✅ Verified |
| CVE-MN-06 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 8/8 ACs matched spec-defined outcomes; 0 spec-precision gaps on the 8 ACs (1 non-blocking gap noted under Edge Cases for the p95≤30s NFR, which the spec itself does not make a hard test gate)
**Sensor**: 6/6 mutations killed (targeted at all 6 must-not guards — above the default lightweight tier, matching the Large/must-not risk floor)
**Must-nots**: 6/6 green, each with its own guard proven by a killed mutation
**Gate**: typecheck ✅, lint ✅, unit 1121/1121 ✅, integration 385/385 ✅, build ✅, E2E 2/2 ✅, migration clean ✅

**What works**: Full upload→extract→confirm journey with strict LGPD consent gating (including revocation mid-flow), real-MIME/size/rate-limit enforcement with durable daily quota, strict LLM-abstraction via the `CVExtractor` port (statically enforced, self-testing guard), no-persist-without-confirmation structurally guaranteed by action separation, graceful fallback with a provably non-throwing adapter, and cost/token/duration auditing that is provably PII-free.

**Issues found**: None blocking. One non-blocking spec-precision note: the p95≤30s latency AC has no direct automated measurement (acceptable per spec's own framing).

**Next steps**: None required — USP-040 / Unit U4 of Fase 3 is verified. Orchestrator may proceed to close the unit (record AD-017 candidate decision on the `cv-extraction` module boundary, per design.md's note to the orchestrator, and continue the Fase 3 pipeline).
