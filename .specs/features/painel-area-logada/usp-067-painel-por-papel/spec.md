# USP-067 — Painel `/inicio` por papel (indicadores, ações rápidas, cards de listas) — Specification

## Fonte da verdade upstream (adapt, don't re-derive)

Esta spec **indexa** os artefatos upstream; não os reescreve:

- **ROADMAP § Fase 11** (`.specs/project/ROADMAP.md`, seção "Painel da área logada") — **escopo normativo**: a tabela *Escopo por papel* (indicadores + cards dos 7 papéis), as notas de privacidade e as decisões de dono D-001/D-002. A tabela manda; onde esta spec diverge dela, é por reconciliação com o que o backend das Fases 1-8 realmente entrega (registrado em *Assumptions*).
- **Protótipo visual** `docs/prototipo/painel.html` (aprovado pelo dono, 7 variações de papel, desktop + mobile) — **fonte visual** (como `index.html` foi da Fase 7). Estrutura: saudação → ações rápidas → faixa de indicadores (KPIs) → grid de cards de lista. Cada linha de card tem badge + meta + botões de ação rápida; cada card tem rodapé "ver lista completa" com contador "5 de N".
- **ADR-0008** (papéis compostos), **ADR-0010** (visibilidade conservadora / View Models), **ADR-0030** (revalidação de sessão), **CLAUDE.md** (View Models, sequência de Server Action, import por barrel), **project-guideline §5/§12/§18/§20** (P1-P5, DoD).
- **AD-027/AD-028** (casca `(app)`: `AppShell` + sidebar colapsável + `ProfileMenu`; a página provê o próprio `<main>`), **AD-030/AD-031** (conteúdo de moderação servido sob demanda; alcance do moderador escopado à fila; leitura depois do `requirePermission`; PII nunca no payload Flight).

**IDs canônicos:** o upstream (ROADMAP/PRD) não numera critérios desta USP net-new; os IDs locais `PNL-*` abaixo são adições locais desta feature.

---

## Problem Statement

Hoje `/inicio` (USP-049) é um **índice de atalhos**: `buildHubLinks` devolve grupos de links e nada mais. Depois das Fases 1-10 todo o dado que importa já existe no backend (candidaturas, manifestações, fila de moderação, encaminhamentos, indicadores), mas a primeira tela pós-login não mostra nenhum — a Pessoa precisa navegar até a área do papel para descobrir se algo aconteceu. Esta USP transforma `/inicio` num **painel de trabalho**: cada papel abre o portal já vendo seus indicadores, ações rápidas e cards de listas, com ação direta a partir da tela.

## Goals

- [ ] `/inicio` renderiza, **por papel ativo**, uma faixa de indicadores (KPIs), um bloco de ações rápidas e cards de listas — dentro da casca `(app)` existente, sem mudar o Design System.
- [ ] Regra transversal cumprida: toda lista mostra **no máximo 5 registros**, cada registro tem **botões de ação rápida**, e o card tem link **"ver lista completa"** para a rota já existente (quando a rota-alvo existe e é acessível).
- [ ] Pessoa com papéis compostos (ADR-0008) vê os blocos de **todos** os seus papéis ativos, na ordem de `ALL_ROLE_LABELS`.
- [ ] **Privacidade preservada:** nenhum dado de uma Pessoa vaza para outra no payload da página; cross-role só via View Models existentes; campo restrito nunca entra no `select`.
- [ ] **Zero migração, zero novo estado de domínio, zero nova mutação** — leituras novas vivem em `queries/` dos módulos donos; ações rápidas reusam Server Actions/rotas já entregues.

## Out of Scope

