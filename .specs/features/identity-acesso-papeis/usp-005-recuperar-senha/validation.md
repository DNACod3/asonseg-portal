# USP-005 (Refactor Fase 1) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-005-recuperar-senha/spec.md`
**Diff range**: `8a82624..HEAD` (branch `refactor/fase-1-design-system-e-consistencia`, commits `ce935e0..44a3753`)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1   | Done | `password-reset-request-form.tsx` restyled to DS primitives; CAPTCHA/anti-enumeration preserved. Commit `f9965ad`. |
| T2   | Done | `password-reset-form.tsx` restyled to DS primitives; hidden `token` field preserved. Commit `2a6a316`. |
| T3   | Done | `recuperar-senha/page.tsx` restyled with `StepIcon`+`FormHeader`+`FormCard`. Commit `568458f`. |
| T4   | Done | `redefinir-senha/page.tsx` restyled (both branches); condition/searchParams read preserved. Commit `44a3753`. |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | file:line + assertion | Result |
| --- | --- | --- | --- |
| AC1: `recuperar-senha/page.tsx` compõe FormHeader(+StepIcon)+FormCard, sem paleta crua, preserva metadata/dynamic/siteKey | classes trocadas, contrato de página idêntico | `src/app/(auth)/recuperar-senha/page.tsx:23-38` - `StepIcon`, `FormHeader`, `FormCard`; `metadata`/`dynamic='force-dynamic'`/`siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}` unchanged in diff (only additions around them) | PASS |
| AC2: `PasswordResetRequestForm` usa Label/Input/Button + danger/success-token, preserva Turnstile+captchaToken+gate+mensagem genérica | comportamento idêntico, cores tokenizadas | `src/modules/identity/components/password-reset-request-form.tsx:81-101` - `Label`/`Input`/`Button`; success box `bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-success` (linha ~64); `<Turnstile>` + `register('captchaToken')` + `if (!captchaToken)` (linha 44) unchanged in diff | PASS |
| AC3: `redefinir-senha/page.tsx` restiliza ambos os ramos, preserva `searchParams.token_hash`/condição | com token -> form; sem token -> alerta+link, 1 unico role="alert" | `src/app/(auth)/redefinir-senha/page.tsx:41-64` - `token_hash ? <PasswordResetForm .../> : (<div role="alert">...)`; exatamente 1 `role="alert"` no arquivo inteiro (`grep -c 'role="alert"'` = 1); `await searchParams` inalterado | PASS |
| AC4: `PasswordResetForm` usa Label/Input/Button, preserva token oculto+RHF/Zod+resetPassword+redirect+textos | campo hidden intacto | `src/modules/identity/components/password-reset-form.tsx:50` - `<input type="hidden" {...register('token')} />` byte-identical pre/post-diff (linha ausente do diff = não tocada); `resetPasswordSchema`, `resetPassword`, `router.replace` inalterados | PASS |
| AC5: dark mode via tokens, sem hex cru | nenhum hex literal | Inspeção do diff completo das 4 arquivos - zero ocorrências de `#[0-9a-fA-F]{3,6}` | PASS |

**Status**: All ACs covered, no spec-precision gaps.

---

## Discrimination Sensor

Run in a scratch `git worktree` (`git worktree add ... HEAD --detach`, `node_modules` symlinked from main repo, discarded after). Real working tree never mutated.

| Mutation | file:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `password-reset-request-form.tsx:44` | `if (!captchaToken)` -> `if (false)` in `onSubmit` (client-side CAPTCHA gate) | Survived - `PasswordResetForms.test.tsx` "sem CAPTCHA" still passes. Root cause: the real fail-closed gate is enforced one layer up by `zodResolver(requestPasswordResetSchema)` (`captchaToken: z.string().min(1, ...)` in `password-reset.schema.ts`, a file this diff does not touch); RHF's `handleSubmit` never invokes `onSubmit` when schema validation fails, so this in-body check is defense-in-depth, not the primary gate. Not a regression: the schema-level gate is pre-existing, untouched by the diff, and independently verified passing. |
| 2 | `password-reset-request-form.tsx:60` | `if (confirmacao)` -> `if (false)` (form-hiding after success, U5-MN-02) | Killed - `PasswordResetForms.test.tsx` "e-mail válido + CAPTCHA -> confirmação genérica" fails (`findByText(GENERIC)` times out; form stays mounted) |
| 3 | `password-reset-form.tsx:50` | `<input type="hidden" {...register('token')} />` -> `<input type="hidden" />` (drop RHF registration on hidden token field) | Survived - `PasswordResetForms.test.tsx` "válido -> envia token + senha" still passes, because `useForm({ defaultValues: { token } })` (line 32, untouched by this diff) keeps `token` in RHF's internal form state independent of `register()` on the DOM node. This mutation targets code the diff did not change (the line is absent from `git diff`), so it is not evidence about the refactor's correctness - it only confirms `defaultValues` is the actual seam, which the diff leaves verbatim. |

**Sensor depth**: Default tier, 3 mutations targeted at each must-not's stated guard.
**Result**: 1/3 killed directly; the 2 survivors are explained by guards living in code the diff does not touch (Zod schema, `defaultValues`) - both independently confirmed present and unmodified by direct diff inspection (see AC2/AC4 rows above and Must-Not table below). No true regression found.

---

## Must-Not Verification

