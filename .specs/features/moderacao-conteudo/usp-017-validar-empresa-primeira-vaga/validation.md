# USP-017 — Validar Empresa na primeira vaga — Validation (Fase 2 restyle)

**Date**: 2026-07-07
**Spec**: `.specs/features/moderacao-conteudo/usp-017-validar-empresa-primeira-vaga/spec.md`
**Diff range**: `bb819b9..HEAD` (`a57df0e`, `8fac14a`, `c975c8f`)
**Verifier**: independent sub-agent (author ≠ verifier)

**Scope note**: style-only restyle (AD-015 pattern) of the already-implemented `VerificationPanel`
(#157). Backend (hook, snapshot, `rejectionCount`, guard P-005, queries, View Models — #156) is baseline
to preserve, evidenced by the pre-existing, untouched integration suite.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 (#156 backend side-effect) | ✅ Baseline (pre-existing, untouched) | `adapters/prisma-company-verify-hook.ts`, `companies/**` — 0 diff lines in range |
| T2 (#157 UI, pre-restyle) | ✅ Baseline (pre-existing, untouched logic) | `verification-panel.tsx` logic (`initialChecklist`, `effectiveReady`, `onReadinessChange`, E-004 short-circuit, diff) unchanged — only markup/classes touched |
| T3 (restyle VerificationPanel to DS) | ✅ Done | `8fac14a` |

---

## Spec-Anchored Acceptance Criteria

### Baseline behavior (must not regress) — evidence via untouched, still-green tests

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ----------------------- | ------ |
| E-002/AD-2 marca+snapshot+evento na mesma tx, idempotente | 1ª vaga: `isVerified=true` + snapshot + `COMPANY_VERIFIED`; 2ª vaga (já verificada): no-op | `src/modules/moderation/__tests__/company-verify-hook.int.test.ts:163` — `it('E-004: aprovar vaga de Empresa já verificada é no-op (não regrava verifiedAt nem re-emite COMPANY_VERIFIED)')` | ✅ PASS (green, file untouched) |
| P-005/AD-3 rota única de marcação | nenhuma rota externa marca `isVerified` | `src/modules/companies/__tests__/no-external-verify.test.ts` (0 diff lines in range) | ✅ PASS (green, file untouched) |
| P-001 checklist bloqueia aprovação | `ready=false` até todos os itens resolvidos (marcado ou dispensado+motivo) | `src/modules/moderation/components/__tests__/verification-panel.test.tsx:55` — `it('P-001: aprovação bloqueada (ready=false) até todos os itens serem resolvidos')`; `:65` — `it('P-001: item dispensado sem motivo NÃO libera; com motivo libera')` | ✅ PASS (green, file untouched — 0 diff lines to this test file) |
| P-002 separação verificar↔decidir | seção própria "Verificação da Empresa" | `src/modules/moderation/components/__tests__/verification-panel.test.tsx:50` — `it('P-002: o painel é uma seção própria "Verificação da Empresa"')` | ✅ PASS (green, file untouched) |
| P-003/D-005 histórico de rejeições visível | badge + lista quando/quem/motivo | `src/modules/moderation/components/__tests__/verification-panel.test.tsx:89` — `it('P-003/D-005: rejeições exibem badge e histórico (quando/quem/motivo)')` | ✅ PASS (green, file untouched) |
| E-004 estado "verificada" | curto-circuito exibe só "verificada em DD/MM por X" | `data.isVerified` branch at `verification-panel.tsx:98` unchanged logically (only classNames edited — see diff); covered by same test file above | ✅ PASS |

### New restyle ACs (T3)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ----------------------- | ------ |
| DS-17-01 tokens/primitivos, paridade light/dark | banner âmbar→`cta`, verde→`success`, vermelho→`danger`; `<Input>` de `@/shared/ui` | `verification-panel.tsx` diff (`8fac14a`): `border-success`/`bg-[color-mix(...success 12%...)]`/`text-success` (verified block); `border-cta`/`bg-[color-mix(...cta 10%...)]`/`text-cta` (unverified block); `border-danger`/`bg-[color-mix(...danger 10%...)]`/`text-danger` (rejection history); `<Input>` imported and used for dismissal-reason field | ✅ PASS |
| DS-17-MN-1 sem paleta crua | 0 matches de paleta fixa/hex em `verification-panel.tsx` | `src/shared/__tests__/ds-moderation-parity.test.ts:27-34` — `it.each(MODERATION_FILES)` includes `verification-panel.tsx` | ✅ PASS (green; sensor-confirmed discriminating below) |
| DS-17-MN-3 sem dark-mode ad-hoc | nenhum `dark:`/`prefers-color-scheme`; semânticas cta/success/danger corretas | `grep -nE "dark:|prefers-color-scheme"` over diff → 0 matches; color mapping verified in diff (amber→cta, green→success, red→danger, matches design.md §8.2/§8.3 exactly) | ✅ PASS |

**Status**: ✅ All ACs covered (baseline preserved by evidence of untouched-and-green tests; new DS ACs covered by the extended guard test and manual diff inspection).

---

## Discrimination Sensor

**Method**: `git worktree add /tmp/verify-ds-mutant HEAD` (scratch, isolated from the real working tree),
`node_modules` symlinked in for speed, mutation injected via Python string replace, guard test run in
isolation, worktree removed afterward. Real tree was never touched (confirmed via `git worktree list`
post-cleanup and `git status` showing no product-file changes attributable to this run).

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `moderation-queue.tsx` — empty-state `<div>` (~line 111) | Appended raw-palette class `bg-blue-600` to existing token classes | ✅ Killed — `ds-moderation-parity.test.ts` "moderation-queue.tsx não contém utilitário de paleta fixa" failed |
| 2 | `verification-panel.tsx` — unverified-block `<h3>` (~line 124) | Appended raw-palette class `text-gray-600` to existing token classes | ✅ Killed — `ds-moderation-parity.test.ts` "verification-panel.tsx não contém utilitário de paleta fixa" failed |

**Sensor depth**: lightweight (2/2 targeted mutations, one per USP's owned file — proportional to a
style-only refactor's risk profile)
**Result**: 2/2 killed — PASS ✅. Guard is genuinely discriminating for both files it protects (not vacuous
— it does not merely assert "file exists" or pass unconditionally); `page.tsx` was not separately mutated
in this run but is covered by the same regex/`it.each` mechanism as the two mutated files, so the killing
mechanism generalizes.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | ---------------------------------------- | ------ | ----------------------- |
| DS-17-MN-1 | reter paleta crua/hex em `verification-panel.tsx` | `src/shared/__tests__/ds-moderation-parity.test.ts:27-34` | ✅ | ✅ (mutation 2 above) |
| DS-17-MN-2 | alterar comportamento (gating P-001, separação P-002, histórico P-003, diff D-006, curto-circuito E-004, contrato `onReadinessChange`) | `src/modules/moderation/components/__tests__/verification-panel.test.tsx` (untouched, 0 diff lines, green in 887-test run) | ✅ | n/a — guarded by test-file immutability + gate green |
| DS-17-MN-3 | introduzir `dark:`/`prefers-color-scheme`/lib de tema | manual grep over diff (see AC table) — 0 matches | ✅ | n/a (same scope limitation as USP-016's DS-16-MN-3 — no dedicated automated regex for this specific prohibition) |
| P-001 (behavioral) | aprovar sem checklist resolvida | `verification-panel.test.tsx:55,65` | ✅ | n/a — component logic untouched (only classNames), pre-existing coverage |
| P-002 (behavioral) | decisão única indistinguível | `verification-panel.test.tsx:50` | ✅ | n/a — pre-existing coverage |
| P-003 (behavioral) | ocultar histórico de rejeições | `verification-panel.test.tsx:89` | ✅ | n/a — pre-existing coverage |
| P-004 (behavioral, backend) | snapshot do rascunho em vez de dados vigentes | `src/modules/moderation/__tests__/company-verify-hook.int.test.ts` (0 diff lines) | ✅ | n/a — backend untouched |
| P-005 (behavioral, backend) | marcar `isVerified` fora do hook | `src/modules/companies/__tests__/no-external-verify.test.ts` (0 diff lines) | ✅ | n/a — backend untouched |

**Status**: ✅ All must-nots proven.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — 1 product file touched (`verification-panel.tsx`) + shared guard test extended |
| Surgical changes | ✅ — matches design.md §8.2 mapping table element-for-element (verified block, unverified block, `<dl>` diff highlight, rejection history, checklist, dismissal input) |
| No scope creep | ✅ — backend (`adapters/prisma-company-verify-hook.ts`, `companies/**`, `schema.prisma`, `container.ts`, `domain/verification-checklist.ts`, `queries/list-verification-checklist.ts`) confirmed untouched (0 diff lines each) |
| Matches patterns | ✅ — `color-mix` tint technique matches `Badge`/`StepIcon` precedent (DS-MN-02 compliant, not raw hex); `accent-primary` on checkboxes matches `LgpdBox` precedent per design.md §8.3 |
| Spec-anchored outcome check | ✅ — see AC table |
| Every test maps to a spec requirement | ✅ |
| Documented guidelines followed | AD-014/AD-015, `.specs/project/STATE.md`, `CLAUDE.md` |

**Implementer-flagged items — judged**:

1. **`color-mix` tint percentages (12%/10%/22%)** — diff shows `success 12%` (verified block),
   `cta 10%` (unverified block + rejection history uses `danger 10%`), `cta 22%` (changed-field highlight
   in `Field` component). Matches design.md §8.2 table exactly (`success 12%`, `cta 10%`, `danger 10%`,
   `cta 22%` for the changed-field highlight). **Confirmed correct.**
2. **`ContentKind.CANDIDATE_PROFILE` drift intentionally not fixed** — confirmed out of scope. This is a
   USP-016 concern (`domain/content-status.ts`), not USP-017's; 0 diff lines to that file in this range
   (see USP-016 validation.md). **Confirmed untouched.**
3. **No `<input type="checkbox">` primitive available in DS** — design.md §8.3 documents this as an
   accepted consistency decision (same precedent as `LgpdBox`). Diff shows `accent-primary` added to both
   checkboxes, native `<input type="checkbox">` retained. **Judged acceptable**, consistent with documented
   decision and DS inventory (`src/shared/ui` has no `Checkbox` export — confirmed via `index.ts`).

---

## Gate Check

- **Gate commands**: `npm run typecheck`, `npm run lint`, `npm run test -- --run`, `npm run test:integration -- --run`, `npm run build`
- **Result**: typecheck 0 errors · lint 0 errors · unit 887/887 passed (126 files) · integration 219/219 passed (39 files) · build succeeded (28 routes, `/moderacao` present as `ƒ` dynamic route)
- **Skipped tests**: none observed
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ---------- |
| E-001..E-004, P-001..P-005, L-001, L-002 | Implemented (master) | ✅ Verified (preserved, non-regressed) |
| DS-17-01 | Implementing | ✅ Verified |
| DS-17-MN-1 | Implementing | ✅ Verified |
| DS-17-MN-2 | Implementing | ✅ Verified |
| DS-17-MN-3 | Implementing | ✅ Verified (manual evidence, not automated — see note under Must-Not Verification) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: baseline ACs traced to untouched pre-existing tests (green); DS ACs traced to the
extended guard test (green, sensor-confirmed discriminating) plus manual color-mapping verification against
design.md §8.2
**Sensor**: 2/2 mutations killed (both USP-016's and USP-017's owned files independently confirmed discriminating)
**Must-nots**: 8/8 green (DS-17-MN-1..3 + P-001..P-005)
**Gate**: typecheck/lint/unit(887)/integration(219)/build all passed

**What works**: backend (hook, snapshot, rejection counter, P-005 guard, View Models) confirmed untouched
(0 diff lines across all named files) — behavior preservation is structural. The restyled component
genuinely adopts the DS: correct token/`color-mix` semantics per element (verified→success,
unverified→cta, rejection→danger), `<Input>` primitive for the one text-input field, and the checkbox
exception is a documented, precedented decision rather than an oversight.

**Issues found**: none blocking. Same minor gap as USP-016: DS-17-MN-3 (no ad-hoc dark-mode) is verified
manually, not by a dedicated automated regex in the guard test.

**Next steps**: none required for PASS. Same optional follow-up as USP-016 — extend
`ds-moderation-parity.test.ts` with a `dark:`/`prefers-color-scheme` check for full DS-16/17-MN-3
automation.