| Item | Motivo |
| ---- | ------ |
| Novo estado "respondido" em `ServiceInterest` (ação "marcar respondido" do protótipo PROVIDER) | Requer migração + nova mutação + evento de auditoria + ADR — novo conceito de domínio, não de tela. PNL-MN-06. Substituída pela ação navegacional existente. |
| Status "em análise" por candidatura / KPI "candidatos ativos" com semântica de triagem | `Application` não tem coluna de status (só `cancelledAt`); triagem de candidato pelo empregador não existe no MVP. Reconciliado (ver Assumptions A-01, A-08). |
| Estado "em andamento" de serviço solicitado (KPI CLIENT) | `ServiceInterest` só tem ativo/cancelado; não há conceito de progresso. Reconciliado (A-05). |
| Contadores de candidatos por empresa/vaga com identidade do candidato no painel | Renderizar PII de candidato no `/inicio` viola ADR-0010/RSC-Flight e a auditoria on-read. Card COMPANY mostra sinal por vaga, sem identidade (PNL-MN-02). |
| Nova rota de "meus pedidos" (CLIENT), "minhas candidaturas" (CANDIDATE) e lista/detalhe de encaminhamentos | O painel só **linka** para rotas existentes; criar telas novas de lista é outra USP. Onde a rota-alvo não existe, o card omite o link "ver lista completa" (A-11). |
| Conceder `MODERATE_*` a `SOCIAL_ASSISTANT`/`BOARD` | Mudança de política de acesso (D-001) — exige ADR. Premissa adotada: fila **somente leitura** para esses papéis. |
| Ação inline de decisão de moderação/aprovação no painel | Aprovar exige o fluxo `openModerationContent → approve` (USP-066/AD-031), pesado demais para o render do painel. Ações da fila no painel são navegacionais (→ `/moderacao`). A-09. |
| E2E autenticado dos fluxos do painel | Precedente L-007/AD-025/AD-027 (E2E autenticado deferido); cobertura por RTL + guards estáticos + testes de integração das queries. |
| Persistência de estado do painel (filtros, ordenação, "marcar como visto") | Painel é leitura + navegação; sem estado próprio no MVP. |
| Alterar `buildHubLinks`/casca/sidebar/`ProfileMenu` | Casca é AD-027/AD-028; esta USP muda **só** o conteúdo de `(app)/inicio/page.tsx` e adiciona componentes em `(app)/inicio/_components/`. |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada. Modo autônomo: ambiguidades viram **premissa de spec** (owner `agent`), sem gate de confirmação.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
|---|----------------------|-------|----------------|-----------|------------|
| **D-001** | Fila de moderação para `SOCIAL_ASSISTANT` e `BOARD` | user (dono) | Esses papéis veem **contador + fila somente leitura** (top-5), **sem** botão de decisão; card só ganha ações para quem passa em `canAccessModerationQueue`. | Premissa já adotada no ROADMAP e confirmada pelas notas de RBAC do próprio protótipo (`SOCIAL_ASSISTANT`/`BOARD` não têm `MODERATE_*` em `ROLE_PERMISSIONS`). Conceder a permissão seria mudança de política (ADR), fora de escopo. | y (adotada) |
| **D-002** | Fase 11 é pré ou pós go-live | user (dono) | Não afeta a implementação — decisão de sequenciamento de lançamento. | Confirmado pelo próprio ROADMAP/briefing: "não afeta a implementação". | y (irrelevante p/ dev) |
| A-01 | KPI CANDIDATE "em análise" | agent | = candidaturas **ativas cuja vaga ainda está `ACTIVE`** (ainda em consideração). Derivado estendendo o `select` de `listPersonApplications` para incluir `job.status` — sem coluna nova. | `Application` não tem status de triagem; esta é a leitura fiel e barata mais próxima do intent do protótipo. Se o dono quiser triagem real, é outra frente (ADR). | y (premissa) |
| A-02 | KPI CANDIDATE "vagas abertas no portal" | agent | `getHomeIndicators().activeJobs` (count `Job.status=ACTIVE`, PII-free). | Reuso direto do indicador da home (USP-041). | y |
| A-03 | Card CANDIDATE "vagas que combinam" | agent | `searchJobs({ areaId: <área primária do CV>, page:1 }, viewer=person)` top-5; sem área no CV → `searchJobs({ page:1 }, person)` mais recentes. Sem ranking multi-área (não existe). | `searchJobs` já filtra por 1 `areaId` (igualdade) e anonimiza por viewer; ranking multi-área é GAP não modelado. | y |
| A-04 | KPI/estado "status do currículo" e "status do perfil" | agent | Ler `CandidateProfile.publicationStatus` / `ProviderProfile.publicationStatus` via **query fina nova** no módulo dono (`persons`), com mapa de rótulo PT-BR. | Hoje lido inline nas páginas; não há query/VM exportada. Query fina, sem migração. | y |
| A-05 | KPIs CLIENT ("prestadores disponíveis", "em andamento") | agent | "prestadores disponíveis" → count de **serviços ativos** via `searchServices({}, viewer).total` (proxy, rótulo "Serviços disponíveis"). "em andamento" → **omitido** (não há estado de progresso). "tipos de serviço" → `listServiceCategories().length`. "serviços solicitados" → count ativo de `listPersonServiceInterests`. | Distinct-provider count e estado de progresso não existem; o proxy é honesto e barato. | y |
| A-06 | Card CLIENT "prestadores por tipo de serviço" (contadores) | agent | **Query fina nova** `countActiveServicesByCategory()` em `services` (`groupBy categoryId` sobre `status=ACTIVE`, join categorias), 1 query, sem N+1. Cada contador → `/servicos?categoria=<id>`. | É o card-âncora do papel CLIENT; per-category count batched não existe. | y |
| A-07 | KPIs COMPANY "candidatos aplicados/ativos" | agent | **Query fina nova** `countCompanyApplications(companyId)` em `jobs` → `{ total, active }` (count-only, sem PII). "vagas criadas/em aberto" derivadas de `listCompanyJobs`. Múltiplas empresas do responsável → agrega sobre os grants `ACTIVE/RESPONSIBLE` (`listPersonCompanyGrants`). | Não há agregado por empresa; count-only evita N+1 e não toca PII. | y |
| A-08 | Card COMPANY "candidaturas recentes" | agent | **Query fina nova** `listCompanyRecentApplications(companyId)` → linhas **por vaga** `{ jobId, jobTitle, appliedAt }` **sem identidade do candidato**; ação "ver candidatos" navega à superfície auditada existente `/empresa/[id]/vagas/[jobId]/candidatos`. | Renderizar nome/contato de candidato no painel violaria ADR-0010/RSC-Flight e puularia a auditoria on-read do `listJobApplicants`. PNL-MN-02. | y |
| A-09 | Ações do card "fila de moderação" (COORDINATOR + delegados) | agent | Ações **navegacionais** para `/moderacao` (revisar/aprovar/validar re-checam permissão lá); **sem decisão inline** no painel. | Aprovar inline exige `openModerationContent → approve` (USP-066/AD-031), pesado no render do painel. | y |
| A-10 | Card "encaminhamentos recentes" (COORDINATOR/AS/BOARD) | agent | **Query fina nova** `listRecentReferrals()` em `referrals` (org-wide, `orderBy createdAt desc`, `take 5`, reusa a shape `PersonReferralRow`). Ação "registrar resultado" → `/encaminhamentos/[id]/resultado` (só para papéis com `REGISTER_REFERRAL_RESULT`); BOARD não vê ações (read-only). | Só existe `listPersonReferrals(personId)` (por pessoa referida); o card precisa de feed org-wide recente. | y |
| A-11 | Link "ver lista completa" quando a rota-alvo não existe ou é inacessível | agent | **Omitir** o link (mantendo o contador "5 de N"). Nunca linkar a rota inexistente (`/minhas-candidaturas`, `/encaminhamentos` lista) nem a rota gated que a Pessoa não abre (ex.: `/moderacao` para AS/BOARD). | ROADMAP: "o painel não pode expor um card cuja rota-alvo a Pessoa não poderia abrir". PNL-MN-04. | y |
| A-12 | KPI BOARD "pessoas ativas" e "empresas ativas" | agent | "empresas ativas" → `getHomeIndicators().verifiedCompanies`. "pessoas ativas" → **query fina nova** de count `Person.status=ATIVO` (o `activeCandidates` da home conta perfis de candidato, não Pessoas). | Faithful ao intent ("pessoas ativas"); count-only, PII-free. | y |
| A-13 | KPI SOCIAL_ASSISTANT "cadastros assistidos no mês" | agent | **Omitido** no MVP (sem query de count; exigiria agregação sobre `audit_log` do evento de cadastro assistido). Os outros 3 KPIs do papel são servidos. | Manter escopo enxuto; count sobre auditoria é frente própria. Documentado como GAP conhecido. | y |
| A-14 | KPIs de moderação (pendentes/vagas na fila/currículos na fila) | agent | Derivados das **linhas de `viewModerationQueue`** já carregadas para o card (total + por `contentKind`), não de `reportModerationQueue` (que usa conjunto de status mais amplo e conta CV/perfil do fixture — mismatch). | O card já carrega a fila; os contadores saem de graça e batem exatamente com a fila exibida. | y |
| A-15 | "novos em 7 dias" (PROVIDER) | agent | Derivado das linhas retornadas por `listProviderInterests` (top-20, `interestedAt desc`) contando `interestedAt >= agora−7d`. Sinal de painel (limitado à página), não total absoluto. | Não há count por janela; a derivação é honesta como sinal e evita 2ª query. Rótulo deixa claro que é recente. | y |
| A-16 | Composição da página / raiz de composição | agent | A **página** (`(app)/inicio/page.tsx`) é a **raiz de composição** (padrão USP-039): resolve sessão + `access`, e para cada papel ativo chama os loaders (barrels dos módulos donos) e passa dados prontos aos blocos apresentacionais. Blocos/loaders **não** fazem Prisma direto nem cross-import de barrels server-only no client. | Precedente `visao-consolidada` (AD-019/AD-022) evita ciclo de import; casca já usa o mesmo trecho `access/groups`. | y |
| A-17 | Ordem dos blocos para papéis compostos | agent | Ordem das chaves de `ALL_ROLE_LABELS` (CANDIDATE, PROVIDER, CLIENT, COMPANY_RESPONSIBLE, VOLUNTEER, COORDINATOR, SOCIAL_ASSISTANT, BOARD). VOLUNTEER não tem bloco próprio (acesso é só por delegação → aparece via `canAccessModerationQueue`, dentro do bloco institucional). | ROADMAP exige ordem de `ALL_ROLE_LABELS`; VOLUNTEER puro não tem escopo na tabela. | y |
| A-18 | Contadores dos KPIs abaixo do piso de exibição | agent | KPIs **não** aplicam o piso "Em breve <5" da home (`applyMinimumDisplay`) — o painel é privado (dados do próprio usuário/operacionais), não a home pública anônima. Exibem o valor corrente. | O piso MP existe para não expor números pequenos publicamente; no painel logado não se aplica. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

