# USP-001 Auto-cadastro - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline (applies to every restyle task):** change **only markup/classes**. Do not touch
handlers, schemas, actions, navigation, metadata, or cache config on restyle tasks. Existing tests MUST
stay green (no weakening/deleting). Preserve: CAPTCHA fail-closed, anti-enumeração, o fluxo split
TX1 -> TX2, o aceite afirmativo em página separada, e a invariante ADR-0020.

---

**Design**: `.specs/features/identity-acesso-papeis/usp-001-auto-cadastro/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`,
> `vitest.integration.config.ts`. DS `.tsx` ficam fora do gate de cobertura (filosofia do repo,
> AD-014), mas cada Client Component tocado tem `.test.tsx` co-localizado que roda em `npm run test`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Server Action (`acceptRoleConsent`) | integration | Caminho feliz + validação + **caso negativo da guarda** (U1-MN-01): grant não ativa, zero consent | `src/modules/identity/__tests__/*.int.test.ts` | `npm run test:integration` |
| Client Component (`RegisterPersonForm`) | unit (RTL) | Render de campos + CAPTCHA fail-closed (U1-MN-02) + ausência de checkbox/campos de perfil (U1-MN-03) | `src/modules/identity/__tests__/*.test.tsx` | `npm run test` |
| Zod schema (`acceptRoleConsentSchema`) | unit/integration | Presença de `sig` exercida via o caso negativo de integração | `src/modules/identity/__tests__/*` | `npm run test:integration` |
| Server Component (páginas cadastro/aceite) | none | Gate de build (padrão do repo para restyle de página) | `src/app/(auth)/cadastro/**` | build gate |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; deps mockadas (`vi.mock`) | `consents-panel.test.tsx`, `LoginForm` pattern |
| integration (Postgres) | No | Postgres compartilhado + cleanup `deleteMany` no `afterEach` | `acceptRoleConsent.int.test.ts:64-71` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL) apenas | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks que tocam a Server Action de banco (integração) | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Tasks de restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Guarda de backend (Sequential)

```
T1
```

### Phase 2: Restyle (Parallel OK)

```
T1 ──→ T4  (aceite: passa a usar sig repassado por T1)
        T2  (form) [P]
```

### Phase 3: Casca de página (Sequential)

```
T2 ──→ T3
```

3 fases -> execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Guarda de defesa em profundidade em `acceptRoleConsent` (re-validar HMAC) + repasse de `sig`

**What**: Adicionar `sig` ao `acceptRoleConsentSchema`; verificar o token HMAC dentro da action antes
de qualquer escrita; repassar `sig` a partir da página de aceite; atualizar/estender os testes de
integração.
**Where**:
- `src/modules/identity/schemas/registerPerson.ts` (add `sig` ao `acceptRoleConsentSchema`)
- `src/modules/identity/actions/acceptRoleConsent.ts` (checagem `verifyConsentToken` após parse, antes de `withAudit`)
- `src/app/(auth)/cadastro/consentimento/page.tsx` (closure `acceptConsent`: passar `sig`)
- `src/modules/identity/__tests__/acceptRoleConsent.int.test.ts` (atualizar 5 caminhos-feliz + add negativo)
**Depends on**: None
**Reuses**: `verifyConsentToken`/`signConsentToken` (`src/shared/lib/consentToken.ts`)
**Requirement**: U1-GUARD-01, U1-MN-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `acceptRoleConsentSchema` inclui `sig: z.string().min(1)`.
- [ ] `acceptRoleConsent` retorna `fail('FORBIDDEN', ...)` quando `verifyConsentToken(personId, role, sig)` é falso, **antes** de `withAudit` (nenhuma escrita).
- [ ] Caminho feliz preservado: com `sig` válido, consent + grant ACTIVE + auditoria na mesma tx (invariante ADR-0020).
- [ ] `acceptConsent` (página) repassa o `sig` da URL para a action.
- [ ] Testes existentes atualizados: cada `acceptRoleConsent({...})` de caminho feliz passa `sig` válido = `signConsentToken(personId, role)`.
- [ ] **Negative test (U1-MN-01)** adicionado: `sig` ausente e `sig` de outro par -> `ok=false`, grant permanece `AWAITING_CONSENT`, `prisma.consent` sem linha nova.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- [ ] Test count: suíte `acceptRoleConsent.int` = 5 casos existentes atualizados + >=2 negativos novos, todos verdes (sem deleções silenciosas).

**Tests**: integration
**Gate**: full

**Commit**: `fix(identity): guarda de sessão/token em acceptRoleConsent (TX2) - defesa em profundidade`

---

### T2: Restyle `RegisterPersonForm` para o Design System (só estilo) + RTL de preservação [P]

