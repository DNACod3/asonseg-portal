# USP-012 — Cadastro de Empresa — Refactor (Fase 2) Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill files
by filesystem path. The skill is the source of truth for the per-task cycle (implement → gate → atomic
commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator — do not proceed without it.**

**Refactor discipline (every restyle task):** change **only markup/classes**. Do not touch the action,
schema, `domain/cnpj.ts`, audit, or the consent/hash flow on restyle tasks. Existing tests MUST stay green
(no weakening/deleting). Preserve: `createCompany` sequence, `isVerified=false`, term hash validation, CNPJ
uniqueness, atomic consent (ADR-0020). The one behavior-adjacent change is the success redirect target (D1).

---

**Design**: `.specs/features/cadastros-publicos/usp-012-cadastro-empresa/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`,
> `vitest.integration.config.ts`. DS `.tsx` ficam fora do gate de cobertura (filosofia do repo, AD-014/AD-015),
> mas cada Client Component tocado tem `.test.tsx` co-localizado que roda em `npm run test`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`CreateCompanyForm`) | unit (RTL) | Render de campos + gate afirmativo do consentimento (U12-MN-04 paridade + preservação) + ausência de paleta crua | `src/modules/companies/__tests__/*.test.tsx` | `npm run test` |
| Guarda estática de paridade DS | unit | Arquivos restilizados sem `bg-blue-*`/`text-gray-*`/`border-gray-*`/`ring-blue-*`/hex (U12-MN-04) | `src/modules/companies/__tests__/ds-empresa-cadastro-parity.test.ts` | `npm run test` |
| Server Action (`createCompany`) | integration | **Preservada** — `isVerified=false` (U12-MN-01), hash divergente → sem consent (U12-MN-02), CNPJ duplicado → CONFLICT (U12-MN-03) | `src/modules/companies/__tests__/create-company.int.test.ts` | `npm run test:integration` |
| Server Component (`empresa/cadastrar/page.tsx`) | none | Gate de build (padrão do repo para restyle/wiring de página) | `src/app/(app)/empresa/cadastrar/**` | build gate |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; deps mockadas (`vi.mock`) | `edit-company-form.test.tsx`, `remove-responsible-dialog.test.tsx` |
| unit (guarda estática, leitura de arquivo) | Yes | Lê fonte do disco; sem estado compartilhado | `no-external-verify.test.ts` (molde de guarda estática) |
| integration (Postgres) | No | Postgres compartilhado + cleanup `deleteMany` | `create-company.int.test.ts` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL/guarda) apenas | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks que exercitam a Server Action de banco (integração preservada) | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Tasks de wiring/restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle do form + guarda (Sequential)

```
T1 → T2
```

### Phase 2: Wiring da rota + verificação de preservação (Sequential)

```
T2 → T4
T3  (verificação da action preservada) [P]
```

2 fases → execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `CreateCompanyForm` para o Design System (só estilo) + RTL

**What**: Trocar `inputClass`/`labelClass`/`errorClass` e a marcação crua por `Label`/`Input`/`Textarea`/`Button`;
termo dentro de `LgpdBox` (corpo rolável + checkbox afirmativo `accent-primary`); caixas de erro/sucesso com
tokens danger. Ajustar o alvo do redirect de sucesso para `/empresa/${companyId}/responsaveis` (D1). Criar o
RTL que trava o gate afirmativo do consentimento e a ausência de paleta crua.
**Where**:
- `src/modules/companies/components/create-company-form.tsx` (modify — markup/classe + 1 linha de redirect)
- `src/modules/companies/__tests__/create-company-form.test.tsx` (novo)
**Depends on**: None
**Reuses**: `LoginForm.tsx`/`RegisterPersonForm.tsx` (padrão de restyle), `@/shared/ui`
**Requirement**: U12-STYLE-01, U12-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Form usa `Label`/`Input`/`Textarea`/`Button` do `@/shared/ui`; sem `inputClass`/`labelClass`/`errorClass`; sem `bg-blue-*`/`text-gray-*`/`border-gray-*`/`focus:ring-blue-*`.
- [ ] Termo dentro de `LgpdBox`; checkbox afirmativo preservado com `accent-primary`; corpo do termo continua rolável.
- [ ] Comportamento preservado: RHF+Zod (`createCompanySchema`), campos ocultos version/hash, gate `disabled={isPending || !consentChecked}`, `createCompany`.
- [ ] Redirect de sucesso aponta para `/empresa/${result.data.companyId}/responsaveis`.
- [ ] **RTL:** submeter sem marcar o consentimento → mock `createCompany` NÃO é chamado; marcar + dados válidos → `createCompany` chamado uma vez.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `create-company-form.test.tsx` com ≥4 casos verdes.

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(companies): restyle CreateCompanyForm com Design System (AD-014) — só estilo`

---

### T2: Guarda estática de paridade DS (must-not de estilo)

**What**: Teste estático que lê os arquivos restilizados da USP-012 e falha se contiverem paleta crua/hex.
**Where**: `src/modules/companies/__tests__/ds-empresa-cadastro-parity.test.ts` (novo)
**Depends on**: T1
**Reuses**: `no-external-verify.test.ts` (molde de guarda estática que lê fonte do disco)
**Requirement**: U12-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] O teste cobre `create-company-form.tsx` e `empresa/cadastrar/page.tsx` (após T4; até lá cobre o form).
- [ ] Falha se encontrar `bg-blue-`, `text-gray-`, `border-gray-`, `ring-blue-`, ou hex `#RRGGBB` em superfície temática.
- [ ] Verde após T1/T4.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit
**Gate**: quick
**Commit**: `test(companies): guarda de paridade DS do cadastro de Empresa (U12-MN-04)`

