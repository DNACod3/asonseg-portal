# USP-046 — Casca de navegação pública (Header + Footer globais) — Specification

> **Modo: Greenfield-adapter (não-ICE).** Esta USP é **net-new** — não consta das 44 USPs do PRD
> nem há card em `docs/prd/matriz-conexoes.md` (verificado: arquivo/entrada ausentes). Portanto NÃO
> há intent/expectations ICE a resolver; a Specify **gera** os requisitos a partir da fonte visual da
> verdade (`docs/prototipo/index.html`) e dos precedentes da Fundação de Design System da Fase 1
> (AD-014/AD-015, guardas `DS-MN-*`). Toda decisão discricionária vira **assumption registrada** (modo
> autônomo — sem gate de confirmação com o usuário).
>
> **Epic:** `fachada-publica` · **Fase 7 — Fachada Pública** · **Precede:** USP-047 (home/landing) e
> USP-048 (navegação integrada), que **consomem** esta casca no mesmo PR.

## Problem Statement

O protótipo (`docs/prototipo/index.html`) abre com uma **casca de navegação global**: um `header`
sticky (logo ASONSEG + navegação primária + ações Entrar/Cadastrar + menu mobile) e um `footer`
institucional (marca + colunas de links + copyright). Essa casca envolve **todas** as telas públicas
do protótipo e é o que faz o portal "abrir como o protótipo".

No app real, essa casca **não existe**. `src/app/layout.tsx` (root) só renderiza `{children}` + um
`ThemeToggle` flutuante fixo; `src/app/(public)/layout.tsx` é um pass-through `<>{children}</>`. As
telas públicas já prontas (`/`, `/vagas`, `/servicos`, mais os detalhes) renderizam "soltas", sem
header nem footer — não há como navegar entre elas nem identidade visual de portal. A Fundação de
Design System da Fase 1 já portou tokens/fontes/dark-mode e o primitivo `Button` (com `asChild`), mas
os componentes de **layout de página** do protótipo (header/nav, footer) foram explicitamente deixados
fora daquela unidade (`fundacao-ui-design-system/spec.md` §Out of Scope).

Esta USP entrega **apenas a casca** do grupo `(public)`: `SiteHeader` + `PublicNav` + `SiteFooter`,
montados no `(public)/layout.tsx`, fiéis ao protótipo e reutilizando os tokens/primitivos da Fase 1,
com **seams** (props/slots) para USP-047 (composição da home) e USP-048 (navegação integrada)
estenderem sem reescrever a casca.

## Goals

- [ ] **G1** — O grupo `(public)` renderiza um `header` global sticky fiel ao protótipo (logo →
  `/`, navegação primária, ações Entrar/Cadastrar, menu mobile) e um `footer` institucional, ambos
  montados **uma única vez** no `(public)/layout.tsx` (envolvem todas as rotas públicas).
- [ ] **G2** — A navegação usa **rotas reais existentes**: Início `/`, Vagas `/vagas`, Serviços
  `/servicos`; Entrar `/login`, Cadastrar `/cadastro`. Nenhum link morto (`href="#"`) nem link para
  rota inexistente.
- [ ] **G3** — Estado de link ativo: o item de nav correspondente à rota atual recebe marcação `active`
  (paridade com `.nav a.active` do protótipo) via `usePathname()`.
- [ ] **G4** — Acessibilidade + responsividade como ACs de primeira classe: landmarks semânticos
  (`<header>`, `<nav aria-label>`, `<footer>`), navegação por teclado, menu mobile acessível (botão
  com `aria-expanded`/`aria-controls`), colapso desktop→mobile nos mesmos breakpoints do protótipo.
- [ ] **G5** — A casca é **presentacional/navegacional pura**: reutiliza tokens (`bg-surface`,
  `text-fg`, `border-border`, `font-heading`…) e o primitivo `Button` (`asChild`), funciona em
  light/dark, **sem** tocar em Server Actions, Prisma, sessão, View Models ou PII.
- [ ] **G6** — Seams para o restante da Fase 7: `PublicNav` consome uma lista tipada de itens
  (default = destinos públicos reais) e o `SiteHeader`/`SiteFooter` expõem pontos de extensão, de modo
  que USP-047/048 adicionem itens/CTAs sem alterar a mecânica da casca.

