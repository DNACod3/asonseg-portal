# USP-058 — Relatórios legíveis (nome de categoria, rótulos PT-BR, filtros na UI) — Specification

- **Fase:** 8 — Remediação do UAT · **Épico:** `ajustes-uat` · **Sizing:** **Large** (piso de risco: carrega must-nots; toca a superfície de export/RBAC/LGPD já validada — só exibição/UI, sem mudar contratos)
- **Dossiê (fonte da verdade dos achados):** `.specs/features/ajustes-uat/uat-findings-2026-07-11.md` — tabela Fase 8, achados **REL-2** (l.60, P2), **REL-3** (l.61, P3), **REL-5** (l.62, P2)
- **Specs vizinhas (upstream — IDs canônicos, NÃO re-derivar):**
  - `.specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/spec.md` — **E-001** ("lista filtrável por período, status e categoria"), **AC-042-1**, o report set **R1..R6**, e os must-nots **REL42-MN-01/02/03/05/06/07** (watermark LGPD, RBAC, coordenador stripped, ciência, `REPORT_EXPORTED`)
  - `.specs/features/indicadores-relatorios/usp-042-relatorios-operacionais/design.md` — §2 (agregados MP4/MP5/MP7), §3 (RBAC por guard de papel), §6 (export CSV/PDF + auditoria), §7 (privacidade R6 2-barreiras)

> **💠 Adapt, don't re-derive.** Esta spec é um **adaptador de remediação**. O requisito de produto já existe upstream: **E-001/AC-042-1** promete relatórios "filtráveis por período, **status e categoria**" e legíveis por papel. A USP-042 entregou o mecanismo (queries + export + RBAC + watermark), mas com três defeitos de **exibição** encontrados no UAT: a categoria de serviço aparece como **UUID cru** (REL-2), valores de enum aparecem **em inglês** (REL-3), e a **UI só filtra por período** embora o backend já aceite `status`/`categoryId`/`regionId` (REL-5). Os IDs locais `USP058-NN` só nomeiam o recorte de remediação e o rastreio de task; cada um mapeia ao achado do dossiê e ao ID upstream. **Nenhum requisito novo de produto é inventado, nenhum contrato validado (export/RBAC/watermark/auditoria/período) é alterado.**

---

## Problem Statement

O UAT de 2026-07-11 aprovou o núcleo dos relatórios operacionais (RBAC stripped por papel, watermark LGPD, ciência/checkbox, `REPORT_EXPORTED`, filtro de período) mas encontrou três defeitos de legibilidade, todos corrigíveis **sem alterar arquitetura nem premissas técnicas**:

1. **REL-2 (P2):** o relatório de serviços (R3) exibe a **categoria como UUID cru** na tela E no CSV/PDF — `build-report-rows.ts` (case `services`) copia `categoryId` para a coluna "Categoria" sem resolver o nome; a query `report-services.ts` agrupa por `categoryId` e nunca faz join para `ServiceCategory.name` (que já existe, `@unique`).
2. **REL-3 (P3):** valores de enum aparecem **em inglês** na tela e nos exports — status de conteúdo em R1/R3 (`DRAFT`, `IN_MODERATION`, `ACTIVE`, `PAUSED`…), o marcador sintético `MANIFESTACOES_INTERESSE` da linha de MP7, e as dimensões de renda/moradia do R6 full (`NO_INCOME`, `UP_TO_1_MW`, `OWNED`, `RENTED`…). Os cabeçalhos/títulos já estão em PT-BR — **só os VALORES** vazam.
3. **REL-5 (P2):** o formulário GET dos relatórios só renderiza os campos de **período** (`from`/`to`), embora o schema Zod (`report-filters.ts`), o parsing de `searchParams` da rota e as props de `ReportView` já aceitem `status`/`categoryId`/`regionId` (provado no UAT). Falta **só a UI** — os `<select>` de status/categoria/região.

## Goals