**What**: Trocar `<label>`/`<input>`/`<button>` crus por `Label`/`Input`/`Button`; restilizar cards de
papel, caixa de erro e rodapé com tokens; criar o teste RTL (novo) que trava CAPTCHA fail-closed e a
ausência de checkbox/campos de perfil.
**Where**:
- `src/modules/identity/components/RegisterPersonForm.tsx` (modify - só marcação/classe)
- `src/modules/identity/__tests__/RegisterPersonForm.test.tsx` (novo)
**Depends on**: None (independe de T1; toca arquivos diferentes)
**Reuses**: `LoginForm.tsx` (padrão de restyle), `@/shared/ui`
**Requirement**: U1-STYLE-01, U1-MN-02, U1-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Form usa `Label`/`Input`/`Button` do `@/shared/ui`; nenhuma classe de paleta crua (`bg-blue-600`, `text-gray-*`, `focus:ring-blue-*`).
- [ ] Comportamento preservado: RHF+Zod (`registerPersonSchema`), Turnstile, gate client de CAPTCHA, `registerPerson`, `onSuccess`, mensagem de erro do servidor.
- [ ] Caixa de erro no padrão danger-token do `LoginForm`; cards de papel com `border-border`/`has-[:checked]:*`/`accent-primary`.
- [ ] **RTL (U1-MN-02):** submit sem token de CAPTCHA -> mock `registerPerson` NÃO chamado; mensagem de CAPTCHA exibida.
- [ ] **RTL (U1-MN-03):** `queryByRole('checkbox')` é `null`; `queryByLabelText(/escolaridade|currículo|telefone|nascimento/i)` é `null`.
- [ ] RTL: labels "Nome completo", "CPF", "E-mail", "Senha" e as 3 opções de papel renderizam; submit com CAPTCHA + dados válidos chama `registerPerson` e dispara `onSuccess`.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `RegisterPersonForm.test.tsx` com >=4 casos verdes.

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle RegisterPersonForm com Design System (AD-014) - só estilo`

---

### T3: Restyle `cadastro/page.tsx` para o Design System (só estilo)

**What**: Envolver a página com `StepIcon` (blue, ícone de usuário) + `FormHeader` + `FormCard`; tokens
no link "Já tem conta? Entrar".
**Where**: `src/app/(auth)/cadastro/page.tsx` (modify - só marcação/classe)
**Depends on**: T2 (o form restilizado é renderizado dentro do card)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`, `FormCard`); SVG de usuário do protótipo (L1228)
**Requirement**: U1-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Página compõe `StepIcon variant="blue"` + `FormHeader` + `FormCard` ao redor do `RegisterPersonForm`.
- [ ] Preservados sem alteração: `handleRegistrationSuccess` (assina `sig` + redirect TX2), `NEXT_STEP_BY_ROLE`, `metadata`, `dynamic='force-dynamic'`.
- [ ] Sem classes de paleta crua; link "Entrar" usa `text-primary`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build, padrão do repo)
**Gate**: build

**Commit**: `refactor(identity): restyle página de cadastro com Design System (AD-014)`

---

### T4: Restyle `cadastro/consentimento/page.tsx` (aceite TX2) para o Design System (só estilo)

**What**: `FormHeader` ("Quase pronto!") + `StepIcon` (green, escudo-check) + `LgpdBox` (termo) +
`Button` (submit afirmativo + "Aceitar depois" via `asChild`), preservando o aceite afirmativo em
página separada.
**Where**: `src/app/(auth)/cadastro/consentimento/page.tsx` (modify - só marcação/classe; o repasse de
`sig` já foi feito em T1)
**Depends on**: T1 (a closure `acceptConsent` já passa `sig`)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`, `LgpdBox`, `Button`); SVG escudo-check do protótipo (L1340)
**Requirement**: U1-STYLE-01, U1-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Termo exibido dentro de `LgpdBox`; submit e "Aceitar depois" usam `Button` (primary / outline `asChild`).
- [ ] **Preserva o split afirmativo (U1-MN-03):** aceite continua sendo o **clique** no botão dentro de `<form action={acceptConsent}>`; nenhum checkbox `defaultChecked`; rota permanece separada da de cadastro.
- [ ] Preservados sem alteração: `verifyConsentToken` (guarda de página), `safeRedirect`, `ROLE_TERM_*`, `dynamic='force-dynamic'`.
- [ ] Sem classes de paleta crua; renderiza em light/dark.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build)
**Gate**: build

**Commit**: `refactor(identity): restyle página de aceite de consentimento (TX2) com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (guarda + repasse de sig + testes de integração)

Phase 2 (Parallel):
  T1 complete, then:
    ├── T2 [P]  (restyle form - independe de T1)
    └── T4      (restyle aceite - depende de T1)

Phase 3 (Sequential):
  T2 complete, then:
    T3  (restyle página de cadastro - usa o form)
```

**Parallelism constraint:** T2 (unit, parallel-safe) e T4 (sem testes) tocam arquivos distintos e podem
ir em qualquer ordem dentro da Phase 2. T1 é sequencial (integração não é parallel-safe e é pré-req de T4).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: guarda + schema + caller + testes | 1 deliverable coeso (a guarda; arquivos acoplados pelo novo campo `sig`) | Granular |
| T2: restyle form + RTL | 1 componente + seu teste | Granular |
| T3: restyle página cadastro | 1 arquivo | Granular |
| T4: restyle página aceite | 1 arquivo | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | Match |
| T2 | None | [P] em Phase 2, sem seta de entrada | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T1 | T1 -> T4 | Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Server Action + schema | integration | integration | OK |
| T2 | Client Component | unit (RTL) | unit | OK |
| T3 | Server Component (página) | none (build) | none | OK |
| T4 | Server Component (página) | none (build) | none | OK |

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U1-MN-01 (guarda TX2) | T1 | `acceptRoleConsent.int.test.ts` caso `sig` inválido/ausente (grant não ativa, zero consent) |
| U1-MN-02 (CAPTCHA fail-closed) | T2 | `RegisterPersonForm.test.tsx` submit sem CAPTCHA -> `registerPerson` não chamado |
| U1-MN-03 (sem checkbox/campos de perfil no cadastro) | T2 (cadastro) + T4 (aceite preserva split) | `RegisterPersonForm.test.tsx` `queryByRole('checkbox')`/`queryByLabelText` null |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate da seção Gate Check Commands. Contagens de
teste explícitas previnem deleções silenciosas. Restyle tasks (T2/T3/T4) devem manter verdes todos os
testes existentes da USP-001 (regra de refactor: só estilo).
</content>
