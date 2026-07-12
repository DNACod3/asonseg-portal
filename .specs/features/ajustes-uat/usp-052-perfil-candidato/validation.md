# USP-052 — Perfil do candidato consistente — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-052-perfil-candidato/spec.md`
**Diff range**: `f07b6e2~1..ce4cfcd` (7 commits: T1-T5 + 2 build-gate follow-ups)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|---|---|---|
| T1 (CAND-1 partial update) | ✅ Done | `f07b6e2` |
| T2 (CAND-2 status real) | ✅ Done | `a4aa246` |
| T3 (CAND-2-UI + CAND-3 form) | ✅ Done | `95dedb8` |
| T4 (CAND-6 gate CvUploadForm) | ✅ Done | `24616e9` |
| T5 (page wiring) | ✅ Done | `ce4cfcd` |
| Follow-up (deep-import allowlist) | ✅ Done | `a6a3733` — registers `CvUploadForm`'s new direct import of `grantConsent` in the F0-MN-02 guard's known-exceptions list; same class as the pre-existing `candidate-form.tsx`/`job-form.tsx` exceptions |
| Follow-up (invocationCallOrder typing) | ✅ Done | `56422b1` — `noUncheckedIndexedAccess` flagged `invocationCallOrder[0]` as `number \| undefined`; fix adds explicit existence assertions, does not weaken the order assertion |

Both follow-ups are typecheck/build-gate driven, touch only test files, and do not change production behavior.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| PERF-01 — update omits unsent optional keys | `update` payload contains only obrigatórios + present-keyed optionals | `activate-candidate-role.ts:84-93` (conditional `if (x !== undefined)` per key) — `candidate-actions.test.ts:152-165` `expect(updateData).not.toHaveProperty('skillsText'…)` | ✅ PASS |
| PERF-01b — present optional key persisted | value sent when key present persisted verbatim | `candidate-actions.test.ts:129-150` `expect(updateData).toMatchObject({headline:'Aux. administrativo', …})` | ✅ PASS |
| PERF-01c — create maps absent to null | create branch keeps `?? null` | `activate-candidate-role.ts:102-113` — `candidate-actions.test.ts:103-127` `expect(createData).toMatchObject({headline:null,…})` | ✅ PASS |
| PERF-02 — real `publicationStatus` returned | result reflects DB-persisted value, not literal `'DRAFT'` | `activate-candidate-role.ts:100-127` (`select`, `return saved.publicationStatus`) — `candidate-actions.test.ts:167-173` `expect(res.data.publicationStatus).toBe('ACTIVE')` | ✅ PASS |
| PERF-03 — UI shows DRAFT/IN_MODERATION/ACTIVE correctly | DRAFT→rascunho box; IN_MODERATION→aviso; ACTIVE→informative non-actionable box, no "Enviar para moderação" | `candidate-form.tsx:121-127,246-281` — `CandidateForm.test.tsx:94-104` | ✅ PASS |
| PERF-03b — other statuses neutral | no draft/moderation box for AWAITING_ADJUSTMENTS et al. | `candidate-form.tsx:127` (`isActive` else no render) — `CandidateForm.test.tsx:106-110` `expect(screen.queryByRole('status')).not.toBeInTheDocument()` | ✅ PASS |
| PERF-04 — page pre-fills defaultValues | existing profile fields + session phone passed as `defaultValues` | `page.tsx:74-80,107-113` — `page.test.tsx:97-123` `expect(candidateFormProps).toHaveBeenCalledWith(expect.objectContaining({defaultValues:{…}}))` | ✅ PASS |
| PERF-04b — new candidate opens empty | no profile ⇒ empty defaultValues, unaffected form | `page.tsx:74-80` (`profile?.field ?? ''`) — `page.test.tsx:90-95` (profile null ⇒ no CV form) + `CandidateForm.test.tsx` default (no `defaultValues` prop in `baseProps`) | ✅ PASS |
| PERF-05 — gate presents term, blocks send, grants before upload | `LgpdBox`+checkbox shown; disabled until accepted; `grantConsent` before `uploadCv` | `CvUploadForm.tsx:114-127,180-183` — `CvUploadForm.test.tsx:203-207,218-251` (`grantOrder < uploadOrder`) | ✅ PASS |
| PERF-05b — already granted skips gate | no term shown, upload direct | `CvUploadForm.tsx:120` (`if (!alreadyGranted)`) — `CvUploadForm.test.tsx:270-284` | ✅ PASS |
| PERF-05c — grant failure blocks upload | PT-BR error shown, `uploadCv` not called | `CvUploadForm.tsx:121-126` — `CvUploadForm.test.tsx:253-268` | ✅ PASS |

**Status**: ✅ All 11 ACs covered, spec-anchored outcomes matched exactly (no vague-assertion gaps found).

---

## Discrimination Sensor