> Todos os papéis do ROADMAP são **P1** — a tabela *Escopo por papel* é normativa e cada papel é um vertical slice demo-ável independentemente (basta logar com um seed daquele papel). A US P1.0 é o arcabouço transversal do painel; P1.1–P1.7 são os blocos por papel.

### P1.0: Arcabouço do painel (transversal) ⭐ MVP

**User Story**: Como Pessoa autenticada, quero que `/inicio` seja um painel com meus indicadores, ações rápidas e cards de listas — em vez de só atalhos — para trabalhar direto da primeira tela.

**Why P1**: É o núcleo da USP; todos os blocos por papel se compõem sobre ele.

**Acceptance Criteria**:

1. WHEN uma Pessoa ativa abre `/inicio` THEN o sistema SHALL renderizar uma saudação com o primeiro nome, e — por papel ativo — um bloco de ações rápidas, uma faixa de indicadores (KPIs) e um grid de cards, dentro da casca `(app)` (a página provê seu próprio `<main>`, AD-027).
2. WHEN a Pessoa tem papéis compostos (ADR-0008) THEN o sistema SHALL renderizar os blocos de **todos** os papéis ativos, na ordem das chaves de `ALL_ROLE_LABELS`.
3. WHEN um card exibe uma lista THEN o sistema SHALL renderizar **no máximo 5 registros**, cada um com botões de ação rápida, e um rodapé com contador "N de M".
4. WHEN a rota-alvo de "ver lista completa" existe **e** é acessível à Pessoa THEN o card SHALL exibir o link "ver lista completa" apontando para ela; caso contrário SHALL **omitir** o link (mantendo o contador).
5. WHEN um bloco/card/ação de um papel institucional depende de acesso THEN sua visibilidade SHALL derivar exatamente das flags `hubAccessFromRoles` + `canAccessModerationQueue` (mesma fonte de `buildHubLinks`), nunca de leitura ad-hoc que a rota-alvo negaria.
6. WHEN uma Pessoa ativa sem nenhum papel público/institucional abre `/inicio` THEN o sistema SHALL ainda renderizar a saudação e um estado coerente (ao menos os atalhos pessoais/ações de conta), sem erro e sem bloco vazio quebrado.
7. WHEN qualquer leitura do painel falha (DB indisponível/erro) THEN o bloco afetado SHALL degradar graciosamente (estado vazio/rótulo neutro), sem derrubar a página inteira.

