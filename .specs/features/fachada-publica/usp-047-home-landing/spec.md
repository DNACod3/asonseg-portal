# USP-047 — Home/landing pública fiel ao protótipo — Specification

> **Modo: Greenfield-adapter (não-ICE).** Esta USP é **net-new** — não consta das 44 USPs do PRD nem
> há card em `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` (verificado: nenhuma entrada `047`).
> Portanto NÃO há intent/expectations ICE a resolver; a Specify **gera** os requisitos a partir da
> fonte visual da verdade (`docs/prototipo/index.html`, seção `#page-home` L842-1034) e dos precedentes
> já entregues da Fase 7 (USP-046 — casca; `CASCA-NN`) e da Fase 1 (Fundação de Design System,
> `DS-MN-*`). Reutiliza os IDs `HOME-NN` / `HOME-MN-NN` no mesmo espírito do precedente `CASCA-NN`.
> Toda decisão discricionária vira **assumption registrada** (modo autônomo — sem gate de confirmação).
>
> **Epic:** `fachada-publica` · **Fase 7 — Fachada Pública** · **Depende de:** USP-046 (casca, já
> mergeada nesta branch) + USP-041 (indicadores, `HomeIndicatorsView`). **Precede:** USP-048
> (navegação integrada), que consome os **seams** (props/hrefs) desta home.

## Problem Statement

O protótipo (`docs/prototipo/index.html`) **abre** na `#page-home`: uma landing composta por **hero**
(headline + subtítulo + CTAs + destaques de vaga + números-âncora), **"Como Funciona"** (3 passos),
**"Para Quem"** (2 personas), **destaque de Serviços** (3 categorias + CTA) e uma **faixa de CTA final**.
É essa composição que faz o portal "abrir como o protótipo".

No app real, `src/app/(public)/page.tsx` nunca saiu do **esqueleto da Fase 1**: um `<h1>`/`<p>` de
inicialização + o `HomeIndicatorsView` da USP-041. A USP-046 já vestiu o grupo `(public)` com a casca
global (header/footer via `(public)/layout.tsx`) e forneceu a convenção `(public)/_components/` (AD-025).
Falta o **miolo da home** — este é o escopo da USP-047.

Esta USP **reconstrói o corpo da página** `(public)/page.tsx` reproduzindo a `#page-home` sobre os
tokens de `globals.css`, quebrada em **componentes de seção** unit-testáveis em `(public)/_components/`
(seguindo AD-025). Ela **ESTENDE — não descarta** — os indicadores da USP-041: os números-âncora falsos
do hero do protótipo (247 / 1.8k / 156) são substituídos pelo `HomeIndicatorsView` real (contrato
count-only / PII-free / "Em breve" < 5 preservado). Cada CTA/busca/destaque é entregue como **markup
fiel, acessível e tokenizado, com seams (props/hrefs)** que a USP-048 apontará para rotas/dados vivos.

## Goals

- [ ] **G1** — `(public)/page.tsx` renderiza a landing completa fiel à `#page-home`: **hero + busca +
  destaques (vagas/serviços) + seções institucionais (Como Funciona / Para Quem) + CTAs**, toda sobre
  tokens de `globals.css`, sem tocar o header/footer (que já vêm da casca / USP-046).
- [ ] **G2** — Os **indicadores da USP-041 são embutidos como uma seção** (na posição dos "hero-stats"),
  via o `HomeIndicatorsView` existente alimentado pelo `getHomeIndicators()` já presente em `page.tsx`
  (com o `FALLBACK_INDICATORS`). O contrato REL41-MN-01/02/03 (count-only, PII-free, "Em breve" < 5,
  piso de ISR ≤ 600) **não regride**.
- [ ] **G3** — Cada seção é um **componente de seção** próprio em `src/app/(public)/_components/`
  (`home-*.tsx`), presentacional e unit-testável (RTL), reutilizando tokens e os primitivos da
  fundação (`Button` `asChild`, `Card`, `StepIcon`, `Badge`, `Input`, `cn`).
- [ ] **G4** — Fidelidade como AC de primeira classe: cada seção presente com a **estrutura, cópia e
  layout** do protótipo (headline, overlines, títulos, rótulos e alvos de CTA), responsiva
  (mobile→desktop nos breakpoints do design system) e correta em light/dark.
