# USP-003 Reivindicar credencial - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline (applies to every task):** change **only markup/classes**. Do not touch handlers,
schemas, actions, queries, navigation, metadata, or cache config. Existing tests MUST stay green (no
weakening/deleting). Preserve: o gate CAPTCHA fail-closed (`if (!captchaToken)`), a mensagem genérica
anti-enumeração, o bloqueio de e-mail em uso, a exigência de verificação antes da ativação, o guard de
concorrência (`updateMany` count===0), `withAudit`, o gate de aprovador da rota interna, e a autz inline
de `verifyCredentialClaim`. shadcn/ui + Tailwind + Radix apenas; imports via barrel `@/shared/ui`; sem nova
lib de estado.

---

**Design**: `.specs/features/identity-acesso-papeis/usp-003-reivindicar-credencial/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`.
> DS `.tsx` ficam fora do gate de cobertura (filosofia do repo, AD-014), mas os Client Components tocados
> têm `.test.tsx` co-localizado (compartilhado) que roda em `npm run test`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`CredentialClaimForm`) | unit (RTL) | Render + CAPTCHA fail-closed (U3-MN-01) + resposta genérica (U3-MN-02); manter os 5 casos de form verdes | `src/modules/identity/__tests__/*.test.tsx` | `npm run test` |
| Client Component (`CredentialClaimReview`) | unit (RTL) | Render + confirmar/remover + falha/manter + vazio (U3-MN-03); manter os 4 casos de review verdes | `src/modules/identity/__tests__/*.test.tsx` | `npm run test` |
| Server Component (páginas pública/interna) | none | Gate de build (padrão do repo para restyle de página); gates preservados | `src/app/(auth)/reivindicar-credencial/**`, `src/app/(app)/credenciais/**` | build gate |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes (por arquivo) | Actions e Turnstile mockados (`vi.mock`); schema Zod real | `CredentialClaimForms.test.tsx:10-33` |

> **Nota:** T1 e T3 editam o **mesmo** arquivo de teste (`CredentialClaimForms.test.tsx`), portanto são
> **sequenciais entre si** (T3 após T1), apesar de os testes RTL serem parallel-safe por arquivo.

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL) apenas | `npm run typecheck && npm run lint && npm run test` |
| Build | Tasks de restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle do form público (Sequential)

```
T1
```

### Phase 2: Página pública + fila interna (Parallel OK)

```
T1 ──→ T2   (página pública: renderiza o form restilizado)
   └──→ T3  (fila interna: mesmo arquivo de teste que T1 -> depois de T1)
```

### Phase 3: Página interna (Sequential)

```
T3 ──→ T4
```

3 fases -> execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `CredentialClaimForm` (público) para o Design System (só estilo)

**What**: Trocar `<label>`/`<input>`/`<button>` crus por `Label`/`Input`/`Button`; restilizar o `<select>`
de meio de verificação, a caixa de sucesso (`success`) e a de erro (`danger`) com tokens; remover
`const inputClass` cru; texto intro `text-fg-muted`. Preservar o CAPTCHA e a mensagem genérica.
**Where**:
- `src/modules/identity/components/credential-claim-form.tsx` (modify - só marcação/classe)
- `src/modules/identity/__tests__/CredentialClaimForms.test.tsx` (manter os 5 casos de form verdes)
**Depends on**: None
**Reuses**: `RegisterPersonForm.tsx` (padrão de restyle), `@/shared/ui`, classe-token do `Input`
**Requirement**: U3-STYLE-01, U3-MN-01, U3-MN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Form usa `Label`/`Input`/`Button` do `@/shared/ui`; nenhuma classe de paleta crua (`bg-blue-600`, `border-gray-300`, `text-gray-*`, `green-*`, `red-*`, `focus:ring-blue-*`).
- [ ] `<select>` de meio restilizado com a classe-token que espelha o `Input`; sucesso com `success`; erro do servidor com `danger`.
- [ ] Comportamento preservado: gate `if (!captchaToken)` (fail-closed), `<input type="hidden">`+`Turnstile`, chamada a `requestCredentialClaim`, render de `role="status"` com a `message` genérica do servidor (sem ramo por existência da Pessoa).
- [ ] Textos preservados verbatim: "Solicitar reivindicação"/"Enviando…"; labels "CPF", "Identificador alternativo", "E-mail desejado", "Meio de verificação preferido".
- [ ] **RTL (U3-MN-01):** "sem CAPTCHA resolvido → não chama a action" permanece verde.
- [ ] **RTL (U3-MN-02):** "submissão válida + CAPTCHA → resposta genérica" permanece verde (status exibe a `message` do servidor).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: os 5 casos do bloco `CredentialClaimForm` verdes (sem deleções silenciosas).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle CredentialClaimForm com Design System (AD-014) - só estilo`

---

### T2: Restyle `reivindicar-credencial/page.tsx` (público) para o Design System (só estilo) [P]

**What**: Envolver a página com `StepIcon` (blue, ícone de chave inline) + `FormHeader` + `FormCard` ao
redor do `CredentialClaimForm`; link "Entrar" com `text-primary`.
**Where**: `src/app/(auth)/reivindicar-credencial/page.tsx` (modify - só marcação/classe)
**Depends on**: T1 (o form restilizado é renderizado dentro do card)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`, `FormCard`); SVG de chave inline (estilo protótipo)
**Requirement**: U3-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Página compõe `StepIcon variant="blue"` + `FormHeader` + `FormCard` ao redor do `CredentialClaimForm`.
- [ ] Preservados sem alteração: `dynamic='force-dynamic'`, `env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`, natureza pública.
- [ ] Sem classes de paleta crua (`text-gray-900`, `text-gray-600`, `text-blue-600`); link "Entrar" com `text-primary hover:underline`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build)
**Gate**: build