**Independent Test**: logar com um seed multi-papel e ver os blocos na ordem de `ALL_ROLE_LABELS`, cada lista com ≤5 linhas e rodapé; logar com Pessoa sem papel e ver a saudação + conta.

---

### P1.1: Bloco CANDIDATE ⭐ MVP

**Acceptance Criteria**:

1. WHEN um CANDIDATE ativo abre `/inicio` THEN os KPIs SHALL ser: vagas abertas no portal (`getHomeIndicators().activeJobs`), minhas candidaturas (ativas), em análise (ativas com vaga `ACTIVE` — A-01), status do currículo (`CandidateProfile.publicationStatus` rotulado).
2. WHEN o card "Vagas que combinam" é renderizado THEN SHALL listar top-5 de `searchJobs({areaId: <área do CV>?}, viewer=person)`, cada linha com ações "Ver detalhes" (`/vagas/[id]`) e "Candidatar-se" (`applyToJob`/`ApplyToJobButton`).
3. WHEN o card "Minhas candidaturas" é renderizado THEN SHALL listar top-5 de `listPersonApplications(person.id)`, cada linha com "Ver detalhes" (`/vagas/[id]`) e "Retirar candidatura" (`cancelApplication`/`CancelApplicationButton`).

**Independent Test**: logar candidato do seed; ver 4 KPIs, 2 cards com ≤5 linhas e as ações certas.

