# USP-051 — Robustez de Formulários — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-051-robustez-forms/spec.md`
**Diff range**: `0c0bc8b~1..a16a967` (8 commits — note: the orchestrator-supplied
`0c0bc8b..a16a967` is *exclusive* of `0c0bc8b`, which is T1's own commit
`fix(infra): CSP libera unsafe-eval apenas em desenvolvimento (ORQ-2)`; the
range was widened by one commit to include all 8 tasks. Verified via
`git log --oneline 0c0bc8b~1..a16a967` = T1, T2, T4, T5, T6, T7, T8, T3, matching
tasks.md exactly.)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (CSP dev unsafe-eval) | ✅ Done | commit `0c0bc8b` |
| T2 (schema guard) | ✅ Done | commit `03e2f27` |
| T3 (noValidate JobForm) | ✅ Done | commit `a16a967` |
| T4 (LoginForm method=post) | ✅ Done | commit `f77bafd` |
| T5 (demais forms method=post) | ✅ Done | commit `692b419` |
| T6 (next.config bodySizeLimit) | ✅ Done | commit `d70d026` |
| T7 (CvUploadForm guard client) | ✅ Done | commit `1b2bbfb` |
| T8 (trocar-senha texto condicional) | ✅ Done | commit `ad49da4` |

Implementer deviation declared: removal of an unnecessary `eslint-disable` in T7 — cosmetic, no functional impact, confirmed by reading the diff (no `eslint-disable` comment present in `CvUploadForm.tsx`). No `SPEC_DEVIATION` markers found in the diff (`git diff 0c0bc8b~1..a16a967 | grep -i SPEC_DEVIATION` → no matches).

---

## Spec-Anchored Acceptance Criteria

### P1: Forms de credencial sem GET fallback (ORQ-3)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `<form>` do login declara `method="post"` | atributo `method="post"` presente | `src/modules/identity/__tests__/LoginForm.test.tsx:45-49` — `expect(form).toHaveAttribute('method','post')`; live: `curl localhost:3000/login \| grep '<form'` → `method="post"` | ✅ PASS |
| AC2: troca de senha e redefinição também `method="post"` | idem | `ChangePasswordForm.test.tsx:37-40`, `PasswordResetForms.test.tsx:107-110` — `toHaveAttribute('method','post')`; live: `/trocar-senha` and `/redefinir-senha?token_hash=...` → `method="post"` | ✅ PASS |
| AC3: submit pré-hidratação usa POST, nunca GET com query string | garantia estrutural via `method="post"` (jsdom não navega; live curl confirma o atributo renderizado no HTML servido) | mesmos testes acima + live curl (4 rotas) | ✅ PASS |
| AC4: comportamento hidratado inalterado (RHF/Server Action/mensagem única/redirectTo) | `LoginForm.test.tsx` contrato preservado | `src/modules/identity/__tests__/LoginForm.test.tsx` — suíte completa verde (5 testes, 1 novo) | ✅ PASS |
| AC5: `PasswordResetRequestForm` também `method="post"` | idem | `PasswordResetForms.test.tsx:54-57` — `toHaveAttribute('method','post')`; live: `/recuperar-senha` → `method="post"` | ✅ PASS |

