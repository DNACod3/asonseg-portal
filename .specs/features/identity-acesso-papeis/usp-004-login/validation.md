# USP-004 (Refactor Fase 1) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-004-login/spec.md`
**Diff range**: `8a82624..HEAD` (branch `refactor/fase-1-design-system-e-consistencia`, commits `ce935e0..44a3753`)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1   | Done | `changePasswordFirstAccess` now resolves the actor via `getCurrentPerson()` + credential guard. Commit `ce935e0`. |
| T2   | Done | `ChangePasswordForm` restyled to DS primitives, no behavior change. Commit `00000e5`. |
| T3   | Done | `trocar-senha/page.tsx` restyled with `StepIcon`+`FormHeader`+`FormCard`. Commit `255859c`. |

---

## Spec-Anchored Acceptance Criteria

### P1: Restyle da troca de senha no 1o acesso

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| AC1: página compõe FormHeader(+StepIcon)+FormCard, sem paleta crua | nenhuma classe `bg-blue-*`/`text-gray-*`/`focus:ring-blue-*` | `src/app/(auth)/trocar-senha/page.tsx:24-34` - usa `StepIcon`, `FormHeader`, `FormCard`; `grep -c 'bg-blue-\|text-gray-\|focus:ring-blue-'` = 0 | PASS |
| AC2: ChangePasswordForm usa Label/Input/Button + danger-token, preserva RHF+Zod/ação/redirect/labels | classes trocadas, comportamento idêntico | `src/modules/identity/components/ChangePasswordForm.tsx:53-100` - `Label`/`Input`/`Button` do `@/shared/ui`; erro do servidor em `bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-danger` (linha ~92); `changePasswordFirstAccessSchema`, `changePasswordFirstAccess`, `router.replace(redirectTo)` inalterados (diff não toca essas linhas) | PASS |
| AC3: dark mode via tokens, sem hex cru | nenhum hex literal | Inspeção do diff completo (`git diff 8a82624..HEAD -- 'src/app/(auth)/trocar-senha/page.tsx' 'src/modules/identity/components/ChangePasswordForm.tsx'`) - zero ocorrências de `#[0-9a-fA-F]{3,6}` | PASS |

### P1: Padronizar a resolução de sessão em changePasswordFirstAccess

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| AC1: resolve ator via getCurrentPerson() (não getUser()+findUnique manual) | `supabase.auth.getUser()`/`prisma.person.findUnique` removidos da resolução | `src/modules/identity/actions/changePassword.ts:35` - `const person = await getCurrentPerson();`; nenhuma chamada a `prisma.person.findUnique` ou `supabase.auth.getUser()` no arquivo (grep confirma) | PASS |
| AC2: getCurrentPerson()==null -> UNAUTHENTICATED, zero escrita | `fail('UNAUTHENTICATED', ...)` antes de updateUser/credential.update/audit | `src/modules/identity/actions/changePassword.ts:36-38`; teste `changePassword.test.ts:99-107` - `expect(result.error.code).toBe('UNAUTHENTICATED')`, `expect(supaState.updateUser).not.toHaveBeenCalled()`, `expect(auditState.events).toHaveLength(0)`, `expect(credentialUpdateSpy).not.toHaveBeenCalled()` | PASS |
| AC3: Pessoa ativa sem credencial -> FORBIDDEN | `fail('FORBIDDEN', ...)` via `prisma.credential.findUnique` | `src/modules/identity/actions/changePassword.ts:40-46`; teste `changePassword.test.ts:109-117` - mesmas 3 asserções de zero-escrita | PASS |
| AC4: Pessoa ativa+credencial, senha válida -> updateUser + tx(credential.update+audit) + redirectTo /inicio | transação verbatim | `src/modules/identity/actions/changePassword.ts:48-76`; teste `changePassword.test.ts:80-92` - `expect(result.data.redirectTo).toBe('/inicio')`, `expect(supaState.updateUser).toHaveBeenCalledWith({ password: VALID.senhaNova })`, `expect(auditState.events).toContain('AUTH_PASSWORD_CHANGED_FIRST_ACCESS')`, `expect(credentialUpdateSpy).toHaveBeenCalledWith({ where: { id: 'cred-1' }, data: { primeiroAcesso: false } })` | PASS |

**Status**: All ACs covered, no spec-precision gaps.

---

## Discrimination Sensor

Run in a scratch `git worktree` (`git worktree add ... HEAD --detach`, `node_modules` symlinked from main repo, discarded after). Real working tree never mutated.