- [ ] **G5** — A home é **estática/pública pura**: sem sessão, `getCurrentPerson`, View Models, Prisma
  direto, Server Actions ou PII no HTML. O único dado dinâmico é o trio de contadores agregados da
  USP-041 (estruturalmente `number`).
- [ ] **G6** — **Seams para a USP-048:** os alvos de CTA (hrefs), a ação de busca e os dados de destaque
  são **props com defaults de rota real**, de modo que a USP-048 ligue busca→resultados vivos, dados de
  destaque vivos e o fluxo integrado `showPage()` **sem reescrever** as seções.

## Out of Scope

Explicitamente excluído para evitar scope creep. USP-047 é **só a composição da home**.

| Item | Por quê / dono |
|---|---|
| **Casca** (header/nav/footer) e sua montagem no layout | É **USP-046** (já mergeada). A home é apenas o **corpo** da página; não re-declara header/footer nem `<main>` (vem do `(public)/layout.tsx`, CASCA-12). |
| **Wiring de navegação integrada**: busca→resultados vivos, dados de destaque vivos (vagas/serviços reais), fluxo `showPage()` (`/vagas`, `/servicos`, cadastros diferenciados candidato/empresa), active-state cruzado | É **USP-048** (ROADMAP §Fase 7). USP-047 entrega o markup + os **seams**; USP-048 os liga a rotas/dados vivos (ver DEF-1..DEF-4 em design.md). |
| Rota pública de **cadastro de empresa / publicar vaga** | Inexistente hoje (empresa vive sob `(app)/empresa`, autenticado). Os CTAs de empresa apontam ao `/cadastro` público como default de seam (A-05); a diferenciação candidato/empresa é USP-048. |
| Páginas institucionais reais (Sobre, A Paróquia, Termos, Contato) | Rotas inexistentes; herdado do DEF-2 da USP-046. Não há links institucionais na home além dos que a casca já trata. |
| Alterar o `HomeIndicatorsView` / `getHomeIndicators` (USP-041) | A home **consome** o componente e a query como estão; mudar o contrato dos indicadores é da USP-041. |
| Novo model Prisma / migração / Server Action | Unidade presentacional; nenhum IO novo. |
| Testes de regressão visual (screenshots/Chromatic/Percy) | Fora do stack; paridade validada por RTL + guardas estáticas + build (precedente Fase 1/USP-046). |
| E2E dedicado da home como gate de merge | Deferido (DEF-4, precedente USP-046); E2E roda `skipped` em PR comum (MEMORY). Lição **L-007**: se um cenário E2E for adicionado, tem de ser `e2e/*.spec.ts` real com asserções vivas, nunca skeleton em `.specs/`. |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida e registrada aqui (modo autônomo, `owner = agent`). Nada fica silenciosamente
indefinido.

