# USP-067 — Painel `/inicio` por papel — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill **`bravi-spec-driven`**: **ative-a pelo nome** e siga o seu fluxo Execute e as Critical Rules (ciclo por task, gate de teste antes de "done", 1 commit atômico por task, sub-agent delegation se >3 fases, Verifier independente ao final). Para gerar os testes-fonte (facts) de cada task, ative a skill **`skill-tdad`** (produtora de testes do pipeline). **Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

**Design**: `.specs/features/painel-area-logada/usp-067-painel-por-papel/design.md`
**Spec**: `.specs/features/painel-area-logada/usp-067-painel-por-papel/spec.md`
**Status**: Draft

---

## 0. 💠 Entry Gate

Reavaliadas as *Assumptions & Open Questions* da spec com owner **externo**:

- **D-001** (fila para SOCIAL_ASSISTANT/BOARD) — owner `user`, mas **premissa já adotada e confirmada** no ROADMAP e nas notas de RBAC do próprio protótipo aprovado (fila **somente leitura**, sem decisão). Não bloqueia: a implementação segue a premissa; se o dono decidir conceder `MODERATE_*` depois, é ADR/USP nova (mudança de política), não retrabalho desta tela.
- **D-002** (pré/pós go-live) — owner `user`, mas **não afeta a implementação** (sequenciamento de lançamento).
- Todas as demais ambiguidades (A-01..A-18) têm owner `agent` e default escolhido.

**Veredito: entry gate LIVRE.** Nenhum item externo não-resolvido de que a implementação dependa. Procede para breakdown.

---

## Test Coverage Matrix