| Mutation | file:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/identity/actions/changePassword.ts:44` | `if (!credential)` -> `if (false)` (removes U4-MN-01 credential guard) | Killed - `changePassword.test.ts` "Pessoa ativa sem credencial -> FORBIDDEN" throws (`Cannot read properties of null (reading 'id')`) because the write path proceeds with `credential=null` |
| 2 | `src/modules/identity/actions/changePassword.ts:36` | `if (!person)` -> `if (false)` (removes U4-MN-01 session guard) | Killed - `changePassword.test.ts` "sem Pessoa ativa -> UNAUTHENTICATED" throws (`Cannot read properties of null (reading 'supabaseUserId')`) because the write path proceeds with `person=null` |

**Sensor depth**: P0/critical-path tier (auth) - 2 targeted mutations covering both branches of U4-MN-01's guard; both killed. No third mutation needed since T2's restyle introduces no new branching logic (markup-only, confirmed by diff inspection).
**Result**: 2/2 killed - PASS

---

## Must-Not Verification

| ID | SHALL NOT... | Negative test (file:line + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U4-MN-01 | chamar `updateUser`/baixar `primeiroAcesso`/auditar sem Pessoa ativa ou sem credencial | `src/modules/identity/__tests__/changePassword.test.ts:99-117` - `getCurrentPerson->null` and `credential->null` cases assert `ok=false` + `updateUser`/`credentialUpdateSpy`/`auditState.events` all zero-called | Yes (verified via `npx vitest run changePassword.test.ts`, 9/9 green) | Yes (both mutations above) |
| U4-MN-02 | chamar `changePasswordFirstAccess` com senha fraca/confirmação divergente | `src/modules/identity/__tests__/ChangePasswordForm.test.tsx` - "senha fraca -> erro de validação e NAO chama a action" / "confirmação diferente -> erro de validação e NAO chama a action" (existing, unmodified assertions - diff only touches JSX markup, not the test) | Yes (5/5 green) | Not re-mutated this round - guard lives in `changePasswordFirstAccessSchema` (Zod), a file the diff does not touch at all (confirmed: `git diff` shows zero changes to `src/modules/identity/schemas/changePassword.ts`); the schema's own protection is pre-existing and out of this unit's diff surface |

**Status**: All must-nots proven.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | OK - diff is markup/import swaps + a resolution-seam swap, no extra abstractions |
| Surgical changes | OK - only the 4 files named in tasks.md T1-T3 touched (`changePassword.ts`, `changePassword.test.ts`, `ChangePasswordForm.tsx`, `trocar-senha/page.tsx`) |
| No scope creep | OK - `login.ts`, `LoginForm.tsx`, `login/page.tsx`, `lockout.ts`, `anti-timing.ts`, `signIn.ts` confirmed absent from `git diff 8a82624..HEAD --name-only` |
| Matches patterns | OK - `getCurrentPerson()` usage mirrors `activate-additional-role.ts:67` per spec; restyle mirrors `LoginForm.tsx` pattern |
| Spec-anchored outcome check | OK - see AC table above, exact values checked |
| Per-layer Coverage Expectation met | OK - action has happy+VALIDATION+2 negative+INTERNAL (5 cases); RTL has render+2 negative+happy+error (5 cases); page has none (build gate, matches matrix) |
| Every test maps to a spec requirement | OK - no unclaimed tests found in the two touched test files |
| Documented guidelines followed | `CLAUDE.md` Server Action Pattern (Zod->permission->consent->precondition->withAudit) - N/A permission/consent steps for this action (pre-existing, not the concern of this refactor); `docs/arch/project-guideline.md` DoD followed |

---

## Edge Cases

- [x] Sem sessão/Pessoa inativa -> UNAUTHENTICATED sem tocar provedor/banco: covered (`changePassword.test.ts:99-107`)
- [x] Pessoa ativa sem credencial -> FORBIDDEN sem escrita: covered (`changePassword.test.ts:109-117`)
- [x] Senha fraca/confirmação divergente -> não chama a action: covered (`ChangePasswordForm.test.tsx`)
- [x] Restyle não altera handlers/schema/action/metadata/dynamic/textos: verified by diff inspection (`metadata`, `dynamic='force-dynamic'` lines unchanged in `trocar-senha/page.tsx` diff; labels "Nova senha"/"Confirmar nova senha"/"Salvar nova senha" unchanged in `ChangePasswordForm.tsx` diff)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build` (Build tier, superset of the Quick tier used for T1/T2)
- **Result**: typecheck clean (0 errors); lint clean (0 errors/warnings); test suite 854/854 passed (117 files); build succeeded (`/trocar-senha` route compiled, dynamic `f`)
- **Test count before feature (per spec)**: `changePassword.test.ts` had 4 schema + 3 action cases (7); `ChangePasswordForm.test.tsx` had 5 cases (baseline per tasks.md/spec narrative)
- **Test count after feature**: `changePassword.test.ts` = 9 (4 schema + 5 action, verified via `--reporter=verbose`); `ChangePasswordForm.test.tsx` = 5 (unchanged)
- **Delta**: +2 in `changePassword.test.ts` (the U4-MN-01 negative-test split into 2 explicit cases, as required by tasks.md T1 "Negative test (U4-MN-01) adicionado/atualizado")
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-09/10/11 (upstream) | Verified (entregue) | Verified (preserved, untouched) |
| U4-STYLE-01 | Pending | Verified |
| U4-BACKEND-01 | Pending | Verified |
| U4-MN-01 | Pending | Verified |
| U4-MN-02 | Pending | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 7/7 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 2/2 mutations killed
**Must-nots**: 2/2 green
**Gate**: typecheck/lint/test/build all passed (854 tests, 117 files)

**What works**: Backend seam swap to `getCurrentPerson()` preserves the first-access transaction verbatim; the previously-`FORBIDDEN` "inactive person" branch now collapses into `UNAUTHENTICATED` exactly as the spec's Assumptions table documents, with identical zero-write observable outcome, confirmed by a killed mutant on each guard. Login files (`login.ts`, `LoginForm.tsx`, `login/page.tsx`, `lockout.ts`, `anti-timing.ts`, `signIn.ts`) are absent from the diff. Restyle is markup/class-only; all pre-existing tests pass unmodified in assertion content.

**Issues found**: none

**Next steps**: none - PASS