| # | Assumption / decisão | Owner | Default escolhido | Rationale | Confirmed? |
|---|---|---|---|---|---|
| A-01 | **Onde a home é composta** | agent | Reescrever o corpo de `src/app/(public)/page.tsx` compondo componentes de seção; **manter** `export const revalidate = 600`, `loadIndicators()` + `FALLBACK_INDICATORS` e o `childLogger`. | O ISR (ADR-0013) e o fallback on-read (ADR-0026) já estão corretos e guardados (`home-revalidate.test.ts`); a USP-047 só troca o `{children}`. | y (evidência: `page.tsx` atual) |
| A-02 | **Onde os componentes de seção moram** | agent | `src/app/(public)/_components/` — `home-hero.tsx`, `home-search.tsx`, `home-featured-jobs.tsx`, `home-how-it-works.tsx`, `home-personas.tsx`, `home-services.tsx`, `home-cta.tsx`. NÃO em `src/shared/ui/`. | Segue **AD-025** (USP-046): chrome/composição acoplado ao grupo `(public)` vive em `_components`; `shared/ui` é reservado a primitivos genéricos (DS-05). As guardas `casca-*` já varrem esse diretório → cobrem os novos arquivos. | y (evidência: AD-025 em USP-046 design.md §11; `casca-uses-tokens.test.ts` varre `(public)/_components/**`) |
| A-03 | **Números-âncora do hero (247/1.8k/156)** | agent | Substituir os "hero-stats" falsos do protótipo pelo **`HomeIndicatorsView` real** (USP-041), embutido na posição dos stats do hero, alimentado pelo `indicators` já carregado em `page.tsx`. | Requisito do ROADMAP ("estende — não descarta os indicadores"). Os rótulos reais do componente ("Vagas ativas"/"Candidatos"/"Empresas verificadas") e o "Em breve" < 5 **vencem** os números falsos do protótipo — divergência de fidelidade deliberada a favor do contrato REL41 (must-not regredir). | y (evidência: `home-indicators.tsx`; `page.test.tsx`) |
| A-04 | **CTAs triviais → rota real agora** | agent | "Buscar Vagas" (hero) → `/vagas`; cards/CTA de Serviços → `/servicos`; "Sou Candidato"/"Criar Meu Perfil"/"Cadastrar como Candidato" → `/cadastro`. `<Link href>` real, via seam prop com esse default. | São mapeamentos triviais a rotas públicas existentes (guia da fase: "onde um CTA mapeia trivialmente a uma rota existente, um `<Link href>` simples serve agora"). | y (evidência: rotas `(public)/vagas`, `(public)/servicos`, `(auth)/cadastro`) |
| A-05 | **CTAs de empresa sem rota pública** ("Publicar Vaga", "Sou Empresa"/"Cadastrar Empresa", "Cadastrar como Empresa") | agent | Default de seam = `/cadastro` (mesma entrada pública de cadastro que a casca usa em "Cadastrar", USP-046 A-04). USP-048 retargeta ao fluxo de empresa. | Não existe rota pública de cadastro de empresa (empresa vive sob `(app)/empresa`, autenticado). Um `<Link>` a `/cadastro` é **fiel (botão real, não "em breve") e não-morto**; a diferenciação candidato/empresa é wiring vivo = USP-048. | y (evidência: `(app)/empresa` autenticado; ausência de rota pública; USP-046 A-04) |
| A-06 | **UI de busca no hero** | agent | Adicionar um `<form role="search">` no hero com `<input>` rotulado + botão de submit; `action` é seam prop com default GET `/vagas` (degrada graciosamente — a página de vagas já lê `?q=`). | O protótipo `#page-home` não tem `<input>` de busca (usa o botão "Buscar Vagas"), mas o **alvo da fase lista "busca"** explicitamente. Entregar a **UI de busca** (composição/fidelidade ao design system) é USP-047; a **submissão→resultados vivos / escopo integrado** é USP-048 (seam). | y (evidência: alvo da fase; `vagas/page.tsx` lê `sp.q`) |
| A-07 | **Destaques (cards de vaga/serviço)** | agent | Cards **presentacionais** com conteúdo estático fiel ao protótipo (2 mini-cards de vaga no hero-visual: "Auxiliar Administrativo"/"Técnico em Enfermagem"; 3 categorias de serviço). Seam `jobs?`/estático → USP-048 injeta dados vivos. | O protótipo os desenha estáticos (mock). "Dados de destaque vivos" é explicitamente USP-048. | y (evidência: protótipo L873-900, L991-1013) |
| A-08 | **Gradiente/cores inline do protótipo** (`#DBEAFE`, `#1D4ED8`, `rgba(255,255,255,…)`, strokes `#2563EB`/`#F97316`) | agent | Mapear tudo para classes token/utilitárias sem hex cru: fundo do CTA final `bg-gradient-to-br from-primary to-secondary` (precedente do logo da casca); tints de ícone `bg-primary/10` / `bg-cta/10`; strokes `text-primary`/`text-cta`; texto/superfícies em botões coloridos via `text-white`/`bg-white`/`bg-white/15` + `border-white/40`. | DS-MN-01 proíbe hex cru em `.tsx`; não há token para o azul mais escuro `#1D4ED8` (adicionar token seria mudança de DS fora de escopo). `text-white`/`bg-white` são utilitários (não `#hex`, não paleta numérica) — precedente aprovado na casca (`site-header`/`site-footer` usam `text-white`). | y (evidência: `casca-uses-tokens.test.ts` (pattern só pega `#RRGGBB` e `-<cor>-<num>`); `site-header.tsx` usa `text-white` + `from-primary to-secondary`) |
| A-09 | **Componentização vs. um único arquivo** | agent | 7 componentes de seção + reescrita fina de `page.tsx` (composição). | Atomicidade/testabilidade (skill Tasks: 1 componente = 1 tarefa) + AD-025. Mantém `page.tsx` enxuto (só carrega indicadores e compõe). | y |
| A-10 | **Ícones (SVG)** | agent | SVG inline (paridade com os paths do protótipo), como na casca — **sem** `lucide-react`/lib de ícones; contêiner colorido via `StepIcon` (`shared/ui`). | Allowlist de deps (CLAUDE.md; DS-MN-05); guarda `casca-no-icon-state-lib` varre `(public)/_components/**`. | y (evidência: `casca-no-icon-state-lib.test.ts`; `StepIcon` no barrel de `shared/ui`) |