---

### P1.2: Bloco PROVIDER ⭐ MVP

**Acceptance Criteria**:

1. WHEN um PROVIDER ativo abre `/inicio` THEN os KPIs SHALL ser: interessados (total de `listProviderInterests`), novos em 7 dias (derivado — A-15), serviços publicados (ACTIVE de `listProviderServices`), status do perfil (`ProviderProfile.publicationStatus`).
2. WHEN o card "Pessoas interessadas em contratar você" é renderizado THEN SHALL listar top-5 de `listProviderInterests(person)` via `viewClientForProvider` (contato do cliente exposto conforme a fronteira já existente), cada linha com ação "Ver detalhes" (`/prestador/manifestacoes`). **Sem** ação "marcar respondido" (PNL-MN-06 — estado inexistente).
3. WHEN o card "Meus serviços" é renderizado THEN SHALL listar top-5 de `listProviderServices(person.id)` via `viewProviderServiceRow` (título + badge de status), com ações "Editar" (`/prestador/servicos/[id]/editar`), "Ver interessados" (`/prestador/manifestacoes`) e, para itens em ajustes, "Corrigir e reenviar" (`submitServiceForModeration`).

---

### P1.3: Bloco CLIENT ⭐ MVP

**Acceptance Criteria**:

1. WHEN um CLIENT ativo abre `/inicio` THEN os KPIs SHALL ser: serviços disponíveis (`searchServices({}, viewer).total` — A-05), tipos de serviço (`listServiceCategories().length`), serviços solicitados (ativos de `listPersonServiceInterests`). O KPI "em andamento" SHALL ser omitido (A-05).
2. WHEN o card "Prestadores por tipo de serviço" é renderizado THEN SHALL exibir contadores por categoria de `countActiveServicesByCategory()` (A-06), cada contador linkando `/servicos?categoria=<id>`.
3. WHEN o card "Últimos serviços solicitados" é renderizado THEN SHALL listar top-5 de `listPersonServiceInterests(person.id)`, cada linha com "Ver detalhes" (`/servicos/[id]`) e "Solicitar novamente" (`manifestInterest`). "Contatar" navega a `/servicos/[id]` (onde a revelação de contato já existe).

