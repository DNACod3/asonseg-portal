# USP-063 — Navegação desktop (menu no header) Specification

## Problem Statement

A USP-061 entregou a casca da área logada (`AppShell`/`AppHeader`) com o header
persistente e o seam `headerNav` **vazio**. Em desktop (`≥ md`), de qualquer rota
`(app)/*` a Pessoa vê só a marca (→ hub) e o Sair — não há como pular direto para outra
área sem passar pelo hub `/inicio`. Falta o menu de navegação **completo** no header (H-3
do UAT, achados SOC-2/EMP-5).

Esta USP preenche o seam `headerNav` com um **menu (disclosure/hambúrguer) no header** que
abre um painel com a **navegação completa role-aware** (todos os grupos/links de
`buildHubLinks`), com **active-state por rota** (`aria-current="page"`). Em mobile (`< md`)
esse menu fica oculto — lá a navegação primária é a bottom tab bar da USP-062.

## Fonte da verdade (upstream — Adapt, Don't Re-Derive)

USP net-new (fora das 44 do PRD, como USP-045…USP-061). Sem artefato upstream com IDs de
requisito; ancora-se em:

- **`.specs/project/ROADMAP.md` → Fase 10** (escopo por USP; USP-063 = menu desktop
  hambúrguer/dropdown com a navegação completa por papel e active-state por rota).
- **USP-061** (`.specs/features/app-shell-logado/usp-061-casca-header/{spec,design}.md`) —
  a casca e o seam `headerNav` consumido; decisões já tomadas (Server/Client,
  composition-root, must-nots tokens/PII) reutilizadas, **não** re-derivadas.
- **`src/app/(public)/_components/public-nav.tsx`** — precedente do padrão de disclosure
  (hambúrguer inline SVG + `useState(open)` + `aria-expanded`/`aria-controls`, fecha ao
  clicar) e do active-state (`aria-current="page"`). Reaproveita-se o **padrão**, não a rota.
- **`src/modules/identity/domain/hub-links.ts`** — `buildHubLinks`/`hubAccessFromRoles`/
  `EXISTING_HUB_ROUTES` (mesma fonte do hub `/inicio`). Invariante **HUB-MN-01** herdado.

IDs de requisito são **locais** (`DNAV-NN` / `DNAV-MN-NN`).

## Goals

- [ ] Em `≥ md`, toda rota `(app)/*` tem no header um **menu disclosure** que abre a
      navegação **completa** por papel (todos os grupos/links de `buildHubLinks`).
- [ ] O menu é **role-aware**: só mostra grupos/links que o `HubAccess` concede; nunca
      linka fora de `EXISTING_HUB_ROUTES` (HUB-MN-01 reaplicado).
- [ ] **Active-state por rota** correto para links aninhados (`/perfil` **não** fica ativo
      em `/perfil/papeis`) — via `pickActiveHref` (longest-match), com `aria-current="page"`.
- [ ] Reaproveita o padrão do `PublicNav` (hambúrguer SVG inline, `useState`, `aria-*`) e
      os tokens do `AppHeader`; zero mudança no design system. Reusa os guards MN da USP-061.
- [ ] Preenche o seam `headerNav` **sem reescrever** a casca da USP-061.

## Decisão: hambúrguer (disclosure) — não dropdown de biblioteca, não barra horizontal