## Out of Scope

Explicitamente excluído para evitar scope creep. USP-046 é **só a casca**.

| Item | Por quê / dono |
|---|---|
| Composição da **home/landing** (hero, how-it-works, personas, seção de serviços, CTA, indicadores) | É **USP-047**. USP-046 entrega o header/footer que a home vai vestir, não o miolo da home. |
| **Wiring de navegação integrada** entre telas (breadcrumbs, back-links, CTAs cruzados, itens "Sou Candidato/Sou Empresa", active-state em rotas de detalhe) | É **USP-048**. USP-046 entrega a nav primária funcional + seams; USP-048 integra o resto. |
| Páginas institucionais (Sobre a ASONSEG, A Paróquia, Termos e Privacidade, Contato) e suas rotas | Rotas inexistentes hoje. Links institucionais do footer ficam **deferidos** (ver A-07). |
| Realocar o `ThemeToggle` para dentro do header (como no protótipo) | O toggle flutuante fixo do root layout (Fase 1) já serve as páginas públicas. Mover afeta root layout + grupos `(auth)`/`(app)` → fora de escopo (ver A-05, DEF-1). |
| Casca dos grupos `(auth)` e `(app)` | Cada grupo tem chrome próprio; esta USP toca só `(public)`. |
| Novo módulo `modules/fachada-publica` | Não é um dos 11 módulos canônicos; a casca é composição do grupo `(public)` (ver design.md §Component Location). |
| Testes de regressão visual (screenshots/Chromatic/Percy) | Fora do stack; paridade validada por build + RTL + guardas estáticas (precedente Fase 1). |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida e registrada aqui (modo autônomo, `owner = agent`). Nada fica silenciosamente
indefinido.

| # | Assumption / decisão | Owner | Default escolhido | Rationale | Confirmed? |
|---|---|---|---|---|---|
| A-01 | **Onde a casca vive** | agent | Montada em `src/app/(public)/layout.tsx` (`<SiteHeader/> {children} <SiteFooter/>`). | O layout do grupo `(public)` envolve exatamente as rotas públicas; `(auth)`/`(app)` têm chrome próprio. O `revalidate` continua por página (layout não o declara) → ISR intacto. | y (evidência: `(public)/layout.tsx` pass-through; `(public)/page.tsx` declara `revalidate`) |
| A-02 | **Onde os componentes moram** | agent | `src/app/(public)/_components/` (`site-header.tsx`, `public-nav.tsx`, `site-footer.tsx`). NÃO em `src/shared/ui/`. | `shared/ui` é a fundação de **primitivos genéricos** (DS-05); a casca é acoplada a rotas públicas (`/vagas`, `/login`…), específica do grupo. Colocação `_`-prefixada é pasta privada do App Router (não vira rota) e mantém `src/` fechada (ainda sob `app/`). Alternativa (shared/ui) discutida e rejeitada em design.md. | y |
| A-03 | **Itens da nav primária** | agent | Início `/`, Vagas `/vagas`, Serviços `/servicos` (destinos públicos reais). | São as 3 telas públicas prontas. Os itens "Sou Candidato/Sou Empresa" do protótipo apontam ambos para cadastro e são wiring de USP-048 → expostos via seam, não hard-coded aqui. | y (evidência: rotas `(public)/*` e `(auth)/cadastro`) |
| A-04 | **Destino dos CTAs Entrar/Cadastrar** | agent | Entrar → `/login`; Cadastrar → `/cadastro`. | Rotas reais do grupo `(auth)` (descobertas, não assumidas). O protótipo aponta ambos para telas de cadastro mock. | y (evidência: `(auth)/login`, `(auth)/cadastro`) |
| A-05 | **Theme toggle no header** | agent | **Não** adicionar toggle no header nesta USP. Mantém o `ThemeToggle` fixo global (root layout, Fase 1). | Um 2º toggle no header enquanto o fixo persiste = dois controles idênticos na mesma página (odor de a11y/duplicidade). Remover o fixo afeta `(auth)`/`(app)` → fora de escopo. Realocação vira DEF-1. | y (evidência: `layout.tsx` root renderiza `ThemeToggle` fixo) |
| A-06 | **Mecânica do menu mobile** | agent | Botão hamburguer + painel togglado por `useState` (React nativo), ícones SVG inline. Sem lib de estado, sem `lucide-react`. | Segue o precedente `ThemeToggle` (DS-14/DS-MN-05): interatividade mínima sem ampliar deps proibidas. | y (evidência: `theme-toggle.tsx`; prototype `toggleMobile()`) |
| A-07 | **Links institucionais do footer** (Sobre, A Paróquia, Termos, Contato) | agent | Coluna renderizada por fidelidade, mas os itens sem rota real são **não-links** (texto mudo, não focáveis) e marcados DEF-2. Nenhum `href="#"`. | Preserva o layout de 4 colunas do protótipo sem shippar links mortos (a11y/UX). Vira link quando as páginas existirem (USP futura). | y |
| A-08 | **`SiteFooter`/`SiteHeader` como Server Components; `PublicNav` como Client** | agent | `SiteFooter` e o casco do `SiteHeader` = Server Components (estáticos, cacheáveis); `PublicNav` = `'use client'` (precisa de `usePathname()` + estado do menu mobile). | Mantém a casca majoritariamente estática/ISR-friendly; só a parte interativa é client. | y |
| A-09 | **Registrar convenção como decisão de projeto** | agent | Propor **AD-025** (bloco pronto em design.md) — não editar `STATE.md` (escopo Planner). Numeração final é do orquestrador (AD-024 é o último registrado). | Fixa a convenção "casca do grupo em `(public)/_components` + montagem no layout do grupo" que USP-047/048 seguirão. | y |