**Open questions:** none — todas resolvidas/registradas acima.

---

## User Stories

### P1: Hero fiel — headline, busca, CTAs, destaque de vagas e indicadores ⭐ MVP

**User Story**: Como visitante que abre o portal, quero um hero que apresente a proposta, me deixe buscar
vagas, agir (candidatar-me / publicar) e ver os números da comunidade — como no protótipo — para me
orientar e engajar já na primeira dobra.

**Why P1**: O hero é a primeira dobra e o núcleo de "abrir como o protótipo"; sem ele a home não existe.

**Acceptance Criteria**:

1. WHEN a home renderiza THEN o sistema SHALL exibir um hero com um único `<h1>` "Conectando **talentos**
   a oportunidades na comunidade" (a palavra "talentos" com ênfase visual via token, ex. `text-primary`)
   e o subtítulo do protótipo (Paróquia N. S. de Guadalupe, Canasvieiras/SC; iniciativa social que
   aproxima candidatos e empresas) (paridade `.hero-content` L847-849). **[HOME-01]**
2. WHEN o hero renderiza as ações THEN o sistema SHALL exibir um CTA primário "Buscar Vagas" (→ seam
   `verVagasHref`, default `/vagas`) e um CTA secundário "Publicar Vaga" (→ seam `publicarVagaHref`,
   default `/cadastro`, A-05), via `Button asChild` sobre `<Link>` (L851-855). **[HOME-02]**
3. WHEN o hero renderiza a busca THEN o sistema SHALL exibir um `<form role="search">` com um `<input>`
   **rotulado** (label acessível) e um botão de submit; a `action` é seam (default GET `/vagas`, `name="q"`),
   degradando graciosamente; a submissão→resultados vivos/escopo integrado é USP-048 (A-06). **[HOME-03]**
4. WHEN o hero renderiza o visual THEN o sistema SHALL exibir ≥2 **cards de destaque de vaga** estáticos
   fiéis ao protótipo (título + empresa + tags), via seam `jobs?` (default estático); dados vivos são
   USP-048 (A-07, L873-900). **[HOME-04]**
5. WHEN o hero renderiza os números-âncora THEN o sistema SHALL embutir o `HomeIndicatorsView` da USP-041
   (3 indicadores: "Vagas ativas"/"Candidatos"/"Empresas verificadas") alimentado pelo `indicators`
   carregado em `page.tsx`; abaixo do limiar SHALL exibir "Em breve" (delegado ao componente, REL41-MN-02).
   O componente da USP-041 **não é alterado** — o hero apenas o posiciona (A-03). **[HOME-05]**

**Independent Test**: RTL de `HomeHero` (com um `indicators` mockado e stubs dos sub-componentes)
confirma: `<h1>` com "talentos", subtítulo, CTA "Buscar Vagas"→`/vagas` e "Publicar Vaga"→`/cadastro`,
`<form role="search">` com input rotulado, ≥2 cards de destaque, e o `data-testid="home-indicators"`
presente. Render sob `data-theme="dark"` não quebra.

---

### P1: Seções institucionais — Como Funciona e Para Quem ⭐ MVP

**User Story**: Como visitante, quero entender em 3 passos como o portal funciona e me reconhecer como
candidato ou empresa — como no protótipo — para confiar e saber o próximo passo.

**Why P1**: São as seções que traduzem a proposta e direcionam candidato/empresa; centrais à fidelidade.

**Acceptance Criteria**:

1. WHEN a seção "Como Funciona" renderiza THEN o sistema SHALL exibir a overline "Como Funciona", o `<h2>`
   "Simples, rápido e gratuito", o subtítulo e **3 passos** (PASSO 01 "Crie seu perfil"; PASSO 02 "Busque
   e filtre"; PASSO 03 "Conecte-se"), cada um com ícone (via `StepIcon`), título e descrição do protótipo
   (L906-938). **[HOME-06]**
2. WHEN a seção "Para Quem" renderiza THEN o sistema SHALL exibir a overline "Para Quem", o `<h2>` "Uma
   plataforma, duas perspectivas" e **2 cards de persona**: "Sou Candidato" (lista de 4 features + CTA
   "Criar Meu Perfil" → seam `candidatoHref`, default `/cadastro`) e "Sou Empresa" (4 features + CTA
   "Cadastrar Empresa" → seam `empresaHref`, default `/cadastro`, A-05) (L943-980). **[HOME-07]**

