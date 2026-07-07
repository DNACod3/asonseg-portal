# USP-043 Consentimentos - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline (applies to every task):** change **only markup/classes**. Do not touch handlers,
actions, queries, views, or cache config. Existing tests MUST stay green (no weakening/deleting).
Preserve: revogação com confirmação, separação vigentes/revogados, abertura de termo, escopo por titular
(`personId`), landmarks e nomes acessíveis.

---

**Design**: `.specs/features/consentimentos-lgpd/usp-043-consentimentos/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md`, `vitest.config.ts`. DS `.tsx`
> ficam fora do gate de cobertura (AD-014), mas o Client Component tocado tem `.test.tsx` co-localizado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`ConsentsPanel`) | unit (RTL) | Separação vigentes/revogados + confirmação + disparo `revokeConsent` + abertura de termo (U43-MN-01) | `src/modules/consents/__tests__/*.test.tsx` | `npm run test` |
| Server Component (página `consentimentos`) | none | Gate de build (padrão do repo para restyle de página) | `src/app/(app)/consentimentos/**` | build gate |
| Query de escopo (`listOwnConsents`) | (existente) | Escopo por `personId` já coberto; não alterado por este refactor (U43-MN-02) | `src/modules/consents/__tests__/list-own-consents.test.ts` | `npm run test` |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; deps mockadas (`vi.mock` de `revoke-consent` e `next/navigation`) | `consents-panel.test.tsx:5-9` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL) apenas | `npm run typecheck && npm run lint && npm run test` |
| Build | Tasks de restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle do componente (Sequential)

```
T1
```

### Phase 2: Restyle da página (Sequential)

```
T1 ──→ T2
```

2 fases -> execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `ConsentsPanel` para o Design System (só estilo)

**What**: Trocar cards/badges/botões crus por `Card`(via tokens no `article`)/`Badge`/`Button` e tokens;
preservar semântica, acessibilidade e o fluxo de revogação.
**Where**:
- `src/modules/consents/components/consents-panel.tsx` (modify - só marcação/classe)
- `src/modules/consents/__tests__/consents-panel.test.tsx` (manter verde; adicionar assert de variante de `Badge` opcional)
**Depends on**: None
**Reuses**: `@/shared/ui` (`Badge`, `Button`), padrão danger-token do `LoginForm`
**Requirement**: U43-STYLE-01, U43-MN-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `STATUS_BADGE` mapeia status -> `variant` de `Badge` (`vigente`->green, `desatualizado`->orange, `revogado`->gray); renderiza `<Badge variant={...}>`.
- [ ] Cada card de consentimento usa os tokens de superfície do `Card` no `<article>` preservado (`rounded-md border border-border bg-surface p-6 shadow-sm`); textos em `text-fg`/`text-fg-muted`.
- [ ] Botões usam `Button`: `outline` (Ver termo / Cancelar); Revogar / Sim, revogar em `outline` + token danger (`border-danger text-danger`), sem hex cru.
- [ ] Área do termo em `bg-background`; caixa de confirmação com token danger (padrão `LoginForm`).
- [ ] **Preservado (U43-MN-01):** landmarks `region` ("Consentimentos vigentes"/"revogados"), `role="dialog"` `aria-modal`, nomes acessíveis ("Revogar", "Sim, revogar", "Ver termo aceito", "Cancelar"), "Revogar" só nos vigentes, confirmação antes de `revokeConsent`.
- [ ] `consents-panel.test.tsx` permanece verde (3 casos existentes) - sem renomear botões/regiões.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: >=3 casos verdes em `consents-panel.test.tsx` (sem deleções).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(consents): restyle ConsentsPanel com Design System (AD-014) - só estilo`

---

### T2: Restyle `consentimentos/page.tsx` para o Design System (só estilo)

**What**: Tokens no header e `Card` no estado-vazio; preservar escopo do titular e carregamento de termos.
**Where**: `src/app/(app)/consentimentos/page.tsx` (modify - só marcação/classe)
**Depends on**: T1 (o painel restilizado é renderizado pela página)
**Reuses**: `@/shared/ui` (`Card`), tokens
**Requirement**: U43-STYLE-01, U43-MN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `<header>` usa `text-fg`/`text-fg-muted` (sem `text-gray-*`); estado-vazio usa `<Card>` (sem `bg-white`/`border-gray-200` crus).
- [ ] **Preservado (U43-MN-02):** `requireActivePerson()`, `listOwnConsents(person.id)`, dedup de termos, `dynamic='force-dynamic'` - inalterados.
- [ ] Renderiza em light/dark via tokens.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build, padrão do repo)
**Gate**: build

**Commit**: `refactor(consents): restyle página de consentimentos com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (restyle ConsentsPanel + RTL verde)

Phase 2 (Sequential):
  T1 complete, then:
    T2  (restyle página - renderiza o painel)
```

T1 e T2 tocam a mesma cadeia de render (página -> painel); T2 depende de T1. Sem paralelismo.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: restyle ConsentsPanel | 1 componente + seu teste | Granular |
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
| U43-MN-01 (revogar só vigentes + confirmação) | T1 | `consents-panel.test.tsx` (existente) - mantido verde |
| U43-MN-02 (sem vazamento entre titulares) | T2 | `list-own-consents.test.ts` (existente, escopo `personId`) - mantido verde; página segue usando `requireActivePerson().id` |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate. Restyle é só estilo: todos os testes
existentes da USP-043 permanecem verdes; nomes acessíveis, landmarks e escopo por titular preservados.
</content>
