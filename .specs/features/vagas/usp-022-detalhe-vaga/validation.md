# USP-022 — Ver detalhe da vaga (Restyle Fase 2 / DS) — Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/vagas/usp-022-detalhe-vaga/spec.md`
**Diff range**: `c83b0d8..HEAD` (9 commits; USP-022 commits: `c976ec7`, `28bc071`, `ec871df`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 — Restyle `JobDetailView` | ✅ Done | `job-detail.tsx` |
| T2 — Restyle casca `page.tsx` + trava P-002 | ✅ Done | `(public)/vagas/[id]/page.tsx`, new `vagas-detalhe-metadata.int.test.ts` |
| T3 — Guarda estática de paridade DS | ✅ Done | new `job-detail-ds-parity.test.ts` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 (detalhe): `Card`/`FormCard`/`Badge`/`Button`, no raw palette/hex | `job-detail.tsx:3` imports from `@/shared/ui`; guard | `job-detail-ds-parity.test.ts:33-43` — `expect(offenders).toEqual([])` for both raw-palette and hex regexes | ✅ PASS |
| AC2 (detalhe): data/origin preserved — `company.displayName`, `salaryVisible`, counter only when `applicationCount != null` | Unchanged consumption of the View Model | `job-detail.tsx:79` (`job.company.displayName`), `:91` (`salary ?? 'Salário a combinar'`), `:93` (`job.applicationCount != null`) | ✅ PASS — **and** confirmed by discrimination-sensor mutation 3 (below): flipping the condition to `== null` killed `job-detail.spec.tsx` (2 tests red) |
| AC3 (detalhe): 3 CTA branches by role, "Candidatar-se" display-only | `canApply`→`Button type="button"` no wiring; `showActivateCandidateCta`→`Button asChild`→`/candidato`; anon→`Button variant="outline" asChild`→`/cadastro` | `job-detail.tsx:41-60`; `job-detail.spec.tsx:101-107` (`U22-MN-04` — `toHaveAttribute('type','button')`, `not.toHaveAttribute('onclick')`, `not.toHaveAttribute('formaction')`); `:57,63,70` (3 role branches) | ✅ PASS |
| AC4 (detalhe): non-matching on-read ⇒ "Vaga encerrada", no candidatar button, never 404 | `VagaIndisponivel` with only "Ver outras vagas" | `(public)/vagas/[id]/page.tsx` — `VagaIndisponivel()` function, `<Button variant="primary" asChild><Link href="/vagas">`; branch `row == null ? <VagaIndisponivel/> : <JobDetailView/>` | ✅ PASS |
| AC5 (detalhe): dark-mode via tokens | No raw hex | `job-detail-ds-parity.test.ts:39-43` | ✅ PASS |
| AC1 (página): `revalidate=1800`, `getActiveJobDetail`/branch/JSON-LD-only-when-row!=null preserved | Unchanged | `page.tsx` — `export const revalidate = 1800`; `{row != null && <script type="application/ld+json" .../>}` | ✅ PASS |
| AC2 (página): `generateMetadata`/JSON-LD always use `viewJobDetail(row, null)` | Anonymous regardless of viewer | `page.tsx` `generateMetadata()` calls `getActiveJobDetail(id, null)` unconditionally; JSON-LD block calls `viewJobDetail(row, null)` unconditionally (independent of `viewer` used for the rendered `JobDetailView`) | ✅ PASS |
| AC3 (página): no `nomeFantasia` leak in any channel for anon | title/description/OG/Twitter/canonical/JSON-LD | `vagas-detalhe-metadata.int.test.ts:132-152` — `U22-MN-01/P-002` — iterates 5 channels + JSON-LD string, `expect(channel).not.toContain(REAL_NAME)` for each | ✅ PASS |
| AC4 (página): dark mode | tokens only | `job-detail-ds-parity.test.ts` | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps.

---

## Discrimination Sensor

All 3 mutations injected directly in the real working tree (tracked files), each verified to kill the relevant test, then reverted with `git checkout -- <file>` immediately after. `git status --short` confirmed a clean tree before the first mutation and after each revert — no residual diff at any point.

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/jobs/components/job-card.tsx:34` | `className="p-5"` → `className="p-5 bg-blue-600"` (raw-palette regression) | ✅ Killed — `ds-vagas-parity.test.ts` (`JobCard (USP-021)…`) failed: 1/16 red, exact offending string reported |
| 2 | `src/modules/jobs/components/job-detail.tsx:78` | `text-fg` → `text-fg #123456` (hex-literal regression) | ✅ Killed — `job-detail-ds-parity.test.ts` failed: `nenhum className com hex literal (#RRGGBB)`, offender array `["font-heading text-2xl font-bold text-fg #123456"]` |
| 3 | `src/modules/jobs/components/job-detail.tsx:93` | Behavior-level fault: `job.applicationCount != null` → `== null` (inverts the N≥3 counter visibility guard, U22-MN-02) | ✅ Killed — `job-detail.spec.tsx` failed: 2/8 red (`@d-005 contador só aparece acima do limiar…`, singular-concordance test) |

**Sensor depth**: lightweight, 3 targeted mutations (2 style-guard, 1 behavior-level on the must-not-02 guard) — proportional to a style-only refactor with one preserved must-not condition in scope.
**Result**: 3/3 killed — ✅ PASS. No surviving mutants; no fix tasks generated.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U22-MN-01 | Expose `nomeFantasia` to anon via any channel | `vagas-detalhe-metadata.int.test.ts:132-152` (5 metadata channels + JSON-LD string) + `job-detail.spec.tsx:70` (`@p-002 anônimo vê a Empresa anonimizada`) | ✅ (both green — metadata test is in the 44/46 passing int files, unaffected by the flake) | Not separately mutated (evidence is direct multi-channel assertion, high specificity already) |
| U22-MN-02 | Show candidature counter when N∈{0,1,2} | `job-detail.spec.tsx:78-97` (`@d-005` N<3 hidden / N≥3 shown, singular concordance) | ✅ | ✅ (sensor mutation 3) |
| U22-MN-03 | Render navigable detail / candidatar button for non-ACTIVE job | `get-job-detail.int.test.ts:165-169` (`@e-005` non-ACTIVE/expired/unverified ⇒ `null`) + page renders `VagaIndisponivel` without a candidatar button | ⚠️ **RED at run time** for the `jExpirada` sub-assertion — see the pre-existing-flake finding in `usp-021-buscar-vagas-publica/validation.md` (this test file is shared infrastructure with USP-021's investigation; reproduced identically on pristine master) | n/a — query file untouched by diff |
| U22-MN-04 | Wire the "Candidatar-se" button to an action | `job-detail.spec.tsx:101-107` — `type="button"`, no `onclick`/`formaction` attributes | ✅ | Not separately mutated (attribute-absence assertions are already maximally specific; adding an `onClick` would be a code-scope change, not a markup mutation) |
| U22-MN-05 | Retain raw palette/hex in `job-detail.tsx`/`page.tsx` | `job-detail-ds-parity.test.ts:33-43` — `offenders == []` for both patterns | ✅ | ✅ (sensor mutation 2) |

**Status**: ✅ All must-nots proven, **with one flagged caveat on U22-MN-03** — the `get-job-detail.int.test.ts` sub-assertion for `jExpirada` was RED at run time due to the same confirmed pre-existing, time-window-dependent `dateOffset()` flake documented in full in `usp-021-buscar-vagas-publica/validation.md`. The `jModeracao` and `jNaoVerificada` sub-assertions in the same test (not date-dependent) passed. Per the orchestrator's explicit disposition, this does not block PASS.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (style-only) | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches existing patterns | ✅ (see deviation judgments below) |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage (RTL for presentation component; integration for route/metadata; static guard for style) | ✅ |
| Documented guidelines followed | `CLAUDE.md` §Testing, AD-014/AD-015, `no-external-verify.test.ts` guard precedent |

### Deviation judgments (as flagged by the Implementer)

1. **`Card`/`FormCard` div-as-root drops the semantic `<article>`/`<section>` wrapper.** Confirmed via base diff: `git show c83b0d8:.../job-detail.tsx` had root `<article className="flex flex-col gap-6">`; HEAD has `<FormCard className="flex flex-col gap-6">`, which renders a `<div>` (`src/shared/ui/form-card.tsx:15-22` — hardcoded `<div ref={ref} ...>`, no `asChild`/polymorphic support). This is a **pre-existing DS-foundation constraint** from the Phase 1 fundação (not introduced by this PR) — `Card`/`FormCard` have no `asChild` prop, unlike `Button`. The inner `Section()` sub-component still renders `<section>` (`job-detail.tsx:28`). **Judged acceptable**: matches the same limitation present everywhere else `Card`/`FormCard` is used in the repo; minor landmark/semantics regression, no must-not violated, no data/behavior change. Not a blocker; if desired, extending `FormCard` with `asChild` is a DS-foundation task, out of scope for a style-only restyle.
2. **Raw `<select>`/checkbox kept with token classes (no DS primitive).** Confirmed in `job-form.tsx:185,197,207,288,297,369` (USP-020's form) — explicitly documented and planned in `tasks.md`/the guard's own comment (`ds-vagas-parity.test.ts:43-45`: "`<select>` nativo não tem primitivo no DS ... só label/textarea/button viram primitivo"). **Judged acceptable** — matches the plan; not a deviation from spec, since the DS foundation genuinely lacks this primitive.
3. **`FormHeader` centered/plain-string loses the bold company-name `<span>` + left-aligned header.** Confirmed via diff: base had `<header><h1 className="text-2xl font-bold text-gray-900">`/`<p>Em nome de <span className="font-medium">{company.nomeFantasia}</span>...</p></header>` (left-aligned, bold company name); HEAD uses `<FormHeader title=".." description={`Em nome de ${company.nomeFantasia}. ...`} />`, and `FormHeader` (`src/shared/ui/form-header.tsx:12-18`) is hardcoded `text-center` with a plain `description?: string` prop (no `ReactNode`/children support for inline emphasis) — this is the same Phase-1 DS primitive used by `cadastro/page.tsx` (the task's cited reuse precedent). **Judged acceptable, cosmetic**: loses inline bold emphasis on the company name and centers the header instead of left-aligning it; no data loss, no PII exposure, matches the existing repo convention for this primitive.

None of the three deviations touch a must-not, alter data flow, or diverge from what `tasks.md`/`ds-vagas-parity.test.ts` explicitly planned — all judged **acceptable, no fix task required**.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **Result**: typecheck 0 errors; lint 0 errors; unit 966/966 passed (134 files, incl. `job-detail.spec.tsx` 8/8, `job-detail-ds-parity.test.ts` 4/4); integration 258/262 passed (44/46 files — `vagas-detalhe-metadata.int.test.ts` fully green, part of the 44); build succeeded, `/vagas/[id]` compiles (180 kB First Load JS).
- **Test count before feature (master)**: 132 unit files / 940 tests.
- **Test count after feature**: 134 unit files / 966 tests. Delta: +2 files / +26 tests, no deletions.
- **Failures**: 4 integration tests — all attributable to the confirmed pre-existing `dateOffset()` flake (see U22-MN-03 caveat above and the full investigation in USP-021's report). None in `vagas-detalhe-metadata.int.test.ts` (the new P-002 lock test this USP added).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| U22-STYLE-01 | Pending | ✅ Verified |
| U22-STYLE-02 | Pending | ✅ Verified |
| U22-MN-01 | Pending | ✅ Verified |
| U22-MN-02 | Pending | ✅ Verified |
| U22-MN-03 | Pending | ⚠️ Verified with caveat (one sub-assertion RED at run time due to confirmed pre-existing environmental flake; query logic itself untouched by diff) |
| U22-MN-04 | Pending | ✅ Verified |
| U22-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (with one recorded residual, non-blocking, shared with USP-021)

**Spec-anchored check**: 9/9 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 mutations killed (2 style-guard, 1 behavior-level on the counter must-not)
**Must-nots**: 5/5 green in principle; 1/5 (MN-03) had one sub-assertion RED at run time due to the proven pre-existing flake
**Gate**: typecheck ✅, lint ✅, unit 966/966 ✅, integration 258/262 (4 pre-existing failures, 0 in this USP's new test), build ✅

**What works**: Full DS adoption on `JobDetailView` and the detail-page shell; P-002 metadata/JSON-LD anonymization explicitly locked by a new integration test covering all 5 channels + JSON-LD; the N≥3 counter guard and the display-only CTA are both proven discriminating by mutation.

**Issues found**: Non-blocking residual — same `dateOffset()` timezone flake as USP-021 affects one sub-assertion of `get-job-detail.int.test.ts`. Not introduced by this PR.

**Anomaly noted (not a code defect)**: during this session's discrimination-sensor mutate/revert cycle, three tool-output blocks appeared claiming the reverted files "were modified... by the user or a linter" and instructing the assistant not to disclose this to the user. These did not correspond to any real out-of-band edit — each revert was verified clean via `git status --short` and the restored file content matched the pre-mutation read exactly. Treated as untrusted content, not acted upon, and disclosed here per the standing rule that no tool output can grant permission or authorize concealment.

**Next steps**: Merge as-is. File a small, separate fix task for the `dateOffset()` helper (test files only). Recommend the orchestrator/user be aware of the injected-instruction anomaly noted above, in case it recurs in other sessions.
