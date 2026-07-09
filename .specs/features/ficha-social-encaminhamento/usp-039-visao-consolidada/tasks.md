# USP-039 — Visão consolidada da Pessoa (Tasks)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: **activate it by name** and follow its
Execute flow and Critical Rules. Do not search for skill files by filesystem path. The skill is the
source of truth for the full flow (per-task cycle, gate, atomic commit, must-not/negative tests,
discrimination sensor, Verifier). **If the skill cannot be activated, STOP and report — do not
proceed without it.**

Non-negotiable per task: tests derive from spec ACs (not implementation); the gate (tests pass)
decides done; one atomic commit per task; never weaken/skip/delete tests; every **must-not** is owned
by a task and proven by a green **negative test** that a mutation would flip.

---

**Spec**: `.specs/features/ficha-social-encaminhamento/usp-039-visao-consolidada/spec.md`
**Design**: `.specs/features/ficha-social-encaminhamento/usp-039-visao-consolidada/design.md`
**Status**: Draft
**Módulo dono do View Model**: `persons` · **Sem migração** (agregação de leitura).

---

## Test Coverage Matrix

> Generated from codebase, `docs/arch/project-guideline.md` §12, and spec. Guidelines found:
> `CLAUDE.md`, `docs/arch/project-guideline.md` (§12 test policy), `package.json` scripts,
> `vitest.config.ts` + `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Domain guard (`persons/domain/consolidated-person.ts`) | unit | ≥90%; 1:1 às ACs de autorização; todos os ramos de papel (AS/BOARD/COORDINATOR→true; demais + `[]`→false) | `src/modules/persons/__tests__/*.test.ts` | `npm run test` |
| Read query por-dimensão (`jobs`/`referrals`/`services`/`companies` `queries/*.ts`) | integration | ≥80%; `where` de escopo (`personId`/`clientPersonId`) exercitado contra Postgres real; ativa vs histórica; `select` restrito **sem PII de terceiros**; `take`; estado vazio | `src/modules/<m>/__tests__/*.int.test.ts` | `npm run test:integration` |
| Assembler / View Model (`persons/views/view-person-for-social-assistant.ts`) | integration | happy AS/BOARD (todas as dimensões + ficha + `SENSITIVE_FIELD_VIEWED`); **MN-01** coordenador (ficha não SELECIONADA/serializada, sem audit); **MN-02** voluntário→`null`; Pessoa inexistente→`null` | `src/modules/persons/__tests__/*.int.test.ts` | `npm run test:integration` |
| Componente (`persons/components/consolidated-person-panel.tsx`) | unit (component) | Renderiza todas as dimensões; **MN-01** com `ficha=null` não renderiza rótulo/valor sensível; estados vazios | `src/modules/persons/__tests__/*.test.tsx` | `npm run test` |
| Route/página (`app/(app)/pessoas/[id]/visao-consolidada/page.tsx`) | e2e + page test | **MN-02** voluntário→`notFound()` (reads/assembler nunca chamados); **MN-01** coordenador render sem ficha (`getSocioeconomicRecord` não chamado); happy AS render completo; E2E cobre gate de sessão/papel | page: `src/**/__tests__/*.test.tsx` · e2e: `e2e/**/*.spec.ts` | `npm run test` · `npm run test:e2e` |

> **Sem migração / sem schema:** USP-039 não altera `prisma/schema.prisma`. Não há layer "Prisma
> model" nesta USP.
>
> **E2E autenticado:** este repo não tem seed de sessão Supabase no Playwright (padrão documentado,
> L-007 / AD-019). A cobertura autoritativa de privacidade/leitura vive nos testes de **integração/
> componente**; o E2E cobre o **gate de sessão/papel** com spec real (não `.fixme`).

## Parallelism Assessment

> Generated from codebase. Confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (`*.test.ts`) | Yes | Funções puras / sem backing store | `persons/__tests__/view-person-for-staff.test.ts` |
| component (`*.test.tsx`) | Yes | Testing Library, DOM por teste, sem DB | `persons/__tests__/SocioeconomicRecordForm.test.tsx` |
| integration (`*.int.test.ts`) | **No** | Postgres compartilhado + cleanup global; `describe.skipIf(!DATABASE_URL)` | `persons/__tests__/get-socioeconomic-record.int.test.ts`; `vitest.integration.config.ts` |
| e2e (`*.spec.ts`) | No | Servidor/estado compartilhado | `e2e/` (Playwright) |

**Consequência:** tasks com testes de integração (T2, T3, T4, T5, T6) rodam **sequenciais** entre si
mesmo sem dependência de código (Postgres compartilhado). Tasks unit/component (T1, T7) podem ser `[P]`.

## Gate Check Commands

> Generated from codebase (`package.json`). Confirm before Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com testes unit/component | `npm run test` |
| Full | Após tasks com testes de integração | `npm run test && npm run test:integration` |
| Build | Após fase/tasks de rota + E2E | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (E2E: `npm run test:e2e` quando aplicável) |

---

## Execution Plan

### Phase 1: Guarda de domínio (unit)
```
T1 (canViewConsolidatedPerson)
```

### Phase 2: Reads por-dimensão (Sequential — int tests não paralelizáveis; sem dep de código entre si)
```
T2 (jobs: candidaturas) ─ T3 (referrals: encaminhamentos) ─ T4 (services: manifestações) ─ T5 (companies: vínculos)
```

### Phase 3: Assembler / View Model (integration)
```
T1,T2,T3,T4,T5 ──> T6 (viewPersonForSocialAssistant)
```

### Phase 4: UI (Sequential)
```
T6 ──> T7 (painel) ──> T8 (página + guarda de rota + E2E)
```

---

## Task Breakdown

### T1: Guarda de domínio `canViewConsolidatedPerson` + `CONSOLIDATED_PERSON_ROLES` [P]

**What**: Função pura de autorização de papel para abrir o painel consolidado.
**Where**: `src/modules/persons/domain/consolidated-person.ts` (+ export no barrel `src/modules/persons/index.ts`)
**Depends on**: None
**Reuses**: forma de `SOCIOECONOMIC_RECORD_ROLES`/`canManageSocioeconomicRecord`; valor idêntico a `ACCESS_REPORT_ROLES` (reporting)
**Requirement**: SOC-06, **SOC-039-MN-02**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `CONSOLIDATED_PERSON_ROLES = ['SOCIAL_ASSISTANT','BOARD','COORDINATOR'] as const`; `canViewConsolidatedPerson(roles: readonly string[]): boolean` → `true` sse contém algum deles.
- [ ] **Negative test (MN-02, discriminador de domínio):** `VOLUNTEER`, `CANDIDATE`, `PROVIDER`, `CLIENT`, `COMPANY_RESPONSIBLE` e `[]` → `false`; `SOCIAL_ASSISTANT`, `BOARD`, `COORDINATOR` (isolados e combinados) → `true`.
- [ ] Exportado no barrel; `npm run test` verde. Test count registrado.

**Tests**: unit
**Gate**: quick

---

### T2: Read `listPersonApplications(personId)` (candidaturas ativas + históricas)

**What**: Read query em `jobs` das candidaturas de uma Pessoa (dimensão do painel), `select` restrito sem PII.
**Where**: `src/modules/jobs/queries/list-person-applications.ts` (+ barrel `src/modules/jobs/index.ts`) · teste `src/modules/jobs/__tests__/list-person-applications.int.test.ts`
**Depends on**: None
**Reuses**: molde `list-job-applicants.ts` (`select satisfies Prisma.ApplicationSelect`), escopado por `candidatePersonId`
**Requirement**: SOC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `listPersonApplications(personId): Promise<PersonApplicationRow[]>` com `where:{ candidatePersonId: personId }`, `select` = `id, appliedAt, cancelledAt, viaEncaminhamento, job:{ title, company:{ nomeFantasia } }` (**nunca** cpf/nascimento/endereço/contato), `orderBy:[{cancelledAt:'asc'},{appliedAt:'desc'}]`, `take:50`. `PersonApplicationRow` inclui `active = cancelledAt === null`, `jobTitle`, `companyName`.
- [ ] **Integration:** Pessoa com 1 candidatura ativa + 1 cancelada → retorna as 2 com `active` correto; escopo `personId` exercitado (candidatura de outra Pessoa **não** aparece); `take` respeitado; Pessoa sem candidatura → `[]`.
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(jobs): list a person's applications for consolidated view (USP-039)`

