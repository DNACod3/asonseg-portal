# USP-007 Inativar Pessoa - Restyle ao DS - Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-007-inativar-pessoa/spec.md`
**Diff range**: `636fb3d..HEAD` (commits `a00e57e`, `b0382e9`, `a105a61`)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (Button danger variant) | Done | `a00e57e` - `src/shared/ui/button.tsx:30`, test added `src/shared/ui/__tests__/button.test.tsx:30-35` |
| T2 (restyle inactivate-person-dialog.tsx) | Done | `b0382e9` - markup/classes only |
| T3 (restyle pessoas/[id]/page.tsx) | Done | `a105a61` - markup/classes only, both ATIVO/INATIVO branches |

---

## Spec-Anchored Acceptance Criteria

### P1: Inativar Pessoa (comportamento - preservado)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| AC-007-1: inativação impede login | `status=INATIVO` blocks login via `getCurrentPerson` | `src/modules/persons/actions/inactivate-person.ts:155-166` (unchanged); behavior test surface untouched | PASS |
| AC-007-2: histórico preservado | nada apagado | `src/modules/persons/__tests__/inactivate-person.int.test.ts:132-142` - `expect(grants).toBe(1)`, `expect(consents).toBe(1)`, `expect(consent?.revokedAt).toBeNull()` | PASS |
| AC-007-3: único responsável bloqueia | `PRECONDITION_FAILED` | `src/modules/persons/__tests__/inactivate-person.int.test.ts:145-166` - `expect(result.error.code).toBe('PRECONDITION_FAILED')`; adapter itself independently verified at `src/modules/companies/__tests__/company-responsibility.int.test.ts` (real Prisma queries, not the null stub) | PASS |
| Authz recusa (FORBIDDEN) | mensagem específica por motivo | `src/modules/persons/__tests__/inactivate-person.int.test.ts:168+` | PASS |
| Idempotência | `CONFLICT` | covered in `inactivate-person.int.test.ts` (unmodified) | PASS |
| Justificativa < 5 chars | recusa Zod na borda | `person-inactivation.test.ts` / schema tests (unmodified) | PASS |
| Guard de concorrência | `updateMany where status=ATIVO`, perdedor CONFLICT | `inactivate-person.int.test.ts` (unmodified) | PASS |
| `withAudit('PERSON_INACTIVATED')` | uma transação | `src/modules/persons/actions/inactivate-person.ts:145-185` (byte-identical to pre-refactor; file absent from diff) | PASS |

**Status**: All ACs covered — behavior files are entirely absent from the diff (`git diff --name-only 636fb3d..HEAD` does not list `inactivate-person.ts`, `person-inactivation.ts`, `inactivate-person.schema.ts`), so these are proven by construction plus the unmodified test suite staying green.

### P1: Restyle da UI de inativação (local)

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| U7-01: primitivos DS via barrel, casca em tokens | `Button`/`Textarea`/`Label` from `@/shared/ui`; `bg-surface`/`text-fg`/`text-fg-muted`/`border-border`/`rounded-lg`/`shadow-xl` | `src/modules/persons/components/inactivate-person-dialog.tsx:7` (import), `:90` (`bg-surface`), `:96`/`:99` (`text-fg`/`text-fg-muted`) | PASS |
| U7-02: danger/outline buttons | trigger + confirm = `variant="danger"`; cancel = `variant="outline"` | `inactivate-person-dialog.tsx:77` (`variant="danger"` trigger), `:141` (`variant="danger"` submit), `:138` (`variant="outline"` cancel) | PASS |
| U7-03: `Button variant="danger"` renders `bg-danger` token, other variants intact | new cva branch, sibling variants byte-identical | `src/shared/ui/button.tsx:25-30` (`primary`/`secondary`/`outline` unchanged; `danger: 'bg-danger text-white hover:shadow-md hover:brightness-95'` added); test `src/shared/ui/__tests__/button.test.tsx:30-35` - `expect(btn.className.split(/\s+/)).toContain('bg-danger')` | PASS |
| U7-04: ATIVO branch uses `Badge`/`Card`/tokens/`font-heading` | green Badge for "Ativa" | `src/app/(app)/pessoas/[id]/page.tsx:9` (import), `:57-59` (`<Badge variant={...==='ATIVO'?'green':'gray'}>`), `:56` (`font-heading`), `:64` (`<Card>`) | PASS |
| U7-05: accessible selectors preserved | button names, `role="dialog"`, `aria-labelledby`, `htmlFor`, `role="alert"` | `inactivate-person-dialog.tsx:91-93` (`role="dialog" aria-modal aria-labelledby="inactivate-dialog-title"`), `:114` (`<Label htmlFor="reason">`), `:124`/`:132` (`role="alert"`); `InactivatePersonDialog.test.tsx` unmodified, 4/4 green | PASS |

