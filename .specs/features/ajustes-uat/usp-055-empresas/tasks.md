# USP-055 — Empresas (remediação UAT) — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com a skill spec-driven deste pipeline: **ative `idsd-spec-driven` pelo nome**
e siga o fluxo Execute e as Critical Rules dela (ciclo por-task: implementar → gate verde → 1 commit
atômico). Não busque arquivos de skill por caminho no filesystem. A skill é a fonte da verdade do
fluxo (testes derivam da spec; gate decide; 1 commit por task; must-not com teste negativo verde).

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

O Verifier é despachado pelo orquestrador após o último commit (author ≠ verifier). **Este agente
(Planner) NÃO implementa e NÃO roda o Verifier.**

---

**Design**: `.specs/features/ajustes-uat/usp-055-empresas/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada do codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas:
> `CLAUDE.md` (§Testing Requirements: Server Action cobre happy/Zod/permission/consent/concurrency;
> domínio 90%; integração 80% em Server Actions sensíveis), `vitest.config.ts` (unit/jsdom, exclui
> `*.int.test.ts`), `vitest.integration.config.ts` (`npm run test:integration`, Postgres local).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain puro (`companies/domain/*.ts`) | unit | Todas as branches; guard de completude enum↔UI (EMP055-MN-02); classificação CPF/e-mail | `src/modules/companies/__tests__/*.test.ts` | `npm run test` |
| Server Action sensível (`create-company.ts`) | integration | Happy 1ª Empresa + 2ª Empresa (reuso), 1 consent ativo, concorrência via índice parcial; preserva U12-MN-02/03 | `src/modules/companies/__tests__/create-company.int.test.ts` | `npm run test:integration` |
| Client component (forms `*.tsx`) | unit (jsdom/RTL) | Render dos 5 radios (ambos os forms); mensagem de campo específica de CPF/e-mail | `src/modules/companies/__tests__/*.test.tsx` | `npm run test` |
| Enum / config / schema Prisma | none | — (build gate) | — | build gate only |

## Parallelism Assessment

> Gerada do codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit / component (jsdom, puro/mockado) | Yes | Sem store compartilhado; pure/mocks | `vitest.config.ts` (jsdom, exclui `*.int.test.ts`) |
| integration (`*.int.test.ts`) | No | Postgres local compartilhado + cleanup entre testes | `vitest.integration.config.ts`; `create-company.int.test.ts` faz `beforeEach`/cleanup no DB |

## Gate Check Commands

> Gerada do codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks só com unit/component | `npm run test` |
| Full | Após tasks com integração | `npm run test && npm run test:integration` |
| Build | Fim de fase / config | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Phase 1: Foundation (Parallel OK)

Fontes client-safe puras + seus testes. Sem dependências.

```
T1 [P]
T2 [P]
```

### Phase 2: UI fixes (Parallel OK)

Forms consumindo as fontes da Fase 1.

```
T1 ──┬──→ T4 [P]
     └──→ T5 [P]
T2 ──────→ T6 [P]
```

### Phase 3: Server Action + integração (Sequential)

Correção MOD-2 com teste de integração (não paralelizável).

```
T3
```

> 3 fases → execução **inline** (sem sub-agentes; o gatilho de sub-agente é >3 fases).

---

## Task Breakdown

### T1: Fonte única de rótulos/opções do `CompanyType` [P]

**What**: Criar `domain/company-type.ts` com `COMPANY_TYPE_LABELS` (mapa PT-BR) + `COMPANY_TYPE_OPTIONS`
(ordenado) + guard de completude; exportar via barrel.
**Where**: `src/modules/companies/domain/company-type.ts` (novo); `src/modules/companies/index.ts` (add export)
**Depends on**: None
**Reuses**: valores do enum `CompanyType` (`prisma/schema.prisma:382`); padrão client-safe de `domain/cnpj.ts`
**Requirement**: EMP055-08, EMP055-MN-02 (parte: guard de completude)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `COMPANY_TYPE_LABELS: Record<CompanyType,string>` com os 5 rótulos PT-BR (A2 da spec).
- [ ] `COMPANY_TYPE_OPTIONS` na ordem MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, SA.
- [ ] Arquivo **client-safe** (não importa `@prisma/client`, `@/modules/*` server, nem Prisma) — união
      de literais local (padrão `EDUCATION_LEVELS`/AD-019).
- [ ] Unit test afirma que o mapa cobre **exatamente** os 5 literais do enum (guard EMP055-MN-02 —
      falha se enum e UI divergirem).
- [ ] Exportado no barrel `companies/index.ts`.
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: +1 (ou mais) unit em `__tests__/company-type.test.ts` (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(companies): fonte única de rótulos PT-BR do CompanyType (EMP-4)`

---

### T2: Classificador CPF/e-mail client-safe (relocação) [P]

**What**: Criar `domain/responsible-identifier.ts` com `classifyIdentifier` + checagem pura de CPF
(client-safe); fazer `add-responsible.schema.ts` importar/re-exportar de lá (back-compat).
**Where**: `src/modules/companies/domain/responsible-identifier.ts` (novo);
`src/modules/companies/schemas/add-responsible.schema.ts` (import + re-export)
**Depends on**: None
**Reuses**: lógica de `classifyIdentifier` (`add-responsible.schema.ts:13-21`); algoritmo canônico de
CPF (idêntico a `identity/schemas/registerPerson.ts:8`)
**Requirement**: fundação EMP-8 (consumido por T6)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `classifyIdentifier(raw)` movido para o novo arquivo, **sem** importar `@/modules/identity`
      (client-safe; checagem de CPF pura local).
- [ ] `add-responsible.schema.ts` importa `classifyIdentifier` do domínio e **continua exportando-o**
      (o barrel `companies/index.ts:28` e testes seguem válidos).
- [ ] Comportamento idêntico ao atual (mesmos vereditos CPF/e-mail/`null`).
- [ ] Unit test do classificador (CPF válido/ inválido / e-mail válido / inválido / `null`).
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: existentes + novos passam (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(companies): classificador CPF/e-mail client-safe (EMP-8)`

---

### T3: `createCompany` reusa consent `COMPANY_REPRESENTATION` ativo (MOD-2)

**What**: Tornar a criação do consent condicional (reuso se já ativo) dentro da tx `withAudit`,
resolvendo o cadastro da 2ª Empresa; cobrir com teste de integração.
**Where**: `src/modules/companies/actions/create-company.ts` (modificar bloco linhas 108-129);
`src/modules/companies/__tests__/create-company.int.test.ts` (novo caso)
**Depends on**: None
**Reuses**: padrão idempotente de `persons/actions/ensure-client-role.ts:90-120` (Passo 4)
**Requirement**: EMP055-01, EMP055-02, EMP055-03, EMP055-04, EMP055-MN-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Dentro do `withAudit`, `tx.consent.findFirst({ personId, purpose:'COMPANY_REPRESENTATION',
      revokedAt:null })`; `tx.consent.create` **só quando ausente**. Grant `RESPONSIBLE` sempre criado.
- [ ] Releitura **após** a validação de hash (passo 3b); pré-checagem de CNPJ (passo 4) intocada.
- [ ] **Negative test (EMP055-MN-01)**: pessoa cadastra Empresa A (consent ativo) → cadastra Empresa B
      (CNPJ distinto) → `ok`; **exatamente 1** consent `COMPANY_REPRESENTATION` ativo; 2 Empresas;
      2 grants `RESPONSIBLE` ativos; nunca `INTERNAL`.
- [ ] Caso 1ª Empresa (sem consent prévio) segue criando o consent (happy path atual preservado).
- [ ] Regressão: `U12-MN-02` (hash divergente → zero consent) e `U12-MN-03` (CNPJ duplicado → CONFLICT,
      1 Empresa) permanecem verdes.
- [ ] Gate full passa: `npm run test && npm run test:integration`
- [ ] Test count: `create-company.int.test.ts` 6 → ≥7 (no silent deletions)

**Tests**: integration
**Gate**: full
**Commit**: `fix(companies): reusa consent COMPANY_REPRESENTATION ativo ao cadastrar 2ª Empresa (MOD-2)`

---

### T4: Editar Empresa exibe os 5 tipos do enum (EMP-4) [P]

**What**: Substituir os 2 radios hardcoded do bloco "Tipo" por render de `COMPANY_TYPE_OPTIONS`.
**Where**: `src/modules/companies/components/edit-company-form.tsx` (linhas 132-150);
`src/modules/companies/__tests__/edit-company-form.test.tsx` (novo caso)
**Depends on**: T1
**Reuses**: `COMPANY_TYPE_OPTIONS` (T1); `editCompanySchema` já aceita os 5
**Requirement**: EMP055-05, EMP055-07, EMP055-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Os 5 radios renderizam via `COMPANY_TYPE_OPTIONS` (values + rótulos PT-BR), `{...register('type')}`.
- [ ] `defaultValues.type` (de `empresa.type`) pré-seleciona; submit/RHF/diálogo de re-verificação intactos.
- [ ] **Negative test (EMP055-MN-02)**: RTL afirma que os **5** `value`s de radio estão presentes
      (incl. `SA`, `LUCRO_PRESUMIDO`, `LUCRO_REAL`).
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: `edit-company-form.test.tsx` 5 → ≥6 (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `fix(companies): editar Empresa exibe os 5 tipos do enum (EMP-4)`

---

### T5: Cadastrar Empresa exibe os 5 tipos do enum (EMP-4 / A1) [P]

**What**: Idem T4 no form de criar Empresa, preservando o default `SIMPLES_NACIONAL`.
**Where**: `src/modules/companies/components/create-company-form.tsx` (linhas 88-106);
`src/modules/companies/__tests__/create-company-form.test.tsx` (novo caso)
**Depends on**: T1
**Reuses**: `COMPANY_TYPE_OPTIONS` (T1); `createCompanySchema` já aceita os 5
**Requirement**: EMP055-06, EMP055-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Os 5 radios renderizam via `COMPANY_TYPE_OPTIONS`.
- [ ] `defaultValues.type = 'SIMPLES_NACIONAL'` preservado (default de criação).
- [ ] **Negative test (EMP055-MN-02)**: RTL afirma os 5 `value`s presentes.
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: `create-company-form.test.tsx` existentes + ≥1 (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `fix(companies): cadastrar Empresa exibe os 5 tipos do enum (EMP-4)`

---

### T6: Mensagem de CPF específica na busca de responsável (EMP-8) [P]

**What**: Estender o `formSchema` do form com `superRefine` que emite mensagem de campo específica
(CPF/e-mail) usando o classificador client-safe.
**Where**: `src/modules/companies/components/add-responsible-form.tsx` (formSchema, linhas 20-24);
`src/modules/companies/__tests__/add-responsible-form.test.tsx` (novo caso)
**Depends on**: T2
**Reuses**: `classifyIdentifier` de `domain/responsible-identifier.ts` (T2); texto canônico
"CPF inválido (formato ou dígito verificador)" (`identity/schemas/registerPerson.ts:29`)
**Requirement**: EMP055-09, EMP055-10, EMP055-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `superRefine`: valor sem "@" e não-CPF → issue path `cpfOuEmail` "CPF inválido (formato ou dígito
      verificador)"; com "@" e não-email → "E-mail inválido"; vazio → "Informe um CPF ou e-mail." (mantido).
- [ ] O form **não** importa `@/modules/identity` (usa o domínio client-safe da T2) — build client OK.
- [ ] RTL: digitar `123` e submeter → mensagem canônica no campo e `adicionarResponsavel` **não** chamada;
      e-mail válido → action chamada (EMP055-11 preservado).
- [ ] Gate quick passa: `npm run test`
- [ ] Test count: `add-responsible-form.test.tsx` 4 → ≥5 (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `fix(companies): mensagem de CPF específica na busca de responsável (EMP-8)`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]
  └── T2 [P]

Phase 2 (Parallel, após Fase 1):
  T1 ──┬── T4 [P]
       └── T5 [P]
  T2 ───── T6 [P]

Phase 3 (Sequential):
  T3
```

`[P]` = sem dependência inter-task na fase (order-free). Integração (T3) roda sequencial (não
parallel-safe). Execução inline (3 fases ≤ 3 → sem sub-agentes).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: fonte de rótulos/opções | 1 arquivo domínio + export + teste | ✅ Granular |
| T2: classificador client-safe | 1 arquivo domínio + re-export + teste | ✅ Granular |
| T3: reuso de consent | 1 action (bloco) + int test | ✅ Granular |
| T4: radios editar | 1 componente + teste | ✅ Granular |
| T5: radios criar | 1 componente + teste | ✅ Granular |
| T6: superRefine CPF | 1 componente + teste | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | root (Fase 1) | ✅ Match |
| T2 | None | root (Fase 1) | ✅ Match |
| T3 | None | root (Fase 3) | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T2 | T2 → T6 | ✅ Match |

Tasks `[P]` na mesma fase não dependem entre si (T1∦T2; T4∦T5∦T6). ✅

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Domain puro | unit | unit | ✅ OK |
| T2 | Domain puro | unit | unit | ✅ OK |
| T3 | Server Action sensível | integration | integration | ✅ OK |
| T4 | Client component | unit | unit | ✅ OK |
| T5 | Client component | unit | unit | ✅ OK |
| T6 | Client component | unit | unit | ✅ OK |

Nenhum `Tests: none` indevido; nenhum deferimento de teste. ✅

---

## Must-Not Ownership Check (💠)

| Must-Not | Owning task(s) | Negative test no `Done when`? | Status |
| -------- | -------------- | ----------------------------- | ------ |
| EMP055-MN-01 (2ª Empresa não duplica consent ativo / não falha `INTERNAL`) | T3 | Sim — int test: 2ª Empresa → ok, 1 consent ativo, nunca INTERNAL | ✅ |
| EMP055-MN-02 (nenhum valor do enum omitido no controle de Tipo) | T1 (guard de completude) + T4 + T5 (5 radios) | Sim — T1 guard de completude do domínio; T4/T5 RTL dos 5 `value`s | ✅ |

Invariantes preservadas (regressão, testes verdes existentes): `U12-MN-02`, `U12-MN-03` — cobertas
pelas asserções mantidas em `create-company.int.test.ts` (T3 não as rebaixa).