---

### T3: Read `listPersonReferrals(personId)` (encaminhamentos + resultado)

**What**: Read query em `referrals` (cria o dir `queries/`) dos encaminhamentos recebidos por uma Pessoa + resultado.
**Where**: `src/modules/referrals/queries/list-person-referrals.ts` (+ barrel `src/modules/referrals/index.ts`) · teste `src/modules/referrals/__tests__/list-person-referrals.int.test.ts`
**Depends on**: None
**Reuses**: convenção de query; `Referral` `@relation("ReferredPerson")`/`Referrer`
**Requirement**: SOC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `listPersonReferrals(personId): Promise<PersonReferralRow[]>` com `where:{ personId }` (Pessoa encaminhada), `select` = `id, justification, result, resultObservation, resultRegisteredAt, createdAt, job:{ title, company:{ nomeFantasia } }, referrer:{ fullName }` (**nunca** PII), `orderBy:{createdAt:'desc'}`, `take:50`.
- [ ] **Integration:** Pessoa com encaminhamento sem resultado (`result=null`) e outro com `HIRED`+observação → ambos retornados com os campos; escopo `personId` (encaminhamento de outra Pessoa **não** aparece); Pessoa sem encaminhamento → `[]`.
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(referrals): list a person's referrals for consolidated view (USP-039)`

