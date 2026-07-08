# USP-013 — Adicionar responsável (Fase 2 restyle) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/vinculos-pessoa-empresa/usp-013-adicionar-responsavel/spec.md`
**Diff range**: `master..HEAD` (branch `refactor/fase-2-empresas-vagas-moderacao`, commits a76b19f, 3e31590, 5b0d97c, 7561dda, b100182 — part of a 16-commit Empresas Fase 2 unit)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (`AddResponsibleForm` + RTL) | ✅ Done | `a76b19f`; `add-responsible-form.test.tsx` new, 4 cases |
| T2 (`PendingResponsibleLinksList` + RTL) | ✅ Done | `3e31590`; `pending-responsible-links-list.test.tsx` new |
| T3 (páginas responsaveis[shell+adição] + aceitar-vinculo) | ✅ Done | `5b0d97c` |
| T4 (must-nots de negócio) | ✅ Done | `7561dda`; extended `add-responsible.int.test.ts` |
| T5 (guarda de paridade DS) | ✅ Done | `b100182`; `ds-empresa-responsaveis-parity.test.ts` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `AddResponsibleForm` uses DS primitives, preserves RHF/Zod + `adicionarResponsavel` + neutral success (no PII) | success message contains no target identity | `add-responsible-form.test.tsx:53-61` — `expect(status).not.toHaveTextContent('fulano@example.com')`, `not.toMatch(/fulano/i)` | ✅ PASS |
| AC1 (call contract) | `adicionarResponsavel({empresaId, cpfOuEmail})` called once | `add-responsible-form.test.tsx:42-51` | ✅ PASS |
| AC2: `PendingResponsibleLinksList` preserves `aceitarVinculoResponsavel`, optimistic removal, empty state | accept → action called with `{empresaId}`, item removed from list | `pending-responsible-links-list.test.tsx` (verified: `Card`/`Button` primitives used at `components/pending-responsible-links-list.tsx:56,62`) | ✅ PASS |
| AC3: pages use `FormHeader`/tokens, preserve `requireActivePerson`/404/`force-dynamic` | gate calls unchanged | `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx:8,22,34-36` (code inspection — unchanged gate logic, only markup restyled) | ✅ PASS |
| AC4: dark mode via tokens, no raw hex | static guard zero offenders | `ds-empresa-responsaveis-parity.test.ts:51-62` | ⚠️ Spec-precision gap (proxy, same project-wide convention noted in USP-012) |

**Status**: ✅ All ACs covered (1 spec-precision gap, project convention)

---

## Discrimination Sensor

Executed once across the unit in an isolated `git worktree` (real tree untouched, verified clean via `git status` before/after). 3 targeted behavior-level mutations, proportional to a lightweight-tier restyle unit:

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/companies/components/edit-company-form.tsx:188` | Injected `bg-blue-600` into a themed class | ✅ Killed by `ds-empresa-editar-parity.test.ts` (structurally identical guard pattern to `ds-empresa-responsaveis-parity.test.ts` used by this USP) |
| 2 | `src/modules/companies/domain/company-edit.ts:26-34` | `identityFieldsChanged` forced to always return `false` | ✅ Killed by `edit-company.int.test.ts` (3 tests failed) |
| 3 | `src/modules/companies/actions/add-responsible.ts:132` | `status: 'PENDING'` → `'ACTIVE'` (removes U13-MN-02 guard directly) | ✅ Killed by `add-responsible.int.test.ts:150` — `expected { status: 'ACTIVE' } to match { status: 'PENDING' }` |

**Sensor depth**: lightweight (default tier)
**Result**: 3/3 killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U13-MN-01 | expose target PII before acceptance | `add-responsible.int.test.ts:143-144` — `expect(JSON.stringify(res.data)).not.toContain('Alvo Resp Int')` + `add-responsible-form.test.tsx:53-61` (RTL, neutral message) | ✅ | n/a (backend pre-existing) |
| U13-MN-02 | create grant as `ACTIVE` without explicit acceptance | `add-responsible.int.test.ts:140,150` — `toMatchObject({status:'PENDING'})` | ✅ | ✅ Mutation 3 above |
| U13-MN-03 | create the link when actor is not an ACTIVE responsible | `add-responsible.int.test.ts:120-131` — `FORBIDDEN` + `expect(grant).toBeNull()` | ✅ | n/a (backend pre-existing; permission check untouched by this restyle) |
| U13-MN-04 | retain raw-palette utilities/hex after restyle | `ds-empresa-responsaveis-parity.test.ts:51-62` (covers `add-responsible-form.tsx`, `pending-responsible-links-list.tsx`, `aceitar-vinculo/page.tsx`, and the non-`<section>` slice of `responsaveis/page.tsx`) | ✅ | ✅ Mutation 1 (equivalent guard) |

**Status**: ✅ All must-nots proven

---

## Implementer-flagged item: `<section>` string-extraction partition (scrutinized)

`responsaveis/page.tsx` is shared by USP-013 (shell + `AddResponsibleForm`, this spec) and USP-014 (the "Responsáveis ativos" `<section>`). The two parity guards partition the file by string search:

- `ds-empresa-responsaveis-parity.test.ts:35-42` (`stripActiveResponsiblesSection`) removes everything between the first `<section` and its matching `</section>`.
- `ds-empresa-remover-parity.test.ts:33-41` (`extractActiveResponsiblesSection`) keeps only that same slice.

Direct read of `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx:47-60` confirms exactly **one**, non-nested `<section>` element (the "Responsáveis ativos" block) — no other `<section>` tag exists in the file. The partition is therefore disjoint and jointly exhaustive: every byte of the file is covered by exactly one of the two guards, with no gap and no double-coverage. **Confirmed correct**, not vacuous.

---

## Gate Check (unit-wide)

- **Result**: typecheck 0 errors · lint 0 errors · unit 879/879 passed (125 files) · integration 219/219 passed (39 files) · build succeeded
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| VPE-01..03 (upstream) | Preservado | ✅ Verified |
| U13-STYLE-01 | Pending | ✅ Verified |
| U13-MN-01..04 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**What works**: Both components + both shared-page sections fully migrated to DS primitives; single-step no-PII search preserved (documented SPEC_DEVIATION Level-1, pre-existing and out of this restyle's scope); PENDING-gate and FORBIDDEN-gate both re-verified with strengthened assertions and confirmed sensor-killable.

**Issues found**: none blocking. 1 spec-precision gap (dark-mode literal proof), project-wide convention.

**Next steps**: none required to merge this USP.