**Open questions:** none — todas resolvidas/registradas acima.

---

## User Stories

### P1: Header público global fiel ao protótipo ⭐ MVP

**User Story**: Como visitante do portal, quero um cabeçalho consistente em todas as páginas públicas —
com a marca ASONSEG, navegação para as seções e acesso a Entrar/Cadastrar — para me orientar e navegar
como no protótipo.

**Why P1**: Sem o header não há navegação nem identidade de portal; é o núcleo de "abrir como o protótipo".

**Acceptance Criteria**:

1. WHEN qualquer rota do grupo `(public)` renderiza THEN o sistema SHALL exibir um landmark `<header>`
   sticky no topo, contendo: a marca (logo-icon "A" + "ASONSEG" + subtítulo "Portal de Vagas") que
   navega para `/`; um `<nav>` de navegação primária; e as ações Entrar/Cadastrar. (paridade
   `.header`/`.logo`/`.nav`/`.nav-actions` do protótipo L811-838).
2. WHEN o header renderiza a navegação primária THEN o sistema SHALL exibir os itens **Início** (`/`),
   **Vagas** (`/vagas`) e **Serviços** (`/servicos`), cada um como `<a>` (Next `<Link>`) para a rota
   real correspondente (CASCA-01, A-03).
3. WHEN o header renderiza as ações THEN o sistema SHALL exibir **Entrar** (variante `outline`, tamanho
   `sm`, → `/login`) e **Cadastrar** (variante `primary`, tamanho `sm`, → `/cadastro`), reutilizando o
   primitivo `Button` via `asChild` sobre um `<Link>` (sem `<button>` extra) (A-04, reuso DS-06).
4. WHEN o header é estilizado THEN o sistema SHALL usar **apenas** classes mapeadas por token
   (`bg-surface`, `text-fg`, `text-fg-muted`, `border-border`, `text-primary`, `font-heading`…), sem
   hex cru nem utilitário de paleta fixa, exibindo corretamente em light e `data-theme="dark"`
   (CASCA-MN-02).

**Independent Test**: RTL de `SiteHeader` confirma landmark `<header>`, marca linkando `/`, os 3 itens
de nav com `href` correto, e os 2 `Button asChild` linkando `/login`/`/cadastro`; render sob
`data-theme="dark"` não quebra. Guarda estática confirma ausência de paleta crua nos arquivos da casca.

---

### P1: Navegação com estado ativo, teclado e menu mobile ⭐ MVP