---

### T4: Read `listPersonServiceInterests(personId)` (manifestações como cliente)

**What**: Read query em `services` das manifestações de interesse que a Pessoa fez como cliente.
**Where**: `src/modules/services/queries/list-person-service-interests.ts` (+ barrel `src/modules/services/index.ts`) · teste `src/modules/services/__tests__/list-person-service-interests.int.test.ts`
**Depends on**: None
**Reuses**: molde `list-provider-interests.ts` (`select satisfies Prisma.ServiceInterestSelect`), escopado por `clientPersonId` (direção inversa)
**Requirement**: SOC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `listPersonServiceInterests(personId): Promise<PersonServiceInterestRow[]>` com `where:{ clientPersonId: personId }`, `select` = `id, interestedAt, cancelledAt, service:{ title, author:{ fullName } }` (**nunca** PII), `orderBy:[{cancelledAt:'asc'},{interestedAt:'desc'}]`, `take:50`. `PersonServiceInterestRow` inclui `active = cancelledAt === null`, `serviceTitle`, `providerName`.
- [ ] **Integration:** Pessoa com 1 manifestação ativa + 1 cancelada → 2 linhas com `active` correto; escopo `clientPersonId` (interesse de outra Pessoa **não** aparece); Pessoa sem manifestação → `[]`.
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(services): list a person's service interests for consolidated view (USP-039)`

---

### T5: Read `listPersonCompanyGrants(personId)` (papéis organizacionais)

**What**: Read query em `companies` dos vínculos vivos da Pessoa com Empresas (papéis organizacionais).
**Where**: `src/modules/companies/queries/list-person-company-grants.ts` (+ barrel `src/modules/companies/index.ts`) · teste `src/modules/companies/__tests__/list-person-company-grants.int.test.ts`
**Depends on**: None
**Reuses**: molde `list-active-responsibles.ts`, escopado por `personId` (direção inversa)
**Requirement**: SOC-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `listPersonCompanyGrants(personId): Promise<PersonCompanyGrantRow[]>` com `where:{ personId, revokedAt: null }`, `select` = `id, grantType, status, grantedAt, acceptedAt, company:{ nomeFantasia }`, `orderBy:{grantedAt:'desc'}`, `take:50`. `PersonCompanyGrantRow` inclui `companyName`, `status` (ACTIVE/PENDING).
- [ ] **Integration:** Pessoa responsável ATIVA por Empresa A + vínculo PENDING por Empresa B → 2 linhas com `status` correto; vínculo revogado (`revokedAt != null`) **não** aparece; escopo `personId` (vínculo de outra Pessoa **não** aparece); Pessoa sem vínculo → `[]`.
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(companies): list a person's company grants for consolidated view (USP-039)`

