# USP-013 — Adicionar responsável — Refactor (Fase 2) Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill files
by filesystem path. The skill is the source of truth for the per-task cycle (implement → gate → atomic
commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator — do not proceed without it.**

**Refactor discipline (every restyle task):** change **only markup/classes**. Do not touch actions, schemas,
queries, outbox, or route gates on restyle tasks. Existing tests MUST stay green. Preserve: busca binária sem
PII (P-001), grant `PENDING` (P-002), permissão ATIVO (P-005), rate limit (L-002), aceite pela sessão + consent
atômico (P-003). **Coordenação:** T3 restila apenas o shell + área de adição de `responsaveis/page.tsx`; a
seção de responsáveis ativos + `RemoveResponsibleDialog` é da USP-014.

---

**Design**: `.specs/features/vinculos-pessoa-empresa/usp-013-adicionar-responsavel/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found:
> `CLAUDE.md`, `docs/arch/project-guideline.md`, `vitest.config.ts`, `vitest.integration.config.ts`.
> DS `.tsx` fora do gate de cobertura (AD-014/AD-015); cada Client Component tocado tem `.test.tsx` co-localizado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`AddResponsibleForm`) | unit (RTL) | Render + sucesso **neutro sem PII** (U13-MN-01) + chamada a `adicionarResponsavel` | `src/modules/companies/__tests__/*.test.tsx` | `npm run test` |
| Client Component (`PendingResponsibleLinksList`) | unit (RTL) | Render de itens + aceitar chama `aceitarVinculoResponsavel` + remove item; estado vazio | `src/modules/companies/__tests__/*.test.tsx` | `npm run test` |
| Guarda estática de paridade DS | unit | Arquivos da USP-013 sem paleta crua/hex (U13-MN-04) | `src/modules/companies/__tests__/ds-empresa-responsaveis-parity.test.ts` | `npm run test` |
| Server Actions (`adicionarResponsavel`/`aceitar…`) | integration | **Preservadas** — grant `PENDING` (U13-MN-02), FORBIDDEN (U13-MN-03), sem PII (U13-MN-01) | `src/modules/companies/__tests__/*.int.test.ts` | `npm run test:integration` |
| Server Component (páginas) | none | Gate de build | `src/app/(app)/empresa/**` | build gate |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; `vi.mock` | `edit-company-form.test.tsx` |
| unit (guarda estática) | Yes | Lê fonte do disco | `no-external-verify.test.ts` |
| integration (Postgres) | No | Postgres compartilhado + cleanup | `add-responsible.int.test.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks unit (RTL/guarda) | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks que exercitam as Server Actions (preservação) | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle de componentes + guarda (Parallel OK)

```
T1 [P]   (AddResponsibleForm)
T2 [P]   (PendingResponsibleLinksList)
   └─→ T5  (guarda de paridade DS; após T1/T2)
T4 [P]   (verificação das actions preservadas)
```

### Phase 2: Restyle de páginas (Sequential)

```
T1, T2 complete → T3  (páginas responsaveis[shell+adição] + aceitar-vinculo)
```

2 fases → execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `AddResponsibleForm` (só estilo) + RTL [P]

**What**: `Label`/`Input`/`Button` do DS; caixas de sucesso/erro com tokens; textos `text-fg`/`text-fg-muted`.
Criar RTL que trava o sucesso **neutro sem PII** e a chamada a `adicionarResponsavel`.
**Where**: `src/modules/companies/components/add-responsible-form.tsx` (modify) + `__tests__/add-responsible-form.test.tsx` (novo)
**Depends on**: None
**Reuses**: `LoginForm.tsx`, `@/shared/ui`
**Requirement**: U13-STYLE-01, U13-MN-01, U13-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Usa `Label`/`Input`/`Button`; sem `inputClass`/`labelClass`/`errorClass`; sem `bg-blue-*`/`text-gray-*`/`ring-blue-*`.
- [ ] Comportamento preservado: RHF+Zod, `adicionarResponsavel`, `reset`, single-step.
- [ ] **RTL (U13-MN-01):** ao sucesso, a mensagem exibida NÃO contém nome/identidade do alvo (texto neutro); `adicionarResponsavel` é chamado com `{empresaId, cpfOuEmail}`.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: ≥3 casos verdes.

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(companies): restyle AddResponsibleForm com Design System (AD-014) — só estilo`

---

### T2: Restyle `PendingResponsibleLinksList` (só estilo) + RTL [P]

**What**: `Card`/`Button`/tokens; estado vazio tokenizado; erro com `text-danger`. RTL de aceite.
**Where**: `src/modules/companies/components/pending-responsible-links-list.tsx` (modify) + `__tests__/pending-responsible-links-list.test.tsx` (novo)
**Depends on**: None
**Reuses**: `@/shared/ui` (`Card`, `Button`)
**Requirement**: U13-STYLE-01, U13-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Usa `Card`/`Button`/tokens; sem `bg-blue-*`/`text-gray-*`/`bg-white`/`border-gray-*`.
- [ ] Comportamento preservado: `aceitarVinculoResponsavel`, filtro otimista, `doneCount`, estado vazio.
- [ ] **RTL:** com itens, clicar "Aceitar vínculo" chama `aceitarVinculoResponsavel({empresaId})` e remove o item; estado vazio renderiza mensagem.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: ≥3 casos verdes.

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(companies): restyle PendingResponsibleLinksList com Design System (AD-014) — só estilo`

---

### T3: Restyle páginas `responsaveis` (shell + adição) e `aceitar-vinculo` (só estilo)

**What**: `FormHeader` + tokens nas duas páginas. Em `responsaveis`, restilizar só o header/shell e a área do
`AddResponsibleForm` (a seção de ativos + dialog é da USP-014).
**Where**: `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx` (modify — seção USP-013) + `src/app/(app)/empresa/aceitar-vinculo/page.tsx` (modify)
**Depends on**: T1, T2
**Reuses**: `@/shared/ui` (`FormHeader`), padrão de página da Fase 1
**Requirement**: U13-STYLE-01, U13-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Header/shell e área de adição com `FormHeader`/tokens; sem `text-gray-*`/`bg-white`.
- [ ] Preservados: `requireActivePerson`, `notFound()`, `force-dynamic`, queries, composição do `AddResponsibleForm`/`PendingResponsibleLinksList`.
- [ ] Renderiza em light/dark.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component — gate de build) · **Gate**: build
**Commit**: `refactor(companies): restyle páginas de responsáveis/aceite com Design System (AD-014)`

---

### T4: Verificar preservação das actions (must-nots de negócio) [P]

**What**: Confirmar que os testes de integração cobrem: grant nasce `PENDING` (U13-MN-02), não-responsável →
`FORBIDDEN` (U13-MN-03), retorno sem PII (U13-MN-01). Estender se algum faltar. **Sem alterar produção.**
**Where**: `src/modules/companies/__tests__/add-responsible.int.test.ts` + `accept-responsible-link.int.test.ts` (verificar/estender)
**Depends on**: None
**Reuses**: suítes existentes
**Requirement**: U13-MN-01, U13-MN-02, U13-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Caso: grant criado com `status='PENDING'`; `aceitarVinculoResponsavel` o torna `ACTIVE`.
- [ ] Caso: não-responsável ATIVO → `FORBIDDEN`, zero grant.
- [ ] Caso: retorno de `adicionarResponsavel` não contém PII do alvo.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- [ ] Test count: nenhum caso deletado.

**Tests**: integration · **Gate**: full
**Commit**: `test(companies): fixar must-nots de negócio da adição de responsável (PENDING/FORBIDDEN/sem-PII)`

---

### T5: Guarda estática de paridade DS (must-not de estilo)

**What**: Teste estático que lê os arquivos restilizados da USP-013 e falha se contiverem paleta crua/hex.
**Where**: `src/modules/companies/__tests__/ds-empresa-responsaveis-parity.test.ts` (novo)
**Depends on**: T1, T2, T3
**Reuses**: `no-external-verify.test.ts`
**Requirement**: U13-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cobre `add-responsible-form.tsx`, `pending-responsible-links-list.tsx`, `aceitar-vinculo/page.tsx` e a seção USP-013 de `responsaveis/page.tsx`.
- [ ] Falha para `bg-blue-`, `text-gray-`, `border-gray-`, `ring-blue-`, hex `#RRGGBB`.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit · **Gate**: quick
**Commit**: `test(companies): guarda de paridade DS das telas de responsáveis (U13-MN-04)`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]  (AddResponsibleForm + RTL)
  ├── T2 [P]  (PendingResponsibleLinksList + RTL)
  └── T4 [P]  (verificação das actions)

Phase 2 (Sequential):
  T1, T2 complete → T3 (páginas) → T5 (guarda de paridade, após T1/T2/T3)
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 componente + teste | Granular |
| T2 | 1 componente + teste | Granular |
| T3 | 2 páginas (seções coesas de restyle) | Granular (cohesive) |
| T4 | verificação de testes existentes | Granular |
| T5 | 1 arquivo de teste | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | [P] Phase 1 | Match |
| T2 | None | [P] Phase 1 | Match |
| T3 | T1, T2 | T1,T2 → T3 | Match |
| T4 | None | [P] Phase 1 | Match |
| T5 | T1, T2, T3 | T3 → T5 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component | unit (RTL) | unit | OK |
| T2 | Client Component | unit (RTL) | unit | OK |
| T3 | Server Component (páginas) | none (build) | none | OK |
| T4 | Server Action (preservada) | integration | integration | OK |
| T5 | Guarda estática | unit | unit | OK |

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U13-MN-01 (sem PII na busca) | T1 (RTL) + T4 (integração) | `add-responsible.int.test.ts` (sem PII) + RTL sucesso neutro |
| U13-MN-02 (grant PENDING) | T4 | `add-responsible.int.test.ts` — grant `PENDING` |
| U13-MN-03 (só responsável ATIVO adiciona) | T4 | `add-responsible.int.test.ts` — não-responsável → `FORBIDDEN` |
| U13-MN-04 (sem paleta crua) | T1, T2, T3 (+ T5 guarda) | `ds-empresa-responsaveis-parity.test.ts` |

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate. Restyle tasks mantêm verdes todos os testes
existentes da USP-013 (regra de refactor: só estilo).