- [x] **G1 (REL-2):** R3 exibe o **nome** da categoria (`ServiceCategory.name`) na tela, no CSV e no PDF — nunca o UUID; linhas sem categoria e a linha sintética de manifestações exibem marcador neutro ("—").
- [x] **G2 (REL-3):** todo valor de `ContentStatus` (R1/R3), o marcador de manifestações (R3) e as dimensões de renda/moradia (R6 full) são renderizados com **rótulo PT-BR canônico** reusado do domínio existente, nunca o token do enum — em tela, CSV e PDF, a partir do **ponto único de projeção** (`build-report-rows.ts`), mantendo o serializador (`cellToString`) agnóstico.
- [x] **G3 (REL-5):** cada relatório exibe, no formulário GET, os `<select>` das dimensões que **sua query já honra** (status→R1, categoria→R3, região→R6), pré-selecionados pelos filtros atuais, sem controles inertes — reusando o schema Zod, o parsing de `searchParams` e a Server Action de export inalterados.
- [x] **G4:** preservar as premissas invioláveis — watermark LGPD, ciência/checkbox, `REPORT_EXPORTED`, RBAC por papel (incl. coordenador **stripped** no social) e filtro de período **intactos**; **zero** dep nova, **zero** migração, **zero** mudança nas queries de agregação. Testes de relatórios preservados (não enfraquecer).

## Out of Scope

Explicitamente excluído para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| Alterar as **queries de agregação** para honrar novas dimensões (ex.: filtrar status no R3, que agrupa por status; categoria/região no R1) | REL-5 é **"só UI"** (o dossiê ancora "backend já aceita `?status=`/`?categoryId=`"). Adicionar filtragem que a query hoje ignora é mudança de query, fora do escopo desta remediação. Cada relatório expõe só as dimensões que já honra. |
| Rótulos PT-BR para `ReferralResult` (R4) e `ContentKind` (R5) | R4/R5 já emitem **prosa PT-BR** (métricas nomeadas em `build-report-rows.ts`); nenhum token cru vaza → nada a corrigir. |
| Alterar watermark / ciência / auditoria `REPORT_EXPORTED` / RBAC / schema Zod de filtros / Server Action de export | Contratos **validados** na USP-042 (REL42-MN-01/02/03/05/06/07) — premissa inviolável. |
| Consolidar os dois mapas privados de status de jobs/services num único canônico compartilhado | Refactor cross-módulo que arrisca os testes de `jobs`/`services`; o mapa de reporting é criado **aditivo** (ver Assumptions A2). Consolidação futura fica como follow-up. |
| i18n / troca de idioma | MVP é PT-BR only (CLAUDE.md). |
| Migração de dados / nova coluna / nova dependência | Nenhuma necessária; premissa inviolável. |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida (modo autônomo — viram assumptions de owner `agent`) ou registrada aqui.

| # | Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|---|
| A1 | **Gênero dos rótulos de `ContentStatus`** (report Status é coluna genérica sobre vagas **e** serviços) | agent | Forma **masculina** canônica: `ACTIVE`→"Ativo", `PAUSED`→"Pausado", `REJECTED`→"Rejeitado", `EXPIRED`→"Expirado", `ARCHIVED`→"Arquivado", `INACTIVATED`→"Inativado" (+ `DRAFT`→"Rascunho", `IN_MODERATION`→"Em moderação", `AWAITING_ADJUSTMENTS`→"Aguardando ajustes") | Valores **idênticos** ao map já existente em `services/views/provider-service-row.view.ts` (masculino) — **não inventa rótulo**; masculino combina com "conteúdo"/"registro" (o enum vive em `moderation`). O map de jobs (feminino "Ativa") fica intocado no seu painel. | n |
| A2 | **Onde criar o mapa de `ContentStatus`** | agent | Novo `CONTENT_STATUS_LABELS: Record<ContentStatus,string>` **client-safe** em `reporting/domain/report-labels.ts`, exportado no barrel; **não** levantar/alterar os maps privados de `jobs`/`services` | Dossiê: "reuse se existir; senão crie no reporting". **Nenhum** map de `ContentStatus` é exportado hoje (só dois privados, divergentes em gênero). Criar no reporting é aditivo e zero-risco aos testes de jobs/services. | n |
| A3 | **Reuso dos rótulos de renda/moradia (R6)** | agent | Reusar `INCOME_BRACKET_LABELS` / `HOUSING_SITUATION_LABELS` de `@/modules/persons` (já exportados no barrel) | Já existem, cobrem 1:1 os enums e são a fonte canônica da ficha social — reuso direto, sem recriar. | n |
| A4 | **Resolução do nome da categoria (REL-2)** | agent | Resolver nomes **em `build-report-rows.ts`** (ponto único de projeção) via `listServiceCategories()` (`@/modules/services`) → `Map<id,name>`; **não** adicionar `categoryName` a `ServiceReportRow` na query | Mantém `report-services.ts` e seu int-test (`{status,categoryId,count}`) **intactos**; corrige tela+CSV+PDF de uma vez (todos consomem a mesma projeção). Volume baixo (MVP) ⇒ carregar todas as categorias é barato. | n |
| A5 | **Quais filtros por relatório (REL-5)** | agent | Cada relatório mostra só as dimensões que sua query **já honra**: **status→R1**, **categoria→R3**, **região→R6** (+ período onde a query tem janela). R6 (social) **não** tem período (view sem janela de data). **Sem** controles inertes; **sem** alterar as queries. | Ground truth do código (build-report-rows + queries): R1 consome `status`, R3 consome `categoryId`, R6 consome `regionId`; R2/R4/R5 só período. Controle que a query ignora engana o usuário. | n |
| A6 | **Fontes das opções de status/categoria/região** | agent | A **página** (`(app)/relatorios/[tipo]/page.tsx`, server component) monta as opções e passa como props ao `ReportView`: status = `Object.entries(CONTENT_STATUS_LABELS)`; categoria = `listServiceCategories()` (`@/modules/services`); região = `listActiveRegions()` (`@/modules/jobs`) — cada uma só para o(s) tipo(s) que a honra | Reusa queries de opção **já existentes** (usadas na busca pública de serviços/vagas). Manter a resolução no **server** evita importar barrels server no Client Component (**AD-019**: barrel `@/modules/persons` arrasta Prisma p/ o bundle client). | n |
| A7 | **Marcador de célula vazia** | agent | Categoria nula (rascunho sem categoria) e a linha sintética de manifestações → **"—"** | Consistência com `formatCell`/`cellToString` atuais (null→"—"). | n |
| A8 | **Opções do select de status (R1)** | agent | Listar **todos os 9** valores de `ContentStatus` + opção "Todos" (vazia = sem filtro) | A query aceita qualquer valor de status; listar todos é completo e honesto. Subconjunto seria arbitrário. | n |

**Owner** — todos os itens são `agent` (discricionários, dentro das premissas invioláveis). **Nenhum item de owner externo pendente → o Entry Gate (tasks.md §0) está LIVRE**; a feature entra em task breakdown.

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P2: Nome da categoria no relatório de serviços (REL-2) ⭐

**User Story**: Como **coordenador/diretoria** lendo o relatório de serviços (R3), quero ver o **nome** da categoria (ex.: "Elétrica", "Jardinagem") na tela e nos exports, para entender o relatório sem decodificar UUIDs.

**Why P2**: Defeito objetivo que torna R3 ilegível (âncora REL-2, P2). O nome já existe na entidade (`ServiceCategory.name`, `@unique`); é só resolução de exibição.

**Acceptance Criteria**:

1. **[USP058-01]** WHEN o relatório R3 é renderizado na tela THEN cada linha de serviço SHALL exibir o **nome** da categoria (`ServiceCategory.name`), não o `categoryId` (UUID).
2. **[USP058-02]** WHEN o R3 é exportado em **CSV** ou **PDF** THEN a coluna "Categoria" SHALL conter o **nome** da categoria, não o UUID (a correção vive na projeção única `build-report-rows.ts`, consumida por tela+CSV+PDF).
3. **[USP058-03]** WHEN uma linha tem `categoryId` nulo (rascunho sem categoria) OU é a linha sintética de manifestações (MP7) THEN a coluna "Categoria" SHALL exibir **"—"**, sem erro.
4. **[USP058-04]** WHEN o R3 é filtrado por `categoryId` THEN o comportamento da **query** de agregação SHALL permanecer inalterado (a resolução de nome é só de exibição — nenhuma mudança em `report-services.ts`).

**Independent Test**: Integração — `buildReportRows('services', …)` sobre serviços em categorias reais retorna, na coluna de categoria, os **nomes** (não UUIDs); linha nula e a linha de manifestações mostram "—"; `report-services.int.test.ts` (shape `{status,categoryId,count}`) permanece verde.

---

### P2: Filtros de status/categoria/região na UI de relatórios (REL-5)

**User Story**: Como **coordenador/AS/diretoria**, quero filtrar cada relatório pelas dimensões que ele suporta (status em vagas, categoria em serviços, região no social), além do período, para recortar os dados direto na tela — como AC-042-1/E-001 promete.