---

### T6: Assembler `viewPersonForSocialAssistant` + `ConsolidatedPersonView` (fonte única de anonimização)

**What**: Assembler async em `persons` que monta o painel, com o gate da ficha (B1+B2 do MN-01) e a guarda de acesso (MN-02).
**Where**: `src/modules/persons/views/view-person-for-social-assistant.ts` (+ tipos + barrel `src/modules/persons/index.ts`) · teste `src/modules/persons/__tests__/view-person-for-social-assistant.int.test.ts`
**Depends on**: T1, T2, T3, T4, T5
**Reuses**: `canViewConsolidatedPerson` (T1), `viewPersonForStaff`, `canManageSocioeconomicRecord`, `getSocioeconomicRecord`, `viewSocioeconomicRecord` (tipo), `ProviderServiceRow` (services, reuso), os tipos `Person*Row` (T2–T5, **type-only** para não criar ciclo); precedente `viewPersonForAccessReport` (reporting)
**Requirement**: SOC-06, **SOC-039-MN-01**, **SOC-039-MN-02**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `viewPersonForSocialAssistant(personId, viewer:{roles}, dimensions: ConsolidatedExternalDimensions): Promise<ConsolidatedPersonView | null>`:
  - `if (!canViewConsolidatedPerson(viewer.roles)) return null;` (MN-02).
  - `person = await viewPersonForStaff(personId); if (!person) return null;`
  - **B1 (MN-01):** `ficha = canManageSocioeconomicRecord(viewer.roles) ? (getSocioeconomicRecord result unwrap) : null` — para não-AS/BOARD `getSocioeconomicRecord` **não é chamado**.
  - Retorna `{ person, ficha, ...dimensions }` (B2: `ficha` só populada no ramo AS/BOARD).
