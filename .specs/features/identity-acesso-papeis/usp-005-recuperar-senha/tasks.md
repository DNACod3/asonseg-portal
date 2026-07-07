# USP-005 Recuperar senha esquecida - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline (applies to EVERY task - esta unidade é 100% só estilo):** change **only
markup/classes**. Do not touch handlers, schemas, actions, navigation, metadata, or cache config.
Existing tests MUST stay green (no weakening/deleting). Preserve: CAPTCHA fail-closed (Turnstile +
`captchaToken`), anti-enumeração (mensagem genérica idêntica), token de uso único (campo oculto), a
validade de 24h e o uso único do link (vivem nas actions **não tocadas**), e o ramo "link inválido" da
página de redefinição.

---

**Design**: `.specs/features/identity-acesso-papeis/usp-005-recuperar-senha/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`.
> DS `.tsx` ficam fora do gate de cobertura (filosofia do repo, AD-014), mas cada Client Component e a
> página com roteamento condicional têm teste co-localizado que roda em `npm run test`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`PasswordResetRequestForm`) | unit (RTL) | Render + CAPTCHA fail-closed (U5-MN-01) + mensagem genérica/anti-enumeração (U5-MN-02) + e-mail inválido | `src/modules/identity/__tests__/PasswordResetForms.test.tsx` | `npm run test` |
| Client Component (`PasswordResetForm`) | unit (RTL) | Render + token trafega (U5-MN-03) + senha fraca não chama a action + token inválido | `src/modules/identity/__tests__/PasswordResetForms.test.tsx` | `npm run test` |
| Server Component (`redefinir-senha/page.tsx`) | unit | Ramo sem token → `role=alert` + link "Solicitar novo link" (U5-MN-03); ramo com token → form | `src/app/(auth)/redefinir-senha/page.test.tsx` | `npm run test` |
| Server Component (`recuperar-senha/page.tsx`) | none | Gate de build (sem roteamento condicional; sem page.test) | `src/app/(auth)/recuperar-senha/**` | build gate |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; deps mockadas (`vi.mock`, Turnstile stub) | `PasswordResetForms.test.tsx:11-33` |
| unit (page render, jsdom) | Yes | Render puro do Server Component com form stubado | `redefinir-senha/page.test.tsx:11-15` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL) apenas | `npm run typecheck && npm run lint && npm run test` |
| Build | Tasks de restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

> Sem gate Full/integração: nenhuma Server Action de banco é tocada por esta unidade (restyle-only).

---

## Execution Plan

### Phase 1: Restyle dos formulários (Parallel OK)

```
     ┌→ T1  (PasswordResetRequestForm) [P]
     └→ T2  (PasswordResetForm) [P]
```

### Phase 2: Restyle das páginas (Parallel OK)

```
T1 ──→ T3  (recuperar-senha/page)
T2 ──→ T4  (redefinir-senha/page)
```

2 fases -> execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `PasswordResetRequestForm` para o Design System (só estilo) [P]

**What**: Trocar `<label>`/`<input>`/`<button>` crus por `Label`/`Input`/`Button`; caixa de erro
danger-token e caixa de confirmação success-token; preservar Turnstile, campo `captchaToken` oculto e a
mensagem genérica. Manter verdes os 3 casos do request-form em `PasswordResetForms.test.tsx`.
**Where**: `src/modules/identity/components/password-reset-request-form.tsx` (modify - só marcação/classe)
**Depends on**: None (toca arquivo distinto de T2)
**Reuses**: `LoginForm.tsx` (padrão de restyle), `@/shared/ui`
**Requirement**: U5-STYLE-01, U5-MN-01, U5-MN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Form usa `Label`/`Input`/`Button variant="primary"`; nenhuma classe de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-300`, `bg-red-50`, `bg-green-50`, `focus:ring-blue-*`).
- [ ] Caixa de erro danger-token; caixa de confirmação success-token (`bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-success`) mantendo `role="status"` e o texto genérico; links `text-primary`, texto auxiliar `text-fg-muted`.
- [ ] **Preserva (U5-MN-01/02):** `<Turnstile>` + `<input type="hidden" {...register('captchaToken')} />`, o gate `if (!captchaToken)`, a exibição de `result.data.message`, o `if (confirmacao)` que oculta o form; label "E-mail"; botão "Enviar link de recuperação".
- [ ] `PasswordResetForms.test.tsx` (bloco `PasswordResetRequestForm`, 3 casos) permanece verde sem alterar assertivas: confirmação genérica + form some (U5-MN-02); "CAPTCHA obrigatório" → não chama a action (U5-MN-01); e-mail inválido → não chama a action.
- [ ] Renderiza em light/dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: bloco `PasswordResetRequestForm` = 3 casos verdes (inalterados).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle PasswordResetRequestForm com Design System (AD-014) - só estilo`

