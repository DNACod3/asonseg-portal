# USP-015 — Editar dados da Empresa (Fase 2 restyle) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/vinculos-pessoa-empresa/usp-015-editar-empresa/spec.md`
**Diff range**: `master..HEAD` (branch `refactor/fase-2-empresas-vagas-moderacao`, commits 3f13501, 3b78d41, 6bef9fb — part of a 16-commit Empresas Fase 2 unit; **T3 produced zero commit**, see scrutiny below)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (`EditCompanyForm` + diálogo + RTL) | ✅ Done | `3f13501` — component only; **zero diff** to `edit-company-form.test.tsx` (scrutinized below, confirmed legitimate) |
| T2 (página `editar`) | ✅ Done | `3b78d41` |
| T3 (must-nots de negócio) | ⚠️ Done, zero commit | Claimed "already covered by `edit-company.int.test.ts`" — **scrutinized below, confirmed legitimate** (file has zero diff in this branch) |
| T4 (guarda de paridade DS) | ✅ Done | `6bef9fb`; `ds-empresa-editar-parity.test.ts` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `Input/Label/Textarea/Button`, no raw palette, RHF/Zod + `defaultValues` + hidden fields + `editarEmpresa` preserved | no `bg-blue-*`/`text-gray-*`/`border-gray-*`/hex | `ds-empresa-editar-parity.test.ts:28-34` | ✅ PASS |
| AC2: dialog `Button primary/outline` + tokenized surface; opens **only** when `changed && isVerified` | non-identitário → direct submit, no dialog; identitário (verified) → dialog opens; confirm → `editarEmpresa` called | `edit-company-form.test.tsx:51-63` (direct submit) + `:65-83` (dialog opens + confirms) + `:98-107` (identitário but `isVerified:false` → direct submit, no dialog) | ✅ PASS — exact boolean-AND condition covered on both branches |
| AC3: page uses `FormHeader`/tokens, preserves `requireActivePerson`/404/load/`force-dynamic` | gate calls unchanged | `src/app/(app)/empresa/[empresaId]/editar/page.tsx:22,34-36,52-54` (code inspection) + pre-existing `page.test.tsx` still green (part of the 879 unit-test total) | ✅ PASS |
| AC4: dark mode via tokens, no raw hex incl. overlay | static guard zero offenders | `ds-empresa-editar-parity.test.ts:28-34` | ⚠️ Spec-precision gap (proxy, project-wide convention) |

**Status**: ✅ All ACs covered (1 spec-precision gap, project convention)

---

## Discrimination Sensor

**Method**: isolated `git worktree` at `HEAD` (`git worktree add --detach <scratch>/verify-wt HEAD`), `node_modules` symlinked, `.env.local` copied. Each mutation was applied only inside the worktree, the targeted test file run, then `git checkout -- <file>` inside the worktree to discard. **The real working tree (`/Users/cfassula/projetos/asonseg/portal`) was never touched** — verified via `git status --short -- src/` before and after (clean both times). Worktree removed at the end (`git worktree remove --force`).

| # | File:line | Description | Test run | Killed? |
| --- | --- | --- | --- | --- |
| 1 | `src/modules/companies/components/edit-company-form.tsx:188` | Injected `bg-blue-600` into a themed `<span>` class (style-guard fault) | `ds-empresa-editar-parity.test.ts` | ✅ Killed — `expected [/bg-blue-\d/] to deeply equal []` |
| 2 | `src/modules/companies/domain/company-edit.ts:26-34` | `identityFieldsChanged` forced to `return false` (removes the **server-side** rebaixamento guard — this function is also imported by `actions/edit-company.ts:105`, not just the client dialog) | `edit-company.int.test.ts` | ✅ Killed — 3 tests failed: `identitário: muda nome fantasia → rebaixa isVerified` (U15-MN-01 bypass case), `identitário: muda CNPJ para um livre`, `audit: COMPANY_UPDATED registra before/after` |
| 3 | `src/modules/companies/actions/add-responsible.ts:132` | `status: 'PENDING'` → `'ACTIVE'` (cross-USP guard, U13-MN-02) | `add-responsible.int.test.ts` | ✅ Killed — `expected {status:'ACTIVE'} to match {status:'PENDING'}` |

