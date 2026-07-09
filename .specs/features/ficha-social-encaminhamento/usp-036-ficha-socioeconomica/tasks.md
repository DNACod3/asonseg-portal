# USP-036 — Ficha socioeconômica (Tasks)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: **activate it by name** and follow
its Execute flow and Critical Rules. Do not search for skill files by filesystem path. The skill
is the source of truth for the full flow (per-task cycle, gate, atomic commit, must-not/negative
tests, discrimination sensor, Verifier). **If the skill cannot be activated, STOP and report — do
not proceed without it.**

Non-negotiable per task: tests derive from spec ACs (not implementation); the gate (tests pass)
decides done; one atomic commit per task; never weaken/skip/delete tests; every **must-not** is
owned by a task and proven by a green **negative test**.

---

**Spec**: `.specs/features/ficha-social-encaminhamento/usp-036-ficha-socioeconomica/spec.md`
**Design**: `.specs/features/ficha-social-encaminhamento/usp-036-ficha-socioeconomica/design.md`
**Status**: Draft
**Módulo dono**: `persons`

---

## Test Coverage Matrix

> Generated from codebase, `docs/arch/project-guideline.md` §12, and spec. Guidelines found:
> `CLAUDE.md`, `docs/arch/project-guideline.md` (§12 test policy), `package.json` scripts,
> `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Domain / business rule (`domain/socioeconomic-record.ts` — guard, enums) | unit | ≥90%; 1:1 às ACs de autorização; todos os ramos de papel (AS/BOARD→ok, demais→deny) | `src/modules/persons/__tests__/*.test.ts` | `npm run test` |
| Zod schema (`schemas/socioeconomic-record.schema.ts`) | unit | Válido + cada inválido (enum fora, texto longo, vazio→undefined) | `src/modules/persons/__tests__/*.test.ts` | `npm run test` |
| View Model serializer (`views/view-socioeconomic-record.ts`) | unit | Molda todos os campos; sem cross-Person | `src/modules/persons/__tests__/*.test.ts` | `npm run test` |
| Sensitive Server Action (`actions/save-socioeconomic-record.ts`) | integration | ≥80%; happy (create+update), Zod-fail, **permissão negada (MN-01)**, edge Pessoa inativa, **auditoria autor+data same-tx (MN-02)**. *(consent-absent = N/A, Assumption #2)* | `src/modules/persons/__tests__/*.int.test.ts` | `npm run test:integration` |
| Query + audit-on-read (`queries/get-socioeconomic-record.ts`) | integration | AS/BOARD recebem campos; **não-AS `FORBIDDEN` sem vazar campo (MN-01)**; `SENSITIVE_FIELD_VIEWED` gravado | `src/modules/persons/__tests__/*.int.test.ts` | `npm run test:integration` |
| Component (`components/socioeconomic-record-form.tsx`) | unit (component) | Renderiza os 4 campos (AC-036-1); mostra erro de validação | `src/modules/persons/__tests__/*.test.tsx` | `npm run test` |
| Route/página (`app/(app)/.../ficha/page.tsx`) | e2e + page test | Guarda de rota nega não-AS (MN-01 na rota); happy render p/ AS; E2E cobre o gate de sessão/papel | page: `src/**/__tests__/*.test.tsx` · e2e: `e2e/**/*.spec.ts` | `npm run test` · `npm run test:e2e` |
| Prisma model + enums + migration (`prisma/schema.prisma`) | none | build gate only (migração aplica limpa) | — | build gate |
| Audit events catalog (`audit/events.ts`) | none | build gate only (typecheck) — consumidos/assertados pelos int tests de T5 | — | build gate |

> **AC-036-4 (criptografia em repouso):** **sem teste de código** — é controle de plataforma
> (encriptação gerenciada Supabase, ADR-0012 / arch-doc §4.3). Verificação = referência de
> config/ADR no design + `PROJECT.md` §LGPD. O Verifier deve tratar AC-036-4 como
> *satisfeita-por-plataforma* (gap residual documentado), não como AC sem cobertura.
>
> **E2E autenticado:** este repo não tem seed de sessão Supabase no Playwright (padrão documentado,
> L-007 / AD-019). A cobertura autoritativa de write-path/privacidade vive nos testes de
> **integração/componente**; o E2E cobre o **gate de sessão/papel** com spec real (não `.fixme`).

## Parallelism Assessment

> Generated from codebase. Confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (`*.test.ts`) | Yes | Funções puras / sem backing store compartilhado | `persons/__tests__/person-inactivation.test.ts` |
| component (`*.test.tsx`) | Yes | Testing Library, DOM por teste, sem DB | `persons/__tests__/CandidateForm.test.tsx` |
| integration (`*.int.test.ts`) | **No** | Postgres compartilhado + cleanup global; `describe.skipIf(!DATABASE_URL)` | `persons/__tests__/inactivate-person.int.test.ts`; `vitest.integration.config.ts` |
| e2e (`*.spec.ts`) | No | Servidor/estado compartilhado | `e2e/` (Playwright) |

**Consequência:** tasks com testes de integração (T5, T6) rodam **sequenciais** entre si mesmo
sem dependência de código. Tasks unit/component (T3, T4) podem ser `[P]`.

## Gate Check Commands

> Generated from codebase (`package.json`). Confirm before Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com testes unit/component | `npm run test` |
| Full | Após tasks com testes de integração | `npm run test && npm run test:integration` |
| Build | Após fase/tasks de schema/config/rota + E2E | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (E2E: `npm run test:e2e` quando aplicável) |

---

## Execution Plan

### Phase 1: Foundation (Sequential)
```
T1 (schema + migration + prisma generate)
```

### Phase 2: Domain + Validation + Events (Parallel OK)
```
T1 ──┬── T2 [P] (audit events)
     ├── T3 [P] (domain guard + types)
     └── T4 [P] (Zod schema)