**Why P2**: O backend já aceita os filtros (schema + rota + props prontos); a UI só expõe período (âncora REL-5, P2). Fecha a promessa E-001 "filtrável por período, status e categoria".

**Acceptance Criteria**:

1. **[USP058-05]** WHEN o formulário GET de um relatório que honra **status** (R1 Vagas) é renderizado THEN o sistema SHALL exibir um `<select name="status">` com uma opção por valor de `ContentStatus` (rótulo PT-BR) + opção "Todos" (vazia), pré-selecionando `filters.status`.
2. **[USP058-06]** WHEN o formulário de um relatório que honra **categoria** (R3 Serviços) é renderizado THEN o sistema SHALL exibir um `<select name="categoryId">` populado com as categorias de serviço (valor = `id`, rótulo = `name`) + opção "Todas", pré-selecionando `filters.categoryId`.
3. **[USP058-07]** WHEN o formulário de um relatório que honra **região** (R6 Social) é renderizado THEN o sistema SHALL exibir um `<select name="regionId">` populado com as regiões ativas (valor = `id`, rótulo = `name`) + opção "Todas", pré-selecionando `filters.regionId`.
4. **[USP058-08]** WHEN um relatório **não** honra uma dimensão (a query a ignora) THEN o sistema SHALL NOT renderizar o controle correspondente (R2/R4/R5 seguem só com período; R6 sem período).
5. **[USP058-09]** WHEN o usuário seleciona valores e submete o form GET THEN a rota SHALL reprocessar via `searchParams` (já plumado) e a lista + os botões de export SHALL refletir o filtro — **sem** alterar o schema Zod (`report-filters.ts`) nem a Server Action `exportReport`.
6. **[USP058-10]** WHEN o form é submetido sem selecionar um filtro opcional THEN o relatório SHALL listar tudo dentro do `take` (comportamento atual preservado); o filtro de **período** (`from`/`to`) SHALL continuar funcionando como hoje.

**Independent Test**: RTL — renderizar `ReportView` com `statusOptions` → o `<select name="status">` aparece com as opções e o valor pré-selecionado; sem `categoryOptions` → nenhum select de categoria; a chamada de `exportReport({reportType, filters, format, acknowledgePII})` e os inputs `from`/`to` permanecem intactos. Page test — para `tipo='jobs'` a página passa `statusOptions`; para `tipo='services'` passa `categoryOptions`; para `tipo='social'` passa `regionOptions`.

---

### P3: Valores de enum em PT-BR nas tabelas e exports (REL-3)

**User Story**: Como leitor de relatórios (coordenador/AS/diretoria), quero que os valores de status e as dimensões da ficha social apareçam em **português**, para ler o relatório sem decorar os códigos internos do sistema.

**Why P3**: Legibilidade (âncora REL-3, P3). Cabeçalhos já estão PT-BR; só os valores vazam em inglês.

**Acceptance Criteria**:

1. **[USP058-11]** WHEN R1 (Vagas) ou R3 (Serviços) exibe a coluna "Status" (tela/CSV/PDF) THEN cada valor de `ContentStatus` SHALL ser renderizado com seu rótulo PT-BR canônico (ex.: `IN_MODERATION`→"Em moderação", `ACTIVE`→"Ativo", `DRAFT`→"Rascunho", `PAUSED`→"Pausado"), nunca o token do enum.
2. **[USP058-12]** WHEN R3 exibe a linha sintética de manifestações (hoje `status='MANIFESTACOES_INTERESSE'`) THEN o sistema SHALL exibir **"Manifestações de interesse"** (PT-BR), não o token.
3. **[USP058-13]** WHEN R6 (Social, versão **full** AS/BOARD) exibe as dimensões de renda/moradia THEN cada valor SHALL usar `INCOME_BRACKET_LABELS` / `HOUSING_SITUATION_LABELS` (reuso de `@/modules/persons`), nunca o token do enum.
4. **[USP058-14]** WHEN a tradução é aplicada THEN ela SHALL ocorrer na **projeção única** (`build-report-rows.ts`), **não** em `cellToString`/`formatCell` — preservando a neutralização anti-injeção de fórmula (CWE-1236) e a passagem-crua do serializador provada por `csv.test.ts` (o serializador segue agnóstico; só os valores de relatório passam pelo mapa).
5. **[USP058-15]** WHEN um valor de enum não tiver rótulo no mapa THEN um **teste de completude** (guard enum↔mapa) SHALL falhar, evitando divergência silenciosa; em runtime o fallback SHALL ser o próprio token (nunca crash).

