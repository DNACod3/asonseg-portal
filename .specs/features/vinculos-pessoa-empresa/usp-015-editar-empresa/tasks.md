# USP-015 — Editar dados da Empresa — Refactor (Fase 2) Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill files
by filesystem path. The skill is the source of truth for the per-task cycle (implement → gate → atomic
commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator — do not proceed without it.**

**Refactor discipline (every restyle task):** change **only markup/classes**. Do not touch `editarEmpresa`,
`identityFieldsChanged`, `editCompanySchema`, audit, or the route gate. Existing tests MUST stay green.
Preserve: rebaixamento atômico de identitários (server-authoritative), CNPJ único no UPDATE, permissão ATIVO,
aviso client antes do submit (só abre quando `changed && isVerified`). **Não mover a decisão de rebaixamento
para o cliente.**

---

**Design**: `.specs/features/vinculos-pessoa-empresa/usp-015-editar-empresa/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found:
> `CLAUDE.md`, `docs/arch/project-guideline.md`, `vitest.config.ts`, `vitest.integration.config.ts`.
> DS `.tsx` fora do gate de cobertura (AD-014/AD-015); Client Components tocados têm `.test.tsx` co-localizado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`EditCompanyForm`) | unit (RTL) | Editar não-identitário → submete direto; editar identitário (verificada) → abre diálogo; confirmar → `editarEmpresa` | `src/modules/companies/__tests__/*.test.tsx` | `npm run test` |
| Guarda estática de paridade DS | unit | Arquivos da USP-015 sem paleta crua/hex (U15-MN-04) | `src/modules/companies/__tests__/ds-empresa-editar-parity.test.ts` | `npm run test` |
| Server Action (`editarEmpresa`) | integration | **Preservada** — identitário → `isVerified=false` (U15-MN-01, incl. bypass), CNPJ de outra → `CONFLICT` (U15-MN-02), não-responsável → `FORBIDDEN` (U15-MN-03) | `src/modules/companies/__tests__/edit-company.int.test.ts` | `npm run test:integration` |
| Server Component (`editar/page.tsx`) | none (build) + `page.test.tsx` existente | Gate de build + preservar teste de gate de rota | `src/app/(app)/empresa/[empresaId]/editar/**` | build gate + `npm run test` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; `vi.mock` | `edit-company-form.test.tsx` (existente) |
| unit (guarda estática) | Yes | Lê fonte do disco | `no-external-verify.test.ts` |
| integration (Postgres) | No | Postgres compartilhado + cleanup | `edit-company.int.test.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks unit (RTL/guarda) | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks que exercitam a Server Action (preservação) | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle + verificação (Parallel OK)

```
T1 [P]  (EditCompanyForm + diálogo)
T3 [P]  (verificação da action preservada)
```

### Phase 2: Página + guarda (Sequential)

```
T1 → T2 (página editar) → T4 (guarda de paridade DS)
```

2 fases → execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `EditCompanyForm` + diálogo de re-verificação (só estilo) + RTL [P]

**What**: `Input`/`Label`/`Textarea`/`Button` no form; diálogo tokenizado (superfície + `Button primary`/`outline`,
overlay). Atualizar/estender o RTL existente para travar: não-identitário → sem diálogo; identitário (verificada)
→ diálogo aparece; confirmar → `editarEmpresa`.
**Where**: `src/modules/companies/components/edit-company-form.tsx` (modify) + `__tests__/edit-company-form.test.tsx` (atualizar)
**Depends on**: None
**Reuses**: `LoginForm.tsx`, `remove-responsible-dialog.tsx` (irmão restilizado), `@/shared/ui`
**Requirement**: U15-STYLE-01, U15-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Form usa `Input`/`Label`/`Textarea`/`Button`; diálogo tokenizado (`bg-surface`/`text-fg`/`border-border`, `Button` primary/outline); sem `bg-blue-*`/`text-gray-*`/`border-gray-300`.
- [ ] Comportamento preservado: RHF+Zod, `defaultValues`, campo oculto `empresaId`, `onSubmit` com `identityFieldsChanged` abrindo o diálogo **só** quando `changed && empresa.isVerified`, `editarEmpresa`, `router.refresh`, Esc handler, tratamento de erros.
- [ ] **RTL (U15-MN-04 comportamento):** editar só descrição → `editarEmpresa` chamado sem passar pelo diálogo; editar razão social (empresa verificada) → diálogo renderiza; confirmar → `editarEmpresa` chamado.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `edit-company-form.test.tsx` ≥ casos existentes (sem deleções) + cobertura do diálogo.

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(companies): restyle EditCompanyForm + diálogo de re-verificação com Design System (AD-014)`

---

### T2: Restyle da página `editar` (só estilo)

**What**: `FormHeader` + tokens; preservar o `page.test.tsx` existente verde.
**Where**: `src/app/(app)/empresa/[empresaId]/editar/page.tsx` (modify)
**Depends on**: T1
**Reuses**: `@/shared/ui` (`FormHeader`), padrão de página da Fase 1
**Requirement**: U15-STYLE-01, U15-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Header/shell com `FormHeader`/tokens; sem `text-gray-*`.
- [ ] Preservados: `requireActivePerson`, `notFound()`, carga dos dados, `force-dynamic`, e o `page.test.tsx` existente.
- [ ] Renderiza em light/dark.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component — gate de build; `page.test.tsx` existente preservado) · **Gate**: build
**Commit**: `refactor(companies): restyle página de edição de Empresa com Design System (AD-014)`

---

### T3: Verificar preservação de `editarEmpresa` (must-nots de negócio) [P]

**What**: Confirmar que os testes de integração cobrem: identitário → `isVerified=false` na mesma tx, incluindo
**bypass** por chamada direta (U15-MN-01); CNPJ de outra Empresa → `CONFLICT` (U15-MN-02); não-responsável →
`FORBIDDEN` (U15-MN-03). Estender se algum faltar. **Sem alterar produção.**
**Where**: `src/modules/companies/__tests__/edit-company.int.test.ts` (verificar/estender)
**Depends on**: None
**Reuses**: suíte existente
**Requirement**: U15-MN-01, U15-MN-02, U15-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Caso: editar não-identitário → `isVerified` inalterado.
- [ ] Caso: editar identitário (empresa verificada) chamando a action diretamente → `isVerified=false`, `downgraded=true` (bypass do aviso de UI).
- [ ] Caso: CNPJ de outra Empresa → `CONFLICT`; não-responsável → `FORBIDDEN`, Empresa intacta.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- [ ] Test count: nenhum caso deletado.

**Tests**: integration · **Gate**: full
**Commit**: `test(companies): fixar must-nots de negócio da edição (rebaixamento/CNPJ/FORBIDDEN)`

---

### T4: Guarda estática de paridade DS (must-not de estilo)

**What**: Teste estático que lê os arquivos restilizados da USP-015 e falha com paleta crua/hex.
**Where**: `src/modules/companies/__tests__/ds-empresa-editar-parity.test.ts` (novo)
**Depends on**: T1, T2
**Reuses**: `no-external-verify.test.ts`
**Requirement**: U15-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cobre `edit-company-form.tsx` e `editar/page.tsx`.
- [ ] Falha para `bg-blue-`, `text-gray-`, `border-gray-`, hex `#RRGGBB` em superfície temática.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit · **Gate**: quick
**Commit**: `test(companies): guarda de paridade DS da edição de Empresa (U15-MN-04)`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]  (EditCompanyForm + diálogo + RTL)
  └── T3 [P]  (verificação da action)

Phase 2 (Sequential):
  T1 → T2 (página editar) → T4 (guarda de paridade)
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 componente (form + diálogo) + teste | Granular (cohesive) |
| T2 | 1 página | Granular |
| T3 | verificação de testes existentes | Granular |
| T4 | 1 arquivo de teste | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | [P] Phase 1 | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | None | [P] Phase 1 | Match |
| T4 | T1, T2 | T2 → T4 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component | unit (RTL) | unit | OK |
| T2 | Server Component (página) | none (build) | none | OK |
| T3 | Server Action (preservada) | integration | integration | OK |
| T4 | Guarda estática | unit | unit | OK |

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U15-MN-01 (rebaixa identitário, incl. bypass) | T3 | `edit-company.int.test.ts` — identitário → `isVerified=false` (chamada direta) |
| U15-MN-02 (CNPJ único no UPDATE) | T3 | `edit-company.int.test.ts` — CNPJ de outra → `CONFLICT` |
| U15-MN-03 (só responsável ATIVO edita) | T3 | `edit-company.int.test.ts` — não-responsável → `FORBIDDEN` |
| U15-MN-04 (sem paleta crua) | T1, T2 (+ T4 guarda) | `ds-empresa-editar-parity.test.ts` |

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate. Restyle tasks mantêm verdes todos os testes
existentes da USP-015 (regra de refactor: só estilo). A decisão de rebaixamento permanece server-authoritative.