---

### P1.4: Bloco COMPANY_RESPONSIBLE ⭐ MVP

**Acceptance Criteria**:

1. WHEN um COMPANY_RESPONSIBLE ativo abre `/inicio` THEN os KPIs SHALL ser: vagas criadas e vagas em aberto (de `listCompanyJobs` agregado sobre os grants `ACTIVE/RESPONSIBLE`), candidatos aplicados e candidatos ativos (de `countCompanyApplications` — A-07).
2. WHEN o card "Minhas vagas" é renderizado THEN SHALL listar top-5 de `listCompanyJobs(companyId)` via `viewCompanyJobRow`, com ações "Ver candidatos" (`/empresa/[id]/vagas/[jobId]/candidatos`), "Editar" e, para itens em ajustes, "Corrigir e reenviar" (`submitJobForModeration`).
3. WHEN o card "Candidaturas recentes" é renderizado THEN SHALL listar top-5 de `listCompanyRecentApplications(companyId)` **por vaga, sem identidade do candidato** (A-08 / PNL-MN-02), com ação "Ver candidatos" → superfície auditada `/empresa/[id]/vagas/[jobId]/candidatos`.
4. WHEN o responsável não tem nenhuma empresa ativa (grant `RESPONSIBLE/ACTIVE`) THEN o bloco SHALL degradar para estado vazio + atalho "cadastrar empresa" (`/empresa/cadastrar`), sem erro.

---

### P1.5: Bloco COORDINATOR ⭐ MVP

**Acceptance Criteria**:

1. WHEN um COORDINATOR (ou delegado que passa em `canAccessModerationQueue`) abre `/inicio` THEN os KPIs SHALL ser: moderações pendentes, vagas na fila, currículos na fila (derivados das linhas de `viewModerationQueue` — A-14) e encaminhamentos no mês (`reportReferrals({janela do mês}).totalCreated`).
2. WHEN o card "Fila de moderação" é renderizado THEN SHALL listar top-5 de `viewModerationQueue({viewerPersonId: person.id})`, cada linha com ações navegacionais "Revisar"/"Aprovar" (e "Validar empresa" quando `companyUnverified`), todas apontando para `/moderacao` (A-09), com "ver fila completa" → `/moderacao`.
3. WHEN o card "Encaminhamentos recentes" é renderizado THEN SHALL listar top-5 de `listRecentReferrals()`, cada linha com "Ver detalhes" e "Registrar resultado" (`/encaminhamentos/[id]/resultado`).

---

### P1.6: Bloco SOCIAL_ASSISTANT ⭐ MVP (fila somente leitura — D-001)

**Acceptance Criteria**:

1. WHEN um SOCIAL_ASSISTANT ativo abre `/inicio` THEN os KPIs SHALL ser: encaminhamentos no mês, aguardando resultado (`reportReferrals.outcome.withoutResult`), e moderações pendentes (leitura — contador de `viewModerationQueue`). O KPI "cadastros assistidos no mês" SHALL ser omitido (A-13).
2. WHEN o card "Encaminhamentos recentes" é renderizado THEN SHALL listar top-5 de `listRecentReferrals()` **com** ações (ver detalhes, registrar resultado — o papel tem `REGISTER_REFERRAL_RESULT`).
3. WHEN o card "Fila de moderação" é renderizado para SOCIAL_ASSISTANT THEN SHALL exibir top-5 de `viewModerationQueue` **somente leitura** — nenhum botão de decisão e **sem** link "ver fila completa" para `/moderacao` (rota gated que o papel não abre — A-11 / PNL-MN-03).

---

### P1.7: Bloco BOARD ⭐ MVP (tudo somente leitura — D-001)

**Acceptance Criteria**:

1. WHEN um BOARD ativo abre `/inicio` THEN os KPIs SHALL ser: moderações pendentes (contador de `viewModerationQueue`), encaminhamentos no mês (`reportReferrals` — BOARD autorizado), pessoas ativas (count `Person.status=ATIVO` — A-12), empresas ativas (`getHomeIndicators().verifiedCompanies`).
2. WHEN os cards "Fila de moderação" e "Encaminhamentos recentes" são renderizados para BOARD THEN ambos SHALL ser **somente leitura**: nenhum botão de decisão de moderação e nenhuma ação de encaminhamento (BOARD não tem `REFER_*`/`REGISTER_*`); links "ver lista completa" só quando a rota-alvo é acessível (A-11).

---

## Edge Cases

- WHEN um card não tem registros THEN SHALL exibir estado vazio ("Nada por aqui ainda."), não sumir nem quebrar o grid.
- WHEN o CANDIDATE não tem `CandidateProfile` (ou sem área) THEN "status do currículo" mostra rótulo de rascunho/ausente e "Vagas que combinam" cai para vagas recentes gerais.
- WHEN o COMPANY_RESPONSIBLE tem múltiplas empresas ativas THEN os KPIs agregam sobre todas e os cards linkam por vaga (cada vaga carrega seu `empresaId`).
- WHEN uma leitura de módulo lança/erra THEN o loader daquele bloco retorna vazio/neutro (try/catch → fallback, espelhando `loadIndicators` da home) e os demais blocos seguem.
- WHEN a Pessoa é VOLUNTEER puro com delegação de moderação THEN não há bloco "VOLUNTEER" próprio; o card de fila aparece via `canAccessModerationQueue` **com** ações (A-17).

---

## Must-Nots (world-level prohibitions)