### P1: CSP libera `unsafe-eval` só em desenvolvimento (ORQ-2)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `NODE_ENV=development` → `script-src` inclui `'unsafe-eval'` | presença literal | `src/shared/lib/__tests__/securityHeaders.test.ts:58-62` — `expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/)` | ✅ PASS |
| AC2: `NODE_ENV!=='development'` (prod/test) → ausência | ausência literal | `securityHeaders.test.ts:64-67` (production) and `:69-72` (test) — `expect(csp).not.toContain("'unsafe-eval'")` | ✅ PASS |
| AC3: contrato existente preservado (Turnstile, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` Supabase, HSTS condicional) | asserts inalterados | `securityHeaders.test.ts:1-48` (pré-existente) — todos verdes, sem edição de assert | ✅ PASS |

### P1: Validade vazia não derruba o formulário de vaga (EMP-1)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `safeParse` com `validUntil:''` não lança, `success:false`, issue em `validUntil` | exato | `src/modules/jobs/__tests__/publish-job.schema.spec.ts:130-138` — `not.toThrow()`, `expect(parsed.success).toBe(false)`, `expect(issue?.message).toBe('Data de validade é obrigatória.')` | ✅ PASS |
| AC2: clique em "Enviar para moderação" com validade vazia renderiza "Data de validade é obrigatória." inline | mensagem exata | `src/modules/jobs/__tests__/job-form.spec.tsx:191-206` — `await screen.findByText('Data de validade é obrigatória.')`; `expect(actions.submitJobForModeration).not.toHaveBeenCalled()` | ✅ PASS |
| AC3: passado/excede_teto/ok inalterados | contrato preservado | `publish-job.schema.spec.ts` (testes pré-existentes) — verdes, sem alteração de assert | ✅ PASS |

### P3: `noValidate` no `JobForm` (EMP-6)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `<form>` do `JobForm` declara `noValidate` | atributo presente | `job-form.spec.tsx:174-179` — `toHaveAttribute('novalidate','')` | ✅ PASS |
| AC2: erro PT-BR do Zod exibido no submit (não tooltip nativo) | mensagem PT-BR visível | mesmo teste EMP-1 AC2 acima (depende do fix de schema) | ✅ PASS |

### P1: Upload de CV até 5 MB (CAND-5)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `next.config.ts` define `serverActions.bodySizeLimit` com folga ≥5 MB, valor `'6mb'` | valor exato `'6mb'`, ≥`MAX_CV_BYTES` | `src/shared/__tests__/next-config.test.ts:26-37` — `expect(...).toBeGreaterThanOrEqual(MAX_CV_BYTES)`; `expect(...).toBe('6mb')`; live: `grep bodySizeLimit next.config.ts` → `'6mb'` | ✅ PASS |
| AC2: CV > `MAX_CV_BYTES` → mensagem PT-BR, `uploadCv` não chamado | mensagem exata + not.toHaveBeenCalled | `CvUploadForm.test.tsx:148-160` — `toHaveTextContent('O arquivo excede o limite de 5 MB. Envie um currículo menor.')`; `expect(actions.uploadCv).not.toHaveBeenCalled()` | ✅ PASS |
| AC3: CV 1–5 MB → `uploadCv` chamado | dispatch ocorre | `CvUploadForm.test.tsx:162-173` — `expect(actions.uploadCv).toHaveBeenCalledOnce()` | ✅ PASS |

### P3: Texto de "primeiro acesso" condicional (AUTH-7)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `primeiroAcesso===true` → contém "Este é seu primeiro acesso" | texto presente | `src/app/(auth)/trocar-senha/page.test.tsx:20-26` — `getByText(/este é seu primeiro acesso/i)` | ✅ PASS |
| AC2: `primeiroAcesso===false` → NÃO afirma "primeiro acesso" | texto ausente, copy neutra exata | `page.test.tsx:28-35` — `queryByText(/primeiro acesso/i)).not.toBeInTheDocument()`; `getByText('Por segurança, escolha uma nova senha para continuar.')` | ✅ PASS |
| AC3: página não confina (sem sessão inclusive) | sem `redirect`, form renderiza | `page.test.tsx:37-45` (`getCurrentPerson` → `null`) — form stub presente, sem redirect | ✅ PASS |

**Status**: ✅ All ACs covered — 0 spec-precision gaps (todos os critérios têm outcome literal e teste correspondente).

---

## Discrimination Sensor

Sensor tiering: **P0-adjacent** (must-not-bearing feature) — one mutation per must-not's own guard, run in the real tree and reverted via `git checkout --` immediately after each run (verified `git status --short` clean before/after each mutation; no scratch worktree needed since every mutated file is tracked and committed).

| # | Must-Not | File:line | Mutation | Killed? |
| - | -------- | --------- | -------- | ------- |
| 1 | RF-MN-02 | `src/shared/lib/securityHeaders.ts:53` | Removed `if (isDev)` guard — always push `'unsafe-eval'` | ✅ Killed — `securityHeaders.test.ts` prod/test branches failed |
| 2 | RF-MN-03 | `src/modules/jobs/schemas/publish-job.schema.ts:120` | Removed `if (!Number.isNaN(...))` guard — always calls `validadeStatus` | ✅ Killed — `RangeError: Invalid time value` thrown, `not.toThrow()` assertions failed |
| 3 | RF-MN-01 | `src/modules/identity/components/LoginForm.tsx:68` | Removed `method="post"` attribute | ✅ Killed — `toHaveAttribute('method','post')` failed (received `null`) |
| 4 | RF-MN-04 | `src/modules/cv-extraction/components/CvUploadForm.tsx:93` | Short-circuited guard (`if (false && !isWithinCvSizeLimit(...))`) | ✅ Killed — oversized-file test timed out waiting for the PT-BR alert (guard never fired) |
| 5 | RF-MN-05 | `src/app/(auth)/trocar-senha/page.tsx:31` | Forced `description` to always show "primeiro acesso" (`true ? ... : ...`) | ✅ Killed — both `primeiroAcesso:false` and no-session branch tests failed |

**Sensor depth**: 5/5 must-not guards, one targeted mutation each (proportional to a must-not-bearing feature; the spec's risk floor treats every RF-MN as a security/UX-integrity boundary).
**Result**: 5/5 killed — PASS ✅

All mutated files restored via `git checkout --` immediately after each run; `git status --short` and `git diff --stat` confirmed a fully clean tracked tree before writing this report (only pre-existing untracked `.specs/.../usp-051-robustez-forms/` and an unrelated `temp.md` remain untracked, neither touched by this verification).

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| RF-MN-01 | colocar senha/e-mail na query string em qualquer estado de hidratação | `LoginForm.test.tsx:45-49`, `ChangePasswordForm.test.tsx:37-40`, `PasswordResetForms.test.tsx:54-57,107-110` — `toHaveAttribute('method','post')` (×4 forms); live curl confirms `method="post"` rendered on `/login`, `/trocar-senha`, `/redefinir-senha?token_hash=...`, `/recuperar-senha` | ✅ | ✅ (mutation 3) |
| RF-MN-02 | incluir `'unsafe-eval'` em `script-src` fora de dev | `securityHeaders.test.ts:64-72` — `not.toContain("'unsafe-eval'")` for `production`/`test` | ✅ | ✅ (mutation 1) |
| RF-MN-03 | lançar exceção ao processar `validUntil` vazia/inválida | `publish-job.schema.spec.ts:130-149` — `not.toThrow()` ×2 (`''`, `'2020-13-40'`) | ✅ | ✅ (mutation 2) |
| RF-MN-04 | despachar `uploadCv` para CV acima do limite sem mostrar mensagem PT-BR | `CvUploadForm.test.tsx:148-160` — `uploadCv` `not.toHaveBeenCalled()` + PT-BR alert; `next-config.test.ts:31-33` — `bodySizeLimit` ≥ `MAX_CV_BYTES` | ✅ | ✅ (mutation 4; config side confirmed statically — `'6mb'` ≥ 5 MB, no guard to mutate there) |
| RF-MN-05 | exibir "Este é seu primeiro acesso" fora do 1º acesso | `page.test.tsx:28-45` — `queryByText(/primeiro acesso/i)).not.toBeInTheDocument()` (×2 branches: false, no-session) | ✅ | ✅ (mutation 5) |

**Status**: ✅ All must-nots proven — 5/5 green, 5/5 guard-mutations killed.

---

## Live Outcome Checks (build + `npm run start`, port 3000)

| Check | Method | Result |
| --- | --- | --- |
| ORQ-3: `/login` form transport | `curl -s localhost:3000/login \| grep -o '<form[^>]*>'` | `<form noValidate="" class="..." method="post">` |
| ORQ-3: `/trocar-senha` form transport | same | `method="post"` |
| ORQ-3: `/redefinir-senha?token_hash=abc123def456` form transport | same (note: query param is `token_hash`, not `token`) | `method="post"` |
| ORQ-3: `/recuperar-senha` form transport | same | `method="post"` |
| CAND-5: `next.config.ts` config | `grep bodySizeLimit next.config.ts` (post-build) | `bodySizeLimit: '6mb'` present under `experimental.serverActions` |
| EMP-1: `publishJobSchema.safeParse` with empty `validUntil` | ran the actual test file (`publish-job.schema.spec.ts`) — `not.toThrow()` and `success:false` confirmed green | ✅ PASS |

Server started with `npm run start`, confirmed responsive (`curl /login` → 200) before checks, and was torn down afterward (`pkill -f "next start"`; `lsof -i :3000` → free).

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — 8 surgical, single-concern diffs; no new modules/routes/deps |
| Surgical changes | ✅ — each task touches exactly the file(s) named in design.md |
| No scope creep | ✅ — Out of Scope items (nonce CSP, MOD-5, CAND-1/2/3/6, `/trocar-senha` confinement, migrations) untouched |
| Matches patterns | ✅ — `noValidate`/`method="post"` follow the existing auth-form convention; guard-in-`superRefine` follows existing style |
| Spec-anchored outcome check (asserted values match spec) | ✅ — see AC table above, all literal outcomes matched |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error) | ✅ — schema/config/component/page layers each covered per the Test Coverage Matrix in tasks.md |
| Every test maps to a spec requirement — no unclaimed tests | ✅ — every new test carries an RF-NN/RF-MN-NN/achado-ID comment tying it to spec.md |
| Documented guidelines followed | `CLAUDE.md` §Testing Requirements (happy/validation/edge, Vitest unit/integration); repo lesson L-007 (E2E deferred) — both followed |

---

## Edge Cases

- [x] Submit pré-hidratação → POST nativo, sem credencial na URL (RF-MN-01) — verified structurally (`method="post"`) per the design's documented jsdom limitation.
- [x] `validUntil` não vazia mas inválida (`'2020-13-40'`) → erro sem lançar (RF-MN-03) — `publish-job.schema.spec.ts:139-149`.
- [x] `getCurrentPerson()` retorna `null` → copy neutra — `page.test.tsx:37-45`.
- [x] CV com `size === MAX_CV_BYTES` exatamente (5 MB) → aceito (`isWithinCvSizeLimit` inclusive) — confirmed by reading `src/modules/cv-extraction/domain/mime.ts:58` (`<=` comparison, pre-existing, unchanged by this feature).
- [x] `NODE_ENV==='test'` → CSP sem `'unsafe-eval'` — `securityHeaders.test.ts:69-72`.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**: typecheck clean (0 errors), lint clean (0 errors/warnings), test 262 files / 1804 tests passed (0 failed, 0 skipped), build succeeded (all routes compiled, including all 4 credential-form routes and `/trocar-senha`)
- **Test count before feature**: ~1784 (1804 − 20 new `it(` blocks introduced by this diff; no test deletions found: `git diff 0c0bc8b~1..a16a967` shows 0 removed `it(` lines)
- **Test count after feature**: 1804
- **Delta**: +20 new tests, 0 deletions
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| RF-01 | Pending | ✅ Verified |
| RF-02 | Pending | ✅ Verified |
| RF-03 | Pending | ✅ Verified |
| RF-04 | Pending | ✅ Verified |
| RF-05 | Pending | ✅ Verified |
| RF-06 | Pending | ✅ Verified |
| RF-MN-01 | Pending | ✅ Verified |
| RF-MN-02 | Pending | ✅ Verified |
| RF-MN-03 | Pending | ✅ Verified |
| RF-MN-04 | Pending | ✅ Verified |
| RF-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 16/16 ACs matched spec outcome (0 spec-precision gaps)
**Sensor**: 5/5 mutations killed
**Must-nots**: 5/5 green
**Gate**: typecheck + lint + test (1804) + build all passed

**What works**: All 6 UAT findings (ORQ-2, ORQ-3, EMP-1, EMP-6, CAND-5, AUTH-7) fixed exactly as designed, each with a negative test tied to its must-not; existing contracts (`LoginForm.test.tsx`, `securityHeaders.test.ts`, `publish-job.schema.spec.ts`, `job-form.spec.tsx`, `CvUploadForm.test.tsx`, password-reset suites) preserved with 0 deletions; live curl against the built app confirms `method="post"` actually renders on all 4 credential-route forms; `next.config.ts` confirmed carrying `bodySizeLimit:'6mb'` in the built config. Zero migrations, zero new dependencies, zero architecture changes — matches the spec's stated constraint.

**Issues found**: none.

**Next steps**: none — feature ready to merge. (Note for the orchestrator: the diff range it should use going forward for this feature is `0c0bc8b~1..a16a967`, not `0c0bc8b..a16a967`, to include T1's own commit.)
