# USP-006 Ativar papel adicional - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline (applies to every task):** change **only markup/classes**. Do not touch handlers,
schemas, actions, queries, navigation, metadata, or cache config. The Server Action
`activate-additional-role.ts` and all of `schemas/`, `domain/role-activation.ts`,
`server/build-activatable-options.ts` and `server/session.ts` are **OUT OF SCOPE - do not open them**
(the Verifier confirms diff = 0 there). Preserve: `getCurrentPerson` P-002, server-side SHA-256 recompute
(`loadTerm`, P-004), no moderation of the role (E-003), single `withAudit` tx (P-001), idempotent
re-activation, `missingProfileFields` (only unfilled fields). Existing tests MUST stay green.

---

**Design**: `.specs/features/identity-acesso-papeis/usp-006-ativar-papel/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`,
> AD-014 (DS `.tsx` fora do gate de cobertura). Cada Client Component tocado tem `.test.tsx`
> co-localizado que roda em `npm run test`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`activate-role-form.tsx`) | unit (RTL) | 5 casos existentes verdes: render so dos campos faltantes + termo (E-001/P-004), aceite obrigatorio, **U6-MN-01** (campos vazios/sem aceite -> nao chama a action), sucesso->redireciona, erro->mensagem | `src/modules/identity/__tests__/ActivateRoleForm.test.tsx` | `npm run test` |
| Server Component (`perfil/papeis/page.tsx`) | none | Gate de build (padrao do repo para restyle de pagina sem roteamento condicional) | `src/app/(app)/perfil/papeis/**` | build gate |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; action + router mockados | `ActivateRoleForm.test.tsx:11-22` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL) | `npm run typecheck && npm run lint && npm run test` |
| Build | Tasks de restyle de Server Component (pagina) | `npm run typecheck && npm run lint && npm run test && npm run build` |

> Sem gate Full/integracao: nenhum teste de integracao (Postgres) e tocado por esta unidade (a action e
> seus testes de integracao ficam intocados).

---

## Execution Plan

### Phase 1: Restyle do formulario (Sequential)

```
T1
```

### Phase 2: Casca de pagina (Sequential)

```
T1 --> T2
```

2 fases -> execucao inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `activate-role-form.tsx` para o Design System (so estilo)

**What**: Trocar `<label>`/`<input>`/`<button>` crus por `Label`/`Input`/`Button`; radios/checkbox com
`accent` de token; caixa do termo e realces em superficie/tokens; caixa de erro no padrao danger-token.
Manter verdes os 5 casos do `ActivateRoleForm.test.tsx`.
**Where**: `src/modules/identity/components/activate-role-form.tsx` (modify - so marcacao/classe)
**Depends on**: None
**Reuses**: `LoginForm.tsx` (padrao de restyle), `@/shared/ui` (`Input`/`Label`/`Button`/`FormCard`/`LgpdBox`/`LgpdCheck`)
**Requirement**: U6-STYLE-01, U6-MN-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Campos faltantes usam `Label`/`Input` do `@/shared/ui`; submit usa `Button variant="primary"`; nenhuma classe de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-200`/`300`, `focus:ring-blue-*`, `accent-blue-600`, `bg-gray-50`, `bg-red-50`, `text-red-*`, `has-[:checked]:border-blue-500`, `has-[:checked]:bg-blue-50`).
- [ ] Radios de selecao de papel e checkbox de aceite mantidos como elementos nativos, com `accent-primary` (ou `accent-[var(--color-primary)]`) e realce de selecao em token; opcionalmente o aceite usa `LgpdCheck`.
- [ ] Caixa de erro do servidor no padrao danger-token (`rounded-sm bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm text-danger`); erros de campo mantem `<p role="alert" className="text-xs text-danger">`.
- [ ] Caixa do termo em superficie de token (ou `LgpdBox`), preservando `max-h-72 overflow-auto whitespace-pre-wrap` e o conteudo `option.term.body`.
- [ ] Comportamento preservado: estado (`selectedRole`/`values`/`accepted`/`fieldErrors`/`serverError`), `onSubmit`, validacao dos `missingFields`, gate do aceite (botao desabilitado por `!accepted || isPending`), payload identico a `activateAdditionalRole` (`role`/`termVersion`/`termContentHash`/`acceptTerm`/`profile`), `router.push(nextStep)`+`refresh`; textos de label ("Telefone"/"Endereco completo"), botao ("Ativar papel"/"Ativando...") e mensagem "ja possui todos os papeis publicos" inalterados.
- [ ] **Negative test (U6-MN-01):** `ActivateRoleForm.test.tsx` "campos faltantes nao preenchidos -> NAO chama a action" e "botao desabilitado ate marcar o aceite" continuam verdes sem alteracao das assertivas.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `ActivateRoleForm.test.tsx` = 5 casos verdes (inalterados; sem delecoes silenciosas).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle ActivateRoleForm com Design System (AD-014) - so estilo`