> Gerada do codebase + guidelines + spec — confirmar antes de Execute. Guidelines encontradas: `CLAUDE.md` (§Testing), `docs/arch/project-guideline.md` §12/§18/§20 (P1-P5, DoD), `vitest.config.ts` (gate 65% statements/branches, include só `src/shared`+`src/modules`+`middleware`), `vitest.integration.config.ts` (`*.int.test.ts`, env node, DB via `.env.local`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Query de leitura (`src/modules/**/queries/*.ts`) | integration | Caminho de query (`where`/`select`/`take`) correto + privacidade (campo restrito ausente do `select`) + estado vazio; 1 teste por AC de dado | `src/modules/**/__tests__/*.int.test.ts` | `npm run test:integration` |
| Helper puro / mapa de rótulo / ordenação (`src/modules/**/domain/*.ts`) | unit | Todas as ramificações; 1:1 aos ACs de derivação (em análise, 7 dias, ordem de papéis, contagem por kind) | `src/modules/**/__tests__/*.test.ts` | `npm run test` |
| Componente de painel (`src/app/(app)/inicio/_components/*.tsx`) | unit (RTL) | Render feliz + estado vazio + ≤5 linhas + omissão de `footHref` + gating de ação | `src/app/(app)/inicio/**/*.test.tsx` | `npm run test` |
| Página composition-root (`src/app/(app)/inicio/page.tsx`) | unit (RTL) | Composição por papel na ordem `ALL_ROLE_LABELS` + gate de acesso + papel-zero + must-nots de payload | `src/app/(app)/inicio/page.test.tsx` | `npm run test` |
| Guard estático (`*.guard.test.ts`) | unit | DS tokens-only; page sem Prisma direto; leitura read-only | `src/app/(app)/inicio/__tests__/*.guard.test.ts` | `npm run test` |
| Rota `(app)` render / E2E autenticado | e2e | **Deferido** (L-007/AD-025/AD-027) — cobertura por RTL + guards + integração; gate de build | — | build gate |

> Nota: `src/app/**` **não** é medido pela cobertura (só `src/modules`+`src/shared`) — os testes de componente/página são **facts obrigatórios** (P1), mas não contam para o gate de 65%. As queries e helpers novos (em `src/modules`) **são** medidos — cobrir ramificações (ver Parallelism/Risks).

## Parallelism Assessment

> Gerada do codebase — confirmar antes de Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (jsdom, RTL, helpers puros) | **Yes** | Sem store compartilhado; mocks por teste | `vitest.config.ts` (jsdom), testes puros existentes em `src/modules/**/__tests__` |
| integration (`*.int.test.ts`) | **No** | DB Postgres compartilhado + cleanup que trunca/deleta fixtures | `vitest.integration.config.ts`; lição MEMORY `seed-cnpj-exclusivo` (cleanup apaga fixtures compartilhadas) |

## Gate Check Commands

> Gerada do codebase — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks só com unit (helpers/componentes/página/guards) | `npm run test` |
| Full | Após tasks com query nova (integração) | `npm run test && npm run test:integration` |
| Build | Fim de fase / antes do Verifier | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Phase 1 — Leituras novas + helpers (Sequential nas queries; helpers [P] no fim)

Queries carregam testes de **integração** (não paralelizáveis) → sequenciais entre si. O helper puro (T9) é unit → pode ir a qualquer momento.

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 ; T9 [P]
```

### Phase 2 — Primitivas apresentacionais (Parallel OK — unit)

```
T10 [P]   T11 [P]
```

### Phase 3 — Loaders + blocos por papel (Parallel OK — unit; dependem de Phase 1+2)

```
T12 [P]  T13 [P]  T14 [P]  T15 [P]  T16 [P]
```

### Phase 4 — Composição + must-nots + guards (Sequential)

```
T17 → T18 → T19
```

---

## Task Breakdown

### T1: `getCandidateProfileStatus` + mapa de rótulo (persons)

**What**: Query fina lendo `CandidateProfile.publicationStatus` do titular + `CANDIDATE_STATUS_LABELS` PT-BR (A-04).
**Where**: `src/modules/persons/queries/get-candidate-profile-status.ts`, `src/modules/persons/domain/candidate-status-labels.ts`, barrel `persons/index.ts`.
**Depends on**: None
**Reuses**: padrão de `queries/` existente; enum `ContentStatus`.
**Requirement**: PNL-01 (A-04)
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `getCandidateProfileStatus(personId): Promise<ContentStatus | null>` com `select: { publicationStatus: true }` e `take`/`findUnique` por `personId`.
- [ ] Mapa de rótulo cobre todos os `ContentStatus` (rascunho/em análise/publicado/…).
- [ ] Exportados no barrel; integração verde (status presente / ausente → null).
- [ ] Gate: `npm run test:integration`.

**Tests**: integration (query) + unit (mapa) · **Gate**: full

---

### T2: `getProviderProfileStatus` + mapa de rótulo (persons)

**What**: Query fina lendo `ProviderProfile.publicationStatus` + `PROVIDER_STATUS_LABELS` (A-04).
**Where**: `src/modules/persons/queries/get-provider-profile-status.ts`, `src/modules/persons/domain/provider-status-labels.ts`, barrel.
**Depends on**: None
**Reuses**: mesmo padrão de T1.
**Requirement**: PNL-02 (A-04)
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `getProviderProfileStatus(personId): Promise<ContentStatus | null>` (`select` explícito).
- [ ] Barrel + integração verdes.
- [ ] Gate: `npm run test:integration`.

**Tests**: integration + unit · **Gate**: full

---

### T3: Estender `listPersonApplications` com `job.status` (jobs)

**What**: Adicionar `job.status` ao `select` e `jobStatus` à `PersonApplicationRow` para derivar "em análise" (A-01/N8).
**Where**: `src/modules/jobs/queries/list-person-applications.ts` (modify).
**Depends on**: None
**Reuses**: query existente.
**Requirement**: PNL-01 (A-01) · **mudança de contrato de leitura (P4)** — justificar no PR.
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `PersonApplicationRow` ganha `jobStatus: ContentStatus`; `select` inclui `job: { select: { title, status, company: { select: { nomeFantasia } } } }`.
- [ ] Testes existentes/int atualizados (novo campo presente); nenhum campo removido sem justificativa (P5).
- [ ] Gate: `npm run test:integration`.

**Tests**: integration · **Gate**: full

---

### T4: `countCompanyApplications` (jobs)

**What**: Count-only `{ total, active }` de candidaturas às vagas de uma empresa (A-07/N4) — **sem PII**.
**Where**: `src/modules/jobs/queries/count-company-applications.ts`, barrel.
**Depends on**: None
**Reuses**: relação `Job.companyId` / `Application`.
**Requirement**: PNL-04 (A-07)
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `countCompanyApplications(companyId): Promise<{ total: number; active: number }>` via `application.count` sobre `job: { companyId }` (active = `cancelledAt: null`).
- [ ] Retorno é só números (nenhum `select` de candidato).
- [ ] Barrel + integração verdes (empresa com/sem candidaturas).
- [ ] Gate: `npm run test:integration`.

**Tests**: integration · **Gate**: full

---

### T5: `listCompanyRecentApplications` (jobs) — sem identidade do candidato [owns PNL-MN-02]

**What**: Top-5 candidaturas recentes de uma empresa, **por vaga**, sem candidato no `select` (A-08/N5).
**Where**: `src/modules/jobs/queries/list-company-recent-applications.ts`, barrel.
**Depends on**: None
**Reuses**: relação `Application → Job`.
**Requirement**: PNL-04 · **PNL-MN-02**
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `listCompanyRecentApplications(companyId): Promise<{ jobId; jobTitle; appliedAt }[]>`, `orderBy appliedAt desc`, `take 5`, `cancelledAt: null`.
- [ ] **Negative test (PNL-MN-02):** o `select` **não** contém `candidate`/`candidatePersonId`/qualquer campo de identidade; asserção estrutural de que nenhuma PII de candidato está na linha retornada (teste falha se alguém adicionar `candidate` ao select).
- [ ] Gate: `npm run test:integration`.

**Tests**: integration (+ negative) · **Gate**: full

---

### T6: `countActiveServicesByCategory` (services)

**What**: Contadores por categoria de serviços `ACTIVE` (A-06/N3), 1 query, sem N+1.
**Where**: `src/modules/services/queries/count-active-services-by-category.ts`, barrel.
**Depends on**: None
**Reuses**: `listServiceCategories` (nomes), `Service.categoryId`.
**Requirement**: PNL-03 (A-06)
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `countActiveServicesByCategory(): Promise<{ categoryId; name; count }[]>` via `groupBy(['categoryId'], where:{status:'ACTIVE'})` + merge com categorias (`take` na listagem de categorias já é 200).
- [ ] Sem N+1 (uma agregação); categorias sem serviço ativo → count 0 (ou omitidas — decidir no teste, coerente com o card).
- [ ] Barrel + integração verdes.
- [ ] Gate: `npm run test:integration`.

**Tests**: integration · **Gate**: full

---

### T7: `listRecentReferrals` (referrals)

**What**: Feed org-wide de encaminhamentos recentes (A-10/N6), `take 5`, sem PII sensível.
**Where**: `src/modules/referrals/queries/list-recent-referrals.ts`, barrel.
**Depends on**: None
**Reuses**: shape `PersonReferralRow` / `personReferralSelect`.
**Requirement**: PNL-05/06/07 (A-10)
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `listRecentReferrals(): Promise<RecentReferralRow[]>`, `orderBy createdAt desc`, `take 5`; `select` com título de vaga/empresa/nome referido/`result`/data — sem campo sensível de ficha.
- [ ] `result: null` representa "aguardando"; ordenação/`take` provados.
- [ ] Barrel + integração verdes.
- [ ] Gate: `npm run test:integration`.

**Tests**: integration · **Gate**: full

---

### T8: `countActivePersons` (reporting)

**What**: Count `Person.status = 'ATIVO'` para o KPI BOARD "pessoas ativas" (A-12/N7), PII-free.
**Where**: `src/modules/reporting/queries/count-active-persons.ts`, barrel.
**Depends on**: None
**Reuses**: padrão de `home-indicators.ts`.
**Requirement**: PNL-07 (A-12)
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `countActivePersons(): Promise<number>` via `person.count({ where: { status: 'ATIVO' } })`.
- [ ] Barrel + integração verdes.
- [ ] Gate: `npm run test:integration`.

**Tests**: integration · **Gate**: full

---

### T9: Helpers puros de derivação + ordenação [P]

**What**: `orderActiveRolePanels(roles, access)` (ordem `ALL_ROLE_LABELS`, A-17), `countQueueByKind(items)` (A-14), `deriveCandidateApplicationKpis(rows)` (total ativas / em análise = ativa ∧ `jobStatus=ACTIVE`, A-01), `countRecentWithin7Days(rows, now)` (A-15).
**Where**: `src/modules/identity/domain/dashboard-panels.ts` (ordenação) + derivações no módulo dono do dado (`jobs/domain/*`, `moderation/domain/*`). Testes por **import direto** do arquivo (não barrel — evitar queda de branch coverage, lição MEMORY).
**Depends on**: None
**Reuses**: `ALL_ROLE_LABELS`, `HubAccess`.
**Requirement**: PNL-00 (A-14/A-17), PNL-01 (A-01), PNL-02 (A-15)
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] Cada helper é puro (sem IO), com todas as ramificações testadas (papel composto, ordem, kind ausente, janela de 7 dias, `jobStatus` variando).
- [ ] Testes importam o arquivo diretamente (branch coverage preservada).
- [ ] Gate: `npm run test`.

**Tests**: unit · **Gate**: quick

---

### T10: Primitivas `KpiStrip` + `QuickActions` [P]

**What**: `KpiStrip`/`Kpi` (faixa de indicadores) e `QuickActions` (botões de ação rápida por papel) — tokens-only, Server.
**Where**: `src/app/(app)/inicio/_components/kpi-strip.tsx`, `.../quick-actions.tsx` (+ testes RTL).
**Depends on**: None
**Reuses**: `@/shared/ui` (`Button`, `cn`), `nav-icons` existente.
**Requirement**: PNL-00 · PNL-MN-08
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `KpiStrip({items})` renderiza label+valor+tone; `QuickActions({actions})` renderiza links/botões.
- [ ] RTL verde; **sem** hex/paleta fixa (PNL-MN-08).
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T11: Primitivas `DashboardCard` + `DashboardRow` + `CounterGrid` [P] [owns PNL-MN-07 render + A-11]

**What**: Card (header/corpo/rodapé com omissão de `footHref`), Row (mark/badge/meta/actions), CounterGrid (contadores clicáveis).
**Where**: `src/app/(app)/inicio/_components/dashboard-card.tsx`, `.../dashboard-row.tsx`, `.../counter-grid.tsx` (+ testes RTL).
**Depends on**: None
**Reuses**: `@/shared/ui` (`Card`, `Badge`, `cn`).
**Requirement**: PNL-00 (A-11) · **PNL-MN-07** · PNL-MN-08
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] `DashboardCard` omite o link quando `footHref` ausente (A-11) e mantém o contador; estado vazio renderiza "Nada por aqui ainda.".
- [ ] **Negative test (PNL-MN-07):** dado >5 linhas, o card renderiza no máximo 5 (ou recebe já cortado e nunca renderiza o 6º) — asserção de que nunca aparecem 6+ linhas.
- [ ] Sem hex/paleta fixa (PNL-MN-08).
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T12: Loader + bloco CANDIDATE [P]

**What**: `loadCandidatePanel(person)` (reusa `getHomeIndicators`, `searchJobs`, `listPersonApplications`+`jobStatus`, `getCandidateProfileStatus`; deriva KPIs via T9) + `CandidateBlock` apresentacional.
**Where**: `src/app/(app)/inicio/_loaders/candidate.ts`, `src/app/(app)/inicio/_components/candidate-block.tsx` (+ testes RTL com módulos mockados).
**Depends on**: T1, T3, T9, T10, T11
**Reuses**: `ApplyToJobButton`, `CancelApplicationButton` (ações existentes).
**Requirement**: PNL-01
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] KPIs: vagas abertas, minhas candidaturas, em análise, status do currículo (rotulado).
- [ ] Cards "Vagas que combinam" (≤5, ações ver/candidatar) e "Minhas candidaturas" (≤5, ações ver/retirar).
- [ ] Fallback por dimensão (try/catch) testado; RTL verde.
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T13: Loader + bloco PROVIDER [P]

**What**: `loadProviderPanel(person)` (`listProviderInterests` 1× para KPI-total+card, `listProviderServices`+`viewProviderServiceRow`, `getProviderProfileStatus`, derivação 7 dias T9) + `ProviderBlock`.
**Where**: `src/app/(app)/inicio/_loaders/provider.ts`, `.../_components/provider-block.tsx` (+ testes).
**Depends on**: T2, T9, T10, T11
**Reuses**: `viewClientForProvider` (já dentro de `listProviderInterests`), `submitServiceForModeration`.
**Requirement**: PNL-02 · **PNL-MN-06** (sem "marcar respondido")
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] KPIs: interessados, novos 7d, serviços publicados, status do perfil.
- [ ] Card "interessados" (≤5, ação ver detalhes → manifestações) **sem** "marcar respondido"; card "meus serviços" (≤5, editar/ver interessados/corrigir-reenviar).
- [ ] `listProviderInterests` chamado **1×** (não duplicar; audit-on-read); `ok:false` → card vazio.
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T14: Loader + bloco CLIENT [P]

**What**: `loadClientPanel(person)` (`searchServices` total, `listServiceCategories`, `countActiveServicesByCategory`, `listPersonServiceInterests`) + `ClientBlock` com `CounterGrid`.
**Where**: `src/app/(app)/inicio/_loaders/client.ts`, `.../_components/client-block.tsx` (+ testes).
**Depends on**: T6, T10, T11
**Reuses**: `manifestInterest` (solicitar novamente), rota `/servicos/[id]`.
**Requirement**: PNL-03
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] KPIs: serviços disponíveis, tipos de serviço, serviços solicitados (sem "em andamento", A-05).
- [ ] Card "prestadores por tipo de serviço" com contadores → `/servicos?categoria=<id>`; card "últimos solicitados" (≤5, ver/solicitar novamente).
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T15: Loader + bloco COMPANY_RESPONSIBLE [P] [owns PNL-MN-02 render]

**What**: `loadCompanyPanel(person)` (`listPersonCompanyGrants` → empresas ativas; `listCompanyJobs`+`viewCompanyJobRow`; `countCompanyApplications`; `listCompanyRecentApplications`) + `CompanyBlock`.
**Where**: `src/app/(app)/inicio/_loaders/company.ts`, `.../_components/company-block.tsx` (+ testes).
**Depends on**: T4, T5, T10, T11
**Reuses**: rota candidatos auditada `/empresa/[id]/vagas/[jobId]/candidatos`, `submitJobForModeration`.
**Requirement**: PNL-04 · **PNL-MN-02**
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] KPIs agregados sobre grants `RESPONSIBLE/ACTIVE`; sem empresa → estado vazio + atalho `/empresa/cadastrar`.
- [ ] Card "minhas vagas" (≤5, ver candidatos/editar/corrigir-reenviar); card "candidaturas recentes" **por vaga, sem nome/contato de candidato** — ação "ver candidatos" → rota auditada.
- [ ] **Negative test (PNL-MN-02):** dado um recent-app, o markup do card **não** contém nome/contato/CV de candidato.
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T16: Loader + bloco Institucional (COORDINATOR / SOCIAL_ASSISTANT / BOARD) [P] [owns PNL-MN-03]

**What**: `loadInstitutionalPanel(person, access)` (`viewModerationQueue`+`countQueueByKind`, `reportReferrals` janela do mês, `listRecentReferrals`, `countActivePersons`, `getHomeIndicators`) + `InstitutionalBlock` com gating read-only.
**Where**: `src/app/(app)/inicio/_loaders/institutional.ts`, `.../_components/institutional-block.tsx` (+ testes).
**Depends on**: T7, T8, T9, T10, T11
**Reuses**: `canAccessModerationQueue` (passada como flag pela página), rota `/moderacao`, `/encaminhamentos/[id]/resultado`.
**Requirement**: PNL-05, PNL-06, PNL-07 · **PNL-MN-03**
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] COORDINATOR/delegado (`canModerate=true`): card fila com ações navegacionais (→ `/moderacao`) + link "ver fila completa"; KPIs de fila derivados.
- [ ] SOCIAL_ASSISTANT/BOARD (`canModerate=false`): card fila **somente leitura** — sem botão de decisão e **sem** link para `/moderacao` (A-11).
- [ ] Encaminhamentos: ações (ver/registrar resultado) só para papéis com `REGISTER_REFERRAL_RESULT`; BOARD read-only.
- [ ] **Negative test (PNL-MN-03):** com `canModerate=false`, o markup não contém botão de decisão nem `href="/moderacao"`.
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T17: Reescrever `page.tsx` (composition-root) + migrar `page.test.tsx` [owns PNL-00, PNL-MN-04]

**What**: `(app)/inicio/page.tsx` vira o painel: resolve sessão + `access`, calcula papéis ativos na ordem `ALL_ROLE_LABELS` (T9), chama loaders em `Promise.all` com gate por flag, renderiza saudação + blocos. Migrar `page.test.tsx` (o contrato antigo de hub-de-atalhos é substituído — documentar como SPEC_DEVIATION justificado, não enfraquecimento).
**Where**: `src/app/(app)/inicio/page.tsx` (rewrite), `src/app/(app)/inicio/page.test.tsx` (migrate).
**Depends on**: T12, T13, T14, T15, T16
**Reuses**: `requireActivePerson`, `hubAccessFromRoles`, `canAccessModerationQueue`, `describeActiveRoles`.
**Requirement**: PNL-00 · **PNL-MN-04**
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] Papel composto → blocos na ordem `ALL_ROLE_LABELS`; papel-zero → saudação + conta sem quebrar (PNL-00-6).
- [ ] Bloco/card/ação só aparece se `access`/`canAccessModerationQueue` concede (PNL-MN-04); mantém `force-dynamic` e o próprio `<main>` (AD-027).
- [ ] `page.test.tsx` cobre composição por papel + gate + papel-zero; nenhum fact removido sem justificativa (P5).
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL) · **Gate**: quick

---

### T18: Testes negativos de privacidade no payload [owns PNL-MN-01, PNL-MN-02, PNL-MN-03]

**What**: Testes que renderizam a página/blocos por papel e afirmam que **nenhum campo restrito de terceiro** aparece no markup/payload (PNL-MN-01), que o card COMPANY não expõe identidade de candidato (PNL-MN-02), e que read-only não expõe ação/rota (PNL-MN-03).
**Where**: `src/app/(app)/inicio/__tests__/privacy.mn.test.tsx` (+ o que couber por bloco).
**Depends on**: T17
**Reuses**: fixtures dos blocos; padrão de asserção de ausência (`queryBy...().not.toBeInTheDocument()`, checagem de string no `container.innerHTML`).
**Requirement**: **PNL-MN-01, PNL-MN-02, PNL-MN-03**
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] PNL-MN-01: com dados de terceiro semeados, cpf/birthDate/fullAddress/contato de terceiro **não** aparecem no markup renderizado do painel (decoy killable — teste falha se o campo for injetado).
- [ ] PNL-MN-02: card COMPANY sem nome/contato/CV de candidato.
- [ ] PNL-MN-03: viewer sem `canAccessModerationQueue` não vê ação/rota de moderação.
- [ ] Gate: `npm run test`.

**Tests**: unit (RTL, negativos) · **Gate**: quick

---

### T19: Guards estáticos [owns PNL-MN-05, PNL-MN-06, PNL-MN-07, PNL-MN-08]

**What**: (a) estender o DS-tokens guard para `inicio/_components/**` + `_loaders/**` (PNL-MN-08); (b) guard "a página/loaders não importam `@/shared/lib/prisma` nem chamam Prisma direto — só barrels de módulo" (PNL-MN-05); (c) guard "queries novas N1..N8 são read-only" (só `findMany/findFirst/findUnique/count/groupBy`, nenhum `create/update/delete/$executeRaw`) + verificação de que **nenhum arquivo em `prisma/migrations/**` foi adicionado** por esta feature (PNL-MN-06); (d) reforço estático do teto ≤5 onde a constante `take`/slice é literal (PNL-MN-07).
**Where**: `src/app/(app)/inicio/__tests__/ds-tokens.guard.test.ts` (estender o existente ou novo), `.../__tests__/no-direct-prisma.guard.test.ts`, `.../__tests__/read-only-queries.guard.test.ts`.
**Depends on**: T17
**Reuses**: padrão do `ds-tokens.guard.test.ts` (USP-049) e dos guards estáticos recursivos da casca (USP-061).
**Requirement**: **PNL-MN-05, PNL-MN-06, PNL-MN-07, PNL-MN-08**
**Tools**: MCP NONE · Skill `skill-tdad`
**Done when**:
- [ ] DS guard cobre os arquivos novos (hex/paleta fixa = falha).
- [ ] Guard de Prisma: `page.tsx`/`_loaders/**` não contêm `from '@/shared/lib/prisma'` nem `prisma.` direto.
- [ ] Guard read-only: os arquivos N1..N8 não contêm verbo de escrita; `git diff --name-only origin/master... -- prisma/migrations` vazio (checar no DoD do PR).
- [ ] Gate: `npm run test` (e build no fim da fase).

**Tests**: unit (guards estáticos) · **Gate**: build

---

## Parallel Execution Map

```
Phase 1 (queries sequenciais — integração não paralela; T9 unit é [P]):
  T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8
  T9 [P] (a qualquer momento)

Phase 2 (unit, paralelo):
  ├── T10 [P]
  └── T11 [P]

Phase 3 (unit, paralelo — dependem de Phase 1+2):
  ├── T12 [P]  (T1,T3,T9,T10,T11)
  ├── T13 [P]  (T2,T9,T10,T11)
  ├── T14 [P]  (T6,T10,T11)
  ├── T15 [P]  (T4,T5,T10,T11)
  └── T16 [P]  (T7,T8,T9,T10,T11)

Phase 4 (sequencial):
  T17 → T18 → T19
```

**Parallelism constraint:** tasks de query (T1–T8) carregam testes de **integração** (Parallel-Safe: **No**) → executam **sequencialmente** mesmo sem dependência de código. T9–T19 são unit (Parallel-Safe: Yes); os `[P]` marcam ausência de dependência inter-task dentro da fase.

---

## Task Granularity Check

| Task | Escopo | Status |
| ---- | ------ | ------ |
| T1–T2 | 1 query + 1 mapa (coeso) | ✅ Granular |
| T3 | 1 modificação de query | ✅ Granular |
| T4–T8 | 1 query cada | ✅ Granular |
| T9 | helpers puros coesos (derivações) | ✅ OK (coeso, mesmo tema) |
| T10–T11 | 2–3 primitivas coesas por arquivo-tema | ✅ OK (coeso) |
| T12–T16 | 1 loader + 1 bloco por papel (coeso) | ✅ OK (par loader/apresentação) |
| T17 | 1 página (rewrite) + seu teste | ✅ Granular |
| T18 | 1 suíte de must-not de payload | ✅ Granular |
| T19 | guards estáticos coesos | ✅ OK (coeso) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
| ---- | ----------------- | ------- | ------ |
| T1–T8 | None (sequenciados por integração) | cadeia T1→…→T8 | ✅ Match (ordem por parallel-safety, não dependência de código) |
| T9 | None | [P] | ✅ Match |
| T10, T11 | None | [P] Phase 2 | ✅ Match |
| T12 | T1,T3,T9,T10,T11 | Phase 3 [P] | ✅ Match |
| T13 | T2,T9,T10,T11 | Phase 3 [P] | ✅ Match |
| T14 | T6,T10,T11 | Phase 3 [P] | ✅ Match |
| T15 | T4,T5,T10,T11 | Phase 3 [P] | ✅ Match |
| T16 | T7,T8,T9,T10,T11 | Phase 3 [P] | ✅ Match |
| T17 | T12–T16 | Phase 4 | ✅ Match |
| T18 | T17 | Phase 4 | ✅ Match |
| T19 | T17 | Phase 4 | ✅ Match |

> Nota: T1–T8 aparecem encadeados no diagrama por **execução** (integração sequencial), não por dependência de código — nenhuma delas importa a outra. Isso é a constraint de parallelism, explicitada acima.

---

## Test Co-location Validation

| Task | Layer criado/modificado | Matriz exige | Task diz | Status |
| ---- | ----------------------- | ------------ | -------- | ------ |
| T1,T2 | query + mapa domain | integration + unit | integration+unit | ✅ OK |
| T3 | query (modify) | integration | integration | ✅ OK |
| T4–T8 | query | integration | integration | ✅ OK |
| T9 | helper puro (domain) | unit | unit | ✅ OK |
| T10,T11 | componente `_components` | unit (RTL) | unit | ✅ OK |
| T12–T16 | loader + bloco | unit (RTL, módulos mockados) | unit | ✅ OK |
| T17 | page | unit (RTL) | unit | ✅ OK |
| T18 | must-not payload | unit (RTL negativo) | unit | ✅ OK |
| T19 | guard estático | unit | unit | ✅ OK |

> Loaders (T12–T16) chamam queries reais em produção, mas sua **orquestração** (fallback/gating/derivação) é unit-testável com os módulos mockados (padrão do `page.test.tsx` existente). A correção de `where`/`select`/`take` das queries é coberta pela integração da Phase 1 — sem deferimento de teste.

---

## 💠 Must-Not Ownership

| Must-Not | Owning task(s) | Negative test |
| -------- | -------------- | ------------- |
| PNL-MN-01 (sem PII de terceiro no payload) | T18 (primário); reforçado por T13/T15 (View Models) | `privacy.mn.test.tsx`: campo restrito de terceiro ausente do markup |
| PNL-MN-02 (card COMPANY sem identidade de candidato) | T5 (`select` sem candidato) + T15 (render) + T18 | int-test do `select` + RTL do card + payload |
| PNL-MN-03 (read-only sem ação/rota de moderação) | T16 (gating) + T18 | RTL com `canModerate=false` |
| PNL-MN-04 (bloco/card/ação gated por acesso) | T17 (página) + T11 (omissão de `footHref`) | RTL de gate de acesso + card sem link |
| PNL-MN-05 (sem Prisma direto em app/; leitura só em queries de módulo) | T19 (guard) | `no-direct-prisma.guard.test.ts` |
| PNL-MN-06 (sem migração/estado/mutação nova) | T19 (guard read-only + check de `prisma/migrations`) + T13 (sem "marcar respondido") | `read-only-queries.guard.test.ts` + DoD |
| PNL-MN-07 (≤5 + take) | T11 (render ≤5) + T5/T6/T7 (`take` nas queries) | RTL de >5 → 5; int-test de `take` |
| PNL-MN-08 (tokens-only) | T19 (DS guard) + T10/T11 | `ds-tokens.guard.test.ts` estendido |

Todos os 8 must-nots têm task dona e teste negativo. ✅ Nenhum órfão.

---

## Tools / MCPs / Skills (por task)

- **MCP:** NONE (filesystem local). Context7 disponível se surgir dúvida de API de lib (não previsto — reuso interno).
- **Skill:** `skill-tdad` em toda task com testes (gera os facts: `.feature` PT-BR + specs Vitest red + matriz AC→teste antes de implementar); `bravi-spec-driven` orquestra o Execute.
- **Verifier:** ao final da última task, o pipeline dispara o Verifier independente automaticamente (author ≠ verifier) — spec-anchored + discrimination sensor + must-not verification (os 8 PNL-MN).

---

## Notas para o Implementer (riscos herdados do design)

1. **Coverage de branch (lição MEMORY `coverage-gate-branch-loading-drop`):** teste helpers puros por **import direto do arquivo**, não do barrel — importar barrel puxa módulos não-medidos ao grafo v8 e derruba o branch global <65%. As queries novas (medidas) precisam de ramificações cobertas (caminho vazio/erro).
2. **`listProviderInterests` audita on-read** — chame **1×** por render (serve KPI-total + card); não duplique. Trate `ok:false` como card vazio.
3. **Não tocar a casca** — diff restrito a `(app)/inicio/**` (+ as queries/domain novos em `src/modules/**` e a extensão de `listPersonApplications`). Os guards recursivos de `(app)/_components/**` (USP-061) não devem acusar mudança.
4. **`page.test.tsx` muda de contrato** — o hub-de-atalhos vira painel; documente a substituição como SPEC_DEVIATION justificado (não enfraquecimento — a capacidade de navegação segue via casca/sidebar).
5. **Zero migração** — se alguma leitura parecer exigir coluna nova, PARE: é sinal de que caiu num item de *Out of Scope* (ex.: estado "respondido"/"em análise" real). Reconcilie via os helpers/derivações (A-01/A-05/A-15), não via schema.
6. **>3 fases** → o Execute oferece 1 worker por fase (offer-then-confirm). Phase 1 é sequencial (integração); Phases 2–3 paralelizáveis em unit.