O ROADMAP permite "hambúrguer/dropdown". **Escolha: botão disclosure (hambúrguer) que abre
um painel com os grupos/links** — registrada como A1. Rationale em Assumptions.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Bottom tab bar mobile/tablet | É a **USP-062** — preenche o seam `bottomNav`. Mesma unidade de execução, requisitos/artefatos separados |
| Barra de navegação horizontal sempre-visível no header (estilo PublicNav) | 13+ links em até 3 grupos não cabem inline no header. Painel agrupado (disclosure) é o container certo (A1) |
| Componente de dropdown de biblioteca (Radix `DropdownMenu` etc.) | CLAUDE.md proíbe adicionar libs; o disclosure do `PublicNav` já é o padrão estabelecido (A1) |
| Ícones por link no menu desktop | Ícones são a affordance da bottom bar (USP-062). O menu desktop é lista textual agrupada (como os cards do hub). Mantém o escopo de ícones em 062 (A6) |
| Header refletir sessão no grupo público `(public)` | É H-4 da Fase 9 |
| E2E autenticado (Playwright) | Deferido — L-007 / AD-025 / USP-061 A8. Cobertura por RTL + guards + build |
| Novo `AuditEvent` de navegação | Navegação por `<Link>` não é operação sensível |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
| - | -------------------- | ----- | -------------- | --------- | ---------- |
| A1 | **Hambúrguer/disclosure** (botão `aria-expanded` que abre painel agrupado), **não** dropdown de lib nem barra horizontal | agent | Disclosure hambúrguer, espelhando `PublicNav` | Navegação completa = até 3 grupos e 13+ links → não cabe inline. Painel agrupado é o container. Reusa o único padrão de disclosure do repo (PublicNav), sem lib nova (CLAUDE.md "Forbidden") | y |
| A2 | O menu recebe `groups: HubLinkGroup[]` já computados do composition-root (layout), **não** busca sessão | agent | Client, data via props | Precisa `usePathname()` (active) + `useState` (toggle). Espelha `PublicNav` (Client) no `SiteHeader` (Server). Preserva MN de PII (dados só via props) | y |
| A3 | **Active-state** usa `pickActiveHref(hrefs, pathname)` puro (match "exato-ou-descendente" mais longo), **não** o `isActive` do `PublicNav` | agent | Novo helper longest-match (compartilhado com USP-062) | `isActive` casa por prefixo simples → marcaria `/perfil` ativo em `/perfil/papeis` (par aninhado do hub). Longest-match resolve. Mesmo aria (`aria-current="page"`), semântica diferente | y |
| A4 | Grupos e ordem = exatamente os de `buildHubLinks` (Minha conta / Meus papéis / Institucional), com o **título** do grupo como cabeçalho no painel | agent | Renderizar os grupos como vêm | Fonte única de dados/ordem/rótulos (mesma do hub). O menu não inventa grupos nem reordena | y |
| A5 | **Toggle**: painel abre/fecha por `useState`; fecha ao clicar num link (navegação SPA); `aria-expanded`/`aria-controls`/`aria-label` idênticos ao padrão `PublicNav` | agent | Espelhar `PublicNav` | Padrão de disclosure já validado (USP-046). Consistência de a11y | y |
| A6 | Menu desktop = lista **textual** agrupada (sem ícones por link) | agent | Sem ícones no menu | Ícones = affordance da bottom bar (USP-062). Menu textual espelha os cards do hub. Menos superfície, menos risco | y |
| A7 | **Breakpoint** = `md`. Menu visível `≥ md` (`hidden md:…`); oculto `< md` (onde a bottom bar da USP-062 assume) | agent | `hidden md:block` (ou equivalente) | Mesmo breakpoint do `PublicNav`. "desktop" = `≥ md` | y |
| A8 | Os **guards estáticos MN-03/MN-04 da USP-061** varrem `(app)/_components/**` recursivamente → cobrem os arquivos novos; **não** se cria novo guard | agent | Reutilizar guards existentes | Mesma razão da USP-062/A9. O componente novo só mantém-nos verdes (+asserção de que consta da varredura) | y |

**Owner de todos os itens = `agent`.** Nenhum item de owner externo pendente →
**Entry Gate (tasks.md §0) está livre**: a feature entra em task breakdown.

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Menu desktop com a navegação completa role-aware ⭐ MVP

**User Story**: Como Pessoa autenticada num desktop, quero um menu no header que abra toda
a minha navegação por papel, para pular direto para qualquer área sem voltar ao hub.

**Why P1**: É o núcleo da USP — dá em desktop o acesso completo que o hambúrguer entrega em
uma superfície compacta; resolve o beco sem saída (H-3) para `≥ md`.

**Acceptance Criteria**:

1. WHEN uma Pessoa renderiza qualquer rota `(app)/*` num viewport `≥ md` THEN o header
   SHALL prover um botão disclosure (hambúrguer) que, ao acionar, abre um painel com a
   navegação **completa** role-aware (todos os grupos/links de `buildHubLinks`). `[DNAV-01]`
2. WHEN o painel abre THEN os links SHALL estar agrupados pelo **título** do grupo (Minha
   conta / Meus papéis / Institucional), mostrando só os grupos que o `HubAccess` concede.
   `[DNAV-02]`
3. WHEN o `pathname` atual corresponde a um link (exato ou rota-descendente) THEN esse link
   SHALL ser marcado ativo (`aria-current="page"`) pela regra de match mais longo — de modo
   que `/perfil` **não** fique ativo em `/perfil/papeis`; no máximo **um** link ativo.
   `[DNAV-03]`
4. WHEN o botão disclosure é acionado THEN o painel SHALL abrir/fechar (`useState`) e
   SHALL fechar ao clicar num link; o botão SHALL expor `aria-expanded`, `aria-controls`
   e `aria-label` (mesmo padrão do `PublicNav`). `[DNAV-04]`
5. WHEN o viewport é `< md` THEN o menu do header SHALL estar oculto (`hidden md:…`) — em
   mobile a navegação é a bottom tab bar (USP-062). `[DNAV-05]`

**Independent Test**: Renderizar `AppDesktopMenu` (RTL, `usePathname` mockado) com `groups`
de acessos variados: abrir/fechar pelo botão, ver os grupos/links certos, o link ativo por
rota (incl. o caso aninhado `/perfil` vs `/perfil/papeis`), e a ausência de grupos não
concedidos.