**Independent Test**: RTL de `HomeHowItWorks` confirma overline/`<h2>`/3 passos com títulos corretos;
RTL de `HomePersonas` confirma os 2 cards, as listas de features e os CTAs com `href` dos seams.

---

### P1: Destaque de Serviços e faixa de CTA final ⭐ MVP

**User Story**: Como visitante, quero descobrir que o portal também conecta prestadores de serviço e ser
convidado a participar da iniciativa — como no protótipo — para explorar serviços e me cadastrar.

**Why P1**: Fecham a landing (destaque de serviços + conversão); sem elas a home não "abre como o protótipo".

**Acceptance Criteria**:

1. WHEN a seção de Serviços renderiza THEN o sistema SHALL exibir a overline "Serviços", o `<h2>` "Precisa
   de um profissional?", o subtítulo e **3 cards de categoria** ("Serviços Domésticos"; "Reparos e
   Manutenção"; "Área Externa") cada um linkando ao seam `servicosHref` (default `/servicos`), mais o CTA
   "Ver Todos os Serviços" (→ `servicosHref`) (L983-1021). **[HOME-08]**
2. WHEN a faixa de CTA final renderiza THEN o sistema SHALL exibir o `<h2>` "Faça parte dessa iniciativa
   social", o subtítulo e **2 CTAs**: "Cadastrar como Candidato" (→ `candidatoHref`, `/cadastro`) e
   "Cadastrar como Empresa" (→ `empresaHref`, `/cadastro`, A-05), sobre um fundo em gradiente de token
   (`from-primary to-secondary`, A-08), texto legível em light/dark (L1023-1033). **[HOME-09]**

**Independent Test**: RTL de `HomeServices` confirma overline/`<h2>`/3 categorias linkando `/servicos` +
CTA "Ver Todos os Serviços"; RTL de `HomeCta` confirma o `<h2>`, os 2 CTAs com `href` dos seams, e que o
fundo usa classes token (guarda estática cobre hex).

---

### P1: Composição na página, acessibilidade, responsividade e não-regressão ⭐ MVP

**User Story**: Como desenvolvedor da Fase 7, quero a home composta em `(public)/page.tsx` a partir das
seções, acessível e responsiva, sem regredir os indicadores nem o ISR — para que o portal abra fiel ao
protótipo e nada existente quebre.

**Why P1**: A home só cumpre o objetivo se compuser tudo sob a casca, acessível/responsiva, preservando
o contrato da USP-041.

**Acceptance Criteria**:

1. WHEN `src/app/(public)/page.tsx` renderiza THEN o sistema SHALL compor as seções na ordem hero →
   Como Funciona → Para Quem → Serviços → CTA final, **sem** re-declarar `<main>` (vem do layout, CASCA-12)
   e mantendo `export const revalidate = 600` + `loadIndicators()`/`FALLBACK_INDICATORS` (A-01). **[HOME-10]**
2. WHEN as seções renderizam em viewport estreita THEN o sistema SHALL colapsar as grades para 1 coluna e
   expandir em desktop nos breakpoints do design system (paridade responsiva do protótipo), sem overflow
   horizontal do body. **[HOME-11]**
3. WHEN a home renderiza em `data-theme="dark"` THEN o sistema SHALL exibir corretamente usando **apenas**
   classes mapeadas por token; SHALL NOT reintroduzir `@media (prefers-color-scheme)` sobre os tokens
   (DS-MN-04). **[HOME-12]**
4. WHEN a home renderiza THEN o sistema SHALL usar landmarks/semântica acessíveis: cada seção como
   `<section>` com nome acessível (`aria-labelledby`/`aria-label`), **um único `<h1>`** (o do hero) e
   hierarquia h1→h2→h3, links/botões com texto discernível, e SVGs decorativos `aria-hidden`. **[HOME-13]**