**Independent Test**: Unit — teste de completude afirma que `CONTENT_STATUS_LABELS` cobre 1:1 o enum `ContentStatus`. Integração — `buildReportRows('jobs'/'services'/'social', …)` retorna, nas células de status/renda/moradia, os rótulos PT-BR (não os tokens); `csv.test.ts` (serializador agnóstico) permanece verde.

---

## Edge Cases

- WHEN um serviço referencia um `categoryId` cuja categoria não existe (dado órfão) THEN a coluna "Categoria" exibe "—" (fallback do `Map.get(id) ?? '—'`), sem erro.
- WHEN R3 tem período sem serviços mas com manifestações THEN só a linha sintética "Manifestações de interesse" aparece (categoria "—") — export só com cabeçalhos + essa linha, sem erro (edge de período-vazio da USP-042 preservada).
- WHEN o coordenador abre R6 (versão **stripped**) THEN não há dimensões de renda/moradia (nem SELECIONADAS) — só região + total; os rótulos de renda/moradia não se aplicam (REL42-MN-05 preservado).
- WHEN o usuário submete o form com `status`/`categoryId`/`regionId` vazios THEN a rota trata como ausente (`sp.x === '' → undefined`, já plumado) e lista tudo.
- WHEN um `categoryId`/`regionId` inválido (não-UUID) é injetado na URL THEN o schema Zod (`report-filters.ts`) já rejeita com `VALIDATION` — comportamento inalterado (não mexemos no schema).
- WHEN um valor de `ContentStatus` novo for adicionado ao enum no futuro sem rótulo THEN o teste de completude (USP058-15) falha no CI — divergência barrada antes do merge.

---

## Must-Nots (world-level prohibitions)

Cada uma com teste negativo (garantia 1 do bravi-spec-driven).

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **USP058-MN-01** | WHEN qualquer relatório renderiza um valor de `ContentStatus`, `IncomeBracket` ou `HousingSituation`, ou o marcador de manifestações, na tela/CSV/PDF THEN SHALL NOT emitir o **token cru** do enum — todo valor tem rótulo PT-BR (mapa **exaustivo** + guard de completude). | Reincidência do REL-3; divergência silenciosa enum↔mapa. | T1 (guard de completude) + T3 (aplicação na projeção) | Unit: `CONTENT_STATUS_LABELS` cobre 1:1 o enum (falha se faltar). Int: `buildReportRows` de jobs/services/social **não** contém token cru nas células. `csv.test.ts` verde (serializador cru — prova que a tradução é upstream). |
| **USP058-MN-02** | WHEN R3 renderiza a coluna "Categoria" THEN SHALL NOT emitir o **UUID cru** de `categoryId` — só o nome (ou "—"). | Reincidência do REL-2 (UUID na tela/export). | T2 | Int: célula de categoria do R3 é o **nome** ou "—", nunca casa com padrão UUID (`/^[0-9a-f-]{36}$/`). |
| **USP058-MN-03** | WHEN qualquer alteração é aplicada THEN SHALL NOT alterar os contratos validados de export — **watermark** LGPD (REL42-MN-01), **ciência/checkbox** (REL42-MN-06), auditoria **`REPORT_EXPORTED`** (REL42-MN-07), **RBAC** por papel incl. coordenador **stripped** no social (REL42-MN-02/03/05) — nem introduzir **dep nova**, **migração**, ou mudar o **schema Zod**/`exportReport`. | Regressão de segurança/LGPD; escopo inflado. | T2, T3, T5 | Suítes existentes **verdes**: `export-report.test.ts`, `export-report.int.test.ts`, `report-pdf.test.tsx` (watermark), `csv.test.ts` (watermark+injeção), `social-report.int.test.ts` (stripped), `report-access.test.ts`. Diff sem dep/migração; `report-filters.ts` e `exportReport` inalterados. |
| **USP058-MN-04** | WHEN os selects de filtro são adicionados THEN SHALL NOT alterar o comportamento das **queries de agregação** nem renderizar controles que a query **ignora**; o filtro de **período** e a semântica de cada dimensão (status→R1, categoria→R3, região→R6) SHALL permanecer como o backend já os honra. | Controle inerte enganoso; mudança de agregação; regressão do período. | T4 (gating) + T5 (opções por tipo) | Int: `report-jobs`/`report-services`/`social` verdes (agregação inalterada). RTL: select ausente quando a opção não é passada; chamada de `exportReport` e inputs `from`/`to` preservados. |

