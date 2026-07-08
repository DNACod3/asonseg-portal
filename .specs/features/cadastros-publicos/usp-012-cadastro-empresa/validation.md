# USP-012 — Cadastro de Empresa (Fase 2 restyle) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/cadastros-publicos/usp-012-cadastro-empresa/spec.md`
**Diff range**: `master..HEAD` (branch `refactor/fase-2-empresas-vagas-moderacao`, commits c7e68ba, 6003a85, 1ad04da, e879dd8 — part of a 16-commit Empresas Fase 2 unit)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (restyle form + RTL) | ✅ Done | `c7e68ba`; `create-company-form.test.tsx` new, 5 cases |
| T2 (guarda de paridade DS) | ✅ Done | `6003a85`; `ds-empresa-cadastro-parity.test.ts` |
| T3 (must-nots de negócio) | ✅ Done | `1ad04da`; extended `create-company.int.test.ts` with explicit U12-MN-02/03 assertions (U12-MN-01 already asserted pre-existing) |
| T4 (rota `/empresa/cadastrar`) | ✅ Done | `e879dd8`; `src/app/(app)/empresa/cadastrar/page.tsx` — confirmed present in `next build` route table |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| P1-AC1: form uses `Label/Input/Textarea/Button`, no raw palette | no `bg-blue-*`/`text-gray-*`/`border-gray-*`/`focus:ring-blue-*`/hex in restyled files | `src/modules/companies/__tests__/ds-empresa-cadastro-parity.test.ts:34-40` — `expect(offenders).toEqual([])` over `create-company-form.tsx` + `cadastrar/page.tsx` | ✅ PASS |
| P1-AC2: RHF/Zod, hidden term fields, affirmative consent gate, `createCompany` preserved | submit without consent → `createCompany` NOT called; submit with consent → called once | `src/modules/companies/__tests__/create-company-form.test.tsx:70-93` | ✅ PASS |
| P1-AC3: term inside `LgpdBox`, scrollable body + checkbox | `LgpdBox` renders heading "Termo de representação empresarial" | `create-company-form.test.tsx:58-68` | ✅ PASS |
| P1-AC4: dark mode via tokens, no raw hex | static guard finds zero hex/raw-palette occurrences | `ds-empresa-cadastro-parity.test.ts:34-40` | ⚠️ Spec-precision gap — proxy (absence of hex) proves no raw hex, not literal dark-mode rendering; no visual/e2e check exists in repo for this (project-wide convention, not unique to this unit) |
| Rota-AC1: authenticated access loads term + renders form | `loadTerm('COMPANY_REPRESENTATION')` called server-side, form receives `term` prop | `src/app/(app)/empresa/cadastrar/page.tsx:26-49` (code inspection) + `next build` route `ƒ /empresa/cadastrar` present | ✅ PASS (build-gate per spec's documented decision — no `page.test.tsx` planned) |
| Rota-AC2: unauthenticated → redirect to login | `requireActivePerson()` called first | `page.tsx:27`; generic behavior unit-tested at `src/modules/identity/__tests__/session.test.ts` (route itself has no dedicated test, consistent with project convention for `(app)` pages) | ⚠️ Spec-precision gap — no route-specific evidence, but same pattern as all sibling `(app)` routes |
| Rota-AC3: success redirects to `/empresa/{companyId}/responsaveis` | exact redirect target | `create-company-form.test.tsx:95-102` — `expect(routerState.push).toHaveBeenCalledWith('/empresa/c-1/responsaveis')` | ✅ PASS |

**Status**: ✅ All ACs covered (2 spec-precision gaps flagged, both pre-existing project conventions, not regressions)

---

## Discrimination Sensor (unit-level; see cross-USP note)

Sensor executed once across the whole Empresas-Fase-2 unit in an isolated `git worktree` (real tree never touched). See `usp-015-editar-empresa/validation.md` for the full mutation log — 3/3 mutations killed. USP-012's own style-guard mechanism (`ds-empresa-cadastro-parity.test.ts`) uses the identical pattern verified killed for USP-015's sibling guard (`ds-empresa-editar-parity.test.ts`); code-read confirms both guards share the same `RAW_PALETTE_PATTERNS`/`toEqual([])` structure — non-vacuous by construction (would fail on any of the 5 raw-palette/hex patterns).

**Result**: non-vacuous by inspection + cross-file mutation evidence — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U12-MN-01 | persist `isVerified=true` on creation | `create-company.int.test.ts:121-126` — `expect(company).toMatchObject({..., isVerified: false})` | ✅ | n/a (pre-existing, unmodified backend) |
| U12-MN-02 | persist `Consent` when term hash mismatches | `create-company.int.test.ts:159-166` — hash divergent → `VALIDATION`, `fabricatedConsent` `toBeNull()` | ✅ | n/a (pre-existing backend; assertion strengthened this branch) |
| U12-MN-03 | create a 2nd Company with duplicate CNPJ | `create-company.int.test.ts:202-213` — duplicate → `CONFLICT`, `duplicates` `toHaveLength(1)` | ✅ | n/a (pre-existing backend; assertion strengthened this branch) |
| U12-MN-04 | retain raw-palette utilities/hex after restyle | `ds-empresa-cadastro-parity.test.ts:34-40` | ✅ | ✅ (equivalent guard mutation killed on sibling USP-015, see cross-reference above) |

**Status**: ✅ All must-nots proven

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code / surgical changes | ✅ — only `create-company-form.tsx`, new tests, new page |
| No scope creep | ✅ — `createCompany` action/schema/domain untouched (`git diff` confirms 0 changes outside listed files) |
| Matches patterns | ✅ — reuses `LgpdBox`, `FormCard`/`FormHeader`/`StepIcon` consistent with Fase 1 restyle |
| Spec-anchored outcome check | ✅ (2 precision gaps noted, both project-convention, not defects) |
| Documented guidelines followed | `CLAUDE.md` (Server Action pattern, DS), `docs/arch/project-guideline.md` (DoD) |

---

## Gate Check (unit-wide; see summary below)

- **Result**: typecheck 0 errors · lint 0 errors · unit 879/879 passed (125 files) · integration 219/219 passed (39 files) · build succeeded, `/empresa/cadastrar` route present
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| CAD-11..15 (upstream) | Preservado | ✅ Verified |
| U12-STYLE-01 | Pending | ✅ Verified |
| U12-WIRE-01 | Pending | ✅ Verified |
| U12-MN-01..04 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**What works**: Form fully migrated to `@/shared/ui` primitives; route wired (dead code from before this branch now reachable); all backend must-nots (isVerified, hash, CNPJ uniqueness) preserved with strengthened assertions; redirect target fixed to an existing route.

**Issues found**: none blocking. Two spec-precision gaps (dark-mode literal proof, unauthenticated-redirect route-specific evidence) are project-wide conventions, not regressions introduced here.

**Next steps**: none required to merge this USP.