**User Story**: Como visitante (inclusive em celular e por teclado), quero saber em que seção estou e
abrir/fechar o menu em telas estreitas, para navegar sem fricção e de forma acessível.

**Why P1**: Navegação sem active-state, sem teclado ou sem menu mobile não é fiel ao protótipo nem acessível.

**Acceptance Criteria**:

1. WHEN a rota atual corresponde a um item da nav THEN o sistema SHALL marcar **apenas** esse item como
   ativo (`aria-current="page"` + marcação visual `.active` do protótipo), derivado de `usePathname()`;
   `/vagas/[id]` marca "Vagas" e `/servicos/[id]` marca "Serviços" como ativos (match por prefixo de
   seção) (CASCA-03).
2. WHEN a viewport é ≤768px THEN o sistema SHALL ocultar a nav/ações inline e exibir o botão de menu
   mobile (paridade media query do protótipo L677-680); WHEN ≥769px THEN SHALL exibir a nav/ações inline
   e ocultar o botão mobile.
3. WHEN o usuário aciona o botão de menu mobile THEN o sistema SHALL alternar a visibilidade do painel de
   navegação e refletir o estado em `aria-expanded` (e `aria-controls` apontando o painel), usando
   apenas React nativo (`useState`) — sem lib de estado, sem `lucide-react` (A-06, CASCA-MN-04).
4. WHEN o usuário navega por teclado THEN todos os links/botões do header SHALL ser focáveis na ordem do
   DOM, com foco visível (herdado dos tokens/primitivos), e o `<nav>` SHALL ter `aria-label` (ex.:
   "Navegação principal").

**Independent Test**: RTL de `PublicNav` com `usePathname` mockado confirma `aria-current`/classe ativa
no item certo (incl. `/vagas/123` → Vagas); simula clique no botão mobile e verifica `aria-expanded`
true/false e a exibição do painel; confirma `aria-label` do `<nav>` e `role`/`aria-controls` do botão.

---

### P1: Footer institucional fiel ao protótipo ⭐ MVP

**User Story**: Como visitante, quero um rodapé com a identidade da ASONSEG e atalhos para as seções,
para reforçar a confiança institucional e ter navegação secundária, como no protótipo.

**Why P1**: Faz parte da casca que envolve toda página pública; sem footer o portal não "abre como o protótipo".

**Acceptance Criteria**:

1. WHEN qualquer rota `(public)` renderiza THEN o sistema SHALL exibir um landmark `<footer>` contendo:
   bloco de marca (logo + descrição institucional, texto do protótipo L2144) e colunas de links
   (paridade `.footer`/`.footer-grid`/`.footer-brand`/`.footer-col` L2136-2178).
2. WHEN o footer renderiza links de navegação THEN cada link SHALL apontar para uma **rota real
   existente** (ex.: Buscar Vagas → `/vagas`, Buscar Serviços → `/servicos`, Criar Perfil/Cadastrar →
   `/cadastro`, Entrar → `/login`); nenhum `href="#"` (CASCA-04).
3. WHEN o footer renderiza itens institucionais sem rota (Sobre a ASONSEG, A Paróquia, Termos e
   Privacidade, Contato) THEN o sistema SHALL renderizá-los como texto não-focável (não-links) marcados
   como "em breve" — nunca como âncora morta (A-07, DEF-2).
4. WHEN o footer renderiza o rodapé inferior THEN SHALL exibir o copyright "© 2026 ASONSEG…" e a tagline
   da comunidade (L2175-2176), só com classes token (light/dark), e colapsar as colunas em 1 coluna em
   viewport estreita (media query do protótipo L687-688).

**Independent Test**: RTL de `SiteFooter` confirma landmark `<footer>`, presença dos links reais com
`href` correto, ausência de `href="#"`, itens institucionais como não-links, e o texto de copyright.
Guarda estática confirma ausência de `href="#"`/paleta crua nos arquivos da casca.

---

### P1: Montagem única no layout do grupo, sem regressão ⭐ MVP

**User Story**: Como desenvolvedor da Fase 7, quero a casca montada uma única vez no layout do grupo
`(public)`, para que toda tela pública a herde e nenhuma tela existente quebre.

