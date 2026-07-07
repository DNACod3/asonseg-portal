# USP-003 Reivindicar credencial de Pessoa pré-cadastrada — Refactor (Fase 1) Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-003-reivindicar-credencial/spec.md`
**Diff range**: `44a3753..HEAD` (commits `8d86def`, `c161406`, `654cdbf`, `28578fc` of the 6-commit Group C range)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1: Restyle `CredentialClaimForm` (público) | ✅ Done | Commit `c161406` |
| T2: Restyle `reivindicar-credencial/page.tsx` (público) | ✅ Done | Commit `8d86def` |
| T3: Restyle `CredentialClaimReview` (fila interna) | ✅ Done | Commit `654cdbf` |
| T4: Restyle `credenciais/reivindicacoes/page.tsx` (interna) | ✅ Done | Commit `28578fc` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: página pública compõe `StepIcon`(blue)+`FormHeader`+`FormCard`; link "Entrar" usa `text-primary` | `StepIcon variant="blue"`, ícone de chave, link sem `text-blue-600` | `src/app/(auth)/reivindicar-credencial/page.tsx:143-159` — `className="font-medium text-primary hover:underline"`; grep `blue-` → 0 hits | ✅ PASS |
| AC2: `CredentialClaimForm` usa `Label`/`Input`/`Button`; `<select>` com tokens; preserva CAPTCHA fail-closed, mensagem genérica, Turnstile hidden input, chamada a `requestCredentialClaim` | Nenhuma mudança de fluxo; classes sem `bg-blue-600`/`border-gray-300`/cru | `credential-claim-form.tsx:7,498-499` (selectClass = Input token class) + `CredentialClaimForms.test.tsx:80-90` ("sem CAPTCHA resolvido → não chama a action", verde) + `:56-78` (resposta genérica, verde) | ✅ PASS |
| AC3: página interna compõe `StepIcon`(orange)+`FormHeader`; `CredentialClaimReview` usa `Card`/tokens (sem `bg-white`/`border-gray-*`/`bg-blue-600`) e `Button` para "Confirmar e ativar" | Composição presente; zero paleta crua | `src/app/(app)/credenciais/reivindicacoes/page.tsx:95-99` (`StepIcon variant="orange"`+`FormHeader`) + `credential-claim-review.tsx:676-681` (empty state via `Card`), `:690` (queue item: `rounded-md border border-border bg-surface p-5 shadow-sm` — Card's exact token classes, kept as `<li>`, see deviation note below) + `:721` (`<Button variant="primary">`) | ✅ PASS |
| AC4: `CredentialClaimReview` preserva `<select>` de meio, `onConfirm`(`verifyCredentialClaim({claimId, verificationMethod})`), remoção em sucesso, manutenção em erro, estado vazio/`role="status"` | Wiring idêntico ao pré-refactor | `CredentialClaimForms.test.tsx:142-160` ("confirmar → chama a action com o meio selecionado e remove o item", verde, mutation-killed abaixo) + `:162-172` ("action falha → mantém o item", verde) + `:174-177` (estado vazio, verde) | ✅ PASS |
| AC5: telas restilizadas resolvem cor via tokens (`data-theme`), sem hex cru | Todas as classes usam tokens | grep `gray-\|blue-\|amber-\|green-\|red-\|bg-white` nos 4 arquivos → 0 hits (ver Code Quality) | ✅ PASS |

**Status**: ✅ All ACs covered

---

## Deviation Review (Implementer self-reported)

**Reported**: `CredentialClaimReview` queue item kept as `<li>` (not the `Card` component, which renders a `<div>` and would nest invalidly inside `<ul>`); Card's exact token classes applied directly (`rounded-md border border-border bg-surface p-5 shadow-sm`). Empty state uses `Card` directly.

**Verification**:
- `credential-claim-review.tsx:690`: `<li key={claim.id} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 shadow-sm">` — confirmed `<li>` retained (not swapped for `Card`'s `<div>`), avoiding an invalid `<div>` child of `<ul>`.
- `src/shared/ui/card.tsx:8-19`: `Card` renders `<div className={cn('rounded-md border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md', className)}>`. The queue item's classes (`rounded-md border border-border bg-surface p-5 shadow-sm`) match Card's border/bg/shadow/radius tokens; only difference is `p-5` (item) vs `p-6` (Card default) and no `hover:shadow-md`/`transition-shadow` — a minor, intentional visual choice for a denser list item, not a token deviation (no raw hex/palette).
- `credential-claim-review.tsx:676`: empty state uses `<Card role="status" className="text-sm text-fg-muted">` directly — `Card` is a `forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>` that spreads `...props`, so `role="status"` passes through correctly.
- DOM shape for RTL: `screen.getByText('Maria Pré-cadastrada')`, `getByRole('button', {name: 'Confirmar e ativar'})`, `getByLabelText(/Meio de verificação utilizado/)` in `CredentialClaimForms.test.tsx:135-172` do not depend on the wrapping tag (`<li>` vs `<div>`) — the tests query by role/label/text, not by element type. No test breakage risk from this choice, and it is HTML-valid where the original wasn't at risk of becoming invalid.

**Verdict**: Deviation is acceptable — matches DS visual intent (same tokens as `Card`), preserves valid `<ul>/<li>` semantics, and does not affect RTL test behavior.

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/identity/components/credential-claim-review.tsx:46` (scratch worktree) | Changed `verificationMethod: methods[id] ?? 'AS_CONFIRMATION'` → hardcoded `verificationMethod: 'AS_CONFIRMATION'` (ignores the selected `<select>` value) | ✅ Killed — `CredentialClaimForms.test.tsx` "confirmar → chama a action com o meio selecionado e remove o item da fila" failed (expected `IN_PERSON`, got `AS_CONFIRMATION`) |

**Sensor depth**: lightweight (1 targeted mutation on the U3-MN-03 confirmation wiring, the highest-risk new-code touchpoint in this style-only refactor for USP-003; CAPTCHA fail-closed and anti-enumeration logic live in files absent from the diff — see Must-Not table — so no mutation was injected there, consistent with "target new code introduced by this feature")
**Result**: 1/1 killed — PASS ✅
**Method**: Same `git worktree add` scratch approach as USP-002 (see USP-002 `validation.md`); mutation reverted with `git checkout --`, worktree removed with `git worktree remove --force`. Real working tree never mutated.

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U3-MN-01 | Restyle enfraquecer o gate anti-bot fail-closed (chamar `requestCredentialClaim` sem CAPTCHA) | `CredentialClaimForms.test.tsx:80-90` — `expect(actionState.requestCredentialClaim).not.toHaveBeenCalled()` after submit without resolving CAPTCHA | ✅ | n/a — guard code (`if (!captchaToken)` in `credential-claim-form.tsx`) is pre-existing logic, unchanged by this diff; not re-mutated since it isn't new code from this refactor (test itself already proves the guard is intact and unweakened post-restyle by staying green) |
| U3-MN-02 | Exibir conteúdo que revele existência da Pessoa; só a mensagem genérica do servidor | `CredentialClaimForms.test.tsx:56-78` — `expect(await screen.findByRole('status')).toHaveTextContent('Recebemos sua solicitação.')` (renders exactly the server's `message`, no existence-conditional branch) | ✅ | n/a — same rationale; the rendering path (`successMessage` from server) is unchanged code, verified green post-restyle |
| U3-MN-03 | Restyle quebrar o wiring de confirmação (`verifyCredentialClaim` com `claimId`+meio, remoção em sucesso, manutenção em erro) | `CredentialClaimForms.test.tsx:142-160` + `:162-172` | ✅ | ✅ (Mutation 1 above) |

**Status**: ✅ All must-nots proven

**Preserved-by-non-alteration items** (per spec, out of restyle scope, confirmed untouched in diff): approver route gate (`SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR` → 404 for others), inline authz in `verifyCredentialClaim` (`getCurrentPerson`+`canApproveCredentialClaim`, confirmed still inline — see Code Quality below), email-in-use block, verification-before-activation requirement, concurrency guard (`updateMany` count===0), `withAudit`. Backend files `request-credential-claim.ts`, `verify-credential-claim.ts`, `credential-claim.schema.ts`, `domain/credential-claim.ts`, `list-pending-credential-claims.ts` are **absent from the diff** (verified via `git diff 44a3753..HEAD --name-only`).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ Only markup/classes changed across T1-T4 |
| Surgical changes | ✅ 4 source files + 1 shared test file touched |
| No scope creep | ✅ No handler/schema/action/query/navigation/metadata/cache changes |
| Matches patterns | ✅ Mirrors already-restyled `RegisterPersonForm`/`LoginForm` danger/success tokens; `Card` reuse consistent with DS foundation |
| Spec-anchored outcome check | ✅ |
| Per-layer Coverage Expectation met | ✅ Both Client Components have RTL coverage; Server Components covered by build gate per repo convention |
| Every test maps to a spec requirement | ✅ 9 tests in `CredentialClaimForms.test.tsx` (5 form + 4 review), all traceable to AC1-5/U3-MN-01/02/03 |
| Documented guidelines followed | ✅ `CLAUDE.md` §Testing Requirements, `docs/arch/project-guideline.md` DoD, repo convention "no `page.test.tsx`" |

**Authz-decision check**: `src/modules/identity/actions/verify-credential-claim.ts` (not in diff) still calls `getCurrentPerson()` (line 67) + `canApproveCredentialClaim(operator.roles)` (line 71) inline — confirmed **not** migrated to `requirePermission`, honoring the spec's Out-of-Scope decision.

---

## Edge Cases

- [x] Submit without resolved CAPTCHA → `requestCredentialClaim` not called — U3-MN-01, green
- [x] Successful public request → same generic server message rendered, no existence branch — U3-MN-02, green
- [x] `role="alert"`/`role="status"` and button/label texts preserved verbatim — existing tests, green
- [x] `CredentialClaimReview` confirm → `verifyCredentialClaim({claimId, verificationMethod})` with selected method, item removed on success — U3-MN-03, green + mutation-killed

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build` (Build-level gate, T2/T4 restyle Server Component pages)
- **Result**: typecheck 0 errors; lint 0 errors/warnings; test 855/855 passed across 117 files (full suite; USP-003 scope: `CredentialClaimForms.test.tsx` 9/9 passed — 5 form + 4 review); build succeeded, `/reivindicar-credencial` and `/credenciais/reivindicacoes` routes compiled (ƒ, 174 kB First Load JS each)
- **Test count before feature** (`CredentialClaimForms.test.tsx`, baseline `44a3753`): 9
- **Test count after feature**: 9
- **Delta**: 0 (no new tests required — all 3 must-nots reuse pre-existing tests per the spec's Must-Not Ownership table)
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans (if issues found)

None.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-07/08 (upstream) | Verified (entregue) | ✅ Verified — preserved (no backend files touched) |
| U3-STYLE-01 | Pending | ✅ Verified |
| U3-MN-01 | Pending | ✅ Verified |
| U3-MN-02 | Pending | ✅ Verified |
| U3-MN-03 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 5/5 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 1/1 mutation killed
**Must-nots**: 3/3 green
**Gate**: typecheck/lint/test/build all passed (855/855 tests, 0 failures)

**What works**: Full restyle of both public and internal flows (form, 2 pages, review queue) to DS primitives/tokens, zero raw-palette classes, CAPTCHA fail-closed / anti-enumeration / confirm-remove wiring / inline authz all preserved and covered by green tests. The reported `<li>`-vs-`Card` deviation is verified sound (valid DOM, matching tokens, no RTL impact).

**Issues found**: None.

**Next steps**: None — USP-003 refactor is verified PASS.