Scratch method: direct file mutation in the real working tree, gate run, then restored byte-for-byte from a pre-edit backup copy (verified via `git diff --stat` = empty after each restore — no `git stash` needed since the tree was already clean before mutating).

| # | File:line | Description | Killed? |
|---|---|---|---|
| 1 | `src/modules/persons/actions/activate-candidate-role.ts:84-93` | Removed the `!== undefined` guards on `updateData` — every optional field always written with `?? null` (reintroduces the CAND-1 destructive-overwrite bug) | ✅ Killed — unit `candidate-actions.test.ts` (`PERF-MN-01` — `not.toHaveProperty('skillsText')` failed, got `null`) **and** integration `candidate-actions.int.test.ts` (`CAND-1 / PERF-MN-01` — expected `'Excel avançado'`, got `null`) |
| 2 | `src/modules/persons/actions/activate-candidate-role.ts:121` | Changed `return saved.publicationStatus` → `return 'DRAFT' as ContentStatus` (reintroduces the CAND-2 hardcoded-status bug) | ✅ Killed — unit `candidate-actions.test.ts` (`PERF-MN-02` — expected `'ACTIVE'`, got `'DRAFT'`) |
| 3 | `src/modules/cv-extraction/components/CvUploadForm.tsx:182-183` | Collapsed `uploadDisabled` to `isPending` only — removes the consent/checkbox gate entirely (reintroduces the CAND-6 dead-end/no-gate bug) | ✅ Killed — component `CvUploadForm.test.tsx` (`PERF-MN-03` — `grantConsent` called 1 time, expected 0) plus 2 further pre-existing tests also failed (button not disabled) |