**Invariantes preservadas (regressão — já com testes verdes na USP-042):** watermark (REL42-MN-01), ciência (REL42-MN-06), `REPORT_EXPORTED`+rollback (REL42-MN-07), voluntário negado (REL42-MN-03), fila só a autorizado (REL42-MN-02), coordenador stripped no social (REL42-MN-05), MP9 sempre com "sem resultado" (REL42-MN-04), filtro de período. A remediação toca **só a camada de exibição/projeção e a UI de filtros** — nunca a Server Action de export, o schema, as queries de agregação ou os guards de RBAC.

---

## Requirement Traceability

| Requirement ID | Story | Upstream (canônico) | Phase | Status |
|---|---|---|---|---|
| USP058-01 | P2 (REL-2) | E-001 / R3 | Tasks (T2) | Done |
| USP058-02 | P2 (REL-2) | E-002 (export) / R3 | Tasks (T2) | Done |
| USP058-03 | P2 (REL-2) | edge USP-042 | Tasks (T2) | Done |
| USP058-04 | P2 (REL-2) | R3 query | Tasks (T2) | Done |
| USP058-05 | P2 (REL-5) | E-001 / AC-042-1 (status) | Tasks (T4, T5) | Done |
| USP058-06 | P2 (REL-5) | E-001 / AC-042-1 (categoria) | Tasks (T4, T5) | Done |
| USP058-07 | P2 (REL-5) | E-001 (região) | Tasks (T4, T5) | Done |
| USP058-08 | P2 (REL-5) | A5 (gating) | Tasks (T4, T5) | Done |
| USP058-09 | P2 (REL-5) | schema/rota já plumados | Tasks (T4, T5) | Done |
| USP058-10 | P2 (REL-5) | filtro de período (USP-042) | Tasks (T4) | Done |
| USP058-11 | P3 (REL-3) | legibilidade | Tasks (T1, T3) | Done |
| USP058-12 | P3 (REL-3) | R3 (MP7) | Tasks (T1, T3) | Done |
| USP058-13 | P3 (REL-3) | R6 full | Tasks (T3) | Done |
| USP058-14 | P3 (REL-3) | REL42-MN-01/CWE-1236 (serializador agnóstico) | Tasks (T3) | Done |
| USP058-15 | P3 (REL-3) | guard enum↔mapa | Tasks (T1) | Done |
| USP058-MN-01 | must-not | REL-3 | Tasks (T1, T3) | Done |
| USP058-MN-02 | must-not | REL-2 | Tasks (T2) | Done |
| USP058-MN-03 | must-not | REL42-MN-01/02/03/05/06/07 | Tasks (T2, T3, T5) | Done |
| USP058-MN-04 | must-not | REL-5 / queries USP-042 | Tasks (T4, T5) | Done |

**ID format:** `USP058-NN` (local); âncoras upstream = achados REL-2/REL-3/REL-5 do dossiê + E-001/AC-042-1 (USP-042).
**Status values:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 19 requisitos (15 ACs + 4 must-nots), todos mapeados a tasks (T1–T5); 0 sem mapa.

---

## Success Criteria

- [x] R3 exibe **nomes** de categoria (não UUID) em tela, CSV e PDF; linhas sem categoria e a de manifestações mostram "—".
- [x] Status (R1/R3), o marcador de manifestações (R3) e renda/moradia (R6 full) aparecem em **PT-BR** em tela, CSV e PDF; teste de completude do mapa `ContentStatus` verde.
- [x] R1 mostra select de **status**, R3 select de **categoria**, R6 select de **região** — pré-selecionados, sem controles inertes; período preservado; `exportReport` e o schema Zod inalterados.
- [x] Suítes preservadas verdes: `export-report.test.ts`, `export-report.int.test.ts`, `report-pdf.test.tsx`, `csv.test.ts`, `social-report.int.test.ts`, `report-access.test.ts`, `report-services.int.test.ts`, `report-view.test.tsx`.
- [x] `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` verdes; **zero** dep nova; **zero** migração; **zero** mudança nas queries de agregação e nos contratos de export/RBAC.
