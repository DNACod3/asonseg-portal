# USP-048 — Navegação integrada das telas públicas (vagas, serviços, cadastros) — Specification

> **Modo: Greenfield-adapter (não-ICE).** Esta USP é **net-new** — não consta das 44 USPs do PRD nem
> há card em `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` (verificado: a matriz cobre só USP-001..045;
> nenhuma entrada `048`). Portanto NÃO há intent/expectations ICE **desta** USP a resolver. A Specify
> **adapta-se aos artefatos das features que a USP-048 liga** — os **seams** já entregues pela USP-047
> (`HOME-14`, `.../usp-047-home-landing/{spec,design}.md`) e as features públicas reais a montante
> (USP-021 busca de vagas, USP-030 busca de serviços, USP-041 indicadores) — e à **fonte visual da verdade**
> (`docs/prototipo/index.html`, fluxo `showPage()`). Reutiliza o esquema de IDs `NAV-NN` / `NAV-MN-NN`
> no mesmo espírito dos precedentes `CASCA-NN` (USP-046) e `HOME-NN` (USP-047).
> Toda decisão discricionária vira **assumption registrada** (modo autônomo — sem gate de confirmação).
>
> **Epic:** `fachada-publica` · **Fase 7 — Fachada Pública** · **Última unidade da Fase 7.**
> **Depende de:** USP-046 (casca ✅), USP-047 (home + seams ✅), USP-021 (`searchJobs` ✅), USP-030
> (`searchServices` ✅). **Precede:** o Lançamento (UAT + cutover).

## Problem Statement

A USP-047 entregou a home fiel ao protótipo, mas com **seams**: cada CTA/nav/busca é uma prop com
**default de rota real** e os destaques (vagas/serviços) são **mock estático** (`HomeFeaturedJobs` mostra 2
cards hardcoded; `HomeServices` mostra 3 categorias fixas linkando genericamente a `/servicos`). O portal
"abre como o protótipo" visualmente, mas o **fluxo `showPage()`** do protótipo — onde cada nav/CTA leva à
tela certa e os destaques mostram conteúdo real — ainda não está **ligado às rotas e dados vivos**.

A USP-048 **fecha esse gap** (o último da Fase 7): liga a busca/CTAs/nav aos **destinos reais já entregues**
reproduzindo a **intenção** de `showPage()` via roteamento Next.js (`<Link>`/GET form, não show/hide client),
e **injeta dados reais** nos destaques (vagas ACTIVE anonimizadas ligando ao detalhe real; categorias de
serviço reais ligando ao filtro real). É **puro wiring/navegação + leituras públicas já existentes** —
**nenhum model Prisma novo, nenhuma migração, nenhuma query nova** (reusa `searchJobs`/`searchServices`/
`listServiceCategories`). Conforme o design de seams da USP-047, a USP-048 **pluga nos seams sem reescrever
a mecânica das seções**: o wiring acontece no **composition root** (`(public)/page.tsx`) + duas extensões
mínimas e retrocompatíveis de seam (um `href` opcional por card).

## Goals

- [ ] **G1 — Destaque de vagas com dados reais.** `HomeFeaturedJobs` recebe as **top-N vagas ACTIVE reais**
  (via `searchJobs({ page: 1 }, null)` — anonimizado, portão ACTIVE/verificada/não-expirada preservado),
  cada card ligando ao **detalhe real** `/vagas/{id}`. Fallback gracioso ao mock estático se vazio/erro
  (ADR-0026, ISR-safe) — a home nunca quebra por causa do destaque.
- [ ] **G2 — Destaque de serviços com dados reais.** Os 3 cards de categoria de `HomeServices` linkam ao
  **filtro real** `/servicos?categoria=<id>` usando IDs reais de `listServiceCategories()`; categoria não
  resolvida cai para `/servicos` (sem dead end). "Ver Todos os Serviços" → `/servicos`.
- [ ] **G3 — Busca ligada aos resultados reais.** A busca do hero (`HomeSearch`, GET `/vagas` `name="q"`)
  **preserva o termo** para a listagem real de vagas (USP-021 lê `?q=`); query vazia → `/vagas` (todas
  ACTIVE, sem erro). Reproduz "Buscar Vagas" do protótipo (`showPage('vagas')`).
