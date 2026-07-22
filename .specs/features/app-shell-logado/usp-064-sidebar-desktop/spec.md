# USP-064 — Navegação desktop round 2: sidebar colapsável Specification

## Problem Statement

A USP-063 (round 1) entregou a navegação desktop como um **menu hambúrguer/dropdown** no
header. Rodando em produção (PR #292), o dono **rejeitou na prática** esse padrão: para
`≥ md` ele quer uma **sidebar fixa à esquerda, colapsável** — alternando entre modo
**expandido** (ícone + rótulo de texto, todos os grupos/links) e **colapsado** (só ícone,
rail estreito) —, no padrão estrutural do console do Supabase (sidebar vertical à esquerda +
um toggle que alterna "com rótulos" ⇄ "só-ícones"). O menu hambúrguer da USP-063 esconde a
navegação atrás de um clique; a sidebar a mantém sempre visível e navegável.

Esta USP **substitui** o `AppDesktopMenu` (USP-063) por um `AppSidebar`, preenchendo a mesma
necessidade (navegação completa role-aware em desktop) com a apresentação que o dono aprovou.
Mobile/tablet (`< md`, bottom tab bar — USP-062) fica **intacto** (aprovado como está).

## Fonte da verdade (upstream — Adapt, Don't Re-Derive)

USP net-new (fora das 44 do PRD, como USP-045…USP-063). Sem artefato upstream com IDs de
requisito; ancora-se em:

- **`.specs/project/ROADMAP.md` → Fase 10, nota "Round 2" + linha USP-064** (escopo:
  sidebar colapsável ícone+rótulo ⇄ só-ícone, substitui o menu hambúrguer da USP-063).
- **USP-061** (`usp-061-casca-header/{spec,design}.md`) — a casca `AppShell`/`AppHeader` e o
  padrão de seams do composition-root; decisões já tomadas (Server/Client, composition-root,
  must-nots tokens/PII, `<main>` não centralizado) **reutilizadas, não re-derivadas**.
- **USP-062** (`usp-062-bottom-tab-bar/design.md`) — o registry `NavIcon` (`nav-icons.tsx`,
  href→SVG inline cobrindo as 11 `EXISTING_HUB_ROUTES` + fallback) e o breakpoint `md`
  (bottom bar assume `< md`). **Reaproveitados sem alterar** (USP-062 aprovada como está).
- **USP-063** (`usp-063-menu-desktop/design.md`) — o que esta USP **substitui**; o helper
  puro `pickActiveHref` (longest-match, `identity/domain/app-nav.ts`) e a fonte de dados
  `buildHubLinks`/`hubAccessFromRoles`/`EXISTING_HUB_ROUTES` são reusados verbatim.
- **`src/shared/ui/theme-toggle.tsx`** — precedente do mecanismo de preferência client-side
  persistida (`localStorage` + `useState`/`useEffect`), reusado para a persistência do
  collapse (ver A-COLLAPSE). Invariante **HUB-MN-01** herdado da fonte de dados.

IDs de requisito são **locais** (`SIDE-NN` / `SIDE-MN-NN`).

> **Unidade de execução combinada 064+065.** Esta USP e a USP-065 (Menu de Perfil) são a
> **mesma superfície** (a chrome da casca `(app)`) e editam os mesmos arquivos
> (`AppShell`, `AppHeader`, `(app)/layout.tsx`, os guards source-scan). Specs e designs são
> separados (um por USP), mas o `tasks.md` é **único e combinado** (idêntico nos dois `dir:`),
> como o precedente 062/063. Ver `design.md` e o `tasks.md` combinado.

## Goals

- [ ] Em `≥ md`, toda rota `(app)/*` tem uma **sidebar fixa à esquerda** com a navegação
      **completa** por papel (todos os grupos/links de `buildHubLinks`).
- [ ] A sidebar **alterna** expandido (ícone + rótulo + títulos de grupo) ⇄ colapsado (só
      ícone, rail estreito) por um **toggle**, e a preferência **persiste** (recarga/navegação).
- [ ] **Role-aware**: só mostra o que o `HubAccess` concede; nunca linka fora de
      `EXISTING_HUB_ROUTES` (HUB-MN-01 reaplicado).
- [ ] **Active-state por rota** correto para links aninhados (`/perfil` **não** ativo em
      `/perfil/papeis`) — via `pickActiveHref` (longest-match), com `aria-current="page"`.
- [ ] Acessível mesmo colapsada (ícone-só) — cada item mantém nome acessível
      (`aria-label`/`title`); landmark `nav`, foco visível.
- [ ] Reaproveita tokens/`shared/ui`/`NavIcon`; **zero** lib nova, **zero** migração.
      Substitui o `AppDesktopMenu` (remoção limpa) sem reescrever a casca da USP-061.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Bottom tab bar mobile/tablet (`< md`) | É a **USP-062**, aprovada como está — **não** se toca (só o breakpoint `md` é compartilhado) |
| Menu de Perfil (nome/papel, tema, Sair) | É a **USP-065** — mesma unidade de execução, requisitos/artefatos separados |
| Migração do `ThemeToggle` para fora do canto flutuante | É a **USP-065** (ponto 4 do briefing) |
| Componente de sidebar de biblioteca (shadcn `Sidebar`, Radix etc.) | CLAUDE.md proíbe libs novas; o padrão de estado client (`useState`) do repo já basta |
| Persistência via cookie / Server Action | `localStorage` é o precedente estabelecido (`ThemeToggle`); cookie/SA seria padrão novo desnecessário (A-COLLAPSE) |
| Sidebar em `(public)`/`(auth)` | Só a área logada tem navegação de app-shell; grupos públicos têm sua própria casca (Fase 7) |
| Header refletir sessão no grupo público | É H-4 da Fase 9 |
| E2E autenticado (Playwright) | Deferido — L-007 / AD-025 / AD-027. Cobertura por RTL + guards + build |
| Novo `AuditEvent` de navegação | Navegação por `<Link>` não é operação sensível |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
| - | -------------------- | ----- | -------------- | --------- | ---------- |
| A1 | **Sidebar** fixa à esquerda (não menu, não topbar horizontal), `≥ md` | agent | `AppSidebar` vertical à esquerda em `hidden md:flex` | É o pedido explícito do dono (round 2). Substitui o `AppDesktopMenu` da USP-063 | y |
| A2 | O `AppShell` vira **flex-row**: sidebar (coluna esquerda) + `<div class="flex-1 flex-col">` (header + `{children}` + bottomNav). **Não** se toca no `<main>` de cada página (A2 da USP-061 preservada) | agent | Wrapper flex-row; páginas mantêm seu `<main>` | Introduzir a sidebar é um elemento de layout **horizontal**; o wrapper flex-row a acomoda sem editar 30+ páginas (o briefing sugere exatamente isso). Preserva a decisão da USP-061 | y |
| A3 | A sidebar recebe `groups: HubLinkGroup[]` já computados do composition-root (layout), **não** busca sessão | agent | Client, dados via props | Precisa `usePathname()` (active) + `useState` (collapse). Espelha `AppDesktopMenu`/`AppBottomNav` (Client) alimentados pelo layout (Server). Preserva MN de PII | y |
| A-COLLAPSE | **Persistência do collapse** = `localStorage['asonseg:sidebar-collapsed']` (`'true'`/`'false'`); estado aplicado no cliente por `useEffect` (SSR renderiza **expandido** por default; `useEffect` lê a preferência e ajusta) — **padrão idêntico ao `ThemeToggle`** (`readInitialTheme`→`useEffect`) | agent | `localStorage` + `useEffect` (padrão ThemeToggle) | `localStorage` é o precedente do repo; evita inventar cookie/Server Action. Custo: usuários que preferem **colapsado** veem um settle de 1 frame (expandido→colapsado) no 1º paint — **mesma classe** do settle do ícone do `ThemeToggle`, aceito. **Zero-flash** (inline `SidebarInitScript` espelhando `ThemeScript`, para largura pré-hidratação) fica **deferido** como follow-up se o dono pedir | y |
| A4 | **Active-state** = `pickActiveHref` (longest-match) — **o mesmo** helper da USP-062/063, reusado sem mudança | agent | Reusar `pickActiveHref` | Corrige pares aninhados do hub (`/perfil` vs `/perfil/papeis`). Já existe e testado | y |
| A5 | **Toggle** = botão dentro da própria sidebar (rail), com `aria-pressed` + `aria-label` dinâmico; ícone chevron SVG inline **local ao `app-sidebar.tsx`** (não se toca em `nav-icons.tsx`, dono da USP-062) | agent | Toggle self-contained na sidebar; chevron inline | Supabase põe o controle de recolher na própria sidebar; mantém o header limpo (a USP-065 assume o canto direito). `nav-icons.tsx` (USP-062, aprovado) não é modificado | y |
| A6 | Grupos/ordem/rótulos = exatamente os de `buildHubLinks`; **ícones** = `NavIcon(href)` reusado (registry já cobre as 11 rotas + fallback) | agent | Reusar `buildHubLinks` + `NavIcon` | Fonte única; role-aware/allowlist herdados. O registry de ícones da USP-062 já cobre todos os hrefs elegíveis (não só os 4 atalhos primários) | y |
| A7 | **Breakpoint** = `md` (mesmo da USP-062). Sidebar visível `≥ md` (`hidden md:flex`); oculta `< md` (bottom bar assume) | agent | `hidden md:flex` | Mesmo limiar do `AppBottomNav` (`md:hidden`) — sem sobreposição de superfícies de navegação | y |
| A8 | **`AppDesktopMenu` é removido** (arquivo + teste), não só desconectado | agent | Remoção limpa (dead code) | Preferência explícita do dono/briefing; nada mais o referencia após o layout parar de injetá-lo. As asserções de membership dos guards migram de `app-desktop-menu.tsx` → `app-sidebar.tsx` | y |
| A9 | Os **guards estáticos MN-03/MN-04 da USP-061** varrem `(app)/_components/**` recursivamente → cobrem `app-sidebar.tsx` automaticamente; **não** se cria guard novo (só migra a asserção de membership) | agent | Reutilizar guards existentes | Mesma razão da USP-062/063. Reduz superfície | y |

**Owner de todos os itens = `agent`.** Nenhum item de owner externo pendente →
**Entry Gate (tasks.md §0) está livre**: a feature entra em task breakdown.

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Sidebar colapsável com a navegação completa role-aware ⭐ MVP

**User Story**: Como Pessoa autenticada num desktop, quero uma sidebar à esquerda com toda a
minha navegação por papel, que eu possa recolher para só-ícones, para navegar direto de
qualquer área sem voltar ao hub e sem o menu ocupar o meu campo de trabalho.

**Why P1**: É o núcleo da USP — dá em desktop a navegação persistente no padrão que o dono
aprovou; substitui o hambúrguer rejeitado (round 1) e resolve o beco sem saída (H-3) para `≥ md`.

**Acceptance Criteria**:

1. WHEN uma Pessoa renderiza qualquer rota `(app)/*` num viewport `≥ md` THEN a casca SHALL
   renderizar uma **sidebar à esquerda** com a navegação **completa** role-aware (todos os
   grupos/links de `buildHubLinks`), agrupada pelos títulos de grupo. `[SIDE-01]`
2. WHEN a sidebar está **expandida** THEN cada item SHALL exibir ícone + rótulo de texto e os
   títulos de grupo; WHEN **colapsada** THEN SHALL exibir só o ícone (rail estreito), sem
   rótulos nem títulos de grupo visíveis. `[SIDE-02]`
3. WHEN a Pessoa aciona o **toggle** THEN a sidebar SHALL alternar expandido⇄colapsado, e a
   preferência SHALL **persistir** (`localStorage`) — mantida ao navegar entre rotas `(app)/*`
   e ao recarregar. `[SIDE-03]`
4. WHEN o `pathname` atual corresponde a um link (exato ou rota-descendente) THEN esse link
   SHALL ser marcado ativo (`aria-current="page"`) pela regra de match mais longo — de modo
   que `/perfil` **não** fique ativo em `/perfil/papeis`; no máximo **um** link ativo. `[SIDE-04]`
5. WHEN o viewport é `< md` THEN a sidebar SHALL estar oculta (`hidden md:…`) — em mobile a
   navegação é a bottom tab bar (USP-062). `[SIDE-05]`
6. WHEN a sidebar renderiza (expandida **ou** colapsada) THEN SHALL ser acessível: landmark
   `nav` com `aria-label` distinto, toggle com `aria-label` + `aria-pressed`, foco visível; e
   **mesmo colapsada** cada item de navegação SHALL manter um nome acessível
   (`aria-label`/`title` = rótulo), pois o rótulo visual está oculto. `[SIDE-06]`

**Independent Test**: Renderizar `AppSidebar` (RTL, `usePathname` mockado) com `groups` de
acessos variados: ver os grupos/links certos; alternar pelo toggle e ver o modo mudar +
`localStorage` gravado; o link ativo por rota (incl. o caso aninhado); a ausência de grupos
não concedidos; e — colapsada — que cada link ainda expõe nome acessível.

---

## Edge Cases

- WHEN a Pessoa só tem "Minha conta" (zero papéis) THEN a sidebar SHALL mostrar apenas esse
  grupo (nunca vazia — `buildHubLinks` sempre inclui "Minha conta"). `[SIDE-01]`
- WHEN `pathname` não casa nenhum link THEN **nenhum** link fica ativo (`pickActiveHref` →
  `null`). `[SIDE-04]`
- WHEN o `pathname` é `/perfil/papeis` THEN o link ativo é `/perfil/papeis` (não `/perfil`)
  — longest-match. `[SIDE-04]`
- WHEN `localStorage` está indisponível (SSR/navegador privado) THEN a sidebar SHALL degradar
  sem lançar (usa o default expandido) — mesmo tratamento do `ThemeToggle`. `[SIDE-03]`
- WHEN um href elegível não tem ícone mapeado no registry THEN `NavIcon` cai no **fallback**
  (círculo) — sem crash (herdado da USP-062). `[SIDE-01]`

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, independentemente do caminho. Cada um exige um teste negativo que
afirma que o resultado proibido não ocorre (ver validate.md §6b).

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| -- | ------------------------------- | -------- | ----------- | ------------- |
| SIDE-MN-01 | WHEN a sidebar renderiza, para **qualquer** combinação de acessos, THEN SHALL NOT produzir um link cujo `href ∉ EXISTING_HUB_ROUTES` | Link morto / vazamento de prefixo de route-group (classe HUB-MN-01) | T1 | `app-sidebar.test.tsx` (grupos de acesso total → todo href de âncora ∈ `EXISTING_HUB_ROUTES`) |
| SIDE-MN-02 | WHEN o `HubAccess` da Pessoa não concede um grupo/link THEN a sidebar SHALL NOT renderizar esse grupo/link | Expor atalho a área sem permissão (classe HUB-MN-02) | T1, T6 | `app-sidebar.test.tsx` (candidate-only → sem grupo Institucional/moderação/relatórios) + `layout.test.tsx` |
| SIDE-MN-03 | WHEN o componente da sidebar renderiza THEN os arquivos de `(app)/_components/**` SHALL NOT importar `prisma` / `getCurrentPerson` / `requireActivePerson` / View Models / Server Actions / `'use server'` — dados só via props do composition-root | Renderizar PII de Pessoa ≠ da sessão na chrome global | T1 | `src/shared/__tests__/app-shell-no-auth-pii.test.ts` (guard USP-061, varre o dir; asserção de `app-sidebar.tsx`) |
| SIDE-MN-04 | WHEN o componente da sidebar renderiza THEN SHALL NOT usar hex cru / paleta fixa / CDN externa / lib de ícone ou de estado — tokens-only (DS intacto) | Deriva do design system | T1 | `src/shared/__tests__/app-shell-uses-tokens.test.ts` (guard USP-061, varre o dir; asserção de `app-sidebar.tsx`) |
| SIDE-MN-05 | WHEN a sidebar está **colapsada** (só-ícone) THEN SHALL NOT deixar um item de navegação sem nome acessível (o rótulo visual oculto SHALL ser substituído por `aria-label`/`title`) | Regressão de acessibilidade — navegação viraria ícones mudos p/ leitor de tela | T1 | `app-sidebar.test.tsx` (render colapsado → cada link tem accessible name) |

> **Nota MN-03/MN-04:** guards reaproveitados da USP-061 (A9) — a task T1 migra a asserção de
> membership de `app-desktop-menu.tsx` para `app-sidebar.tsx` em ambos os guards.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SIDE-01 | P1: Sidebar (nav completa role-aware) | T1, T6 | Pending |
| SIDE-02 | P1: Sidebar (expandido⇄colapsado) | T1 | Pending |
| SIDE-03 | P1: Sidebar (toggle + persistência) | T1 | Pending |
| SIDE-04 | P1: Sidebar (active-state) | T1 | Pending |
| SIDE-05 | P1: Sidebar (responsivo) | T1 | Pending |
| SIDE-06 | P1: Sidebar (a11y, incl. colapsada) | T1 | Pending |
| SIDE-MN-01 | P1: Sidebar | T1 | Pending |
| SIDE-MN-02 | P1: Sidebar | T1, T6 | Pending |
| SIDE-MN-03 | P1: Sidebar | T1 | Pending |
| SIDE-MN-04 | P1: Sidebar | T1 | Pending |
| SIDE-MN-05 | P1: Sidebar | T1 | Pending |

**ID format:** `SIDE-[NUMBER]`; must-nots `SIDE-MN-[NUMBER]`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 total, 11 mapped to tasks (plano combinado 064+065 — ver `tasks.md`), 0 unmapped.

---

## Success Criteria

- [ ] Em `≥ md`, toda rota `(app)/*` tem a sidebar à esquerda com a navegação completa por papel.
- [ ] Toggle alterna expandido⇄colapsado; a preferência persiste em `localStorage` (recarga/nav).
- [ ] Nenhum link fora de `EXISTING_HUB_ROUTES`; nenhum grupo/link de área sem permissão.
- [ ] Active-state correto para links aninhados (longest-match, `aria-current`, ≤1 ativo).
- [ ] Colapsada, cada item mantém nome acessível; landmark `nav` + toggle acessíveis.
- [ ] Sidebar oculta em `< md` (bottom bar da USP-062 intacta).
- [ ] `AppDesktopMenu` removido; guards migrados; 5 must-nots com teste negativo verde.
- [ ] typecheck/lint verdes, `npm run test` verde, `NODE_ENV=production` build OK, zero migração.