Cada must-not exige um teste negativo que afirma que o resultado proibido não ocorre (ver validate.md §6b).

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| -- | -------------------------------------- | -------- | ----------- | ------------- |
| PNL-MN-01 | WHEN o painel renderiza dado de uma Pessoa para outra THEN SHALL NOT incluir no payload da página (HTML/Flight/JSON) qualquer campo restrito de terceiro (candidato: cpf/birthDate/fullAddress; cliente: cpf/birthDate/fullAddress) — cross-role só via `viewCandidateForEmployer`/`viewClientForProvider`, e o campo restrito **nunca entra no `select`**. | Vazamento de PII no payload RSC/Flight (lição "anonimizar no View Model não basta"). | (Tasks) | (Tasks) |
| PNL-MN-02 | WHEN o card "Candidaturas recentes" do COMPANY_RESPONSIBLE renderiza THEN SHALL NOT expor identidade/PII do candidato (nome/contato/CV) no `/inicio`; identidade só na superfície auditada por vaga. | PII de candidato no Flight de cada carga do painel + bypass da auditoria on-read (`SENSITIVE_FIELD_VIEWED`). | (Tasks) | (Tasks) |
| PNL-MN-03 | WHEN o viewer **não** passa em `canAccessModerationQueue` (ex.: SOCIAL_ASSISTANT/BOARD) THEN o card de fila SHALL NOT renderizar botão de decisão (revisar/aprovar/validar/reprovar) nem link para `/moderacao`. | Exposição de ação/rota de moderação sem permissão (D-001). | (Tasks) | (Tasks) |
| PNL-MN-04 | WHEN um bloco/card/ação/quick-action é candidato a render THEN SHALL NOT aparecer se a rota-alvo não existe ou a Pessoa não poderia abri-la; visibilidade deriva de `hubAccessFromRoles`/`canAccessModerationQueue`. | Becos sem saída (404/forbidden) e dicas de privilégio. | (Tasks) | (Tasks) |
| PNL-MN-05 | WHEN o painel busca dados THEN `(app)/inicio/page.tsx` (e componentes) SHALL NOT consultar Prisma diretamente para mostrar dado de uma Pessoa a outra; toda leitura vive em `queries/` do módulo dono e cross-role passa por View Model. | Drift de arquitetura + bypass de privacidade (P2/ADR-0010/CLAUDE.md). | (Tasks) | (Tasks) |
| PNL-MN-06 | WHEN a feature é implementada THEN SHALL NOT introduzir migração Prisma, novo estado de domínio ou nova mutação; ações rápidas reusam apenas Server Actions/rotas existentes. | Scope creep em novo conceito de domínio (ex.: "marcar respondido") sem ADR. | (Tasks) | (Tasks) |
| PNL-MN-07 | WHEN qualquer card renderiza uma lista THEN SHALL NOT exibir mais de 5 registros, e toda leitura subjacente SHALL usar `take`. | Leitura ilimitada / N+1 / payload inflado. | (Tasks) | (Tasks) |
| PNL-MN-08 | WHEN os componentes novos do painel são escritos THEN SHALL NOT usar hex cru nem utilitário Tailwind de paleta fixa (estende DS-MN-01). | Deriva do Design System (a casca é AD-028, tokens-only). | (Tasks) | (Tasks) |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PNL-00 (arcabouço/composição/≤5/ordem/access-gate) | P1.0 | Design | Pending |
| PNL-01 (bloco CANDIDATE: KPIs + 2 cards + ações) | P1.1 | Design | Pending |
| PNL-02 (bloco PROVIDER) | P1.2 | Design | Pending |
| PNL-03 (bloco CLIENT + contadores por categoria) | P1.3 | Design | Pending |
| PNL-04 (bloco COMPANY_RESPONSIBLE + recent apps sem PII) | P1.4 | Design | Pending |
| PNL-05 (bloco COORDINATOR) | P1.5 | Design | Pending |
| PNL-06 (bloco SOCIAL_ASSISTANT — fila read-only) | P1.6 | Design | Pending |
| PNL-07 (bloco BOARD — read-only) | P1.7 | Design | Pending |
| PNL-MN-01..08 (must-nots) | transversal | Design | Pending |

**ID format:** `PNL-NN` / must-nots `PNL-MN-NN`. Adições locais (upstream sem IDs para esta USP net-new).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 8 requisitos + 8 must-nots = 16 total; mapeamento a tasks fechado no `tasks.md`.

---

## Success Criteria

- [ ] Cada um dos 7 papéis do seed abre `/inicio` e vê seus KPIs + ações rápidas + cards conforme a tabela *Escopo por papel* (com as reconciliações A-01..A-18), sem 404 e sem beco.
- [ ] Nenhum payload de `/inicio` contém PII de terceiro (PNL-MN-01/02) — provado por teste negativo sobre o payload renderizado.
- [ ] Toda lista ≤5 registros com `take` (PNL-MN-07); toda leitura nova vive em `queries/` do módulo dono (PNL-MN-05); zero migração (PNL-MN-06).
- [ ] `typecheck` + `lint` verdes; unit + integração das queries novas verdes; build de produção OK; casca `(app)`/`ProfileMenu`/sidebar intactos (diff só em `inicio/`).