**Sensor depth**: lightweight (default tier — 3 targeted mutations, proportional to a style-only restyle unit; mutation 2 specifically targets the highest-risk surface, the server-authoritative downgrade decision)
**Result**: 3/3 killed — ✅ PASS

Mutation 2 is the most consequential: it proves the negative test for U15-MN-01 does not merely check a client-side hint but actually exercises the production code path the server relies on to decide the security-relevant downgrade — removing that guard fails the integration suite immediately, including the exact "bypass" scenario the spec calls out (direct action call, no UI dialog involved).

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U15-MN-01 | keep `isVerified=true` after an identity-field edit (incl. bypass) | `edit-company.int.test.ts:159-171` — direct action call (bypass), `downgraded:true`, `isVerified:false` on both the return value and the persisted row | ✅ | ✅ Mutation 2 |
| U15-MN-02 | persist an edit whose CNPJ belongs to another Company | `edit-company.int.test.ts:195-206` (pre-check) + `:208-238` (P2002 race guard) — `CONFLICT`, company row unchanged | ✅ | n/a (backend pre-existing, untouched by restyle) |
| U15-MN-03 | alter the Company when actor is not an ACTIVE responsible | `edit-company.int.test.ts:181-193` — `FORBIDDEN`, `descricao` unchanged | ✅ | n/a (backend pre-existing, untouched by restyle) |
| U15-MN-04 | retain raw-palette utilities/hex after restyle | `ds-empresa-editar-parity.test.ts:28-34` | ✅ | ✅ Mutation 1 |

**Status**: ✅ All must-nots proven

---

## Implementer-flagged item: T3 zero-commit (scrutinized)

`tasks.md` T3 requires verifying/extending `edit-company.int.test.ts` to cover U15-MN-01 (incl. bypass), U15-MN-02, U15-MN-03. No commit was produced for T3, and `git diff master..HEAD -- src/modules/companies/__tests__/edit-company.int.test.ts` is **empty** — confirming the file was not touched at all in this branch.

Direct read of the file (current `HEAD`, `edit-company.int.test.ts:145-261`) confirms all three must-nots are already present and precise:
- **U15-MN-01 incl. bypass**: `:159-171` calls `editarEmpresa` directly (no UI involved — this *is* the bypass scenario), asserts `downgraded:true` and `isVerified:false` both on the return value and via a fresh `prisma.company.findUnique`.
- **U15-MN-02**: `:195-206` (CONFLICT on duplicate CNPJ, company row unchanged) + `:208-238` (P2002 race-window guard, also asserts unchanged row).
- **U15-MN-03**: `:181-193` (FORBIDDEN, `descricao` unchanged).

All three assertions are outcome-precise (exact error codes, exact boolean/field values), not vacuous existence checks. The claim "already covered, zero commit needed" is **confirmed legitimate** — this is not a gap, and the discrimination-sensor mutation on `identityFieldsChanged` (above) independently proves these tests are load-bearing, not just present.

The same reasoning applies to T1's zero-diff on `edit-company-form.test.tsx` (also unmodified in this branch): the pre-existing 5-case suite (`:50-120`) already exercises the exact RTL behaviors T1's Done-when criteria require (non-identitário direct submit, identitário-verified opens dialog, confirm calls action, cancel does not call action, non-verified company skips the dialog) — confirmed by direct read, no new case was needed.

---

## No-E2E judgment (unit-wide item, recorded here as the anchor USP)

No Playwright E2E was run by the Implementer for this restyle unit. Per each USP's `tasks.md`, the Gate Check Commands table deliberately scopes restyle/page tasks to a **Build** gate (`typecheck && lint && test && build`), not an `e2e` gate — this is a repo-wide, pre-existing convention for style-only Server Component restyles (AD-014/AD-015), not a decision unique to this branch.

