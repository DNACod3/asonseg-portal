# USP-002 Cadastro de Pessoa pela assistente social - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline (applies to every task):** change **only markup/classes**. Do not touch handlers,
schemas, actions, queries, navigation, metadata, or cache config. Existing tests MUST stay green (no
weakening/deleting). Preserve: RHF/Zod (`registerByAssistantSchema`), a exceção de CPF condicional
(esconde CPF, exige justificativa), a ausência de credencial, `signedOnPaperAt`, o gate de papel da rota
(só `SOCIAL_ASSISTANT`/`BOARD`), `withAudit` + eventos de exceção, e a evidência de consentimento em papel
(ADR-0013). shadcn/ui + Tailwind + Radix apenas; imports via barrel `@/shared/ui`; sem nova lib de estado.

---

**Design**: `.specs/features/identity-acesso-papeis/usp-002-cadastro-as/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`.
> DS `.tsx` ficam fora do gate de cobertura (filosofia do repo, AD-014), mas o Client Component tocado
> tem `.test.tsx` co-localizado que roda em `npm run test`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`AssistedRegisterForm`) | unit (RTL) | Render de campos + exceção condicional (U2-MN-01) + ausência de campo de credencial (U2-MN-02); manter os 6 casos existentes verdes | `src/modules/identity/__tests__/*.test.tsx` | `npm run test` |
| Server Component (página `cadastro-assistido`) | none | Gate de build (padrão do repo para restyle de página); gate de papel preservado | `src/app/(app)/cadastro-assistido/**` | build gate |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; action mockada (`vi.mock`); schema Zod real | `AssistedRegisterForm.test.tsx:11-17` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL) apenas | `npm run typecheck && npm run lint && npm run test` |
| Build | Tasks de restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle do formulário (Sequential)

```
T1
```

### Phase 2: Casca de página (Sequential)

```
T1 ──→ T2
```

2 fases -> execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `AssistedRegisterForm` para o Design System (só estilo) + RTL de preservação

**What**: Trocar `<label>`/`<input>`/`<textarea>`/`<button>` crus por `Label`/`Input`/`Textarea`/`Button`;
restilizar o `<select>` de papel, a caixa de exceção (tokens `cta`), a caixa de sucesso (tokens `success`)
e a caixa de erro do servidor (tokens `danger`) com tokens do DS; remover `const inputClass` cru; estender
o teste RTL com a asserção de ausência de campo de credencial (U2-MN-02).
**Where**:
- `src/modules/identity/components/assisted-register-form.tsx` (modify - só marcação/classe)
- `src/modules/identity/__tests__/AssistedRegisterForm.test.tsx` (modify - manter 6 casos + add U2-MN-02)
**Depends on**: None
**Reuses**: `RegisterPersonForm.tsx` (padrão de restyle), `@/shared/ui`, classe-token do `Input`
**Requirement**: U2-STYLE-01, U2-MN-01, U2-MN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Form usa `Label`/`Input`/`Textarea`/`Button` do `@/shared/ui`; nenhuma classe de paleta crua (`bg-blue-600`, `border-gray-300`, `text-gray-*`, `amber-*`, `green-*`, `red-*`, `focus:ring-blue-*`).
- [ ] `<select>` de papel restilizado com a classe-token que espelha o `Input`; caixa de exceção com `border-cta`/`color-mix(...--color-cta...)`; sucesso com `success`; erro do servidor com `danger`.
- [ ] Comportamento preservado: RHF+Zod (`registerByAssistantSchema`), condicional `cpfException` (esconde CPF, exige justificativa via `CPF_EXCEPTION_MIN_JUSTIFICATION`), `signedOnPaperAt`, chamada a `registerPersonByAssistant`.
- [ ] Textos preservados verbatim: botão "Cadastrar Pessoa", sucesso "Pessoa cadastrada com sucesso", "Cadastrar outra Pessoa"; labels "Nome completo", "CPF", "Justificativa da exceção"; checkbox de exceção com `getByRole('checkbox')`.
- [ ] **RTL (U2-MN-01):** os casos existentes "ao marcar a exceção, esconde o CPF e mostra a justificativa" e "exceção marcada sem justificativa → erro e NÃO chama a action" permanecem verdes.
- [ ] **RTL (U2-MN-02, novo):** `queryByLabelText(/senha|password/i)` é `null` e nenhum input de e-mail/credencial é adicionado ao formulário.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `AssistedRegisterForm.test.tsx` com >=7 casos verdes (6 existentes + >=1 novo U2-MN-02), sem deleções silenciosas.

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle AssistedRegisterForm com Design System (AD-014) - só estilo`

---

### T2: Restyle `cadastro-assistido/page.tsx` para o Design System (só estilo)

**What**: Envolver a página com `StepIcon` (blue, ícone de usuário inline) + `FormHeader` + `FormCard` ao
redor do `AssistedRegisterForm`; nota de rodapé com `text-fg-muted`.
**Where**: `src/app/(app)/cadastro-assistido/page.tsx` (modify - só marcação/classe)
**Depends on**: T1 (o form restilizado é renderizado dentro do card)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`, `FormCard`); SVG de usuário inline (estilo protótipo)
**Requirement**: U2-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Página compõe `StepIcon variant="blue"` + `FormHeader` + `FormCard` ao redor do `AssistedRegisterForm`.
- [ ] Preservados sem alteração: gate de papel (`requireActivePerson` + `canRegisterAssisted` → `notFound`), `dynamic='force-dynamic'`.
- [ ] Sem classes de paleta crua (`text-gray-900`, `text-gray-600`, `text-gray-500`); nota de rodapé com `text-fg-muted`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build, padrão do repo)
**Gate**: build

**Commit**: `refactor(identity): restyle página de cadastro assistido com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (restyle form + RTL de preservação)

Phase 2 (Sequential):
  T1 complete, then:
    T2  (restyle página - usa o form)
```

**Parallelism constraint:** T2 depende de T1 (renderiza o form restilizado dentro do card); não há tasks
paralelas. Nenhuma toca banco (sem testes de integração nesta rodada - o restyle não altera actions).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: restyle form + RTL | 1 componente + seu teste | Granular |
| T2: restyle página | 1 arquivo | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | Match |
| T2 | T1 | T1 -> T2 | Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component | unit (RTL) | unit | OK |
| T2 | Server Component (página) | none (build) | none | OK |

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U2-MN-01 (exceção de CPF condicional preservada) | T1 | `AssistedRegisterForm.test.tsx` - "esconde o CPF e mostra a justificativa" + "exceção marcada sem justificativa → erro e NÃO chama a action" (existentes, verdes) |
| U2-MN-02 (sem campo de credencial/login no form assistido) | T1 | `AssistedRegisterForm.test.tsx` - `queryByLabelText(/senha|password/i)` null (novo) |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate da seção Gate Check Commands. Contagens de teste
explícitas previnem deleções silenciosas. As tasks de restyle (T1/T2) devem manter verdes todos os testes
existentes da USP-002 (regra de refactor: só estilo). Os testes backend de `register-by-assistant` (unit e
integração) não são tocados e devem seguir verdes na suíte completa.