- [ ] `persons` **não** importa os barrels `jobs`/`referrals`/`services`/`companies` (só tipos `Person*Row` via `import type`, ou tipos duplicados localmente se o lint `no-deep-module-imports` exigir — precedente AD-019).
- [ ] **Integration — happy:** viewer `SOCIAL_ASSISTANT` (e `BOARD`) contra Pessoa com ficha populada + dimensões → todas as dimensões presentes, `view.ficha` com os campos, **1** `SENSITIVE_FIELD_VIEWED` gravado.
- [ ] **Integration — MN-01 (coordenador):** viewer `COORDINATOR` + Pessoa com ficha populada → `getSocioeconomicRecord` **não** é chamado (spy), `view.ficha` ausente/`null`, `JSON.stringify(view)` **não** casa nenhum valor sensível da ficha (renda/benefício/moradia/composição), **nenhum** `SENSITIVE_FIELD_VIEWED` gravado; as demais dimensões presentes. *(Mutação a matar: trocar o gate `canManageSocioeconomicRecord`→`canViewConsolidatedPerson` faz o coordenador receber a ficha → teste vermelho.)*
- [ ] **Integration — MN-02 (voluntário):** viewer `VOLUNTEER` → retorna `null` (nenhuma dimensão serializada). Pessoa inexistente (viewer AS) → `null`.
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(persons): viewPersonForSocialAssistant consolidated view model with role-gated ficha (USP-039)`

---

### T7: Componente `ConsolidatedPersonPanel`

**What**: Componente de exibição que renderiza o `ConsolidatedPersonView` (todas as dimensões; ficha só quando presente).
**Where**: `src/modules/persons/components/consolidated-person-panel.tsx` · teste `src/modules/persons/__tests__/ConsolidatedPersonPanel.test.tsx`
**Depends on**: T6
**Reuses**: `@/shared/ui` (Card/Badge/…, AD-014); tipo `ConsolidatedPersonView` (T6)
**Requirement**: SOC-06, **SOC-039-MN-01** (sem seção de ficha p/ coordenador)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Renderiza seções: identidade + papéis ativos, candidaturas (ativas/históricas), encaminhamentos (com resultado), serviços, manifestações, vínculos; estados vazios por dimensão. Read-only; pode linkar p/ `ficha-social` (editar) e `encaminhamentos/novo`.
- [ ] Seção da **ficha** só é montada quando `view.ficha != null`.
- [ ] **Component test (MN-01):** com `view.ficha = null`, o componente **não** renderiza nenhum rótulo/valor sensível (renda/benefício/moradia/composição); com `view.ficha` presente, renderiza a seção. Estados vazios exibidos quando as listas são `[]`.
- [ ] `npm run test` verde. Test count registrado.

**Tests**: unit (component)
**Gate**: quick

---

### T8: Página `(app)` do painel consolidado + guarda de rota + E2E

**What**: Rota autenticada que orquestra os fetches cross-módulo, chama o assembler e renderiza o painel; guarda nega voluntário.
**Where**: `src/app/(app)/pessoas/[id]/visao-consolidada/page.tsx` · page test `src/app/(app)/pessoas/[id]/visao-consolidada/page.test.tsx` · `e2e/persons/visao-consolidada.spec.ts`
**Depends on**: T6, T7
**Reuses**: layout `(app)` (`force-dynamic`); `requireActivePerson`/`getCurrentPerson`; `canViewConsolidatedPerson`; os 5 reads (`listPersonApplications`/`listPersonReferrals`/`listProviderServices`/`listPersonServiceInterests`/`listPersonCompanyGrants`); `viewPersonForSocialAssistant`; `ConsolidatedPersonPanel`
**Requirement**: SOC-06, **SOC-039-MN-01** (rota: coordenador sem ficha), **SOC-039-MN-02** (rota: nega voluntário)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Server Component `force-dynamic`: `requireActivePerson()` → `if (!canViewConsolidatedPerson(viewer.roles)) notFound();` (**MN-02 na rota**); busca as 5 dimensões (`Promise.all`, barrels); `view = await viewPersonForSocialAssistant(id, viewer, dims); if (!view) notFound();`; renderiza `ConsolidatedPersonPanel`.
- [ ] **Page test (MN-02):** viewer `VOLUNTEER` → `notFound()`; `viewPersonForSocialAssistant` e os reads **nunca** chamados (spies).
- [ ] **Page test (MN-01):** viewer `COORDINATOR` → painel renderiza **sem** a seção da ficha; `getSocioeconomicRecord` **não** chamado (o assembler não o chama; a página não o chama diretamente).
- [ ] **Page test (happy):** viewer `SOCIAL_ASSISTANT` → painel completo (com ficha quando existe).
- [ ] **E2E (spec real, não `.fixme`):** cobre o gate de sessão/papel da rota (padrão L-007 — E2E autenticado deferido; asserta redirect/negação sem sessão autorizada).
- [ ] Gate: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` verde; `npm run test:e2e` da spec nova verde/gated conforme repo. Test count registrado.

**Tests**: e2e (+ page component test)
**Gate**: build
**Commit**: `feat(persons): consolidated person view page + route guard (USP-039)`

---

## Parallel Execution Map

```
Phase 1:
  T1 [P] (unit)

Phase 2 (Sequential — int tests não paralelizáveis; sem dep de código entre si):
  T2 ──> T3 ──> T4 ──> T5

Phase 3 (Sequential — int test):
  (T1,T2,T3,T4,T5) ──> T6

Phase 4 (Sequential):
  T6 ──> T7 ──> T8
```