---

### T2: Restyle `PasswordResetForm` para o Design System (só estilo) [P]

**What**: Trocar `<label>`/`<input>`/`<button>` crus por `Label`/`Input`/`Button`; caixa de erro
danger-token; preservar o campo `token` oculto. Manter verdes os 3 casos do reset-form.
**Where**: `src/modules/identity/components/password-reset-form.tsx` (modify - só marcação/classe)
**Depends on**: None (toca arquivo distinto de T1)
**Reuses**: `LoginForm.tsx` (padrão de restyle), `@/shared/ui`
**Requirement**: U5-STYLE-01, U5-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Form usa `Label`/`Input`/`Button variant="primary"`; nenhuma classe de paleta crua; caixa de erro danger-token; erros de campo `<p role="alert" className="text-xs text-danger">`.
- [ ] **Preserva (U5-MN-03):** `<input type="hidden" {...register('token')} />` + `defaultValues: { token }`; RHF+Zod (`resetPasswordSchema`), `resetPassword`, `router.replace` + `refresh`; labels "Nova senha"/"Confirmar nova senha"; botão "Redefinir senha".
- [ ] `PasswordResetForms.test.tsx` (bloco `PasswordResetForm`, 3 casos) permanece verde: "válido → envia token + senha" (token trafega, U5-MN-03); senha fraca → não chama a action; token inválido → mensagem de erro sem redirect.
- [ ] Renderiza em light/dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: bloco `PasswordResetForm` = 3 casos verdes (inalterados).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle PasswordResetForm com Design System (AD-014) - só estilo`

---

### T3: Restyle `recuperar-senha/page.tsx` para o Design System (só estilo)

**What**: Envolver a página com `FormHeader` (+ `StepIcon variant="blue"`) + `FormCard` ao redor do
`PasswordResetRequestForm`; tokens no texto auxiliar.
**Where**: `src/app/(auth)/recuperar-senha/page.tsx` (modify - só marcação/classe)
**Depends on**: T1 (o form restilizado é renderizado dentro do card)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`, `FormCard`); `login/page.tsx` como gabarito
**Requirement**: U5-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Página compõe `FormHeader title="Recuperar senha" description="..."` (+ opcional `StepIcon`) + `FormCard` ao redor do `PasswordResetRequestForm`.
- [ ] Preservados sem alteração: `metadata`, `dynamic='force-dynamic'`, `siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}`.
- [ ] Sem classes de paleta crua; textos via `text-fg`/`text-fg-muted` (ou `FormHeader`).
- [ ] Renderiza em light/dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component sem page.test - gate de build)
**Gate**: build

**Commit**: `refactor(identity): restyle página de recuperar senha com Design System (AD-014)`

---

### T4: Restyle `redefinir-senha/page.tsx` (2 ramos) para o Design System (só estilo)