5. WHEN cada seção é entregue THEN o sistema SHALL expor os alvos de CTA (hrefs), a ação de busca e os
   dados de destaque como **props com defaults de rota real**, de forma que a USP-048 os retargete
   (busca→resultados, dados vivos, fluxo integrado) **sem** reescrever as seções (G6). **[HOME-14]**

**Independent Test**: RTL de `page.tsx` (com `getHomeIndicators` mockada) confirma a ordem das seções,
`queryByRole('main')` ausente, **exatamente um** heading nível 1, e os 3 indicadores presentes (contrato
preservado); com a query em erro, a página carrega e os indicadores caem para "Em breve" (fallback).
Leitura do arquivo confirma `revalidate = 600`. Guardas estáticas confirmam tokens/sem-CDN/sem-PII.

---

## Edge Cases

- WHEN `getHomeIndicators()` lança (DB indisponível) THEN a home SHALL carregar normalmente e os
  indicadores SHALL cair para "Em breve" (via `FALLBACK_INDICATORS`, ADR-0026) — nenhuma seção quebra.
- WHEN os contadores estão abaixo do limiar mínimo (cold start, ex. 0/1/2) THEN o `HomeIndicatorsView`
  SHALL exibir "Em breve" em vez do número cru (REL41-MN-02) — a home não contorna esse comportamento.
- WHEN a USP-048 não passou nenhum seam THEN cada CTA/busca/destaque SHALL usar seu **default de rota
  real** (nenhum link morto `href="#"`, nenhum handler client).
- WHEN a viewport cruza o breakpoint com conteúdo largo (tabela de destaques/cards) THEN o layout SHALL
  degradar para 1 coluna sem provocar scroll horizontal do `<body>`.
- WHEN um componente de seção recebe `className` extra (seam) THEN SHALL mesclar via `cn` sem
  duplicar/contradizer classes de token.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um **teste negativo** (guarda estática
`node:fs` no padrão `src/shared/__tests__/*.test.ts`, ou asserção RTL) asseverando que o resultado
proibido não ocorre. Precedente: guardas `casca-*` (USP-046) e `ds-*`/`closed-src-root` (Fase 1).

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| HOME-MN-01 | WHEN a home (`(public)/page.tsx` + `(public)/_components/home-*.tsx`) é montada THEN SHALL NOT importar/consumir sessão, `getCurrentPerson`, View Models, Prisma/`@/shared/lib/prisma`, Server Actions (`'use server'`), nem renderizar PII/dado autenticado — é landing pública estática; o único dado dinâmico é o trio de contadores agregados (estruturalmente `number`) da USP-041. | Vazamento de PII/estado autenticado no HTML público/ISR (lição RSC/Flight: SELECT condicional ao papel); quebra do contrato de privacidade (View Models). | T9 (guarda de page.tsx) + guarda `casca-no-auth-pii` existente (cobre `_components/**`) | `src/shared/__tests__/home-page-static.test.ts` (scan de imports proibidos em `(public)/page.tsx`) |
| HOME-MN-02 | WHEN um arquivo da home é estilizado THEN SHALL NOT conter hex cru (`#RRGGBB`), utilitário de paleta fixa (`bg-blue-600`, `text-gray-*`, `from-slate-*`…), `system-ui`, nem CDN/host externo (`fonts.googleapis`/`gstatic`/`href="http`/`src="http`) — só classes token e assets da fundação. | Quebra de dark-mode / drift da fonte única de tokens / falha de CSP em prod (mesma razão DS-MN-01/02/04, CASCA-MN-02/03). | T9 (page.tsx) + guardas `casca-uses-tokens`/`casca-no-external-cdn` existentes (cobrem `_components/**`) | `src/shared/__tests__/home-page-static.test.ts` (scan de `(public)/page.tsx`) + guardas `casca-*` verdes sobre os novos `home-*.tsx` |
| HOME-MN-03 | WHEN a home apresenta os indicadores THEN SHALL NOT (a) re-implementar a contagem ou renderizar números crus fora do `HomeIndicatorsView`; (b) exibir um número abaixo do limiar em vez de "Em breve" (REL41-MN-02); (c) elevar o piso de ISR acima de 600s (`revalidate ≤ 600`, REL41-MN-03). | Regressão do contrato da USP-041 (count-only, "Em breve" < 5, frescor da home). | T7 (embed) + T8 (page) | `page.test.tsx` (Em breve < 5 + fallback + testid dos indicadores) **preservado** + `reporting/__tests__/home-revalidate.test.ts` **verde** (guarda `revalidate ≤ 600`) |
| HOME-MN-04 | WHEN a home é montada THEN SHALL NOT adicionar um segundo landmark `<main>` (vem do `(public)/layout.tsx`, CASCA-12) nem mais de um `<h1>`. | Duplicação de landmark/heading (a11y); regressão da migração da USP-046. | T8 (page) | `page.test.tsx` RTL: `queryByRole('main')` ausente + `getAllByRole('heading',{level:1})` com length 1 |

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
|---|---|---|---|
| HOME-01 | P1 Hero: `<h1>` "talentos" + subtítulo | Execute | Verified |
| HOME-02 | P1 Hero: CTAs Buscar Vagas/Publicar Vaga (seams) | Execute | Verified |
| HOME-03 | P1 Hero: UI de busca (`role="search"`, seam action) | Execute | Verified |
| HOME-04 | P1 Hero: cards de destaque de vaga (estático + seam) | Execute | Verified |
| HOME-05 | P1 Hero: embed do `HomeIndicatorsView` (USP-041) | Execute | Verified |
| HOME-06 | P1 Como Funciona: overline + `<h2>` + 3 passos | Execute | Verified |
| HOME-07 | P1 Para Quem: overline + `<h2>` + 2 personas + CTAs (seams) | Execute | Verified |
| HOME-08 | P1 Serviços: overline + `<h2>` + 3 categorias + CTA (seam) | Execute | Verified |
| HOME-09 | P1 CTA final: `<h2>` + 2 CTAs (seams) + fundo token | Execute | Verified |
| HOME-10 | P1 Página: composição ordenada + revalidate 600 + sem `<main>` | Execute | Verified |
| HOME-11 | P1 Página: responsivo (colapso 1-coluna → desktop) | Execute | Verified |
| HOME-12 | P1 Página: dark-mode só com tokens (sem `@media`) | Execute | Verified |
| HOME-13 | P1 Página: a11y (sections nomeadas, 1 `<h1>`, SVG aria-hidden) | Execute | Verified |
| HOME-14 | P1 Seams: hrefs/ação-de-busca/dados de destaque como props (USP-048) | Execute | Verified |
| HOME-MN-01 | Must-Not: home sem sessão/PII/Prisma/ViewModel/Server Action | Execute | Verified |
| HOME-MN-02 | Must-Not: home só com classes token, sem CDN externo | Execute | Verified |
| HOME-MN-03 | Must-Not: não regredir contrato de indicadores/ISR (USP-041) | Execute | Verified |
| HOME-MN-04 | Must-Not: sem segundo `<main>` nem múltiplos `<h1>` | Execute | Verified |