```

### Phase 3: Server Path (Sequential — integration tests não paralelizáveis)
```
T2,T3,T4 ──> T5 (save action) ──> T6 (get query + view)
```

### Phase 4: UI (Sequential)
```
T5 ──> T7 (form) ; T6,T7 ──> T8 (página + guarda de rota + E2E)
```

---

## Task Breakdown

### T1: Model Prisma `SocioeconomicRecord` + enums + relação + migração

**What**: Adicionar os enums `IncomeBracket`/`HousingSituation`, o model `SocioeconomicRecord` (tabela `socioeconomic_records`, PK=`personId`) e a relação `Person.socioeconomicRecord`; gerar a migração `usp036_socioeconomic_record`.
**Where**: `prisma/schema.prisma`; `prisma/migrations/<timestamp>_usp036_socioeconomic_record/migration.sql`
**Depends on**: None
**Reuses**: padrão 1:1 `CandidateProfile`/`ProviderProfile` (PK=`personId`, `onDelete: Cascade`, `@@map`)
**Requirement**: SOC-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Enums + model conforme design.md §Data Models; `Person.socioeconomicRecord SocioeconomicRecord?` adicionada.
- [ ] `npx prisma generate` OK; `prisma migrate dev` cria migração que aplica limpa (só a nova tabela+enums, sem drift).
- [ ] `npm run typecheck` verde.

**Tests**: none (schema — build gate)
**Gate**: build

---

### T2: Eventos de auditoria `SOCIAL_SHEET_CREATED` / `SOCIAL_SHEET_UPDATED` [P]

**What**: Adicionar as duas constantes de evento ao catálogo `AuditEvent` (SCREAMING_SNAKE), disponíveis para `withAudit`.
**Where**: `src/modules/audit/events.ts`
**Depends on**: None
**Reuses**: convenção do catálogo `AuditEvent`; `SENSITIVE_FIELD_VIEWED` (já existe, será reusado na T6)
**Requirement**: SOC-01, SOC-036-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `SOCIAL_SHEET_CREATED` e `SOCIAL_SHEET_UPDATED` no `AuditEvent`; tipo `AuditEventName` os inclui.
- [ ] **Não** adicionados a `JUSTIFICATION_REQUIRED_EVENTS` (edição/criação da ficha não exige justificativa).
- [ ] `npm run typecheck` verde.

**Tests**: none (catalog/config — build gate)
**Gate**: build

---

### T3: Guarda de domínio `canManageSocioeconomicRecord` + tipos [P]

**What**: Função pura de autorização de papel + tipos/labels de domínio (`IncomeBracket`/`HousingSituation`) + `isEmptyRecord`.
**Where**: `src/modules/persons/domain/socioeconomic-record.ts` (+ export no barrel `src/modules/persons/index.ts`)
**Depends on**: T1 (importa enums de `@prisma/client`)
**Reuses**: forma de `canRegisterAssisted` (`identity/actions/register-person-by-assistant.ts`)
**Requirement**: SOC-02, **SOC-036-MN-01**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `canManageSocioeconomicRecord(roles: Role[]): boolean` → `true` sse contém `SOCIAL_ASSISTANT` ou `BOARD`.
- [ ] **Negative test (MN-01, discriminador de domínio):** `COORDINATOR`, `VOLUNTEER`, `CANDIDATE`, `PROVIDER`, `CLIENT`, `COMPANY_RESPONSIBLE` e `[]` → `false`; `SOCIAL_ASSISTANT` e `BOARD` (isolados e combinados) → `true`.
- [ ] Exportado no barrel; `npm run test` verde.

**Tests**: unit
**Gate**: quick

---

### T4: Zod schema `socioeconomicRecordSchema` [P]

**What**: Schema de validação dos 4 campos (todos opcionais; formato/limites quando presentes).
**Where**: `src/modules/persons/schemas/socioeconomic-record.schema.ts` (+ barrel)
**Depends on**: T1 (enums)
**Reuses**: convenção `persons/schemas/*`
**Requirement**: SOC-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Valida `personId` (uuid), `incomeBracket?` (enum), `socialBenefit?` (`string` ≤200, trim), `housingSituation?` (enum), `familyComposition?` (`string` ≤500, trim); string vazia → `undefined`.
- [ ] Testes unit: input válido completo; parcial/vazio (aceito); enum inválido → erro; texto acima do limite → erro.
- [ ] Exportado no barrel; `npm run test` verde.

**Tests**: unit
**Gate**: quick

---

### T5: Server Action `saveSocioeconomicRecord` (upsert auditado)

**What**: Action de escrita: Zod → guarda de papel → pré-condição (Pessoa existe) → `withAudit` upsert.
**Where**: `src/modules/persons/actions/save-socioeconomic-record.ts` (+ barrel) · testes `src/modules/persons/__tests__/save-socioeconomic-record.int.test.ts`
**Depends on**: T1, T2, T3, T4
**Reuses**: sequência de `register-person-by-assistant.ts`; `withAudit`; `getCurrentPerson`; `ok`/`fail`
**Requirement**: SOC-01, **SOC-036-MN-01**, **SOC-036-MN-02**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Sequência: `safeParse`→`VALIDATION`; `getCurrentPerson`→`UNAUTHENTICATED`; `canManageSocioeconomicRecord`→`FORBIDDEN`; Pessoa inexistente→`NOT_FOUND`; `withAudit(SOCIAL_SHEET_CREATED|UPDATED)` com `upsert` na mesma tx; retorna `ActionResult<{personId}>`, nunca `throw`.
- [ ] `audit.after` **não** grava valores sensíveis em claro (só nomes de campos alterados/flags de presença).
- [ ] **Integration tests:** happy create → `SOCIAL_SHEET_CREATED`; happy update → `SOCIAL_SHEET_UPDATED`, dado persistido e reabrível; Zod-fail; **MN-01:** operador `COORDINATOR` e `VOLUNTEER` → `FORBIDDEN` e **nenhuma linha** em `socioeconomic_records`; **edge:** editar ficha de Pessoa `INATIVO` → persiste e preserva (sem delete); **MN-02:** após OK existe exatamente 1 `audit_log` `SOCIAL_SHEET_*` com `actorPersonId`=operador + timestamp, e falha forçada de auditoria faz rollback do upsert (nada persiste).
- [ ] Gate: `npm run test && npm run test:integration` verde. Test count registrado (sem deleções silenciosas).

**Tests**: integration
**Gate**: full
**Commit**: `feat(persons): save socioeconomic record action (USP-036)`

---

### T6: Query `getSocioeconomicRecord` + View Model `viewSocioeconomicRecord`

**What**: Leitura restrita a AS/BOARD, com `SELECT` explícito, audit-on-read (`SENSITIVE_FIELD_VIEWED`) e serializer puro.
**Where**: `src/modules/persons/queries/get-socioeconomic-record.ts` + `src/modules/persons/views/view-socioeconomic-record.ts` (+ barrel) · testes `__tests__/get-socioeconomic-record.int.test.ts` + `__tests__/view-socioeconomic-record.test.ts`
**Depends on**: T1, T2, T3
**Reuses**: `view-candidate-for-employer.ts` (serializer sem cross-Person); padrão query `select`
**Requirement**: SOC-02, **SOC-036-MN-01**, Assumption #8 (audit-on-read)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `getSocioeconomicRecord(personId)`: guarda de papel **antes** do `SELECT`; AS/BOARD → `ok(view|null)`; grava `SENSITIVE_FIELD_VIEWED` quando retorna campos.
- [ ] `viewSocioeconomicRecord(row)` puro (sem IO), Row estruturalmente só com campos da ficha.
- [ ] **Unit** (serializer): molda todos os campos corretamente.
- [ ] **Integration (MN-01):** `COORDINATOR`/`VOLUNTEER` → `FORBIDDEN` e o resultado **não** contém nenhum campo sensível (nem carregado); AS → campos presentes + `SENSITIVE_FIELD_VIEWED` gravado.
- [ ] Exportados no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(persons): read socioeconomic record with role guard + audit-on-read (USP-036)`

---

### T7: Componente `SocioeconomicRecordForm`

**What**: Formulário Client (RHF + Zod adapter) com os 4 campos, submetendo a `saveSocioeconomicRecord`.
**Where**: `src/modules/persons/components/socioeconomic-record-form.tsx` · teste `__tests__/SocioeconomicRecordForm.test.tsx`
**Depends on**: T4, T5
**Reuses**: `@/shared/ui` (Select/Input/Textarea/Button/FormCard, AD-014); padrão `candidate-form.tsx`/`provider-form.tsx` p/ o carve-out client/server (ADR-0017 — não importar barrel `@/modules/persons` inteiro)
**Requirement**: SOC-01 (AC-036-1)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Renderiza os 4 campos: renda (Select `IncomeBracket`), benefício (Input/Textarea), moradia (Select `HousingSituation`), composição familiar (Textarea). Labels PT-BR.
- [ ] Pré-preenche com `initial` quando fornecido; exibe `fieldErrors` de validação.
- [ ] **Component test:** renderiza os 4 campos; submit inválido mostra erro; não importa Prisma no bundle client (build não quebra).
- [ ] `npm run test` verde.

**Tests**: unit (component)
**Gate**: quick

---

### T8: Página `(app)` da ficha social + guarda de rota + E2E

**What**: Rota autenticada AS/diretoria que carrega e renderiza a ficha; guarda de rota nega não-AS.
**Where**: `src/app/(app)/social/pessoas/[personId]/ficha/page.tsx` *(ajustar à convenção de rotas de gestão de Pessoa da USP-002 se já houver área AS)* · page test `__tests__/*.test.tsx` · `e2e/persons/ficha-socioeconomica.spec.ts`
**Depends on**: T6, T7
**Reuses**: layout `(app)` (`force-dynamic`); `getCurrentPerson`; `canManageSocioeconomicRecord`; `getSocioeconomicRecord`; `SocioeconomicRecordForm`
**Requirement**: SOC-01, SOC-02, **SOC-036-MN-01** (guarda de rota)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Server Component `force-dynamic`; guarda `getCurrentPerson` + `canManageSocioeconomicRecord` → `notFound()`/redirect p/ não-autorizado (MN-01 na rota); carrega `getSocioeconomicRecord`; renderiza o form.
- [ ] **Page test:** render p/ AS mostra o form com dados; **MN-01:** viewer `COORDINATOR`/`VOLUNTEER` → guarda nega (sem render dos campos).
- [ ] **E2E (spec real, não `.fixme`):** cobre o gate de sessão/papel da rota (padrão L-007 — E2E autenticado deferido; asserta o redirect/negação sem sessão de AS).
- [ ] Gate: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` verde; `npm run test:e2e` da spec nova verde/gated conforme repo.
- [ ] Test count registrado.

**Tests**: e2e (+ page component test)
**Gate**: build
**Commit**: `feat(persons): ficha socioeconômica page + route guard (USP-036)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1

Phase 2 (Parallel após T1):
  ├── T2 [P]
  ├── T3 [P]   } unit/config — sem dependência mútua
  └── T4 [P]

Phase 3 (Sequential — int tests não paralelizáveis):
  T5 ──> T6

Phase 4 (Sequential):
  T7 ──> T8
```

**Parallelism constraint:** T2/T3/T4 são `[P]` (dependem só de T1, testes unit/config paralelos, sem
estado mutável compartilhado). T5/T6 têm testes de integração (Postgres compartilhado) → sequenciais.
T7/T8 sequenciais (T8 usa o form de T7).

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: model + enums + migração | 1 schema change coeso | ✅ Granular |
| T2: 2 constantes de evento | 1 arquivo/conceito | ✅ Granular |
| T3: guarda + tipos de domínio | 1 arquivo de domínio | ✅ Granular |
| T4: Zod schema | 1 arquivo | ✅ Granular |
| T5: 1 Server Action | 1 action + testes | ✅ Granular |
| T6: 1 query + 1 serializer | 2 arquivos coesos (leitura) | ✅ OK (coeso) |
| T7: 1 componente | 1 componente | ✅ Granular |
| T8: 1 página + guarda + E2E | 1 rota | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | (raiz) | ✅ Match |
| T2 | None | após T1 (grupo paralelo) — sem seta de dep | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T2, T3, T4 | (T2,T3,T4) → T5 | ✅ Match |
| T6 | T1, T3 (via T5 na ordem) | T5 → T6 (sequência de fase) | ✅ Match |
| T7 | T4, T5 | T5 → T7 | ✅ Match |
| T8 | T6, T7 | (T6,T7) → T8 | ✅ Match |

> T2 aparece no grupo paralelo da Phase 2 sem seta de dependência de T1 (é independente); listado
> junto por conveniência de fase. Sem contradição: nenhum `[P]` depende de outro `[P]` do mesmo grupo.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Prisma model/enums/migração | none (build gate) | none | ✅ OK |
| T2 | Audit events catalog (config) | none (build gate) | none | ✅ OK |
| T3 | Domain (guard/types) | unit | unit | ✅ OK |
| T4 | Zod schema | unit | unit | ✅ OK |
| T5 | Sensitive Server Action | integration | integration | ✅ OK |
| T6 | Query (integration) + serializer (unit) → highest | integration | integration | ✅ OK |
| T7 | Component | unit (component) | unit | ✅ OK |
| T8 | Route/página + E2E | e2e (+ page test) | e2e | ✅ OK |

> `Tests: none` em T1/T2 é válido porque a matriz classifica esses layers como *none/build gate*
> (não é deferral — nenhum layer com teste requerido fica sem teste na task que o cria).

---

## Must-Not Ownership (Check 4)

| Must-Not | Owning task(s) | Negative test (Done when) |
|---|---|---|
| **SOC-036-MN-01** (nenhum campo sensível a não-AS/BOARD) | T3 (domain), T5 (action), T6 (query), T8 (rota) | T3: papéis não-AS→`false`; T5: `COORDINATOR`/`VOLUNTEER`→`FORBIDDEN`+0 linhas; T6: →`FORBIDDEN`+sem campo no resultado; T8: guarda de rota nega render |
| **SOC-036-MN-02** (nenhuma escrita sem auditoria autor+data) | T5 (action) | T5: 1 `audit_log` `SOCIAL_SHEET_*` com `actorPersonId`+timestamp; falha de auditoria → rollback (nada persiste) |

✅ Todos os must-nots têm task dona e teste negativo. Nenhum gap de decomposição.

---

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Cada `Done when` é binário/testável e referencia
o comando de gate. Contagem de testes registrada por task (anti-deleção silenciosa). O Verifier
independente (author ≠ verifier) roda após a última task: checagem spec-anchored por AC (com
AC-036-4 tratada como satisfeita-por-plataforma), sensor de discriminação, e verificação
evidence-or-zero dos must-nots SOC-036-MN-01/02.