**Commit**: `refactor(identity): restyle página de reivindicar credencial com Design System (AD-014)`

---

### T3: Restyle `CredentialClaimReview` (fila interna) para o Design System (só estilo)

**What**: Trocar item `<li>`/`<button>`/`<select>` crus por `Card`/`Button` e classe-token; estado vazio
com `Card`/tokens; remover `const selectClass` cru. Preservar o wiring de confirmação.
**Where**:
- `src/modules/identity/components/credential-claim-review.tsx` (modify - só marcação/classe)
- `src/modules/identity/__tests__/CredentialClaimForms.test.tsx` (manter os 4 casos de review verdes)
**Depends on**: T1 (mesmo arquivo de teste `CredentialClaimForms.test.tsx` - sequencial para evitar conflito)
**Reuses**: `@/shared/ui` (`Card`, `Button`), classe-token do `Input`
**Requirement**: U3-STYLE-01, U3-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Itens da fila e estado vazio usam `Card`/tokens (`border-border`, `bg-surface`, `text-fg`/`text-fg-muted`); nenhuma classe crua (`bg-white`, `border-gray-*`, `bg-blue-600`, `text-gray-*`).
- [ ] `<select>` de meio utilizado restilizado com a classe-token; botão via `Button variant="primary"`; erro `role="alert"` com `text-danger`.
- [ ] Comportamento preservado: `onConfirm` chama `verifyCredentialClaim({ claimId, verificationMethod })` com o meio selecionado; remoção do item em sucesso; manutenção em erro; `role="status"` no estado vazio.
- [ ] Textos preservados verbatim: "Confirmar e ativar"/"Ativando…"; label "Meio de verificação utilizado"; estado vazio "Não há reivindicações de credencial pendentes"/"processada(s)".
- [ ] **RTL (U3-MN-03):** "confirmar → chama a action com o meio selecionado e remove o item" e "action falha → mantém o item e exibe o erro" permanecem verdes.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: os 4 casos do bloco `CredentialClaimReview` verdes (sem deleções silenciosas).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle CredentialClaimReview com Design System (AD-014) - só estilo`

---

### T4: Restyle `credenciais/reivindicacoes/page.tsx` (interna) para o Design System (só estilo)

**What**: Envolver a página com `StepIcon` (orange, ícone de checklist/revisão inline) + `FormHeader` ao
redor do `CredentialClaimReview`; nota com `text-fg-muted`.
**Where**: `src/app/(app)/credenciais/reivindicacoes/page.tsx` (modify - só marcação/classe)
**Depends on**: T3 (a fila restilizada é renderizada na página)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`); SVG de checklist inline (estilo protótipo)
**Requirement**: U3-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Página compõe `StepIcon variant="orange"` + `FormHeader` ao redor do `CredentialClaimReview`.
- [ ] Preservados sem alteração: gate de aprovador (`requireActivePerson` + `canApproveCredentialClaim` → `notFound`), `listPendingCredentialClaims`, `formatSaoPaulo`, `dynamic='force-dynamic'`.
- [ ] Sem classes de paleta crua (`text-gray-900`, `text-gray-600`); nota com `text-fg-muted`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build)
**Gate**: build

**Commit**: `refactor(identity): restyle página de reivindicações de credencial com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (restyle form público + mantém 5 casos verdes)

Phase 2 (Parallel OK):
  T1 complete, then:
    ├── T2 [P]  (página pública - arquivo distinto de T3)
    └── T3      (fila interna - mesmo arquivo de teste que T1 -> após T1)

Phase 3 (Sequential):
  T3 complete, then:
    T4  (página interna - usa a fila)
```

**Parallelism constraint:** T2 e T3 tocam arquivos-fonte distintos e podem ir em qualquer ordem dentro da
Phase 2, MAS T3 edita o mesmo arquivo de teste que T1 (`CredentialClaimForms.test.tsx`), então roda após
T1. T2 (página, sem teste) é `[P]`. T4 depende de T3. Nenhuma task toca banco (sem integração nesta rodada).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: restyle form público | 1 componente (+ manutenção do teste compartilhado) | Granular |
| T2: restyle página pública | 1 arquivo | Granular |
| T3: restyle fila interna | 1 componente (+ manutenção do teste compartilhado) | Granular |
| T4: restyle página interna | 1 arquivo | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | Match |
| T2 | T1 | T1 -> T2 ([P]) | Match |
| T3 | T1 | T1 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component | unit (RTL) | unit | OK |
| T2 | Server Component (página) | none (build) | none | OK |
| T3 | Client Component | unit (RTL) | unit | OK |
| T4 | Server Component (página) | none (build) | none | OK |

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U3-MN-01 (CAPTCHA fail-closed preservado) | T1 | `CredentialClaimForms.test.tsx` - "sem CAPTCHA resolvido → não chama a action" (existente, verde) |
| U3-MN-02 (mensagem genérica anti-enumeração) | T1 | `CredentialClaimForms.test.tsx` - "submissão válida + CAPTCHA → resposta genérica" (existente, verde) |
| U3-MN-03 (wiring de confirmação/remoção preservado) | T3 | `CredentialClaimForms.test.tsx` - "confirmar → chama a action e remove o item" + "action falha → mantém o item" (existentes, verdes) |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate da seção Gate Check Commands. Contagens de teste
explícitas previnem deleções silenciosas. As tasks de restyle (T1-T4) devem manter verdes todos os testes
existentes da USP-003 (regra de refactor: só estilo). Os testes backend de `credential-claim` (unit e
integração) não são tocados e devem seguir verdes na suíte completa.