**Sensor depth**: lightweight (3 targeted mutations, one per must-not — proportional to a non-P0 UI/CRUD-consistency fix, no payment/auth/data-migration surface).
**Result**: 3/3 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| PERF-MN-01 | Overwrite `skillsText`/`coursesText`/`educationArea`/`availability` when input omits the key | `candidate-actions.test.ts:152-165` (unit, payload) + `candidate-actions.int.test.ts:127-153` (int, DB-level) | ✅ | ✅ (mutation 1) |
| PERF-MN-02 | Report/exhibit a `publicationStatus` different from persisted, or offer "Enviar para moderação" outside DRAFT | `candidate-actions.test.ts:167-173` (backend) + `CandidateForm.test.tsx:100-104` (UI) | ✅ | ✅ (mutation 2, backend guard); UI guard (`isDraft`/`isActive` branching in `candidate-form.tsx:121-127`) independently proven by its own render test, not re-mutated (redundant with mutation 2's backend proof + direct code inspection: `isDraft = status === 'DRAFT'` is a straightforward equality, not a compound condition warranting a 4th mutation under lightweight tiering) |
| PERF-MN-03 | Dispatch `uploadCv` when `CV_AI_EXTRACTION` inactive and term unaccepted | `CvUploadForm.test.tsx:209-216` | ✅ | ✅ (mutation 3) |

**Status**: ✅ All 3 must-nots proven (negative test green + guard mutation killed for PERF-MN-01/03; PERF-MN-02 backend guard killed, UI guard proven by direct render assertion).

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ — changes confined to the 4 files the deviation/spec named plus their co-located tests |
| Surgical changes | ✅ — `git diff --stat` touches only `persons/{actions,components}`, `cv-extraction/components`, `app/(app)/candidato/page.tsx`, and the pre-existing `no-deep-module-imports.test.ts` guard list |
| No scope creep | ✅ — H-5 (re-moderation on ACTIVE edit) explicitly not decided; no `transitionContent` call added to `activateCandidateRole`; upsert still preserves status on update |
| Matches patterns | ✅ — `grantConsent`-before-mutation pattern mirrors `candidate-form.tsx`'s `activateAdditionalRole`-before-`activateCandidateRole`; `select`-on-`upsert`-return mirrors `grant-consent.ts:96` |
| Spec-anchored outcome check | ✅ — see table above, no vague assertions |
| Per-layer coverage (domain 1:1 ACs; routes happy+edge+error) | ✅ — Server Action has unit+int for every branch (happy/Zod/permission/consent/concurrency n/a — idempotency covered instead); component tests cover render+gate+edge; page test covers wiring |
| Every test maps to a spec requirement | ✅ — spot-checked; no unclaimed tests found in the 5 touched test files |
| Documented guidelines followed | ✅ — `CLAUDE.md` (Server Action sequence: Zod→permission/consent→business precondition→`withAudit`), `docs/arch/project-guideline.md` |

`defaultValue={defaultValues?.educationLevel ?? ''}` retained alongside RHF `defaultValues` in `candidate-form.tsx:143` is the declared A-11/SPEC_DEVIATION: verified empirically — native `<select>` auto-selects the first *enabled* option (not the disabled `""` placeholder) absent an explicit `defaultValue`, which would have silently passed a valid enum on an "empty submit" test. Legitimate, matches the code comment at `candidate-form.tsx:135-139`.

---

## Edge Cases

- [x] Empty-string vs. absent-key distinction (`headline`/`experienceText` cleared to `''` by user) — `data.headline !== undefined` treats `''` as present, persists it; not conflated with "not sent" (`activate-candidate-role.ts:88`)
- [x] New candidate (no profile) — `defaultValues` empty, create branch (`?? null`) unaffected — `page.test.tsx:90-95`, `candidate-actions.test.ts:103-127`
- [x] `CV_AI_EXTRACTION` term unavailable (`TermLoaderError`) — `page.tsx:84-94` catches and passes `term=null`; `CvUploadForm.test.tsx:286-292` confirms disabled+PT-BR alert
- [x] Consent already active on reopen — no term re-shown — `CvUploadForm.test.tsx:270-284`
- [x] Checkbox unchecked + no active consent — `uploadCv` not dispatched — `CvUploadForm.test.tsx:209-216` (= PERF-MN-03)
- [x] ACTIVE re-save doesn't downgrade status — `candidate-actions.int.test.ts:155-168` (`CAND-2 / PERF-02`, DB re-read confirms `ACTIVE` before test restores `DRAFT` for downstream suites)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run build && npm run test` (unit scoped to touched files) `+ npm run test:integration` (scoped to `candidate-actions.int.test.ts`, isolated)
- **Typecheck**: ✅ clean (`tsc --noEmit`, 0 errors)
- **Lint**: ✅ clean (`eslint .`, 0 errors)
- **Build**: ✅ `NODE_ENV=production next build` — compiled successfully, `/candidato` route present, no errors
- **Unit (5 touched files)**: 42/42 passed — `candidate-actions.test.ts` (14), `CandidateForm.test.tsx` (8), `CvUploadForm.test.tsx` (13), `page.test.tsx` (5), `no-deep-module-imports.test.ts` (2)
- **Integration (isolated, `candidate-actions.int.test.ts` only)**: 12/12 passed
- **Full integration suite**: NOT run as a gate for this verdict — orchestrator/Implementer's deviation (3) is independently confirmed below
- **Skipped tests**: none observed in the touched files
- **Failures**: none in scope

### Deviation (3/4) independent confirmation — full integration suite pollution is out of this diff's blast radius

`git diff --stat f07b6e2~1..ce4cfcd -- 'src/modules/jobs/**' 'src/modules/identity/**' 'src/modules/credentials/**'` → **empty** (zero files touched in jobs/identity/credentials by this USP). Combined with `candidate-actions.int.test.ts` passing 12/12 in isolation against the live local Postgres (`supabase status` confirmed running), the credential-claim/jobs/archive-job/jobs/pause-job/cron failures cited as pre-existing DB-volume pollution are confirmed structurally unrelated to USP-052's diff — this USP touched none of those modules' source or test files. PASS is not withheld for those failures.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| PERF-01 | Implementing | ✅ Verified |
| PERF-01b | Implementing | ✅ Verified |
| PERF-01c | Implementing | ✅ Verified |
| PERF-02 | Implementing | ✅ Verified |
| PERF-03 | Implementing | ✅ Verified |
| PERF-03b | Implementing | ✅ Verified |
| PERF-04 | Implementing | ✅ Verified |
| PERF-04b | Implementing | ✅ Verified |
| PERF-05 | Implementing | ✅ Verified |
| PERF-05b | Implementing | ✅ Verified |
| PERF-05c | Implementing | ✅ Verified |
| PERF-MN-01 | Implementing | ✅ Verified |
| PERF-MN-02 | Implementing | ✅ Verified |
| PERF-MN-03 | Implementing | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 11/11 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Must-nots**: 3/3 green
**Gate**: typecheck ✅, lint ✅, build ✅, unit (42/42 scoped) ✅, integration (12/12 isolated) ✅

**What works**:
- CAND-1: partial-update guard proven at both unit (payload shape) and integration (DB persistence) levels; mutation-tested.
- CAND-2: real `publicationStatus` returned and displayed; ACTIVE/other-status UI correctly suppresses invalid actions; mutation-tested.
- CAND-3: `/candidato` pre-fills from the existing profile + session phone; new candidates still open empty.
- CAND-6: `CvUploadForm` gates on `CV_AI_EXTRACTION` term acceptance, `grantConsent` strictly precedes `uploadCv`, failure path blocks upload; mutation-tested.
- H-5 correctly left undecided — no re-moderation logic introduced; upsert still preserves status on update, confirmed by both code inspection and the ACTIVE-not-downgraded integration test.
- Both build-gate follow-up commits are legitimate, test-only, non-scope-creeping.

**Issues found**: none.

**Next steps**: none — feature verified. Merge-ready per repo conventions.