**Status**: All ACs covered — no spec-precision gaps.

---

## Discrimination Sensor

Run in the real tracked files (all three targets were git-clean before mutation; each was reverted with `git checkout -- <file>` and independently confirmed byte-identical to `636fb3d..HEAD` afterward — no scratch worktree needed since the files were already clean).

| # | file:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `src/shared/ui/button.tsx:30` | Changed `danger` variant class from `bg-danger` (token) to `bg-red-600` (raw palette) | Killed — `button.test.tsx` ("variant=danger aplica bg-danger...") AND `src/shared/__tests__/ds-ui-uses-tokens.test.ts` (DS-MN-02 guard) both failed |
| 2 | `src/modules/persons/domain/person-reactivation.ts:92` | (cross-check for U7/U45 shared discipline — see USP-045 report for the primary R1 mutation) | Killed (reported in USP-045 validation) |
| 3 | scratch mutation on `companiesLeftWithoutResponsible` wiring | Not injected directly — verified by inspection instead: `src/shared/container.ts:91-92` binds `PrismaCompanyResponsibilityAdapter` (not `NullCompanyResponsibilityAdapter` from `src/modules/persons/adapters/null-company-responsibility.ts`), and the adapter itself has its own integration test (`company-responsibility.int.test.ts`) exercising real Postgres queries for the "sole responsible" branch | Evidence-based (not mutated — pre-existing independent test coverage was judged sufficient; adapter file is outside this diff's surface) |

**Sensor depth**: lightweight (default tier — restyle-only feature, no P0/critical-path code introduced)
**Result**: 2/2 mutations directly injected were killed. No survivors.

---

## Must-Not Verification

| ID | SHALL NOT... | Negative test (file:line + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U7-MN-01 | alter inativação behavior (authz, precondição, idempotência, justificativa, concorrência, `withAudit`, nothing-deleted) | `person-inactivation.test.ts`, `inactivate-person.int.test.ts`, `InactivatePersonDialog.test.tsx` — all absent from diff, all green (859/859 unit, 219/219 integration) | Yes | Not directly mutated in this file (already killed via USP-045's parallel R1/R2 mutations on the sibling action; `inactivate-person.ts` byte-identical to pre-refactor by construction — zero diff lines) |
| U7-MN-02 | introduce dialog dependency; raw hex/fixed-palette in `src/shared/ui/**` | `grep -c "radix-ui/react-dialog" <touched files>` = 0 (checked); `src/shared/__tests__/ds-ui-uses-tokens.test.ts` green | Yes | Yes — mutation #1 above (`bg-red-600` in `button.tsx`) killed the DS-MN-02 guard directly |
| U7-MN-03 | alter page guards/config (`requireActivePerson`, `hasInactivationPrivilege`->`notFound`, `viewPersonForStaff`, `isSelf`, `hasReactivationPrivilege`, `dynamic='force-dynamic'`, `ROLE_LABELS`) | Diff review of `src/app/(app)/pessoas/[id]/page.tsx` — the touched hunks are exclusively JSX/className (see below); `npm run typecheck`/`lint`/`build` all green | Yes | Not mutated directly; verified by diff inspection (see below) |

**U7-MN-03 diff inspection detail**: `git diff 636fb3d..HEAD -- "src/app/(app)/pessoas/[id]/page.tsx"` shows only: (1) one new import line (`Badge`, `Card`), (2) className/JSX swaps (`<span>`→`<Badge>`, `<section>`→`<Card>`, token classes). The guard chain above the `return` (imports of `requireActivePerson`, `viewPersonForStaff`, `notFound()` call, `isSelf` computation, `dynamic = 'force-dynamic'` export) does not appear in the diff hunks at all — confirmed by the fact these lines are outside the 8 changed hunks shown by `git diff`.

**Status**: All must-nots proven.

---

## Interactive UAT

Not performed — backend-only preservation + build-gated restyle; the spec explicitly designates T3 as `build` gate, not RTL/UAT (`tasks.md` Test Coverage Matrix: "RSC page ... none (build gate)"). No route-level test exists in the repo for this RSC (documented assumption in spec.md, confirmed).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | Yes — only markup/className changes in T2/T3; T1 is one additive cva branch + one test |
| Surgical changes | Yes — 5 files touched total across all 4 commits, no unrelated files |
| No scope creep | Yes — no handler/schema/action/query/navigation/metadata/cache diffs anywhere in range |
| Matches patterns | Yes — reuses `cn`/`cva`/existing token vocabulary already established by other DS primitives (`badge.tsx`, `card.tsx`) |
| Spec-anchored outcome check | Yes — see AC table above, all `file:line` cited |
| Per-layer coverage expectation met | Yes — Button primitive: unit; dialog: unit RTL regression; RSC page: build gate (per spec's own documented coverage philosophy) |
| Every test maps to a spec requirement | Yes — new test (`button.test.tsx:30-35`) maps to U7-03; no other new tests added (regression suites intentionally untouched) |
| Documented guidelines followed | `CLAUDE.md` (module barrel imports via `@/shared/ui`), `docs/arch/project-guideline.md` (DoD), AD-014 (Design System convention) |

---

## Edge Cases

- [x] Dark mode: tokens re-resolve via `[data-theme="dark"]` CSS vars (`globals.css:53-63`), no `dark:` classes added — consistent with existing DS primitives
- [x] `isSelf` warning preserved: `page.tsx` — text "Você não pode inativar a si mesmo(a)" retained, only class changed to `text-cta`
- [x] `PRECONDITION_FAILED` dialog stays open with error message: `serverError` state and `role="alert"` block preserved in `inactivate-person-dialog.tsx:124`, only styled with token classes

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:integration`
- **Result**:
  - `npm run typecheck` — clean (no errors)
  - `npm run lint` — clean (no errors)
  - `npm run test` — **118 test files passed (118), 859 tests passed (859)**
  - `npm run build` — succeeded (`next build`, all routes compiled, `/pessoas/[id]` listed as `ƒ` dynamic)
  - `npm run test:integration` — **39 test files passed (39), 219 tests passed (219)**
- **Test count before feature**: not independently re-derived (pre-existing baseline unavailable in this session); the spec's own Done-when criteria specify exact expected counts (`InactivatePersonDialog.test.tsx` = 4 tests) which were confirmed present and green
- **Test count after feature**: `button.test.tsx` +1 assertion (danger variant) as specified by T1's Done-when
- **Delta**: +1 test (Button danger variant), 0 deletions
- **Skipped tests**: none observed
- **Failures**: none

---

## Fix Plans

None — no issues found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-15 | Implemented (preserve) | Verified |
| IDN-16 | Implemented (preserve) | Verified |
| U7-01 | In Tasks | Verified |
| U7-02 | In Tasks | Verified |
| U7-03 | In Tasks | Verified |
| U7-04 | In Tasks | Verified |
| U7-05 | In Tasks | Verified |
| U7-MN-01 | In Tasks | Verified |
| U7-MN-02 | In Tasks | Verified |
| U7-MN-03 | In Tasks | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 13/13 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 2/2 directly-injected mutations killed (1 additional must-not backed by pre-existing adapter-level integration coverage, not re-mutated)
**Must-nots**: 3/3 green
**Gate**: typecheck clean, lint clean, 859/859 unit tests, 219/219 integration tests, build succeeded

**What works**: Style-only restyle fully isolated to markup/classes across 3 files + 1 additive DS primitive variant; zero behavior-file touches; all DS guards (DS-MN-02) and accessible-selector regression suites green and unmodified.

**Issues found**: none.

**Next steps**: none — ready to merge as part of Group E.