**ID format:** `HOME-NN` / must-nots `HOME-MN-NN` (precedente `CASCA-NN`).
**Status values:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 18 requisitos (14 funcionais + 4 must-nots); mapeamento para tarefas em `tasks.md`.

---

## Success Criteria

- [ ] `(public)/page.tsx` compõe hero → Como Funciona → Para Quem → Serviços → CTA final; a home "abre como o protótipo".
- [ ] Hero fiel: `<h1>` "Conectando talentos…", subtítulo, CTAs (Buscar Vagas→`/vagas`, Publicar Vaga→`/cadastro`), UI de busca, ≥2 cards de destaque, e o `HomeIndicatorsView` embutido.
- [ ] Como Funciona (3 passos) + Para Quem (2 personas com features + CTAs) fiéis ao protótipo.
- [ ] Serviços (3 categorias + "Ver Todos os Serviços"→`/servicos`) + CTA final (2 CTAs de cadastro) fiéis.
- [ ] Indicadores da USP-041 embutidos sem regressão: count-only, PII-free, "Em breve" < 5, `revalidate = 600` (guardas verdes).
- [ ] A11y: sections nomeadas, **um** `<h1>`, hierarquia de headings, SVGs `aria-hidden`, nenhum segundo `<main>`.
- [ ] Light/dark corretos; só classes token; nenhuma paleta crua/hex/CDN externo (guardas `casca-*` + `home-page-static` verdes).
- [ ] Seams entregues: hrefs/ação-de-busca/dados de destaque como props com defaults de rota real (USP-048 pluga sem reescrever).
- [ ] Não-regressão: `page.test.tsx` migrado mantendo o contrato de indicadores; suíte de páginas públicas existentes verde.
- [ ] Gates verdes: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