- [ ] **G4 — CTAs de cadastro diferenciados / rotas reais (`showPage()`).** CTAs de **empresa** ("Publicar
  Vaga", "Cadastrar Empresa", "Cadastrar como Empresa") reapontam para a rota real de cadastro de empresa
  `/empresa/cadastrar` (`showPage('empresa-cadastro')`); CTAs de **candidato** permanecem `/cadastro`
  (`showPage('candidato-cadastro')`). Nenhum CTA morto.
- [ ] **G5 — Fluxo integrado sem dead ends.** Toda rota de nav/CTA/busca/destaque da home resolve para a
  **tela real correta** (home `/`, `/vagas`, `/vagas/{id}`, `/servicos`, `/servicos?categoria=`, `/cadastro`,
  `/empresa/cadastrar`, `/login`), reproduzindo a **intenção** do `showPage()` do protótipo — sem `href="#"`,
  sem handler client de show/hide.
- [ ] **G6 — Contrato de privacidade e não-regressão preservados.** O destaque vivo **não vaza PII** nem
  conteúdo não-ACTIVE (consome só o read anonimizado `viewer=null`); a home **não** importa
  `getCurrentPerson`/View Models/Prisma/Server Actions (guardas `home-page-static`/`casca-no-auth-pii`
  seguem verdes); indicadores da USP-041, ISR `revalidate=600`, tokens/dark e ausência de CDN **não regridem**.

## Out of Scope

Explicitamente excluído para evitar scope creep. USP-048 é **só a ligação navegação↔rotas/dados reais**.

| Item | Por quê / dono |
|---|---|
| Reescrever a **composição/estilo** das seções da home | USP-047 (entregue). A USP-048 só pluga nos seams (props/hrefs) + 2 extensões mínimas de seam (`href` opcional por card). Não muda copy, layout, tokens. |
| Alterar a **casca** (header/nav/footer) | USP-046 (entregue). A nav primária (Início/Vagas/Serviços) + ações (Entrar/Cadastrar) já resolvem para rotas reais com active-state; USP-048 **confirma** (AC), não reescreve. Sem itens de nav "Sou Candidato/Sou Empresa" (A-04). |
| Alterar `searchJobs`/`searchServices`/`listServiceCategories` ou seus contratos | USP-021/030. A USP-048 **consome** as queries como estão (`viewer=null`); mudar o `where`/anonimização/paginação é da feature dona. |
| Nova **query pública de "destaques/featured"** dedicada | Decisão A-05: reusar `searchJobs`/`searchServices` (`page:1`, fatiado) **preserva o portão ACTIVE + View Model + anonimização** já testados; uma query nova duplicaria o `where` e arriscaria drift (ex.: `listActivePublishedJobs` vaza `nomeFantasia`). Nenhum IO novo. |
| Rota **pública** de cadastro de empresa | Inexistente por design: empresa só se cria autenticado (`(app)/empresa/cadastrar`, `requireActivePerson`). O CTA de empresa aponta à rota real, que redireciona anônimo a `/login` (comportamento existente). |
| Busca **integrada** vagas+serviços no hero | O protótipo `#page-home` **não** tem input de busca de serviços (só "Buscar Vagas"→vagas). A busca da home permanece escopada a vagas (A-03). |
| Novo model Prisma / migração / Server Action | Unidade navegacional/apresentacional; nenhuma escrita, nenhum schema. |
| E2E dedicado da home como gate de merge | Deferido (DEF-1; precedente USP-046/047 DEF-4 + lição **L-007**): E2E roda `skipped` em PR comum. Se um cenário for adicionado, tem de ser `e2e/*.spec.ts` real com asserções vivas, nunca skeleton em `.specs/`. |
| Testes de regressão visual (screenshots/Chromatic/Percy) | Fora do stack; paridade validada por RTL + guardas estáticas + build (precedente Fase 1/USP-046/047). |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida e registrada aqui (modo autônomo, `owner = agent`).

| # | Assumption / decisão | Owner | Default escolhido | Rationale | Confirmed? |
|---|---|---|---|---|---|
| A-01 | **Onde o wiring acontece** | agent | No **composition root** `src/app/(public)/page.tsx` (Server Component): busca os dados públicos e passa os seams (props/hrefs) para as seções. As seções `home-*.tsx` seguem **apresentacionais** (recebem props). | Padrão de seam da USP-047 §7 ("a home é 100% funcional sem a USP-048; a USP-048 pluga sem tocar a mecânica das seções"); `page.tsx` já é o lugar que carrega dados (indicadores) e compõe. | y (evidência: `page.tsx` L48-59; USP-047 design §7) |
| A-02 | **Como o destaque de vagas vira vivo** | agent | `page.tsx` chama `searchJobs({ page: 1 }, null)` (barrel `@/modules/jobs`), fatia para **2** itens (paridade com os 2 mini-cards do protótipo), mapeia `JobListItem → FeaturedJob` (título, `company.displayName` anonimizado, tags de área/contrato, `href=/vagas/{id}`) e passa via `HomeHero.jobs`→`HomeFeaturedJobs.jobs`. | Reuso da query real (portão ACTIVE + `is_verified` + `valid_until` + View Model + anonimização já testados em `search-jobs.int.test.ts`); `viewer=null` = anônimo → sem PII. Não há query "featured" hoje (confirmado). | y (evidência: `searchJobs(filters, viewer)`; `JobListItem`; barrel `@/modules/jobs` permitido pela guarda) |
| A-03 | **Empresa anonimizada no destaque vivo** | agent | O card de destaque vivo mostra `company.displayName` = "Empresa do setor de …" (anônimo), **não** o nome real; substitui os nomes realistas do mock ("Supermercado Angeloni"). | Contrato de anonimização para visitante anônimo (`viewer=null` → `viewJobForVisitor` não seleciona `nomeFantasia`); divergência de fidelidade **deliberada** a favor da privacidade (mesmo espírito de A-03 da USP-047 nos indicadores). | y (evidência: `views/job-list-item.view.ts`; `jobListSelect(false)` não seleciona `nomeFantasia`) |
| A-04 | **Itens de nav "Sou Candidato/Sou Empresa" (protótipo)** | agent | **Não** adicionar à nav primária. Os pontos de entrada candidato/empresa já existem na home (cards de persona + CTA final + hero "Publicar Vaga") e no header ("Cadastrar"); a nav primária permanece Início/Vagas/Serviços. | Evita redundância/clutter (a "Cadastrar" do header + os CTAs de persona já cobrem os dois fluxos); o essencial do `showPage()` é **toda tela ser alcançável por rota real**, o que se cumpre pelos CTAs. O seam CASCA-15 continua disponível para uma decisão futura. | y (evidência: protótipo nav L820-826; `PublicNav.items` seam; header "Cadastrar") |
| A-05 | **Query de destaque: reusar vs. nova** | agent | **Reusar** `searchJobs`/`searchServices`/`listServiceCategories` (via barrel, `viewer=null`); **não** criar query nova. | Reuso preserva o `where` (ACTIVE/verificada/expiração), o View Model e a anonimização já testados; query nova = duplicação do `where` = risco de drift/vazamento (precedente: `listActivePublishedJobs` expõe `nomeFantasia` e pula o portão — **não** reusável em público). Anti-fabricação (Knowledge Chain). | y (evidência: subagente confirmou ausência de query featured; `listActivePublishedJobs` inseguro) |
| A-06 | **Destaque de serviços: forma dos "dados reais"** | agent | Manter os 3 cards de categoria **fiéis ao protótipo** (copy/ícones), mas ligá-los ao **filtro real** `/servicos?categoria=<id>` resolvendo o id via `listServiceCategories()` por chave estável (nome normalizado); categoria não resolvida → `/servicos` (fallback garantido, sem dead end). | O protótipo `#page-home` desenha serviços como **categorias** (não listagem viva); "dados reais" para serviços = **taxonomia real + pré-filtro real**, preservando fidelidade. O fallback resolve a fragilidade do match nome→id (L-002/L-005: tensão resolvida no spec, não deixada ao implementador). | y (evidência: `servicos/page.tsx` lê `sp.categoria`; `listServiceCategories()` retorna `{id,name}`) |
| A-07 | **Retarget do CTA de empresa** | agent | `publicarVagaHref`/`empresaHref` → `/empresa/cadastrar` (rota real, `requireActivePerson`). Anônimo é redirecionado a `/login` pelo próprio guard (comportamento existente). Candidato → `/cadastro`. | Não existe rota **pública** de cadastro de empresa; `/empresa/cadastrar` é a rota real ("liga aos destinos reais já entregues"). O bounce a `/login` é o fluxo desenhado do app (registrar Pessoa → login → criar Empresa). Precedente de reuso de rota (L-011: não abrir namespace novo). | y (evidência: `(app)/empresa/cadastrar/page.tsx` `requireActivePerson`→`/login`; `/cadastro` = form de Pessoa CANDIDATE/PROVIDER/CLIENT, sem EMPRESA) |
| A-08 | **Busca da home escopada a vagas** | agent | A busca do hero continua GET `/vagas?q=` (jobs-only); sem busca de serviços na home, sem escopo integrado. | O protótipo home não tem input de busca de serviços (só "Buscar Vagas"→`showPage('vagas')`). Manter fidelidade e escopo enxuto; o `action` continua seam para evolução futura. | y (evidência: subagente Part A4 — 0 inputs em `#page-home`) |
| A-09 | **Extensões de seam necessárias** | agent | Duas extensões **mínimas e retrocompatíveis**: (1) `FeaturedJob.href?` em `home-featured-jobs.tsx` (card vira `<Link>` quando presente; default mock segue sem link); (2) `href?` por categoria em `home-services.tsx` (default = `servicosHref`). Nenhuma outra seção muda de assinatura. | Ligar destaque de vaga ao detalhe e categoria ao filtro exige um alvo por card, que a USP-047 não previu por item. São adições opcionais (default preserva o comportamento atual) → não "reescrevem a mecânica". Cada seam ganha teste RTL isolado (L-014). | y (evidência: `FeaturedJob` = `{title,company,tags?,iconVariant?}` sem href; `HomeServices` usa `servicosHref` para todos) |
| A-10 | **Resiliência/ISR do build** | agent | Cada carga de dado no `page.tsx` (`loadFeaturedJobs`, `loadServiceCategoryHrefs`) usa o **mesmo padrão try/catch → fallback** do `loadIndicators` existente (ADR-0026); `revalidate=600` preservado. | O build (SSG/ISR) já tolera DB indisponível para os indicadores (fallback); o destaque segue o mesmo contrato → `/` compila mesmo sem DB no build (MEMORY: build é gate confiável). Não eleva o piso de ISR. | y (evidência: `loadIndicators()` try/catch em `page.tsx`; `home-revalidate.test.ts`) |

**Open questions:** none — todas resolvidas/registradas acima.

---

## User Stories

### P1: Destaques com dados reais (vagas + serviços) ⭐ MVP

**User Story**: Como visitante que abre o portal, quero que os destaques da home mostrem **vagas e
categorias reais** e me levem às telas certas — como no protótipo — para explorar oportunidades verdadeiras
em vez de exemplos.

**Why P1**: É o núcleo de "destaques com dados reais" e fecha o gap entre a home fiel e a experiência viva.

**Acceptance Criteria**:

1. WHEN a home renderiza o destaque de vagas THEN o sistema SHALL exibir as **top-2 vagas ACTIVE reais**
   obtidas via `searchJobs({ page: 1 }, null)` (portão ACTIVE + empresa verificada + não-expirada + View
   Model anonimizado preservados), cada card ligando ao detalhe real `/vagas/{id}`. **[NAV-02]**
2. WHEN `searchJobs` retorna vazio OU lança THEN o destaque de vagas SHALL cair graciosamente para os cards
   estáticos (mock) sem quebrar a home nem elevar o ISR (ADR-0026, `revalidate=600`). **[NAV-02]**
3. WHEN a home renderiza o destaque de serviços THEN cada um dos 3 cards de categoria SHALL linkar ao filtro
   real `/servicos?categoria=<id>` com `id` de `listServiceCategories()`; categoria não resolvida SHALL cair
   para `/servicos` (sem dead end); "Ver Todos os Serviços" SHALL linkar `/servicos`. **[NAV-03]**
4. WHEN o destaque de vagas exibe a empresa THEN o sistema SHALL exibir o **display name anonimizado**
   ("Empresa do setor de …") para o visitante anônimo, NUNCA o nome real (`nomeFantasia`) nem outra PII. **[NAV-02, NAV-MN-01]**

**Independent Test**: RTL de `page.tsx` com `@/modules/jobs` e `@/modules/services` mockados: `searchJobs`
retorna um `JobListItem` anonimizado → assert card com título + `company.displayName` + `href=/vagas/{id}`,
e ausência do `nomeFantasia`; `searchJobs` rejeita → assert cards estáticos (fallback) e home intacta;
`listServiceCategories` retorna categorias → assert `href` de card contém `categoria=`; retorna vazio →
assert `href=/servicos`.

---

### P1: Busca e CTAs ligados às rotas reais (fluxo `showPage()`) ⭐ MVP

**User Story**: Como visitante, quero que buscar, candidatar-me e cadastrar minha empresa me levem às telas
reais certas — como no protótipo — para completar cada fluxo sem becos sem saída.

**Why P1**: Reproduz a intenção do `showPage()`; sem isso os CTAs são fiéis mas não "abrem" as telas reais.

**Acceptance Criteria**:

1. WHEN o visitante submete a busca do hero THEN o sistema SHALL navegar por GET para `/vagas` preservando
   o termo em `?q=` (`name="q"`); a listagem real de vagas (USP-021) SHALL honrar `?q=`. **[NAV-01]**
2. WHEN o visitante submete a busca com termo vazio THEN o sistema SHALL navegar para `/vagas` (todas as
   vagas ACTIVE), sem erro nem tela em branco. **[NAV-01]**
3. WHEN o visitante aciona um CTA de **empresa** ("Publicar Vaga", "Cadastrar Empresa", "Cadastrar como
   Empresa") THEN o sistema SHALL navegar para a rota real `/empresa/cadastrar` (que, para anônimo,
   redireciona a `/login` pelo `requireActivePerson`). **[NAV-04]**
4. WHEN o visitante aciona um CTA de **candidato** ("Criar Meu Perfil", "Cadastrar como Candidato") THEN o
   sistema SHALL navegar para `/cadastro`. **[NAV-04]**
5. WHEN qualquer item de nav primária ("Início"/"Vagas"/"Serviços") ou ação do header ("Entrar"/"Cadastrar")
   é acionado THEN o sistema SHALL navegar para a rota real correspondente (`/`, `/vagas`, `/servicos`,
   `/login`, `/cadastro`) com active-state — **confirmado** da USP-046, nenhum dead end. **[NAV-05]**

**Independent Test**: RTL de `HomeSearch` confirma `<form method="get" action="/vagas">` + input `name="q"`
(termo preenchido e vazio); RTL/leitura de `page.tsx` confirma os `href` dos CTAs de empresa
(`/empresa/cadastrar`) e candidato (`/cadastro`); `public-nav.test.tsx` (USP-046) segue verde confirmando
a nav primária + active-state.

---

### P1: Integração sem regressão e sem dead ends ⭐ MVP

**User Story**: Como desenvolvedor da Fase 7, quero a navegação integrada sem reintroduzir vazamento de
PII, dead ends, drift de token/CDN nem regressão dos contratos da USP-041/046/047 — para que o portal
"abra como o protótipo" ligado às rotas reais sem quebrar nada existente.

**Why P1**: A integração só cumpre o objetivo se preservar os must-nots já conquistados na Fase 7.

**Acceptance Criteria**:

1. WHEN `page.tsx` passa a consumir os reads públicos THEN SHALL importá-los **apenas pelos barrels**
   (`@/modules/jobs`, `@/modules/services`) — como já faz com `@/modules/reporting` — e SHALL NOT importar
   `getCurrentPerson`/`@/modules/*/views`/`@/shared/lib/prisma`/`@/modules/*/actions`/`'use server'` (guarda
   `home-page-static.test.ts` segue verde). **[NAV-06, NAV-MN-01]**
2. WHEN qualquer CTA/nav/card de destaque é renderizado THEN SHALL apontar para uma **rota real** (`href`
   começa com `/`), NUNCA `href="#"` nem href vazio. **[NAV-06, NAV-MN-02]**
3. WHEN as seções da home são estilizadas THEN SHALL NOT reintroduzir hex cru/paleta fixa/`system-ui`/CDN
   externo (guardas `casca-uses-tokens`/`casca-no-external-cdn`/`home-page-static` verdes). **[NAV-MN-02]**
4. WHEN a home é montada THEN os indicadores da USP-041 (count-only, "Em breve" < 5), o ISR `revalidate=600`,
   o único `<main>` e o único `<h1>` SHALL permanecer intactos (contratos HOME-MN-03/MN-04 preservados). **[NAV-06]**

**Independent Test**: `home-page-static.test.ts` verde após os barrels serem adicionados; nova guarda
`nav-no-dead-ends.test.ts` (node:fs) falha se existir `href="#"`/vazio em `(public)/page.tsx` ou
`home-*.tsx`; `page.test.tsx` migrado mantém indicadores/`<main>`/`<h1>`; `home-revalidate.test.ts` verde.

---

## Edge Cases

- WHEN `searchJobs`/`searchServices`/`listServiceCategories` lançam (DB indisponível, inclusive no build)
  THEN a home SHALL carregar normalmente com os fallbacks (destaque de vagas → mock estático; categorias →
  `/servicos`) — nenhuma seção quebra, o build compila (padrão `loadIndicators`, ADR-0026).
- WHEN não há nenhuma vaga ACTIVE THEN o destaque de vagas SHALL exibir o mock estático (fallback), nunca
  uma lista vazia/quebrada.
- WHEN uma categoria do protótipo não casa com nenhuma categoria real de `listServiceCategories()` THEN o
  card SHALL linkar `/servicos` (sem `categoria=`), nunca um id inventado nem `href="#"`.
- WHEN o visitante anônimo aciona um CTA de empresa THEN a navegação SHALL chegar a `/empresa/cadastrar` e o
  guard `requireActivePerson` SHALL redirecioná-lo a `/login` (comportamento existente, não é dead end).
- WHEN o termo de busca contém caracteres especiais/espaços THEN o GET SHALL codificá-lo normalmente na query
  string e `/vagas` SHALL tratá-lo como termo único (o parser `first(sp.q)` já faz trim).

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um **teste negativo** killable (guarda
estática `node:fs` em `src/shared/__tests__/*.test.ts`, ou asserção RTL). Precedente: `HOME-MN-*` (USP-047),
`CASCA-MN-*` (USP-046). **Anchor de falha-de-resultado:** vazamento de PII/estado autenticado no HTML
público/ISR (lição RSC/Flight — "anonimizar no View Model não basta"; MEMORY).

| ID | WHEN [context] THEN system SHALL NOT… | Prevents (falha-de-resultado) | Owning task | Negative test |
|---|---|---|---|---|
| **NAV-MN-01** | WHEN a home renderiza destaques vivos THEN SHALL NOT (a) vazar PII (nome real de empresa para anônimo, telefone/e-mail de prestador); (b) exibir conteúdo não-ACTIVE / empresa não verificada / vaga expirada; (c) passar um **viewer real**/sessão ao read (só `viewer=null`); (d) importar em `(public)/page.tsx` ou `home-*.tsx` `getCurrentPerson`/`requireActivePerson`/`@/modules/*/views`/`@/shared/lib/prisma`/`@/modules/*/actions`/`'use server'`. **Supersede** a cláusula "o único dado dinâmico é o trio de contadores" de HOME-MN-01, **preservando** seu núcleo anti-PII/anti-auth. | Vazamento de PII/estado autenticado no HTML público/ISR; bypass do portão de moderação/ACTIVE. | T3 (destaque de vagas) | (i) `page.test.tsx`: `searchJobs` mockado retorna `JobListItem` anonimizado → card mostra `displayName`, NUNCA `nomeFantasia`/PII; assert que a chamada usa `null` (anônimo). (ii) `home-page-static.test.ts` **existente** verde (imports proibidos) + `casca-no-auth-pii` verde sobre `home-*.tsx`. |
| **NAV-MN-02** | WHEN qualquer alvo de nav/CTA/busca/destaque é ligado THEN SHALL NOT (a) produzir dead end (`href="#"`, href vazio, handler client de show/hide); (b) contornar o filtro ACTIVE/moderação (nenhum Prisma direto, nenhuma listagem não-anonimizada); (c) reintroduzir hex cru/paleta fixa/`system-ui`/CDN externo. | Beco sem saída (regressão da fidelidade `showPage()`); bypass de moderação; quebra de dark-mode/CSP (DS/CASCA/HOME-MN-02). | T6 (guarda de dead-ends) | Nova guarda `nav-no-dead-ends.test.ts` (node:fs) varre `(public)/page.tsx` + `home-*.tsx` por `href="#"`/vazio → offenders `[]`; guardas `casca-uses-tokens`/`casca-no-external-cdn`/`home-page-static` (hex/paleta/CDN) verdes. |

> **Nota de continuidade dos contratos anteriores:** HOME-MN-03 (indicadores count-only/"Em breve"/ISR≤600),
> HOME-MN-04 (um `<main>`/um `<h1>`) e CASCA-MN-* continuam válidos e são **preservados** (não regridem);
> a USP-048 não os altera, apenas garante que o wiring não os quebre (AC NAV-06.4).

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
|---|---|---|---|
| NAV-01 | P1 Busca: GET `/vagas?q=` preservando termo (+ vazio) | Tasks | Pending |
| NAV-02 | P1 Destaques: vagas ACTIVE reais anonimizadas → `/vagas/{id}` + fallback | Tasks | Pending |
| NAV-03 | P1 Destaques: categorias reais → `/servicos?categoria=<id>` + fallback | Tasks | Pending |
| NAV-04 | P1 CTAs: empresa → `/empresa/cadastrar`; candidato → `/cadastro` | Tasks | Pending |
| NAV-05 | P1 Nav/header: rotas reais + active-state (confirmado USP-046) | Tasks | Pending |
| NAV-06 | P1 Integração: barrels-only, sem dead ends, sem regressão de contratos | Tasks | Pending |
| NAV-MN-01 | Must-Not: destaque vivo sem PII/não-ACTIVE/viewer-real/imports proibidos | Tasks | Pending |
| NAV-MN-02 | Must-Not: sem dead ends / sem bypass de moderação / sem hex-CDN | Tasks | Pending |

**ID format:** `NAV-NN` / must-nots `NAV-MN-NN` (precedente `HOME-NN`/`CASCA-NN`).
**Status values:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 8 requisitos (6 funcionais + 2 must-nots); mapeamento para tarefas em `tasks.md`.

---

## Success Criteria

- [ ] Destaque de vagas mostra vagas ACTIVE reais (anonimizadas) ligando a `/vagas/{id}`; fallback ao mock se vazio/erro.
- [ ] Destaque de serviços liga cada categoria ao filtro real `/servicos?categoria=<id>` (fallback `/servicos`); "Ver Todos" → `/servicos`.
- [ ] Busca do hero → `/vagas?q=` preservando o termo (e vazio → `/vagas` sem erro); USP-021 honra `?q=`.
- [ ] CTAs de empresa → `/empresa/cadastrar`; CTAs de candidato → `/cadastro`; nenhum CTA morto.
- [ ] Nav primária + header confirmados: rotas reais + active-state; nenhum `href="#"` em toda a home.
- [ ] Sem regressão: indicadores USP-041 intactos, `revalidate=600`, um `<main>`/um `<h1>`, guardas `casca-*`/`home-page-static` verdes.
- [ ] Sem PII/estado autenticado no HTML público (destaque só via read anonimizado `viewer=null`; imports proibidos ausentes).
- [ ] Nenhuma query nova / nenhum model / nenhuma migração (reuso de `searchJobs`/`searchServices`/`listServiceCategories`).
- [ ] Gates verdes: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
</content>
</invoke>
