# USP-027 — Empresa ver lista de candidatos da vaga — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com a skill **`idsd-spec-driven`**: **ative-a pelo nome** e
siga o fluxo Execute + Critical Rules. Não procure arquivos de skill por path. A
skill é a fonte da verdade do fluxo (ciclo por task, gate, commit atômico, Verifier,
sensor de discriminação). Produção dos testes-fonte via **`skill-tdad`** a partir
dos ACs/must-nots da spec.

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/candidaturas-busca-candidatos/usp-027-empresa-ver-candidatos/design.md`
**Status**: Draft

---

## Entry Gate (§0) — resultado

**LIBERADO.** Nenhum item das Assumptions tem owner **externo** (usuário/cliente/outro
time) não resolvido do qual a implementação dependa. A única dependência de código é
`Application.viaEncaminhamento`, entregue por **U2/USP-025** (owner **interno da
pipeline**, sequenciada antes de U3) — não é gate externo. Se, no Execute, a coluna
`viaEncaminhamento` **não** existir no working tree, PARE: é falha de sequência
(U2 não rodou), não trabalho de U3 criar a coluna.

---

## Test Coverage Matrix

> Gerada de codebase + guideline (`docs/arch/project-guideline.md` §12) + spec. Guidelines encontrados: `CLAUDE.md`, `docs/arch/project-guideline.md` (§4/§5/§9/§12), `vitest.config.ts` + `vitest.integration.config.ts`, `package.json` scripts.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| View Model puro (`persons/views/view-candidate-for-employer.ts`) | unit | Todas as chaves de saída; must-not: chaves proibidas ausentes; branches (phone null, cv ausente, viaEncaminhamento) | `src/modules/persons/__tests__/*.test.ts` | `npm run test` |
| Query auditada (`jobs/queries/list-job-applicants.ts`) | integration | Happy, ownership deny (MN-02), NOT_FOUND, canceladas excluídas (MN-03), audit gravado (MN-04), sensor PII ausente (MN-01/MN-05), estado vazio, badge | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test:integration` |
| Página RSC (`app/(app)/empresa/[empresaId]/vagas/[jobId]/candidatos/page.tsx`) + componente | component (Vitest+RTL) | authz→notFound; render de lista, badge, estado vazio, data/hora, "não informado" | `src/app/(app)/**/page.test.tsx`, `src/modules/jobs/components/__tests__/*.test.tsx` | `npm run test` |
| Fluxo crítico E2E (empregador vê candidatos) | e2e | Happy path com spec **real** em `e2e/` (L-007: promover, não deixar `.fixme` em `.specs/`) | `e2e/**/*.spec.ts` | `npm run test:e2e` |
| Barrel export (`jobs/index.ts`, `persons/index.ts`) | none | Build/typecheck | — | build gate |

**Coverage por camada:** domínio/VM = 90% branches (1:1 ACs/must-nots); Server-side
sensível (query) = integração cobrindo happy + authz negada + audit + concorrência N/A.

## Parallelism Assessment

> Gerada de codebase.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (VM/domínio) | Yes | Prisma mockado (`vi.hoisted`), sem estado compartilhado | `persons/__tests__/view-person-for-staff.test.ts` |
| component (RTL) | Yes | mocks de query/sessão; sem DB | `app/(app)/empresa/[empresaId]/vagas/page.test.tsx` |
| integration | **No** | DB Postgres compartilhado + teardown por `createdIds` (colisão de seed) | `jobs/__tests__/applications.int.test.ts`; memória `seed-cnpj-exclusivo` |
| e2e | **No** | Servidor + DB semeados compartilhados | `e2e/jobs/*` |

## Gate Check Commands

> Gerada de `package.json`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit/component | `npm run typecheck && npm run test` |
| Full | Após tasks com integração | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Fim de fase / task de barrel/rota/E2E | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build && npm run test:e2e` |

---

## Execution Plan

### Phase 1: View Model (Sequential)
```
T1
```

### Phase 2: Query auditada + ownership (Sequential — integração não é paralela)
```
T1 → T2 → T3
```

### Phase 3: UI + E2E (Sequential)
```
T3 → T4 → T5
```

---

## Task Breakdown

### T1: View Model `viewCandidateForEmployer`

**What**: Serializer **puro** que projeta candidato+candidatura para a Empresa,
expondo só nome+contato+CV+meta; `Row` tipado sem `cpf/birthDate/fullAddress`.
**Where**: `src/modules/persons/views/view-candidate-for-employer.ts` (+ export no barrel `src/modules/persons/index.ts`)
**Depends on**: None
**Reuses**: molde de `src/modules/jobs/views/job-list-item.view.ts`
**Requirement**: USP027-01, USP027-MN-01, USP027-MN-05

**Tools**: MCP: NONE · Skill: `skill-tdad` (gera as specs unit red)

**Done when**:
- [ ] `EmployerCandidateRow`, `EmployerCandidateView` e `viewCandidateForEmployer(row)` definidos e exportados no barrel
- [ ] `Row` **não** contém `cpf`/`birthDate`/`fullAddress` (garantia estrutural)
- [ ] Unit tests: `Object.keys(view)` = whitelist; `for key of ['cpf','birthDate','fullAddress'] expect(view).not.toHaveProperty(key)`; branches phone-null, cv-ausente (`available=false`), `viaEncaminhamento` true/false
- [ ] Test count: ~6 unit passam (no silent deletions)
- [ ] Gate: `npm run typecheck && npm run test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(persons): viewCandidateForEmployer (View Model de candidato p/ Empresa) (USP-027)`

---

### T2: Signed URL do CV (helper de resolução)

**What**: Função server-only que resolve uma signed URL de curta duração para um
`cvStoragePath` via o client `supabase-storage`, com fallback `null` se indisponível.
**Where**: `src/modules/jobs/queries/list-job-applicants.ts` (helper interno `resolveCvUrl`) ou `src/modules/persons/server/cv-url.ts` se reutilizável
**Depends on**: T1
**Reuses**: `src/shared/lib/supabase-storage.ts`
**Requirement**: USP027-01 (link do CV)

**Tools**: MCP: `context7` (API atual do Supabase Storage `createSignedUrl`) · Skill: NONE

**Done when**:
- [ ] `resolveCvUrl(path: string | null): Promise<string | null>` — `null` quando path null ou storage indisponível (try/catch, sem throw)
- [ ] Coberto pelos int tests da T3 (cv presente → url; cv ausente → `available=false`)
- [ ] Gate: `npm run typecheck`

**Tests**: none (exercitado via integração na T3)
**Gate**: quick
**Commit**: `feat(jobs): resolver signed URL de CV p/ lista de candidatos (USP-027)`

---

### T3: Query `listJobApplicants` (ownership + leitura restrita + auditoria)

**What**: Query que autoriza por ownership, carrega candidaturas **ativas** com
SELECT restrito (só PII permitida), resolve CV, mapeia por `viewCandidateForEmployer`
e grava `APPLICATION_VIEWED_BY_EMPLOYER` + `SENSITIVE_FIELD_VIEWED` por candidato.
**Where**: `src/modules/jobs/queries/list-job-applicants.ts` (+ export no barrel `src/modules/jobs/index.ts`)
**Depends on**: T1, T2
**Reuses**: `requireActiveResponsible` (`@/modules/jobs`), `withAudit`/`recordAuditEvent` (`@/modules/audit`), `ok`/`fail` (`@/shared/errors`), `headers()`+`clientIp` (padrão `reporting/access-report.ts`)
**Requirement**: USP027-01, USP027-03, USP027-04, USP027-06, USP027-07, USP027-08, USP027-MN-01..05

**Tools**: MCP: NONE · Skill: `skill-tdad` (int specs red)

**Done when**:
- [ ] Assinatura `listJobApplicants({ jobId, page? }, viewer): Promise<ActionResult<EmployerCandidatesResult>>`
- [ ] Vaga inexistente → `fail('NOT_FOUND')` (USP027-07)
- [ ] `requireActiveResponsible` falso → `fail('FORBIDDEN')` **sem** carregar/auditar (MN-02)
- [ ] SELECT carrega só `fullName,emailLogin,phone,cvStoragePath,cvUploadedAt,appliedAt,viaEncaminhamento`; **nunca** `cpf/birthDate/fullAddress` (MN-01/MN-05)
- [ ] `where: { jobId, cancelledAt: null }`, `orderBy appliedAt asc`, `take: APPLICANTS_PAGE_SIZE` — canceladas excluídas (MN-03)
- [ ] `withAudit(APPLICATION_VIEWED_BY_EMPLOYER)` + `recordAuditEvent(SENSITIVE_FIELD_VIEWED)` por candidato, no mesmo tx, sequencial (MN-04)
- [ ] **Integração** cobre: happy (só ativas, ordenadas), badge `viaEncaminhamento`, ownership deny (outra Empresa → FORBIDDEN), NOT_FOUND, canceladas fora, estado vazio, **audit gravado** (`auditLog.findFirst` para ambos os eventos), e **sensor de discriminação**: semear candidato com CPF/endereço distintivos e `expect(JSON.stringify(result)).not.toContain(CPF)` e `.not.toContain(ENDERECO)`; consulta negada → nenhum evento de audit
- [ ] Test count: ~10 int passam (no silent deletions)
- [ ] Gate: `npm run typecheck && npm run lint && npm run test && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(jobs): listJobApplicants (ownership + leitura auditada de candidatos) (USP-027)`

---

### T4: Página + componente de lista de candidatos

**What**: Página RSC do responsável + componente que renderiza a lista (nome, contato,
CV, data/hora SP, badge de encaminhamento, estado vazio) consumindo só o View Model.
**Where**: `src/app/(app)/empresa/[empresaId]/vagas/[jobId]/candidatos/page.tsx` (+ `page.test.tsx`) e `src/modules/jobs/components/job-applicants-list.tsx` (+ `__tests__`)
**Depends on**: T3
**Reuses**: `requireActivePerson` (`@/modules/identity`), `formatInTimezone` (`@/shared/lib/time`), primitivas `@/shared/ui` (Card/Badge), padrão `empresa/[empresaId]/vagas/page.tsx`
**Requirement**: USP027-01, USP027-02, USP027-03, USP027-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Página chama `requireActivePerson` + `listJobApplicants`; `NOT_FOUND`/`FORBIDDEN` → `notFound()`
- [ ] Componente renderiza: nome, contato ("não informado" quando phone null), link do CV quando `cv.available`, data/hora via `formatInTimezone`, badge "Candidato encaminhado pela ASONSEG" quando `viaEncaminhamento`, estado vazio "Nenhuma candidatura ativa" (USP027-08)
- [ ] Componente **não** recebe linha crua (só `EmployerCandidateView[]`) (MN-05)
- [ ] `page.test.tsx` (RTL): authz → `notFound`; render feliz; badge; estado vazio
- [ ] Test count: ~5 component passam
- [ ] Gate: `npm run typecheck && npm run lint && npm run test`

**Tests**: component
**Gate**: quick
**Commit**: `feat(jobs): página de candidatos da vaga p/ a Empresa (USP-027)`

---

### T5: E2E crítico — empregador vê candidatos da vaga

**What**: Spec Playwright **real** em `e2e/` cobrindo o fluxo: responsável autenticado
abre a vaga da sua Empresa e vê a lista de candidatos ativos (com contato/CV/data);
responsável de outra Empresa não acessa.
**Where**: `e2e/candidaturas/empresa-ver-candidatos.spec.ts` (fixtures de seed demo)
**Depends on**: T4
**Reuses**: fixtures E2E existentes (`e2e/jobs/*`, seed demo d001–d006)
**Requirement**: USP027-01, USP027-06 (fluxo ponta-a-ponta)

**Tools**: MCP: NONE · Skill: `create-e2e-tests`

**Done when**:
- [ ] Spec **real** (não `.fixme`, não em `.specs/`) em `e2e/` — L-007
- [ ] Cobre happy path (vê candidatos) + acesso negado a vaga de outra Empresa
- [ ] Gate: `npm run build && npm run test:e2e` (com Supabase provisionado)
- [ ] Test count: ≥1 E2E passa
- [ ] Barrels (`jobs/index.ts`, `persons/index.ts`) exportam o novo VM/query

**Tests**: e2e
**Gate**: build
**Commit**: `test(jobs): E2E empregador vê candidatos da vaga (USP-027)`

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: View Model | 1 arquivo/serializer | ✅ Granular |
| T2: signed URL helper | 1 função | ✅ Granular |
| T3: query auditada | 1 query | ✅ Granular |
| T4: página + componente | 1 rota + 1 componente coeso (mesma feature) | ⚠️ OK (coeso: rota + seu componente) |
| T5: E2E | 1 spec | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T1, T2 | T2→T3 (T1 via T2) | ✅ Match |
| T4 | T3 | T3→T4 | ✅ Match |
| T5 | T4 | T4→T5 | ✅ Match |

Nenhuma task marcada `[P]` (integração/E2E não são paralelas; cadeia sequencial).

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | View Model puro | unit | unit | ✅ OK |
| T2 | helper server (IO storage) | none (exercitado na T3) | none | ✅ OK (coberto por integração da T3) |
| T3 | Query auditada | integration | integration | ✅ OK |
| T4 | Página RSC + componente | component | component | ✅ OK |
| T5 | Fluxo E2E | e2e | e2e | ✅ OK |

## Must-Not Ownership Check (§4)

| Must-Not | Owning task(s) | Negative test |
| --- | --- | --- |
| USP027-MN-01 (não carregar cpf/birthDate/fullAddress) | T1, T3 | unit (chaves ausentes + SELECT não pede) + int (sensor `JSON.stringify` sem CPF/endereço) |
| USP027-MN-02 (não ver vaga de outra Empresa) | T3 | int (outra Empresa → FORBIDDEN, nada carregado) |
| USP027-MN-03 (não incluir canceladas) | T3 | int (ativa+cancelada → só ativa) |
| USP027-MN-04 (não servir sem auditar) | T3 | int (ambos eventos gravados; negado → nenhum) |
| USP027-MN-05 (não retornar linha crua ao cliente) | T1, T3, T4 | tipo de retorno = VM; int sensor de payload; component recebe só VM |

Todos os 5 must-nots têm task dona + teste negativo. ✅