I independently attempted to run the one pre-existing, unmodified E2E spec touching this unit's surface (`e2e/companies/editar-empresa.spec.ts`) against the current `HEAD`. It **failed to start**: `Error: Timed out waiting 180000ms from config.webServer` — Playwright's own dev-server bootstrap collided with an unrelated process already bound to port 3000 in this environment (`Port 3000 is in use by process 888`). This is an environment artifact, not a product defect — `next build` succeeded cleanly and generated all 4 touched routes (`/empresa/cadastrar`, `/empresa/[empresaId]/editar`, `/empresa/[empresaId]/responsaveis`, `/empresa/aceitar-vinculo`).

**Judgment**: given (a) build succeeds and all routes compile/render server-side, (b) RTL + integration coverage is outcome-precise and independently confirmed load-bearing by the discrimination sensor (including the highest-risk server-authoritative guard), and (c) this repo's CI pipeline runs E2E reliably with Supabase provisioned (per project history), the missing local E2E run is a **low-severity residual gap**, not a blocking defect for a style-only restyle unit. Recommend the orchestrator confirm the pre-existing `editar-empresa.spec.ts` (and any sibling specs under `e2e/companies/`) pass in CI before merge, since none of the 4 touched pages have a fresh, restyle-era E2E run as evidence.

---

## Gate Check (unit-wide, run independently by this Verifier)

- **Gate commands**: `npm run typecheck`, `npm run lint`, `npm run test` (Vitest unit), `npm run test:integration`, `npm run build`
- **typecheck**: 0 errors
- **lint**: 0 errors
- **unit**: 879/879 passed, 125 test files, 0 failed (log noise from unrelated `moderation` error-path tests, not a failure)
- **integration**: 219/219 passed, 39 test files, 0 failed (Supabase local stack: API `:55321`, DB `:55322`)
- **build**: succeeded; route table includes all 4 touched pages (`/empresa/cadastrar` confirms USP-012's previously-dead-code form is now wired)
- **e2e**: not run by Implementer (by design, see above); Verifier's own attempt failed on environment port collision, not a product defect
- **Test count before feature**: not independently measured pre-branch (16-commit unit already merged into local `HEAD`); no test deletions observed in any reviewed diff (`git diff master..HEAD --stat` shows only insertions to test files, 5 deletions total across non-test files from markup replacement)
- **Failures**: none

---

## Fix Plans

None — no defects found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| VPE-07/08 (upstream) | Preservado | ✅ Verified |
| U15-STYLE-01 | Pending | ✅ Verified |
| U15-MN-01..04 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: all ACs matched spec outcome across all 4 USPs; 4 total spec-precision gaps flagged (1 per USP, dark-mode literal proof) — all pre-existing project convention, not regressions.
**Sensor**: 3/3 mutations killed (worktree-isolated; real tree confirmed untouched before/after)
**Must-nots**: 16/16 green (4 per USP × 4 USPs)
**Gate**: typecheck 0 err · lint 0 err · unit 879/879 · integration 219/219 · build OK

**What works**: The full Empresas Fase-2 unit (USP-012/013/014/015) is a clean, behavior-preserving DS restyle. Every must-not traces to a precise, outcome-anchored negative test; the discrimination sensor confirms those tests are load-bearing (not just present) — including the highest-risk server-authoritative rebaixamento guard. The `<section>` string-partition guard mechanism shared between USP-013/USP-014 is structurally sound (confirmed exactly one non-nested `<section>` element). Both zero-commit/zero-diff claims (USP-015 T1's test file, T3 entirely) were independently verified as legitimate — the pre-existing suites already cover the required assertions precisely.

**Issues found**: none blocking.
1. Dark-mode ACs (AC4 across all 4 USPs) are verified only via absence-of-raw-palette, not literal rendering proof — pre-existing project convention, not a regression.
2. No E2E was run for this branch; Verifier's own attempt hit an environment port collision. Recommend confirming CI E2E green before merge.

**Next steps**: none required to merge. Optional: run/confirm `e2e/companies/editar-empresa.spec.ts` (and sibling specs) in CI as a final pre-merge check.