---

## Edge Cases

- WHEN a Pessoa só tem "Minha conta" (zero papéis) THEN o menu SHALL mostrar apenas esse
  grupo (nunca vazio — `buildHubLinks` sempre inclui "Minha conta"). `[DNAV-02]`
- WHEN `pathname` não casa nenhum link do menu THEN **nenhum** link fica ativo
  (`pickActiveHref` → `null`). `[DNAV-03]`
- WHEN o `pathname` é `/perfil/papeis` THEN o link ativo é `/perfil/papeis` (não `/perfil`)
  — longest-match. `[DNAV-03]`
- WHEN o painel está fechado THEN os links não estão no fluxo focável do painel (só o
  botão disclosure é focável) — espelha `PublicNav`. `[DNAV-04]`

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, independentemente do caminho. Cada um exige um teste negativo
que afirma que o resultado proibido não ocorre (ver validate.md §6b).

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| -- | ------------------------------- | -------- | ----------- | ------------- |
| DNAV-MN-01 | WHEN o menu renderiza, para **qualquer** combinação de acessos, THEN ele SHALL NOT produzir um link cujo `href ∉ EXISTING_HUB_ROUTES` | Link morto / vazamento de prefixo de route-group — mesma classe do HUB-MN-01 | T5 | `app-desktop-menu.test.tsx` (render com grupos de acesso total → todo href de âncora ∈ `EXISTING_HUB_ROUTES`) |
| DNAV-MN-02 | WHEN o `HubAccess` da Pessoa não concede um grupo/link THEN o menu SHALL NOT renderizar esse grupo/link | Expor atalho a área sem permissão (classe do HUB-MN-02) | T5, T6 | `app-desktop-menu.test.tsx` (candidate-only → sem grupo Institucional/links de moderação/relatórios) |
| DNAV-MN-03 | WHEN o componente do menu renderiza THEN os arquivos de `(app)/_components/**` SHALL NOT importar `prisma` / `getCurrentPerson` / `requireActivePerson` / View Models / Server Actions / `'use server'` — dados só via props do composition-root | Renderizar PII de Pessoa que não é a da sessão na chrome global | T5 | `src/shared/__tests__/app-shell-no-auth-pii.test.ts` (guard da USP-061, varre o diretório todo) |
| DNAV-MN-04 | WHEN o componente do menu renderiza THEN ele SHALL NOT usar hex cru / paleta fixa / CDN externa / lib de ícone ou de estado — tokens-only (DS intacto) | Deriva do design system | T5 | `src/shared/__tests__/app-shell-uses-tokens.test.ts` (guard da USP-061, varre o diretório todo) |

> **Nota sobre MN-03/MN-04:** guards reaproveitados da USP-061 (A8) — a task T5 adiciona
> asserção explícita de que `app-desktop-menu.tsx` consta do conjunto varrido.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| DNAV-01 | P1: Menu desktop | T5, T6 | ✅ Verified |
| DNAV-02 | P1: Menu desktop (grupos role-aware) | T5, T6 | ✅ Verified |
| DNAV-03 | P1: Menu desktop (active-state) | T1, T5 | ✅ Verified |
| DNAV-04 | P1: Menu desktop (toggle/a11y) | T5 | ✅ Verified |
| DNAV-05 | P1: Menu desktop (responsivo) | T5 | ✅ Verified |
| DNAV-MN-01 | P1: Menu desktop | T5 | ✅ Verified |
| DNAV-MN-02 | P1: Menu desktop | T5, T6 | ✅ Verified |
| DNAV-MN-03 | P1: Menu desktop | T5 | ✅ Verified |
| DNAV-MN-04 | P1: Menu desktop | T5 | ✅ Verified |

**ID format:** `DNAV-[NUMBER]`; must-nots `DNAV-MN-[NUMBER]`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 9 total, 9 mapped to tasks (plano combinado 062+063 — ver `tasks.md`),
0 unmapped.

---

## Success Criteria

- [ ] Em `≥ md`, toda rota `(app)/*` tem o menu disclosure com a navegação completa por papel.
- [ ] Nenhum link fora de `EXISTING_HUB_ROUTES`; nenhum grupo/link de área sem permissão.
- [ ] Active-state correto para links aninhados (longest-match, `aria-current`, ≤1 ativo).
- [ ] Toggle abre/fecha, fecha ao clicar; `aria-expanded`/`aria-controls`/`aria-label` presentes.
- [ ] Menu oculto em `< md`.
- [ ] 4 must-nots com teste negativo verde (1 render + 1 render + 2 guards estáticos reusados).
- [ ] typecheck/lint verdes, `npm run test` verde, `NODE_ENV=production` build OK, zero migração.
