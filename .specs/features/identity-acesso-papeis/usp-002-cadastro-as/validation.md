# USP-002 Cadastro de Pessoa pela assistente social — Refactor (Fase 1) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-002-cadastro-as/spec.md`
**Diff range**: `44a3753..HEAD` (commits `e458923`, `d800496` of the 6-commit Group C range)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1: Restyle `AssistedRegisterForm` + RTL de preservação | ✅ Done | Commit `e458923` |
| T2: Restyle `cadastro-assistido/page.tsx` | ✅ Done | Commit `d800496` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: página `cadastro-assistido` compõe `StepIcon`(blue)+`FormHeader`+`FormCard`, sem paleta crua | `StepIcon variant="blue"` com ícone de usuário, `FormHeader` com título/descrição, `FormCard` envolvendo o form; nenhum `text-gray-*` | `src/app/(app)/cadastro-assistido/page.tsx:40-49` (JSX composition), confirmado sem `text-gray-*` via `grep -nE "gray-|blue-"` → 0 hits | ✅ PASS |
| AC2: `AssistedRegisterForm` usa `Label`/`Input`/`Textarea`/`Button` do barrel; `<select>` e caixas com tokens, sem cru | `import { Button, Input, Label, Textarea } from '@/shared/ui'`; `selectClass` espelha classe-token do `Input`; exceção `border-cta`+`color-mix(...--color-cta...)`; sucesso `border-success`+`text-success`; erro `text-danger` | `src/modules/identity/components/assisted-register-form.tsx:5,195-196,264,208-210` — grep de `gray-\|blue-\|amber-\|green-\|red-` → 0 hits | ✅ PASS |
| AC3: comportamento preservado (RHF/Zod, exceção de CPF condicional, `signedOnPaperAt`, chamada a `registerPersonByAssistant`, textos) | Nenhuma mudança de handler/schema; textos "Cadastrar Pessoa"/"Pessoa cadastrada com sucesso"/"Cadastrar outra Pessoa" intactos | `AssistedRegisterForm.test.tsx:33-102` (6 casos pré-existentes, verdes) + diff não toca `register-person-by-assistant.ts`/`register-by-assistant.schema.ts`/`assisted-registration.ts` (confirmado: `git diff 44a3753..HEAD --name-only` não lista esses arquivos) | ✅ PASS |
| AC4: telas restilizadas resolvem cor via tokens (`data-theme`), sem hex cru | Todas as classes usam tokens do DS (`border-border`, `bg-surface`, `text-fg`, `color-mix(...)`) | `assisted-register-form.tsx:208,264,461-462` + `cadastro-assistido/page.tsx:52` (`text-fg-muted`) — nenhum hex/rgba literal encontrado | ✅ PASS |