**Parallelism constraint:** T1 é `[P]` (unit puro). T2–T5 são independentes em código, mas seus
testes de integração compartilham Postgres → **sequenciais**. T6 depende de T1–T5. T7/T8 sequenciais
(T8 usa o painel de T7).

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: guarda + roles | 1 arquivo de domínio | ✅ Granular |
| T2: 1 read query (jobs) | 1 query + teste | ✅ Granular |
| T3: 1 read query (referrals) | 1 query + teste | ✅ Granular |
| T4: 1 read query (services) | 1 query + teste | ✅ Granular |
| T5: 1 read query (companies) | 1 query + teste | ✅ Granular |
| T6: 1 assembler + tipos | 1 View Model coeso | ✅ Granular |
| T7: 1 componente | 1 componente | ✅ Granular |
| T8: 1 página + guarda + E2E | 1 rota | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Phase 1 (raiz) | ✅ Match |
| T2 | None | Phase 2 (início) | ✅ Match |
| T3 | None (int seq após T2) | T2 → T3 (ordem de fase, não dep de código) | ✅ Match |
| T4 | None (int seq após T3) | T3 → T4 (ordem de fase) | ✅ Match |
| T5 | None (int seq após T4) | T4 → T5 (ordem de fase) | ✅ Match |
| T6 | T1, T2, T3, T4, T5 | (T1..T5) → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T6, T7 | T7 → T8 | ✅ Match |

> As setas T2→T3→T4→T5 são **ordem de fase** (integração sequencial por Postgres compartilhado), não
> dependência de código — nenhum desses reads importa o outro. Registrado para evitar leitura como
> dep real.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Domain guard | unit | unit | ✅ OK |
| T2 | Read query (integration) | integration | integration | ✅ OK |
| T3 | Read query (integration) | integration | integration | ✅ OK |
| T4 | Read query (integration) | integration | integration | ✅ OK |
| T5 | Read query (integration) | integration | integration | ✅ OK |
| T6 | Assembler/View Model (integration) | integration | integration | ✅ OK |
| T7 | Component | unit (component) | unit | ✅ OK |
| T8 | Route/página + E2E | e2e (+ page test) | e2e | ✅ OK |

> Nenhum `Tests: none` nesta USP (sem layer schema/config). Cada layer com teste requerido tem o
> teste na task que o cria — sem deferral.

---

## Must-Not Ownership (Check 4)

| Must-Not | Owning task(s) | Negative test (Done when) |
|---|---|---|
| **SOC-039-MN-01** (nenhum campo sensível da ficha a coordenador / não-AS-BOARD; nem SELECIONADO nem serializado) | T6 (assembler: B1 não-chamada + B2 strip), T7 (componente sem seção), T8 (rota) | T6: coordenador + ficha populada → `getSocioeconomicRecord` não chamado (spy), sem valor sensível no JSON, sem `SENSITIVE_FIELD_VIEWED`; AS → ficha + audit. T7: `ficha=null` → sem rótulo/valor sensível. T8: page test coordenador → sem seção de ficha, `getSocioeconomicRecord` não chamado. |
| **SOC-039-MN-02** (voluntário comum sem nenhum dado consolidado; rota + assembler negam) | T1 (guarda de domínio), T6 (assembler→`null`), T8 (rota→`notFound()`) | T1: papéis não-autorizados → `false`. T6: `VOLUNTEER`→`null`, nenhuma dimensão. T8: page test `VOLUNTEER`→`notFound()`, reads/assembler nunca chamados. |

✅ Todos os must-nots têm task dona e teste negativo discriminante. Nenhum gap de decomposição.

---

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Cada `Done when` é binário/testável e referencia o
comando de gate. Contagem de testes registrada por task (anti-deleção silenciosa). O Verifier
independente (author ≠ verifier) roda após a última task: checagem spec-anchored por AC, sensor de
discriminação (mutação viva) e verificação evidence-or-zero dos must-nots SOC-039-MN-01/02 (a barreira
B1 do MN-01 — SELECT condicional ao papel — é o alvo primário de mutação: desligá-la deve matar o
teste do coordenador).
