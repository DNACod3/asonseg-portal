# USP-028 — Empresa buscar candidatos (busca ativa) — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com a skill **`idsd-spec-driven`**: **ative-a pelo nome** e
siga o fluxo Execute + Critical Rules. Testes-fonte via **`skill-tdad`** a partir dos
ACs/must-nots. Não procure arquivos de skill por path.

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/candidaturas-busca-candidatos/usp-028-empresa-buscar-candidatos/design.md`
**Status**: Draft

---

## Entry Gate (§0) — resultado

**LIBERADO.** Nenhuma Assumption tem owner **externo** não resolvido do qual a
implementação dependa. `CandidateProfile.regionId` é criado **por esta USP** (owner
`agent`), então não é dependência bloqueante — é a **T1**. A coleta de região no
form de cadastro é follow-up explicitamente **fora do escopo** (não bloqueia).

---

## Test Coverage Matrix

> Gerada de codebase + guideline (`docs/arch/project-guideline.md` §5/§12) + spec. Guidelines encontrados: `CLAUDE.md`, `docs/arch/project-guideline.md`, `vitest.config.ts` + `vitest.integration.config.ts`, `package.json`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domínio puro (`persons/domain/candidate-display.ts` — `firstNameOf`) | unit | Todas as branches (vazio, único token, múltiplos, espaços) | `src/modules/persons/__tests__/*.test.ts` | `npm run test` |
| View Model puro (`persons/views/view-candidate-for-search.ts`) | unit | Chaves de saída; must-not: proibidas ausentes + só 1º nome; branches (região null, escolaridade label, resumo) | `src/modules/persons/__tests__/*.test.ts` | `npm run test` |
| Query de busca (`persons/queries/search-candidates.ts`) | integration | Happy (ACTIVE/ATIVO ordenados), filtros AND (todos), texto `unaccent`, paginação (MN-04), authz deny, estado vazio, exclusão não-ACTIVE/INATIVO (MN-03), sensor PII/sobrenome ausente (MN-01/MN-02/MN-05) | `src/modules/persons/__tests__/*.int.test.ts` | `npm run test:integration` |
| Migração (`candidate_profiles.region_id` + índice) | none | Aplica limpa (`prisma migrate`), coberta pelos int tests | `prisma/migrations/**` | build gate |
| Página RSC + componentes (form/list) | component (Vitest+RTL) | authz→notFound; render de cards, estado vazio, "Região não informada", filtros no form | `src/app/(app)/**/page.test.tsx`, `src/modules/persons/components/__tests__/*.test.tsx` | `npm run test` |
| Fluxo crítico E2E (empresa busca candidatos) | e2e | Happy path com spec **real** em `e2e/` (L-007) | `e2e/**/*.spec.ts` | `npm run test:e2e` |

**Coverage por camada:** domínio/VM = 90% branches (1:1 ACs/must-nots); query = integração
cobrindo happy + todos os filtros + paginação + authz + exclusões + sensor de privacidade.

## Parallelism Assessment

> Gerada de codebase.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (domínio/VM) | Yes | Sem DB / Prisma mockado | `persons/__tests__/view-person-for-staff.test.ts` |
| component (RTL) | Yes | mocks de query/sessão | `app/(app)/**/page.test.tsx` |
| integration | **No** | DB Postgres compartilhado + teardown por ids | `jobs/__tests__/search-jobs.int.test.ts`; memória `seed-cnpj-exclusivo` |
| e2e | **No** | Servidor + DB semeados | `e2e/*` |

## Gate Check Commands

> Gerada de `package.json`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit/component | `npm run typecheck && npm run test` |
| Full | Após tasks com integração/migração | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Fim de fase / barrel/rota/E2E | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build && npm run test:e2e` |

---

## Execution Plan

### Phase 1: Fundação (Sequential)
```
T1 → T2 → T3
```
T1 migração `regionId` · T2 `firstNameOf` (domínio) · T3 `viewCandidateForSearch` (VM).

### Phase 2: Query de busca (Sequential — integração não é paralela)
```
T3 → T4
```

### Phase 3: UI + E2E (Sequential)
```
T4 → T5 → T6
```

---

## Task Breakdown

### T1: Migração `CandidateProfile.regionId` + índice de busca

**What**: Adicionar `region_id` (FK nullable → `Region`) a `candidate_profiles`,
back-relation em `Region`, `@@index([regionId])`, e índice trgm funcional para a busca
textual não sensível (reusa `immutable_unaccent`).
**Where**: `prisma/schema.prisma` + `prisma/migrations/<ts>_usp028_candidate_search/migration.sql`
**Depends on**: None
**Reuses**: migração de busca de `search-jobs`/USP-021 (função `immutable_unaccent`, `pg_trgm`)
**Requirement**: USP028-01, USP028-02 (localização), USP028-MN-04 (índice p/ perf)

**Tools**: MCP: `context7` (Prisma migrate / índice funcional Postgres) · Skill: NONE

**Done when**:
- [ ] `CandidateProfile.regionId` + `region Region?` + `@@index([regionId])`; `Region.candidateProfiles`
- [ ] `migration.sql` editada à mão contém **só** a nova coluna/índices (sem arrastar drift — cf. AD-013)
- [ ] Índice trgm `candidate_search_trgm` criado; função `immutable_unaccent` reusada (criar se ausente, idempotente)
- [ ] `npm run db:migrate` aplica limpo local; `prisma generate` ok
- [ ] Gate: `npm run typecheck && npm run build`
- [ ] Commit inclui a migração versionada (P4 — fact é contrato)

**Tests**: none (build gate; exercitada pelos int tests da T4)
**Gate**: build
**Commit**: `feat(persons): coluna region_id + índice de busca de candidatos (USP-028)`

---

### T2: `firstNameOf` (domínio puro)

**What**: Helper puro que extrai o primeiro nome de um nome completo.
**Where**: `src/modules/persons/domain/candidate-display.ts` (+ barrel)
**Depends on**: T1
**Reuses**: nenhum
**Requirement**: USP028-03, USP028-MN-02

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `firstNameOf(fullName: string): string` — 1º token; trata `''`, único token, espaços múltiplos, acentos
- [ ] Unit tests cobrindo todas as branches (~5)
- [ ] Gate: `npm run typecheck && npm run test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(persons): firstNameOf (derivar 1º nome) (USP-028)`

---

### T3: View Model `viewCandidateForSearch`

**What**: Serializer puro que projeta candidato p/ a busca ativa expondo só dados
não sensíveis; reduz `fullName → primeiro nome`; `Row` sem campos proibidos.
**Where**: `src/modules/persons/views/view-candidate-for-search.ts` (+ barrel)
**Depends on**: T2
**Reuses**: `firstNameOf`, `EDUCATION_LEVEL_LABELS` (`persons/domain/candidate.ts`), molde `viewJobForVisitor`
**Requirement**: USP028-03, USP028-05, USP028-MN-01, USP028-MN-02, USP028-MN-05

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [ ] `SearchCandidateRow`, `SearchCandidateView`, `viewCandidateForSearch(row)` definidos e exportados no barrel
- [ ] `Row` **não** contém `cpf/emailLogin/phone/fullAddress/cvStoragePath` (garantia estrutural)
- [ ] Output emite `firstName` (não `fullName`), `location` (`cityName — name` ou null), `educationLevelLabel`, `qualificationsSummary`
- [ ] Unit: `Object.keys(view)` = whitelist; `for key of ['cpf','email','phone','fullAddress','fullName','cv','cvStoragePath'] expect(view).not.toHaveProperty(key)`; sobrenome semeado não aparece; branches região null / escolaridade label / resumo
- [ ] Test count: ~7 unit passam
- [ ] Gate: `npm run typecheck && npm run test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(persons): viewCandidateForSearch (View Model não sensível de busca) (USP-028)`

---

### T4: Query `searchCandidates` (busca `unaccent` + gate + SELECT não sensível)

**What**: Query paginada que autoriza (responsável), monta `WHERE` (ACTIVE/ATIVO +
filtros AND + texto `unaccent`), pagina no DB, hidrata por SELECT não sensível e mapeia
por `viewCandidateForSearch`.
**Where**: `src/modules/persons/queries/search-candidates.ts` (**cria** o dir `persons/queries/`; + barrel)
**Depends on**: T3
**Reuses**: `search-jobs.ts` (estrutura), `Prisma.sql`/`join`, `ok`/`fail`, `CurrentPerson`
**Requirement**: USP028-01, USP028-02, USP028-04, USP028-05, USP028-07, USP028-08, USP028-MN-01..05

**Tools**: MCP: `context7` (Prisma `$queryRaw`/`Prisma.sql`) · Skill: `skill-tdad`

**Done when**:
- [ ] `searchCandidates(filters, viewer): Promise<ActionResult<SearchCandidatesResult>>`
- [ ] Authz: sem `COMPANY_RESPONSIBLE` → `fail('FORBIDDEN')` (USP028-08)
- [ ] `buildWhere` base: `cp.publication_status='ACTIVE' AND p.status='ATIVO'` (MN-03); filtros AND (area, escolaridade igualdade, região igualdade, disponibilidade `unaccent` contains, q `unaccent` sobre headline/skills/courses/experience)
- [ ] Paginação no DB (`ORDER BY cp.created_at DESC`, `LIMIT/OFFSET`, `count`); `take` ⇒ `items.length <= SEARCH_PAGE_SIZE` (MN-04)
- [ ] SELECT de hidratação carrega **só** campos não sensíveis + `person.fullName`; **nunca** `cpf/emailLogin/phone/fullAddress/cvStoragePath` (MN-01/MN-05)
- [ ] **Integração** cobre: happy (só ACTIVE/ATIVO, ordem por cadastro), **cada** filtro isolado + combinação AND, texto `unaccent` (com/sem acento), paginação (> page size), authz deny, estado vazio, exclusão de DRAFT/IN_MODERATION/INATIVO (MN-03), e **sensor**: semear candidato com CPF/e-mail/telefone/endereço/CV + sobrenome distintivos e `expect(JSON.stringify(result)).not.toContain(x)` p/ cada (MN-01/MN-02/MN-05)
- [ ] Test count: ~12 int passam (no silent deletions)
- [ ] Gate: `npm run typecheck && npm run lint && npm run test && npm run test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(persons): searchCandidates (busca ativa não sensível de candidatos) (USP-028)`

---

### T5: Página + componentes de busca de candidatos

**What**: Página RSC sob `[empresaId]` (gate responsável) + form de filtros + lista
paginada de cards não sensíveis + estado vazio, consumindo só o View Model.
**Where**: `src/app/(app)/empresa/[empresaId]/candidatos/page.tsx` (+ `page.test.tsx`),
`src/modules/persons/components/candidate-search-form.tsx`, `src/modules/persons/components/candidate-search-list.tsx` (+ `__tests__`)
**Depends on**: T4
**Reuses**: `requireActivePerson`/`requireActiveResponsible`, `listApprovedJobAreas`/`listActiveRegions` (`@/modules/jobs`), `EDUCATION_LEVELS`, primitivas `@/shared/ui`
**Requirement**: USP028-01, USP028-02, USP028-03, USP028-07, USP028-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Página valida `requireActivePerson` + `requireActiveResponsible(viewer.id, empresaId)` → `notFound()` se falso (USP028-08)
- [ ] Form com filtros área/escolaridade/disponibilidade/localização/texto (opções via queries reusadas); estado na URL (`searchParams`)
- [ ] Lista mostra primeiro nome, cidade/região ("Região não informada" quando null), área, escolaridade (label), resumo; paginação; estado vazio "Nenhum candidato encontrado" (USP028-07)
- [ ] Componentes recebem só `SearchCandidateView[]` (MN-05)
- [ ] `page.test.tsx` (RTL): authz→notFound; render feliz; estado vazio; "Região não informada"
- [ ] Test count: ~5 component passam
- [ ] Gate: `npm run typecheck && npm run lint && npm run test`

**Tests**: component
**Gate**: quick
**Commit**: `feat(persons): página de busca ativa de candidatos (USP-028)`

---

### T6: E2E crítico — Empresa busca candidatos

**What**: Spec Playwright **real** em `e2e/` cobrindo o fluxo: responsável autenticado
abre a busca, filtra e vê cards não sensíveis; assert de que sobrenome/contato/CV não
aparecem na página.
**Where**: `e2e/candidaturas/empresa-buscar-candidatos.spec.ts`
**Depends on**: T5
**Reuses**: fixtures E2E + seed demo (com candidatos ACTIVE e região populada)
**Requirement**: USP028-01, USP028-03, USP028-04 (fluxo ponta-a-ponta)

**Tools**: MCP: NONE · Skill: `create-e2e-tests`

**Done when**:
- [ ] Spec **real** (não `.fixme`, não em `.specs/`) em `e2e/` — L-007
- [ ] Cobre happy path (filtra e vê candidatos) + assert de ausência de PII no DOM (sobrenome/contato/CV)
- [ ] Seed demo popula candidatos ACTIVE com `regionId` (para a busca ter dados) — usando CNPJ/dados exclusivos (memória `seed-cnpj-exclusivo`)
- [ ] Barrels (`persons/index.ts`) exportam VM/query/domínio novos
- [ ] Gate: `npm run build && npm run test:e2e`
- [ ] Test count: ≥1 E2E passa

**Tests**: e2e
**Gate**: build
**Commit**: `test(persons): E2E Empresa busca candidatos (USP-028)`

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: migração | 1 migração + schema | ✅ Granular |
| T2: firstNameOf | 1 função pura | ✅ Granular |
| T3: View Model | 1 serializer | ✅ Granular |
| T4: query | 1 query | ✅ Granular |
| T5: página + form + list | 1 rota + componentes coesos (mesma feature) | ⚠️ OK (coeso) |
| T6: E2E | 1 spec | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T3 | T3→T4 | ✅ Match |
| T5 | T4 | T4→T5 | ✅ Match |
| T6 | T5 | T5→T6 | ✅ Match |

Nenhuma task `[P]` (cadeia sequencial; integração/E2E não paralelizáveis).

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Migração/schema | none (build gate) | none | ✅ OK |
| T2 | Domínio puro | unit | unit | ✅ OK |
| T3 | View Model puro | unit | unit | ✅ OK |
| T4 | Query de busca | integration | integration | ✅ OK |
| T5 | Página RSC + componentes | component | component | ✅ OK |
| T6 | Fluxo E2E | e2e | e2e | ✅ OK |

## Must-Not Ownership Check (§4)

| Must-Not | Owning task(s) | Negative test |
| --- | --- | --- |
| USP028-MN-01 (não carregar/emitir cpf/email/phone/address/cv) | T3, T4 | unit (chaves ausentes + Row sem campos) + int (sensor `JSON.stringify` sem PII semeada; SELECT não pede) |
| USP028-MN-02 (não emitir nome completo — só 1º nome) | T2, T3, T4 | unit (sobrenome ausente) + int (`JSON.stringify` sem sobrenome distintivo) |
| USP028-MN-03 (não retornar não-ACTIVE / INATIVO) | T4 | int (DRAFT/IN_MODERATION/INATIVO semeados → ausentes) |
| USP028-MN-04 (não retornar > page size / sem take) | T1 (índice), T4 | int (> page size → `items.length <= SEARCH_PAGE_SIZE`, `total` correto) |
| USP028-MN-05 (não retornar linha crua ao cliente) | T3, T4, T5 | tipo de retorno = VM; int sensor de payload; componentes recebem só VM |

Todos os 5 must-nots têm task dona + teste negativo. ✅