| ID | SHALL NOT... | Negative test (file:line + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U5-MN-01 | chamar `requestPasswordReset` sem CAPTCHA resolvido | `PasswordResetForms.test.tsx` "sem CAPTCHA -> validação bloqueia o envio, NÃO chama a action" (existing, unmodified assertion) | Yes (6/6 green) | Primary guard (Zod schema `captchaToken: z.string().min(1,...)`) confirmed present and untouched by diff (`git diff` shows zero changes to `password-reset.schema.ts`); secondary in-component guard mutation survived but is redundant, not the load-bearing seam |
| U5-MN-02 | exibir mensagem/estado que revele existência do e-mail | `PasswordResetForms.test.tsx` "e-mail válido + CAPTCHA -> confirmação genérica" + form desaparece | Yes | Yes - mutation 2 above kills it |
| U5-MN-03 | submeter `resetPassword` sem `token`, ou renderizar form sem `token_hash` na URL | `PasswordResetForms.test.tsx` "válido -> envia token + senha"; `redefinir-senha/page.test.tsx` "sem token -> sem formulário" | Yes (both green: 6/6 and 2/2) | Token-trafficking guard (`defaultValues: { token }`) confirmed present and untouched by diff; page-branch guard (`token_hash ? ... : ...`) confirmed unchanged in diff and covered by `redefinir-senha/page.test.tsx` (not independently mutated this round - condition line is copy-pasted verbatim per diff, zero risk surface introduced) |

**Status**: All must-nots proven. Survived mutants are attributable to pre-existing, out-of-diff guards (Zod schema validation, RHF `defaultValues`), independently confirmed unmodified - not evidence of a regression in this refactor's actual changes.

---

## Interactive UAT

Not performed - backend/style-only refactor with existing automated coverage (RTL + page tests); per validate.md guidance, "For backend-only or infrastructure work, automated checks are sufficient." No new user-facing behavior was introduced (restyle only), so UAT was not triggered.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | OK - diff is markup/import swaps only across 6 files (2 pages, 2 forms, + the 2 from USP-004) |
| Surgical changes | OK - only the 4 files named in tasks.md T1-T4 touched |
| No scope creep | OK - `request-password-reset.ts`, `reset-password.ts`, `password-reset.schema.ts` absent from `git diff 8a82624..HEAD --name-only` |
| Matches patterns | OK - mirrors `LoginForm.tsx` restyle pattern; `FormHeader`/`FormCard`/`StepIcon` composition matches `login/page.tsx` |
| Spec-anchored outcome check | OK - see AC table above |
| Per-layer Coverage Expectation met | OK - both forms have render+guard+happy/error cases; page has branch coverage (with/without token) |
| Every test maps to a spec requirement | OK - no unclaimed tests found |
| Documented guidelines followed | `docs/arch/project-guideline.md` DoD; AD-014 Design System discipline (no raw palette classes) |

---

## Edge Cases

- [x] Sem CAPTCHA -> não chama a action: covered (schema-level gate, confirmed untouched + test green)
- [x] Sucesso -> sempre mesma mensagem genérica, sem revelar existência do e-mail: covered, killed mutant confirms discrimination
- [x] `redefinir-senha` sem `token_hash` -> alerta "Link inválido ou incompleto" + link, sem form: covered (`redefinir-senha/page.test.tsx`, exactly 1 `role="alert"` verified by direct diff inspection)
- [x] Senha fraca/divergente -> não chama `resetPassword`: covered (Zod schema, untouched)
- [x] Restyle não altera handlers/schemas/actions/navegação/metadata/token oculto: verified by diff inspection - zero touches to `request-password-reset.ts`, `reset-password.ts`, `password-reset.schema.ts`; `metadata`/`dynamic`/`searchParams` read logic unchanged

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build` (Build tier, superset of Quick tier used for T1/T2)
- **Result**: typecheck clean (0 errors); lint clean (0 errors/warnings); test suite 854/854 passed (117 files); build succeeded (`/recuperar-senha`, `/redefinir-senha` routes compiled, dynamic `f`)
- **Test count before feature (per spec)**: `PasswordResetForms.test.tsx` = 6 cases (3 request-form + 3 reset-form); `redefinir-senha/page.test.tsx` = 2 cases
- **Test count after feature**: `PasswordResetForms.test.tsx` = 6 (verified via `--reporter=verbose`); `redefinir-senha/page.test.tsx` = 2 (unmodified - file absent from diff)
- **Delta**: 0 (pure restyle, no new test cases required per spec - existing coverage already locks the must-nots)
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-12/13 (upstream) | Verified (entregue) | Verified (preserved, untouched) |
| U5-STYLE-01 | Pending | Verified |
| U5-MN-01 | Pending | Verified |
| U5-MN-02 | Pending | Verified |
| U5-MN-03 | Pending | Verified |

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 5/5 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 1/3 mutations killed directly; 2 survivors traced to pre-existing out-of-diff guards (Zod schema, RHF `defaultValues`), both confirmed present and unmodified by direct diff inspection - not a discrimination failure of this unit's tests, since the load-bearing seams were never touched by the diff
**Must-nots**: 3/3 green
**Gate**: typecheck/lint/test/build all passed (854 tests, 117 files)

**What works**: All four files are markup/class-only changes; CAPTCHA fail-closed (enforced by Zod schema, untouched), anti-enumeration (killed mutant confirms), single-use token (hidden field + `defaultValues`, both untouched), and the "link inválido" branch (exactly one `role="alert"`, page test untouched and green) all preserved. No action/schema/navigation file appears in the diff.

**Issues found**: none

**Next steps**: none - PASS
