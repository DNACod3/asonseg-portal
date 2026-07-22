# USP-065 — Menu de Perfil (nome/papel, tema, Sair) Specification

## Problem Statement

Hoje o canto direito do `AppHeader` (USP-061) é **estático**: um bloco de texto com nome +
papel ativo (`data-testid="app-header-role-label"`) e o `SignOutForm` solto ao lado. E o
`ThemeToggle` (`src/shared/ui/theme-toggle.tsx`) é um **botão flutuante fixo**
(`fixed bottom-4 right-4`) montado **incondicionalmente no `src/app/layout.tsx` raiz** — logo
aparece igual em `(public)`, `(auth)` e `(app)`, e em mobile ele ainda **sobrepõe** a bottom
tab bar da USP-062.

O dono pediu (round 2, pós-#292), inspirado no menu de conta do console do Supabase: um
**Menu de Perfil** — dropdown cujo trigger é o nome/avatar da pessoa no canto direito do
header — contendo pelo menos **nome + papel ativo**, um **seletor de tema (claro/escuro)** e a
ação **Sair**; e que o `ThemeToggle` **saia do canto flutuante e entre dentro desse menu** —
mas só faz sentido na área logada `(app)/*` (só lá existe "menu de Perfil").

Esta USP: (1) substitui o bloco estático de identidade do `AppHeader` por um `ProfileMenu`
(dropdown disclosure); (2) coloca dentro dele o controle de tema (reusando a lógica do
`ThemeToggle`) e o `SignOutForm`; (3) **migra** o `ThemeToggle` flutuante para fora do layout
raiz — reinstalando-o (flutuante) só em `(public)` e `(auth)`, e suprimindo-o de `(app)`,
onde o Menu de Perfil assume (ponto 4 do briefing; ver `design.md` §Tech Decisions).

## Fonte da verdade (upstream — Adapt, Don't Re-Derive)

USP net-new. Sem artefato upstream com IDs de requisito; ancora-se em:

- **`.specs/project/ROADMAP.md` → Fase 10, nota "Round 2" + linha USP-065** (escopo: menu de
  perfil com nome/papel + seletor de tema + Sair; ThemeToggle migra do canto flutuante global
  para dentro deste menu na área logada).
- **USP-061** (`usp-061-casca-header/{spec,design}.md`) — o `AppHeader` (bloco de identidade +
  `SignOutForm`, `data-testid="app-header-role-label"`), a casca e os must-nots tokens/PII
  reusados. **A APP-SHELL-MN-01** (nunca deixar `children` sem header persistente com
  saída) é **reenquadrada** aqui (ver Must-Nots).
- **`src/shared/ui/theme-toggle.tsx`** — o `ThemeToggle` (lógica `useState`/`useEffect` +
  `document.documentElement.dataset.theme` + `localStorage['theme']`, SVG lua/sol) e
  **`ThemeScript`** (anti-FOUC no `<head>` raiz) — reusados; a **lógica não é reescrita**.
- **`src/app/layout.tsx`** (raiz), **`src/app/(public)/layout.tsx`**,
  **`src/app/(auth)/layout.tsx`** — os pontos de montagem que a migração do `ThemeToggle` edita.
- **`src/app/(public)/_components/public-nav.tsx`** — precedente do disclosure
  (`useState(open)` + `aria-expanded`/`aria-controls`, fecha ao clicar) reaproveitado.
- **`@/modules/identity` `SignOutForm`** — reusado (só muda de lugar), **injetado como prop**
  no `ProfileMenu` (que é Client) para não arrastar o barrel server-only ao bundle client
  (lição L-021 — ver PROF-MN-03).

IDs de requisito são **locais** (`PROF-NN` / `PROF-MN-NN`).

> **Unidade de execução combinada 064+065.** Ver a nota idêntica em
> `usp-064-sidebar-desktop/spec.md`: mesma superfície (chrome da casca `(app)`), mesmos
> arquivos editados, `tasks.md` **único e combinado** nos dois `dir:`.

## Goals

- [ ] O canto direito do `AppHeader` vira um **dropdown de perfil**: trigger = avatar/nome da
      pessoa; painel contém **nome + papel ativo**, um **controle de tema** e **Sair**.
- [ ] O controle de tema **reusa a lógica do `ThemeToggle`** (persistência + `data-theme`),
      não reescreve — alternando claro/escuro.
- [ ] O `SignOutForm` (já existente) muda de lugar (para dentro do menu) sem reescrever a ação.
- [ ] O `ThemeToggle` flutuante **sai do layout raiz** e é reinstalado (flutuante) só em
      `(public)` e `(auth)`; em `(app)` o Menu de Perfil assume — o `ThemeScript` (anti-FOUC)
      **permanece global** no `<head>` raiz.
- [ ] Tokens-only, sem lib nova, sem migração; sem reescrever a casca da USP-061.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Sidebar colapsável | É a **USP-064** — mesma unidade de execução, requisitos/artefatos separados |
| Seletor de tema "sistema" (radio claro/escuro/sistema, estilo Supabase) | O `ThemeToggle` do projeto é **binário** (claro/escuro, sem "sistema"); o briefing manda **adaptar ao que o projeto já tem**, não inventar. "Sistema" seria feature nova de tema — deferido |
| Seções extra do menu Supabase (Account, Feature previews, Changelog, Timezone, Upgrade) | Briefing: **não inventar seções** que não existem no produto; só nome/papel + tema + Sair |
| Upload/edição de avatar | Não há avatar de imagem no MVP; o trigger usa a **inicial** do nome (badge de texto, padrão da marca) |
| Página `/perfil` (edição de dados) | Já existe (USP-049); o menu **não** a substitui (pode linká-la, mas não é requisito) |
| Menu de perfil em `(public)`/`(auth)` | Não há sessão/perfil nesses grupos; lá o tema fica no `ThemeToggle` flutuante |
| E2E autenticado (Playwright) | Deferido — L-007 / AD-025 / AD-027. Cobertura por RTL + guards + build |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
| - | -------------------- | ----- | -------------- | --------- | ---------- |
| A1 | **Dropdown disclosure** (`useState` + `aria-expanded`), **não** dropdown de lib | agent | Espelhar `PublicNav`/`AppDesktopMenu` | Padrão de disclosure já estabelecido no repo; CLAUDE.md proíbe libs. Consistência de a11y | y |
| A2 | **Trigger** = avatar (inicial do nome, badge de texto tokens-only) + nome (oculto `< sm`); papel ativo aparece **dentro** do painel, não no trigger | agent | Avatar + nome no trigger; papel no painel | Padrão Supabase (avatar no trigger, e-mail/identidade no topo do painel). Sem imagem de avatar no MVP → inicial | y |
| A3 | **Controle de tema** = reusar o componente `ThemeToggle` (`@/shared/ui`) renderizado numa linha do painel (rótulo "Tema" + o botão), **não** reescrever a lógica | agent | Renderizar `<ThemeToggle/>` no painel (com `className` p/ caber na linha) | Briefing: "reaproveite a lógica, não reescreva". `ThemeToggle` já persiste + seta `data-theme`; é client-safe (`@/shared/ui`). Ajuste só visual via `className` | y |
| A4 | **Sair** = o `SignOutForm` existente, **injetado como `ReactNode` prop** (`signOut`) no `ProfileMenu` a partir do `AppHeader` (Server) | agent | `AppHeader` (Server) passa `signOut={<SignOutForm/>}` ao `ProfileMenu` (Client) | `ProfileMenu` é Client; importar `SignOutForm` do barrel `@/modules/identity` (que reexporta `session.ts` server-only) quebraria `next build` (L-021). Passar Server Component como prop a Client Component é o padrão RSC | y |
| A5 | **Migração do `ThemeToggle`** (ponto 4) = **opção (a)**: remover do `layout.tsx` raiz (body), reinstalar flutuante em `(public)/layout.tsx` e `(auth)/layout.tsx`; em `(app)` fica só no Menu de Perfil. O **`ThemeScript`** (anti-FOUC) permanece global no `<head>` raiz | agent | Opção (a) do briefing | App Router: só o layout raiz renderiza `<html>/<head>`; layouts de grupo são fragmentos. Mover o `<ThemeToggle>` (body) para os grupos que **não** têm menu de perfil é o split idiomático. O `ThemeScript` seta `data-theme` — inócuo/necessário em todos os grupos, fica no raiz. **Corolário:** some o overlap do toggle flutuante × bottom bar em mobile de `(app)` | y |
| A6 | O **papel ativo** dentro do painel reusa o `roleLabel` já computado (`describeActiveRoles`) que o layout passa ao `AppHeader`; mantém `data-testid="app-header-role-label"` (agora no painel) | agent | Reusar `roleLabel` + testid | Zero mudança na fonte do rótulo; testes existentes migram (abrindo o menu) | y |
| A7 | **APP-SHELL-MN-01 reenquadrada** (round 2): a garantia "sem beco sem saída" passa a ser **trigger de perfil sempre visível + Sair alcançável ao abrir** (não mais "Sair sempre no DOM"). Supersede a fraseação da USP-061 | agent | Reenquadrar MN-01 → PROF-MN-05 | Sair passa a viver no dropdown (fechado por default). A saída continua garantida: o trigger é sempre visível e Sair está a 1 clique. Registrado como supersessão explícita, não drop silencioso | y |

**Owner de todos os itens = `agent`.** Nenhum item de owner externo pendente →
**Entry Gate (tasks.md §0) está livre**: a feature entra em task breakdown.

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Menu de Perfil no header (nome/papel, tema, Sair) ⭐ MVP

**User Story**: Como Pessoa autenticada, quero um menu de perfil no canto direito do header
que mostre quem sou e meu papel, me deixe trocar o tema e sair — para ter esses controles num
único lugar limpo, em vez de texto solto e um botão de tema flutuando no canto da tela.

**Why P1**: É o núcleo da USP e concretiza o pedido do dono (round 2); resolve o canto direito
estático e tira o `ThemeToggle` flutuante de cima da bottom bar mobile.

**Acceptance Criteria**:

1. WHEN uma Pessoa renderiza qualquer rota `(app)/*` THEN o header SHALL prover, no canto
   direito, um **trigger de perfil** (avatar da inicial + nome) que, ao acionar, abre um
   painel dropdown. `[PROF-01]`
2. WHEN o painel abre THEN SHALL exibir o **nome** e o **papel ativo** da Pessoa (papel
   omitido quando não há papel ativo — sem placeholder). `[PROF-01, PROF-06]`
3. WHEN o painel abre THEN SHALL conter um **controle de tema** que alterna claro/escuro
   (reusando a lógica do `ThemeToggle`) e **persiste** a escolha (`data-theme` +
   `localStorage`). `[PROF-02]`
4. WHEN o painel abre THEN SHALL conter a ação **Sair** (o `SignOutForm` existente); acioná-la
   SHALL efetuar o logout. `[PROF-03]`
5. WHEN o trigger é acionado THEN o painel SHALL abrir/fechar (`useState`) e SHALL fechar ao
   escolher uma ação; o trigger SHALL expor `aria-expanded`, `aria-controls`, `aria-haspopup`
   e `aria-label`. `[PROF-04]`
6. WHEN a app inteira renderiza THEN o `ThemeToggle` flutuante `fixed bottom-4 right-4` SHALL
   NÃO aparecer em `(app)/*` (o tema mora no Menu de Perfil), mas SHALL continuar disponível
   flutuante em `(public)` e `(auth)`; o `ThemeScript` (anti-FOUC) SHALL permanecer global. `[PROF-05]`

**Independent Test**: Renderizar `ProfileMenu` (RTL) com `personName`/`roleLabel` e um
`signOut` stub: abrir/fechar pelo trigger; ver nome + papel; o controle de tema alternar
`data-theme` e gravar `localStorage`; a ação Sair presente; papel omitido quando `roleLabel`
vazio. Testes source-scan confirmam a migração do `ThemeToggle` (ausente no raiz; presente em
`(public)`/`(auth)`; `ThemeScript` no raiz).

---

## Edge Cases

- WHEN a Pessoa não tem papel ativo (`roleLabel === ''`) THEN o painel SHALL exibir só o nome
  (sem nó de papel). `[PROF-06]`
- WHEN `localStorage` está indisponível THEN o controle de tema SHALL degradar sem lançar
  (herdado do `ThemeToggle`). `[PROF-02]`
- WHEN o painel está fechado THEN nome/papel/tema/Sair não estão no fluxo (só o trigger é
  focável) — espelha `PublicNav`. `[PROF-04]`
- WHEN a Pessoa está numa rota `(public)`/`(auth)` THEN o tema fica no `ThemeToggle` flutuante
  (não há Menu de Perfil ali). `[PROF-05]`

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, independentemente do caminho. Cada um exige um teste negativo que
afirma que o resultado proibido não ocorre (ver validate.md §6b).

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| -- | ------------------------------- | -------- | ----------- | ------------- |
| PROF-MN-01 | WHEN o `ProfileMenu` renderiza THEN os arquivos de `(app)/_components/**` SHALL NOT importar `prisma` / `getCurrentPerson` / `requireActivePerson` / View Models / Server Actions / `'use server'` — dados só via props | Renderizar PII de Pessoa ≠ da sessão na chrome global | T2 | `src/shared/__tests__/app-shell-no-auth-pii.test.ts` (guard USP-061; asserção de `profile-menu.tsx`) |
| PROF-MN-02 | WHEN o `ProfileMenu` renderiza THEN SHALL NOT usar hex cru / paleta fixa / CDN externa / lib de ícone ou de estado — tokens-only | Deriva do design system | T2 | `src/shared/__tests__/app-shell-uses-tokens.test.ts` (guard USP-061; asserção de `profile-menu.tsx`) |
| PROF-MN-03 | WHEN o `ProfileMenu` (Client) é bundlado THEN SHALL NOT importar do barrel `@/modules/identity` (que reexporta `session.ts` server-only) — o `SignOutForm` chega **por prop**; imports de identity só de `domain/*` puro | Quebrar `next build` ("importing a component that needs next/headers") — a classe da lição L-021 | T2, T4 | `profile-menu.test.tsx` / static-scan (nenhum `from '@/modules/identity'` em `profile-menu.tsx`) + **build gate** |
| PROF-MN-04 | WHEN uma rota `(app)/*` renderiza THEN o sistema SHALL NOT montar o `ThemeToggle` flutuante global (`fixed bottom-4 right-4`) — o controle de tema em `(app)` vive **só** no Menu de Perfil | Dois controles de tema concorrentes + o toggle flutuante sobrepondo a bottom bar em mobile | T5 | `theme-toggle-placement.test.ts` (source-scan: raiz sem `<ThemeToggle>` no body; `(public)`/`(auth)` com; `ThemeScript` no raiz) |
| PROF-MN-05 | WHEN qualquer `children` é renderizado na casca `(app)` THEN SHALL NOT ficar sem um header persistente com marca→`/inicio` **e um trigger de perfil sempre visível a partir do qual Sair é alcançável** (reenquadra APP-SHELL-MN-01) | Beco sem saída — a Pessoa não conseguir sair/navegar (o UAT H-3/SOC-2/EMP-5) | T4 | `app-shell.test.tsx` / `app-header.test.tsx` (trigger sempre presente; abrir → Sair presente) |

> **Supersessão explícita (A7):** PROF-MN-05 **reenquadra** APP-SHELL-MN-01 da USP-061 —
> "Sair sempre no DOM" → "trigger de perfil sempre visível + Sair alcançável ao abrir". O teste
> `app-shell.test.tsx`/`app-header.test.tsx` da USP-061 é **atualizado** (não enfraquecido): o
> `getByRole('button', {name:'Sair'})` incondicional vira "abrir o menu → Sair presente".

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PROF-01 | P1: Menu de Perfil (trigger + painel) | T2, T4 | Pending |
| PROF-02 | P1: Menu de Perfil (tema) | T2 | Pending |
| PROF-03 | P1: Menu de Perfil (Sair) | T2, T4 | Pending |
| PROF-04 | P1: Menu de Perfil (disclosure/a11y) | T2 | Pending |
| PROF-05 | P1: Migração do ThemeToggle | T5 | Pending |
| PROF-06 | P1: Menu de Perfil (papel condicional) | T2, T4 | Pending |
| PROF-MN-01 | P1: Menu de Perfil | T2 | Pending |
| PROF-MN-02 | P1: Menu de Perfil | T2 | Pending |
| PROF-MN-03 | P1: Menu de Perfil | T2, T4 | Pending |
| PROF-MN-04 | P1: Migração do ThemeToggle | T5 | Pending |
| PROF-MN-05 | P1: Menu de Perfil (sem beco sem saída) | T4 | Pending |

**ID format:** `PROF-[NUMBER]`; must-nots `PROF-MN-[NUMBER]`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 total, 11 mapped to tasks (plano combinado 064+065 — ver `tasks.md`), 0 unmapped.

---

## Success Criteria

- [ ] Header `(app)` mostra o trigger de perfil (avatar+nome); ao abrir: nome + papel ativo.
- [ ] Controle de tema no painel alterna claro/escuro e persiste (reusa `ThemeToggle`).
- [ ] Sair no painel efetua logout (SignOutForm reusado, via prop).
- [ ] Papel omitido quando não há papel ativo (sem placeholder).
- [ ] `ThemeToggle` flutuante removido do raiz; presente em `(public)`/`(auth)`; ausente em
      `(app)`; `ThemeScript` global preservado.
- [ ] `ProfileMenu` não importa o barrel `@/modules/identity` (build verde).
- [ ] 5 must-nots com teste negativo verde (2 guards reusados + 1 static-scan de import + 1
      source-scan de placement + 1 sem-beco-sem-saída).
- [ ] typecheck/lint verdes, `npm run test` verde, `NODE_ENV=production` build OK, zero migração.