**Why P1**: A casca só cumpre o objetivo se envolver **todas** as rotas públicas via o layout — e sem
regredir home/vagas/serviços já prontas.

**Acceptance Criteria**:

1. WHEN `src/app/(public)/layout.tsx` renderiza THEN o sistema SHALL montar `<SiteHeader/>` antes e
   `<SiteFooter/>` depois de `{children}`, envolvendo o conteúdo num `<main>` semântico (um único
   landmark `main` por página) (CASCA-05).
2. WHEN a casca é montada THEN o comportamento de cache das páginas SHALL ser preservado: o layout do
   grupo **não** declara `revalidate` (cada página mantém o seu — home 600s, listagens 1800s) (A-01).
3. WHEN a suíte de testes roda THEN os testes de página públicos existentes
   (`(public)/page.test.tsx`, `(public)/servicos/page.test.tsx`, e os de `vagas`) SHALL permanecer
   verdes (a casca não altera o contrato das páginas) (regressão).
4. WHEN o app é buildado THEN as rotas `(public)` SHALL compilar sem erro e o header/footer SHALL
   aparecer no HTML renderizado das rotas públicas (`npm run build`).

**Independent Test**: RTL do `PublicLayout` confirma ordem header→main→footer; leitura do arquivo
confirma ausência de `export const revalidate` no layout; `npm run build` compila; suíte existente
segue verde.

---

## Edge Cases

- WHEN a rota atual não corresponde a nenhum item de nav (ex.: rota pública futura) THEN nenhum item
  SHALL ficar marcado como ativo (sem falso-positivo).
- WHEN o menu mobile está aberto e o usuário navega para um link THEN o painel SHALL fechar (ou navegar)
  sem deixar `aria-expanded` inconsistente.
- WHEN `usePathname()` retorna a raiz `/` THEN apenas "Início" fica ativo (não casar por prefixo vazio
  contra `/vagas`).
- WHEN a viewport cruza o breakpoint com o menu mobile aberto THEN o layout SHALL degradar sem estado
  preso (o painel mobile é irrelevante no desktop).
