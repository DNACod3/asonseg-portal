# USP-014 — Remover responsável (Fase 2 restyle) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/vinculos-pessoa-empresa/usp-014-remover-responsavel/spec.md`
**Diff range**: `master..HEAD` (branch `refactor/fase-2-empresas-vagas-moderacao`, commits 684cec9, 02b6a96, ede172f, f36391b — part of a 16-commit Empresas Fase 2 unit)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (`RemoveResponsibleDialog` + RTL) | ✅ Done | `684cec9`; `remove-responsible-dialog.test.tsx` updated, 4 cases |
| T2 (seção "Responsáveis ativos") | ✅ Done | `02b6a96` |
| T3 (must-nots de negócio) | ✅ Done | `ede172f`; extended `remove-responsible.int.test.ts` |
| T4 (guarda de paridade DS) | ✅ Done | `f36391b`; `ds-empresa-remover-parity.test.ts` |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `Button variant="danger"`/`"outline"`, `Label`/`Textarea` for motive, tokenized surface | dialog uses `variant="danger"` (confirm) / `variant="outline"` (cancel) | `src/modules/companies/components/remove-responsible-dialog.tsx:81,129,132` (code inspection) | ✅ PASS |
| AC2: RHF/Zod, optional `motivo`, `removerResponsavel`, `PRECONDITION_FAILED`/`FORBIDDEN` handling, `selfRemoved` redirect preserved | confirm without motive → action called with `{grantId}`; `PRECONDITION_FAILED` → message shown, dialog stays open; `selfRemoved` → `router.push` | `remove-responsible-dialog.test.tsx:49-60` (call), `:62-77` (precondition), `:79-88` (selfRemoved) | ✅ PASS — all 3 spec-defined outcomes match assertions exactly |
| AC3: "Responsáveis ativos" section uses tokens, preserves `listActiveResponsibles` + route gate | list rendered with `text-fg`/`border-border`/`divide-border`, "(você)" marker with `text-fg-muted` | `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx:47-60` (code inspection) | ✅ PASS |
| AC4: dark mode via tokens, no raw hex incl. overlay | static guard zero offenders | `ds-empresa-remover-parity.test.ts:44-55` | ⚠️ Spec-precision gap (proxy, project-wide convention, same as sibling USPs) |

**Status**: ✅ All ACs covered (1 spec-precision gap, project convention)

---

## Discrimination Sensor

Executed once across the unit in an isolated `git worktree` (real tree untouched). See `usp-015-editar-empresa/validation.md` for the full 3-mutation log. Mutation 1 (raw-palette injection, killed by `ds-empresa-editar-parity.test.ts`) validates the identical guard-construction pattern used by this USP's `ds-empresa-remover-parity.test.ts` (same `readFileSync` + `RAW_PALETTE_PATTERNS.filter(...).toEqual([])` structure — confirmed by direct code read of both files). Mutation 3 (PENDING→ACTIVE, killed by `add-responsible.int.test.ts`) demonstrates the sibling append-only/invariant guards in this module are equally sensitive to a removed-guard fault.

**Result**: non-vacuous by inspection + cross-file mutation evidence — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U14-MN-01 | end the link when it would leave the Company with 0 ACTIVE responsibles | `remove-responsible.int.test.ts:199-210` — last active → `PRECONDITION_FAILED`, `still?.revokedAt` `toBeNull()` | ✅ | n/a (pure rule `wouldLeaveCompanyWithoutResponsible`, untouched, backend pre-existing) |
| U14-MN-02 | hard-delete the row (must be append-only via `revokedAt`) | `remove-responsible.int.test.ts:167-178` — `revokedAt`/`revokedBy` populated after removal; `:219-229` — row still queryable post-removal | ✅ | n/a (backend pre-existing) |
| U14-MN-03 | end the link when actor is not an ACTIVE responsible | `remove-responsible.int.test.ts:152-164` — `FORBIDDEN`, `stillActive?.revokedAt` `toBeNull()` (strengthened this branch) | ✅ | n/a (backend pre-existing; permission check untouched) |
| U14-MN-04 | retain raw-palette utilities/hex after restyle | `ds-empresa-remover-parity.test.ts:44-55` (covers `remove-responsible-dialog.tsx` + the `<section>` slice of `responsaveis/page.tsx`) | ✅ | ✅ (equivalent guard mutation killed, see Sensor section) |

**Status**: ✅ All must-nots proven

---

## Implementer-flagged item: `<section>` string-extraction partition (scrutinized)

Same partition mechanism reviewed under USP-013's validation report. `ds-empresa-remover-parity.test.ts:33-41` (`extractActiveResponsiblesSection`) throws if `<section`/`</section>` is not found (fail-closed, not silently-pass-if-missing) and extracts exactly the "Responsáveis ativos" block confirmed unique and non-nested in `responsaveis/page.tsx:47-60`. Combined with USP-013's complementary strip, the two guards are disjoint and jointly exhaustive over the file. **Confirmed correct.**

Note also the accepted, documented residual risk: auto-removal still redirects to `/empresa` (`remove-responsible-dialog.tsx:69`, tested at `remove-responsible-dialog.test.tsx:79-88`) — a route that does not exist yet. This is explicitly Out of Scope in the spec ("herança de risco", not a regression of this restyle) and is preserved unchanged.

---

## Gate Check (unit-wide)

- **Result**: typecheck 0 errors · lint 0 errors · unit 879/879 passed (125 files) · integration 219/219 passed (39 files) · build succeeded
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| VPE-04..06 (upstream) | Preservado | ✅ Verified |
| U14-STYLE-01 | Pending | ✅ Verified |
| U14-MN-01..04 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**What works**: Dialog fully migrated to `Button variant="danger"/"outline"` + tokenized surface; ≥1-active invariant, append-only removal, and permission gate all re-verified with strengthened assertions; the shared-page section partition with USP-013 is structurally sound (single non-nested `<section>`).

**Issues found**: none blocking. 1 spec-precision gap (dark-mode literal proof), project-wide convention. Known pre-existing risk (auto-removal redirect target `/empresa` non-existent) correctly left untouched and documented as Out of Scope.

**Next steps**: none required to merge this USP.