---

### T2: Restyle `perfil/papeis/page.tsx` para o Design System (so estilo)

**What**: Envolver a pagina com `FormHeader` (+ opcional `StepIcon variant="blue"`); trocar textos
`text-gray-*` por tokens; renderizar o `ActivateRoleForm` reestilizado no container.
**Where**: `src/app/(app)/perfil/papeis/page.tsx` (modify - so marcacao/classe)
**Depends on**: T1 (o form reestilizado e renderizado na pagina)
**Reuses**: `@/shared/ui` (`FormHeader`, `StepIcon`); `login/page.tsx` como gabarito de composicao
**Requirement**: U6-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Pagina compoe `FormHeader title="Ativar novo papel" description="..."` (texto explicativo atual preservado) + opcional `StepIcon variant="blue"`; `<main>` mantem o container centralizado com tokens.
- [ ] Preservados **verbatim**: `export const dynamic = 'force-dynamic'`, `await requireActivePerson()`, o snapshot `{ phone: person.phone, fullAddress: person.fullAddress }`, `await buildActivatableOptions(snapshot, activeRoles)`, `<ActivateRoleForm options={options} />` e o comentario de privacidade (P-002).
- [ ] Sem classes de paleta crua (`text-gray-900`, `text-gray-600`); textos via tokens (`text-fg`/`text-fg-muted`) ou `FormHeader`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build, padrao do repo)
**Gate**: build

**Commit**: `refactor(identity): restyle pagina de ativar papel (perfil/papeis) com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (restyle form + testes RTL verdes)

Phase 2 (Sequential):
  T1 complete, then:
    T2  (restyle pagina - usa o form no card)
```

**Parallelism constraint:** T2 depende de T1 (composicao visual: a pagina renderiza o form
reestilizado). Nenhum `[P]` - apenas 2 tasks sequenciais. Todos os testes sao unit/jsdom
(parallel-safe), mas a ordem e dada pela dependencia de composicao.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: restyle form | 1 componente | Granular |
| T2: restyle pagina | 1 arquivo | Granular |

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
| T2 | Server Component (pagina) | none (build) | none | OK |

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U6-MN-01 (guardas client-side nao enfraquecidas) | T1 | `ActivateRoleForm.test.tsx` "campos faltantes nao preenchidos -> NAO chama a action" e "botao desabilitado ate marcar o aceite" (existentes, mantidos verdes) |

---

## Task Verification Standards

Cada `Done when` e binario e referencia o comando de gate da secao Gate Check Commands. Contagens de
teste explicitas previnem delecoes silenciosas. Ambas as tasks sao restyle (so estilo): devem manter
verdes todos os testes existentes da USP-006. A Server Action `activate-additional-role.ts` e a cadeia
server-side **nao sao tocadas** (Verifier confirma diff = 0) - a sequencia canonica e preservada por
nao-modificacao.