---

### T3: Verificar preservação da action `createCompany` (must-nots de negócio) [P]

**What**: Confirmar que os testes de integração existentes cobrem `isVerified=false` (U12-MN-01), hash divergente
sem consent (U12-MN-02) e CNPJ duplicado → CONFLICT (U12-MN-03); adicionar o(s) caso(s) faltante(s) se algum não
existir. **Nenhuma alteração de código de produção.**
**Where**: `src/modules/companies/__tests__/create-company.int.test.ts` (verificar/estender)
**Depends on**: None
**Reuses**: casos existentes da suíte `create-company.int`
**Requirement**: U12-MN-01, U12-MN-02, U12-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Existe caso que assere `isVerified=false` após criação (U12-MN-01).
- [ ] Existe caso hash divergente → `VALIDATION` e zero `Consent` gravado (U12-MN-02).
- [ ] Existe caso CNPJ duplicado → `CONFLICT` sem 2ª Empresa (U12-MN-03).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- [ ] Test count: nenhum caso existente deletado; deltas (se houver) adicionados.

**Tests**: integration
**Gate**: full
**Commit**: `test(companies): fixar must-nots de negócio do cadastro de Empresa (isVerified/hash/CNPJ)`

---

### T4: Materializar a rota `(app)/empresa/cadastrar` + `StepIcon`/`FormHeader`/`FormCard`

**What**: Server Component `force-dynamic` que exige sessão (`requireActivePerson`), carrega o termo
`COMPANY_REPRESENTATION` server-side (`loadTerm`) e renderiza `CreateCompanyForm` envolto em `StepIcon` +
`FormHeader` + `FormCard`.
**Where**: `src/app/(app)/empresa/cadastrar/page.tsx` (novo)
**Depends on**: T1
**Reuses**: `(app)/empresa/[empresaId]/responsaveis/page.tsx` (gate), `(auth)/cadastro/consentimento/page.tsx` (`loadTerm`), `@/shared/ui`
**Requirement**: U12-WIRE-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `/empresa/cadastrar` renderiza o form com o termo carregado; sem sessão → redireciona a login.
- [ ] Página compõe `StepIcon` + `FormHeader` + `FormCard`; sem paleta crua (coberto por T2 estendido).
- [ ] `dynamic = 'force-dynamic'`; sem cache.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component — gate de build)
**Gate**: build
**Commit**: `feat(companies): rota /empresa/cadastrar renderiza o formulário (USP-012 wiring)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (restyle form + RTL)
   └─→ T2  (guarda de paridade DS)

Phase 2 (Sequential):
  T2 complete, then:
    T4  (rota de cadastro; T2 é estendida para cobrir a página)
  T3 [P]  (verificação da action preservada — independe de T1/T2/T4)
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: restyle form + RTL | 1 componente + seu teste | Granular |
| T2: guarda estática | 1 arquivo de teste | Granular |
| T3: fixar must-nots de negócio | 1 arquivo de teste (verificar/estender) | Granular |
| T4: rota de cadastro | 1 arquivo de página | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | None | [P], sem seta de entrada | Match |
| T4 | T1 | (via T2) T1 → … → T4; T4 usa o form de T1 | Match |

> Nota: T4 depende de T1 (o form restilizado). T2 é estendida para cobrir a página criada em T4 — por isso o
> ciclo lógico T2↔T4; a ordem de execução resolve T4 após T2, e T2 é re-rodada no gate de T4.

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component | unit (RTL) | unit | OK |
| T2 | Guarda estática | unit | unit | OK |
| T3 | Server Action (preservada) | integration | integration | OK |
| T4 | Server Component (página) | none (build) | none | OK |

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U12-MN-01 (isVerified=false) | T3 | `create-company.int.test.ts` — Empresa criada `isVerified=false` |
| U12-MN-02 (hash → sem consent) | T3 | `create-company.int.test.ts`/schema — hash divergente → `VALIDATION`, zero consent |
| U12-MN-03 (CNPJ único) | T3 | `create-company.int.test.ts` — duplicado → `CONFLICT` |
| U12-MN-04 (sem paleta crua) | T1 (form) + T2 (guarda) + T4 (página, via guarda estendida) | `ds-empresa-cadastro-parity.test.ts` |

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate. Restyle tasks (T1, T4) mantêm verdes todos os
testes existentes da USP-012 (regra de refactor: só estilo; o único ajuste comportamental é o alvo do redirect).