**What**: Restilizar ambos os ramos: com token → `FormHeader`+`FormCard`+`PasswordResetForm`; sem token
→ `FormHeader`+`FormCard` + alerta danger-token com link "Solicitar novo link". Manter verde o
`redefinir-senha/page.test.tsx`.
**Where**: `src/app/(auth)/redefinir-senha/page.tsx` (modify - só marcação/classe; condição preservada)
**Depends on**: T2 (o form restilizado é renderizado no ramo com token)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`, `FormCard`); `login/page.tsx` como gabarito
**Requirement**: U5-STYLE-01, U5-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `FormHeader title="Definir nova senha" description="..."` (+ opcional `StepIcon`) + `FormCard`; ramo com token → `<PasswordResetForm token={token_hash} />`; ramo sem token → alerta danger-token "Link inválido ou incompleto" (`role="alert"`) + link "Solicitar novo link" (`text-primary`, href `/recuperar-senha`).
- [ ] **Preserva (U5-MN-03):** `await searchParams`, a condição `token_hash ? ... : ...`, `metadata`, `dynamic='force-dynamic'`; exatamente um `role="alert"` no ramo sem token e nenhum no ramo com token.
- [ ] `redefinir-senha/page.test.tsx` (2 casos) permanece verde: sem token → alerta + link "Solicitar novo link"→`/recuperar-senha` sem form; com token → form com o token, sem alerta.
- [ ] Sem classes de paleta crua; renderiza em light/dark.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: unit (page.test existente, mantido verde)
**Gate**: build

**Commit**: `refactor(identity): restyle página de redefinir senha com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]  (restyle request form)
  └── T2 [P]  (restyle reset form)

Phase 2 (Parallel):
  T1 complete → T3  (restyle recuperar-senha page)
  T2 complete → T4  (restyle redefinir-senha page)
```

**Parallelism constraint:** T1 e T2 tocam arquivos distintos e testam blocos distintos do mesmo arquivo
de teste (parallel-safe, jsdom). T3 depende de T1 e T4 depende de T2, mas T3 e T4 são independentes
entre si. Todos os testes são unit/jsdom (parallel-safe).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: restyle request form | 1 componente | Granular |
| T2: restyle reset form | 1 componente | Granular |
| T3: restyle página recuperar | 1 arquivo | Granular |
| T4: restyle página redefinir | 1 arquivo (2 ramos, mesma condição) | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | [P] em Phase 1, sem seta de entrada | Match |
| T2 | None | [P] em Phase 1, sem seta de entrada | Match |
| T3 | T1 | T1 -> T3 | Match |
| T4 | T2 | T2 -> T4 | Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component | unit (RTL) | unit | OK |
| T2 | Client Component | unit (RTL) | unit | OK |
| T3 | Server Component (sem page.test) | none (build) | none | OK |
| T4 | Server Component (com page.test) | unit (build inclui test) | unit | OK |

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U5-MN-01 (CAPTCHA fail-closed) | T1 | `PasswordResetForms.test.tsx` "sem CAPTCHA → NÃO chama a action" (existente, verde) |
| U5-MN-02 (anti-enumeração, msg genérica) | T1 | `PasswordResetForms.test.tsx` "e-mail válido + CAPTCHA → confirmação genérica" + form some (existente, verde) |
| U5-MN-03 (token uso único / sem form sem token) | T2 (token trafega) + T4 (ramo sem token) | `PasswordResetForms.test.tsx` "válido → envia token + senha" + `redefinir-senha/page.test.tsx` "sem token → sem formulário" (existentes, verdes) |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate da seção Gate Check Commands. Contagens de
teste explícitas previnem deleções silenciosas. Toda task é restyle (só estilo) e deve manter verdes
todos os 8 testes existentes da USP-005 (6 em `PasswordResetForms.test.tsx` + 2 em
`redefinir-senha/page.test.tsx`). Nenhuma Server Action, schema ou navegação é tocada; as guardas de
segurança (CAPTCHA fail-closed, anti-enumeração, token de uso único e validade de 24h) são preservadas
pela disciplina de refactor e travadas por esses testes.