- WHEN um componente da casca recebe `className` extra (seam) THEN SHALL mesclar via `cn` sem
  duplicar/contradizer classes de token.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um **teste negativo** (guarda estática
`node:fs` no padrão `src/shared/__tests__/*.test.ts`, ou asserção RTL), asseverando que o resultado
proibido não ocorre. Precedente: guardas `ds-*-parity`/`closed-src-root`.

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| CASCA-MN-01 | WHEN a casca pública (`(public)/_components/**`) é montada THEN SHALL NOT importar/consumir sessão, `getCurrentPerson`, View Models, Prisma/`@/shared/lib/prisma`, Server Actions, nem renderizar PII ou dado autenticado — é chrome público estático. | Vazamento de PII/estado autenticado no HTML público/ISR (lição RSC/Flight: SELECT condicional ao papel); quebra do contrato de privacidade (View Models). | T4 | `src/shared/__tests__/casca-no-auth-pii.test.ts` (scan de imports proibidos) |
| CASCA-MN-02 | WHEN um arquivo da casca é estilizado THEN SHALL NOT conter hex cru (`#RRGGBB`) nem utilitário de paleta fixa (`bg-blue-600`, `text-gray-*`, `border-slate-*`, `system-ui`) para superfícies temáticas — só classes mapeadas por token. | Quebra de dark-mode / drift da fonte única de tokens (mesma razão de DS-MN-02/DS-MN-04). | T4 | `src/shared/__tests__/casca-uses-tokens.test.ts` (scan `(public)/_components/**`) |
| CASCA-MN-03 | WHEN a casca referencia assets THEN SHALL NOT introduzir CDN/host externo (`fonts.googleapis.com`/`gstatic`, `<link rel=stylesheet href=http…>`, `<script src=http…>`) — fontes/estilos só via a fundação (`next/font`, tokens). | Falha de CSP/indisponibilidade em prod (sem CDN externo — mesma razão de DS-MN-01). | T4 | `src/shared/__tests__/casca-no-external-cdn.test.ts` |
| CASCA-MN-04 | WHEN o menu mobile/ícones são implementados THEN SHALL NOT introduzir lib de estado (Redux/MobX/Zustand/Jotai), `next-themes`, nem `lucide-react`/lib de ícones — interatividade via React nativo e SVG inline. | Violação do allowlist de deps (CLAUDE.md; DS-MN-05). | T2 (+ guarda `ds-no-forbidden-deps` existente p/ deps) | `src/shared/__tests__/casca-no-icon-state-lib.test.ts` (scan de imports em `(public)/_components/**`) |

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
|---|---|---|---|
| CASCA-01 | P1 Header: landmark `<header>` sticky + marca→`/` + nav + ações | Execute | Pending |
| CASCA-02 | P1 Header: nav primária (Início/Vagas/Serviços) p/ rotas reais | Execute | Pending |
| CASCA-03 | P1 Nav: active-state por `usePathname` (incl. prefixo de detalhe) | Execute | Pending |
| CASCA-04 | P1 Header: ações Entrar/Cadastrar via `Button asChild`+`Link` | Execute | Pending |
| CASCA-05 | P1 Nav: responsivo (colapso desktop↔mobile nos breakpoints) | Execute | Pending |
| CASCA-06 | P1 Nav: menu mobile togglado (React nativo) + `aria-expanded`/`aria-controls` | Execute | Pending |
| CASCA-07 | P1 Nav: teclado + `aria-label` no `<nav>` + foco visível | Execute | Pending |
| CASCA-08 | P1 Footer: landmark `<footer>` + marca + colunas | Execute | Pending |
| CASCA-09 | P1 Footer: links só p/ rotas reais (sem `href="#"`) | Execute | Pending |
| CASCA-10 | P1 Footer: institucionais como não-links "em breve" (DEF-2) | Execute | Pending |
| CASCA-11 | P1 Footer: copyright/tagline + colapso 1-coluna | Execute | Pending |
| CASCA-12 | P1 Layout: montagem `header→main→footer` no `(public)/layout.tsx` | Execute | Pending |
| CASCA-13 | P1 Layout: `revalidate` preservado por página (layout não declara) | Execute | Pending |
| CASCA-14 | P1 Layout: sem regressão nos testes de página existentes | Execute | Pending |
| CASCA-15 | P1 Seams: `PublicNav` data-driven + `className`/slots p/ USP-047/048 | Execute | Pending |
| CASCA-MN-01 | Must-Not: casca sem sessão/PII/Prisma/ViewModel | Execute | Pending |
| CASCA-MN-02 | Must-Not: casca só com classes token | Execute | Pending |
| CASCA-MN-03 | Must-Not: casca sem CDN/host externo | Execute | Pending |
| CASCA-MN-04 | Must-Not: sem lib de estado/ícone no menu mobile | Execute | Pending |

**ID format:** `CASCA-NN` / must-nots `CASCA-MN-NN`.
**Status values:** Pending → In Design → In Tasks → Implementing → Verified.
**Coverage:** 19 requisitos (15 funcionais + 4 must-nots); mapeamento para tarefas em `tasks.md`.

---

## Success Criteria

- [ ] `src/app/(public)/layout.tsx` monta `SiteHeader` + `main` + `SiteFooter`; toda rota pública herda a casca.
- [ ] Header fiel ao protótipo: marca→`/`, nav (Início/Vagas/Serviços), Entrar→`/login`, Cadastrar→`/cadastro`, menu mobile funcional.
- [ ] Active-state correto (incl. `/vagas/[id]`→Vagas, `/servicos/[id]`→Serviços); nenhum item ativo em rota fora da nav.
- [ ] Footer fiel: marca + colunas de links reais + copyright; zero `href="#"`; institucionais como "em breve".
- [ ] A11y: landmarks `<header>/<nav aria-label>/<main>/<footer>`, `aria-current` no item ativo, `aria-expanded`/`aria-controls` no menu mobile, foco por teclado.
- [ ] Light/dark corretos; só classes token; nenhuma paleta crua.
- [ ] Os 4 must-nots têm teste negativo verde.
- [ ] Seams entregues: `PublicNav` consome lista tipada de itens (default público) e aceita override; casca não acopla o miolo da home/nav integrada.
- [ ] Gates verdes: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`; suíte de páginas existente segue verde.