**Status**: ✅ All ACs covered

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/identity/components/assisted-register-form.tsx:118` (scratch worktree) | Flipped CPF-field guard `{!cpfException && (` → `{true && (` (CPF field always shown, exception no longer hides it) | ✅ Killed — `AssistedRegisterForm.test.tsx` "ao marcar a exceção, esconde o CPF e mostra a justificativa" failed |
| 2 | `src/modules/identity/components/assisted-register-form.tsx` (scratch worktree) | Injected a `Label htmlFor="password"` + `Input id="password" type="password"` field before the submit button (simulates a credential-field regression) | ✅ Killed — `AssistedRegisterForm.test.tsx` "U2-MN-02: não expõe nenhum campo de credencial/login" failed |

**Sensor depth**: lightweight (2 targeted mutations; feature is style-only, not P0/critical-path — CAPTCHA/auth mutations for USP-003 covered separately)
**Result**: 2/2 killed — PASS ✅
**Method**: `git worktree add` at `/private/tmp/.../scratchpad/verify-wt` (real tree never mutated); mutations applied, tests run via `npx vitest run` with `node_modules` symlinked, mutations reverted with `git checkout --`, worktree removed with `git worktree remove --force`.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U2-MN-01 | Restyle enfraquecer a exigência de justificativa obrigatória da exceção de CPF | `AssistedRegisterForm.test.tsx:41-46` — `expect(screen.queryByLabelText(/^CPF/)).not.toBeInTheDocument()` (esconde) + `AssistedRegisterForm.test.tsx:48-56` — `expect(actionState.registerPersonByAssistant).not.toHaveBeenCalled()` (bloqueia submit sem justificativa) | ✅ | ✅ (Mutation 1 above killed the "esconde CPF" half of this guard) |
| U2-MN-02 | Restyle introduzir campo de credencial (e-mail/senha) ou caminho de login no form assistido | `AssistedRegisterForm.test.tsx:104-108` — `expect(screen.queryByLabelText(/senha\|password/i)).not.toBeInTheDocument()` + `expect(screen.queryByLabelText(/e-?mail/i)).not.toBeInTheDocument()` | ✅ | ✅ (Mutation 2 above) |

**Status**: ✅ All must-nots proven

**Preserved-by-non-alteration items** (per spec, out of restyle scope, confirmed untouched in diff): role gate of the route (`SOCIAL_ASSISTANT`/`BOARD` → 404 for others — `src/app/(app)/cadastro-assistido/page.tsx` gate logic lines unchanged, still calls `requireActivePerson`+`canRegisterAssisted`+`notFound()`), public self-registration cannot mark exception (enforced in `registerPersonByAssistant`, file not in diff), `withAudit` + exception audit events (file not in diff), paper-consent evidence (`signedOnPaperAt`, file not in diff). Backend files `register-person-by-assistant.ts`, `register-by-assistant.schema.ts`, `assisted-registration.ts` are **absent from the diff** (verified via `git diff 44a3753..HEAD --name-only`).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ Only markup/classes changed in T1/T2 |
| Surgical changes | ✅ 4 files touched (form, test, page, +CredentialClaim files belong to USP-003) |
| No scope creep | ✅ No handler/schema/action/query/navigation/metadata/cache changes |
| Matches patterns | ✅ Mirrors already-restyled `RegisterPersonForm`/`LoginForm` (danger/success token usage) |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Per-layer Coverage Expectation met | ✅ Client Component has RTL coverage incl. new U2-MN-02; Server Component covered by build gate per repo convention (documented exception in spec Assumptions) |
| Every test maps to a spec requirement | ✅ 7 tests in `AssistedRegisterForm.test.tsx`, all traceable to AC1-4/U2-MN-01/02 |
| Documented guidelines followed | ✅ `CLAUDE.md` §Testing Requirements, `docs/arch/project-guideline.md` DoD, repo convention "no `page.test.tsx`" (documented in spec Assumptions) |

**Module-placement decision check**: `identity` barrel (`src/modules/identity/index.ts`) is **untouched** in the diff (`git diff 44a3753..HEAD -- src/modules/identity/index.ts` → empty); no file moved to `src/modules/persons/`. Confirms the spec's Out-of-Scope decision (keep in `identity`) was honored, not silently reverted.

---

## Edge Cases

- [x] Restyle does not introduce credential fields / login path — U2-MN-02
- [x] CPF-exception marked → CPF hidden, justification shown — existing test, verified green + mutation-killed
- [x] Exception marked without justification → blocks submit, does not call `registerPersonByAssistant` — existing test, green
- [x] `role="alert"`/`role="status"` and button/success texts preserved verbatim — existing tests, green

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build` (Build-level gate, since T2 restyles a Server Component page)
- **Result**: typecheck 0 errors; lint 0 errors/warnings; test 855/855 passed across 117 files (full suite, USP-002 scope: `AssistedRegisterForm.test.tsx` 7/7 passed); build succeeded, `/cadastro-assistido` route compiled (ƒ, 278 B, 174 kB First Load JS)
- **Test count before feature** (`AssistedRegisterForm.test.tsx`, baseline `44a3753`): 6
- **Test count after feature**: 7
- **Delta**: +1 (U2-MN-02, new)
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans (if issues found)

None.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-04/05/06 (upstream) | Verified (entregue) | ✅ Verified — preserved (no backend files touched) |
| U2-STYLE-01 | Pending | ✅ Verified |
| U2-MN-01 | Pending | ✅ Verified |
| U2-MN-02 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 4/4 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 2/2 mutations killed
**Must-nots**: 2/2 green
**Gate**: typecheck/lint/test/build all passed (855/855 tests, 0 failures)

**What works**: Full restyle of form + page to DS primitives/tokens, zero raw-palette classes, all existing behavior (RHF/Zod, CPF exception, no-credential invariant, role gate, audit, paper-consent evidence) preserved and covered by green tests; module stayed in `identity` as decided.

**Issues found**: None.

**Next steps**: None — USP-002 refactor is verified PASS.
