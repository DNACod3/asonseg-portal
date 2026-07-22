# USP-064 + USP-065 — Sidebar colapsável + Menu de Perfil (plano combinado, 1 unit) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `bravi-spec-driven` skill: **activate it by name and follow
its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.
The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation,
adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

> **Plano combinado 064+065 (executa como 1 unit).** As duas USPs são a **mesma superfície**
> (a chrome da casca `(app)`) e editam os **mesmos arquivos** (`AppShell`, `AppHeader`,
> `(app)/layout.tsx`, os guards source-scan). Por isso o plano é **um só**, com este arquivo
> idêntico nos dois `dir:`. Cada task é marcada com a USP que serve: `[064]` (sidebar),
> `[065]` (menu de perfil / migração do tema), `[shared]` (integração).
>
> - **USP-064** (`.../usp-064-sidebar-desktop/`) é dona de: SIDE-01..06, SIDE-MN-01..05.
> - **USP-065** (`.../usp-065-menu-perfil/`) é dona de: PROF-01..06, PROF-MN-01..05.
>
> Justificativa da lista única (não 2 encadeadas): a mudança do `AppShell` para flex-row
> (064), a troca identidade→`ProfileMenu` no `AppHeader` (065) e a edição do `(app)/layout.tsx`
> (064) tocam literalmente os mesmos arquivos; e `app-shell.test.tsx` exercita a árvore real
> `AppShell → AppHeader → ProfileMenu`. Duas listas duplicariam a fundação ou criariam arestas
> cross-USP num único PR. Como a unidade roda em 1 PR (precedente 062/063), a lista única é a
> opção não-redundante.

**Designs**:
- `.specs/features/app-shell-logado/usp-064-sidebar-desktop/design.md`
- `.specs/features/app-shell-logado/usp-065-menu-perfil/design.md`

**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `CLAUDE.md` (§Testing Requirements — RTL component tests; matriz de Server
> Action N/A aqui), `docs/arch/project-guideline.md` (§18 DoD, §17 cobertura 70%/CI ≥65%),
> `vitest.config.ts`, `package.json` scripts. Repo samples/molds:
> `src/app/(public)/_components/__tests__/public-nav.test.tsx` (mock `usePathname`),
> `src/shared/ui/__tests__/theme-toggle.test.tsx` (toggle de tema),
> `src/app/(app)/_components/__tests__/app-header.test.tsx` / `app-shell.test.tsx` (RTL de
> casca), `src/app/(app)/layout.test.tsx` (mock `@/modules/identity`),
> `src/shared/__tests__/app-shell-no-auth-pii.test.ts` / `app-shell-uses-tokens.test.ts`
> (guards source-scan reusados). Esta unidade adiciona **nenhum** domain service, Server
> Action, repository ou migração — só componentes de rota apresentacionais (Client) +
> reconfiguração de montagem de layout + reuso de helpers/registry já existentes. E2E
> autenticado deferido (lição **L-007**, precedente AD-025/AD-027).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Componente de nav/chrome (`AppSidebar`, `ProfileMenu`) — Client | unit (RTL, mock `next/navigation`) | Render role-aware + active-state (aria-current) + collapse/persistência + disclosure/a11y + **negativos** (allowlist, role-absent, a11y colapsada, sem import de barrel) | `src/app/(app)/_components/__tests__/*.test.tsx` | `npm run test` |
| Chrome (`AppShell`, `AppHeader`) — modificados | unit (RTL) | Estrutura flex-row + seam `sidebar`; header com `ProfileMenu`; **PROF-MN-05** (trigger sempre visível, Sair alcançável ao abrir); papel condicional | `src/app/(app)/_components/__tests__/*.test.tsx` | `npm run test` |
| Composition-root (`(app)/layout.tsx`) | unit (RTL; mock `@/modules/identity`, `@/modules/moderation`, `next/navigation`) | Injeta `sidebar` (role-aware) + `bottomNav`; regressão da chrome USP-061 verde; role-absent negativo | `src/app/(app)/layout.test.tsx` | `npm run test` |
| Montagem do `ThemeToggle` (raiz + `(public)`/`(auth)` layouts) | unit (source-scan) | **PROF-MN-04**: raiz sem `<ThemeToggle>` (mas com `ThemeScript`); `(public)`/`(auth)` com `<ThemeToggle>` | `src/shared/__tests__/theme-toggle-placement.test.ts` | `npm run test` |
| Guards estáticos MN-03/MN-04 (reusados USP-061) | unit (source-scan) | Padrões proibidos ausentes em `(app)/_components/**`; membership migrada (`app-sidebar.tsx`/`profile-menu.tsx` in, `app-desktop-menu.tsx` out) | `src/shared/__tests__/*.test.ts` | `npm run test` |
| E2E (navegação autenticada) | none (deferido — L-007 / AD-025 / AD-027) | — (build gate only) | — | build gate only |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (RTL componente/chrome/layout) | Yes | Isolamento por arquivo; só mocks (sem DB/conexão) | `public-nav.test.tsx`, `app-shell.test.tsx`, `layout.test.tsx` |
| unit (source-scan guard/placement) | Yes | Lê arquivos-fonte read-only; sem estado mutável compartilhado | `app-shell-no-auth-pii.test.ts` |
| unit (RTL ThemeToggle, `localStorage`/`data-theme`) | Yes | jsdom por-arquivo; `afterEach` limpa `localStorage`/`dataset` | `theme-toggle.test.tsx`/`theme-script.test.tsx` |

Todos os testes desta unidade são parallel-safe (sem integração/e2e, sem backing store
compartilhado). `[P]` é limitado só por dependências de **código** entre tasks. **Exceção de
sequenciamento de edição:** T1, T2 e T6 editam os mesmos 2 guards (`app-shell-*.test.ts`) e T3,
T4 editam o mesmo `app-shell.test.tsx` — quando em fases/paralelo, sequenciar essas edições de
arquivo comum (a lógica de componente em si não colide).

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks com testes unit/RTL/guard | `npm run test` (dirigido no dev: `npx vitest run <path>`) |
| Full | Igual ao Quick — a unidade não adiciona integração/e2e | `npm run test` |
| Build | Após conclusão de fase / final | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Componentes + migração independentes (Parallel)

```
T1 [064]  AppSidebar          (arquivo novo)              [P]
T2 [065]  ProfileMenu         (arquivo novo)              [P]
T3 [064]  AppShell → flex-row (modifica app-shell.tsx/test) [P]
T5 [065]  ThemeToggle migração (raiz + public/auth + placement test) [P]
```

### Phase 2: Header (Sequential)

```
(T2,T3) ──→ T4 [064+065]   (AppHeader: remove nav + ProfileMenu; reframe MN-01)
```

### Phase 3: Integração (Sequential)

```
(T1,T3,T4) ──→ T6 [064]    (wire layout + remover AppDesktopMenu + migrar guards)  [build gate]
```

3 fases → execução inline (sem delegação a sub-agente; limiar é >3 fases).

---

## Task Breakdown

### T1: `AppSidebar` — sidebar colapsável (Client) [064] [P]

**What**: Sidebar fixa à esquerda (`≥ md`) com a navegação completa role-aware, alternando
expandido (ícone+rótulo+títulos) ⇄ colapsado (só-ícone), com toggle + persistência
(`localStorage`) e active-state; acessível mesmo colapsada.
**Where**: `src/app/(app)/_components/app-sidebar.tsx` (novo),
`src/app/(app)/_components/__tests__/app-sidebar.test.tsx` (novo); **estende** os guards
`src/shared/__tests__/app-shell-no-auth-pii.test.ts` e `app-shell-uses-tokens.test.ts`
(adiciona asserção de que `app-sidebar.tsx` consta da varredura).
**Depends on**: None (reusa `pickActiveHref` e `NavIcon`, já existentes da USP-062/063)
**Reuses**: `pickActiveHref` (`@/modules/identity/domain/app-nav`, import direto L-021),
`NavIcon` (`./nav-icons`, intacto), `cn` (`@/shared/ui`), `usePathname`/`Link`; padrão de
persistência do `ThemeToggle` (`useState`+`useEffect`+`localStorage`, degrada sem lançar);
molde de mock em `public-nav.test.tsx`
**Requirement**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, **SIDE-MN-01**,
**SIDE-MN-02**, **SIDE-MN-03**, **SIDE-MN-04**, **SIDE-MN-05**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `'use client'`; props `{ groups: HubLinkGroup[]; className? }`; `<aside>` root
      `hidden md:flex md:flex-col shrink-0 self-start sticky top-0 h-screen border-r border-border
      bg-surface`, largura `w-60` (expandido) / `w-16` (colapsado) via `useState(collapsed)`.
- [ ] Toggle: botão com `aria-pressed={collapsed}` + `aria-label` dinâmico ("Recolher/Expandir
      menu lateral"), chevron SVG inline **local** (não importa/edita `nav-icons.tsx`).
- [ ] Persistência (padrão `ThemeToggle`): `useState(false)` (SSR expandido, sem mismatch);
      `useEffect` lê `localStorage['asonseg:sidebar-collapsed'] === 'true'`; toggle grava a
      chave; `try/catch` em read/write (degrada sem lançar — SIDE-03 edge).
- [ ] `<nav aria-label="Navegação lateral">` com um bloco por grupo (título só no expandido) e
      um `<Link>` por link (`NavIcon` + rótulo no expandido) — grupos/ordem = `buildHubLinks`.
- [ ] `activeHref = pickActiveHref(<flatten hrefs>, pathname)`; link ativo → `aria-current="page"`;
      ≤1 ativo (SIDE-04).
- [ ] **Colapsada**: `<span>` do rótulo omitido; `<Link>` recebe `aria-label`+`title = link.label`
      (SIDE-06/SIDE-MN-05 — nome acessível preservado).
- [ ] Tokens-only (`text-fg`/`text-fg-muted`/`text-primary`/`border-border`/`bg-surface`/`rounded-*`).
- [ ] RTL (mock `next/navigation`; `localStorage` do jsdom): render expandido mostra
      rótulos+títulos; toggle → modo colapsado (só ícones) + `localStorage` gravado; recarrega
      preferência de `localStorage`; active-state por `pathname` incl. **aninhado**
      (`/perfil/papeis` ativo, `/perfil` não); **SIDE-MN-01 (negativo)**: com `groups =
      buildHubLinks(<acesso total>)`, todo href de âncora ∈ `EXISTING_HUB_ROUTES`; **SIDE-MN-02
      (negativo)**: candidate-only → sem grupo "Institucional"/`/moderacao`/`/relatorios`;
      **SIDE-MN-05 (negativo)**: colapsada, cada link tem accessible name (getByRole('link',
      {name: …})).
- [ ] **SIDE-MN-03/MN-04**: guards `app-shell-no-auth-pii`/`app-shell-uses-tokens` seguem
      **verdes** com o arquivo novo; adicionar em cada guard a asserção de que `app-sidebar.tsx`
      consta da varredura (torna o must-not explícito).
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥8 novos testes de componente + 2 asserções de guard passam (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): AppSidebar — sidebar colapsável da área logada (USP-064)`

---

### T2: `ProfileMenu` — dropdown de perfil (Client) [065] [P]

**What**: Dropdown de perfil no header — trigger avatar(inicial)+nome; painel com nome + papel
ativo, controle de tema (`ThemeToggle` reusado) e Sair (injetado por prop).
**Where**: `src/app/(app)/_components/profile-menu.tsx` (novo),
`src/app/(app)/_components/__tests__/profile-menu.test.tsx` (novo); **estende** os guards
`app-shell-no-auth-pii.test.ts` e `app-shell-uses-tokens.test.ts` (asserção de que
`profile-menu.tsx` consta da varredura).
**Depends on**: None
**Reuses**: **molde do disclosure** do `PublicNav` (`useState`, `aria-expanded`/`aria-controls`/
`aria-label`, fecha ao clicar), `ThemeToggle` + `cn` (`@/shared/ui`, client-safe), gradiente da
marca (avatar-badge); molde de teste em `public-nav.test.tsx`/`theme-toggle.test.tsx`
**Requirement**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-06, **PROF-MN-01**, **PROF-MN-02**,
**PROF-MN-03**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `'use client'`; props `{ personName: string; roleLabel: string; signOut: React.ReactNode;
      className? }`; **não** importa `@/modules/identity` (só `@/shared/ui`) — PROF-MN-03.
- [ ] Trigger: botão `aria-expanded`/`aria-controls="profile-menu-panel"`/`aria-haspopup="menu"`/
      `aria-label` dinâmico; avatar `<span aria-hidden>` com a inicial de `personName`
      (`bg-gradient-to-br from-primary to-secondary text-white`) + nome (`hidden sm:block`).
- [ ] Painel (`open === true`) `role="menu"`: nome; papel **só se** `roleLabel` não-vazio
      (`data-testid="app-header-role-label"`) — PROF-06; linha "Tema" + `<ThemeToggle/>` reusado
      (PROF-02); `{signOut}` (PROF-03); fecha (`setOpen(false)`) ao acionar Sair (PROF-04).
- [ ] Tokens-only (PROF-MN-02).
- [ ] RTL (mock `next/navigation` não necessário; usa `fireEvent`): trigger abre/fecha o painel;
      painel mostra nome + papel; **papel omitido** quando `roleLabel=''`
      (`queryByTestId('app-header-role-label')` ausente); o controle de tema alterna
      `document.documentElement.dataset.theme` e grava `localStorage['theme']` (reuso do
      `ThemeToggle`); a ação Sair (stub node) presente; **PROF-MN-03 (negativo/static)**: o
      arquivo `profile-menu.tsx` não contém `from '@/modules/identity'` (assert por leitura de
      fonte no teste, ou guard dedicado).
- [ ] **PROF-MN-01/MN-02**: guards seguem verdes; adicionar asserção de que `profile-menu.tsx`
      consta da varredura em cada guard.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥7 novos testes de componente + 2 asserções de guard + 1 static-scan passam
      (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): ProfileMenu — dropdown de perfil (nome/papel + tema + Sair) (USP-065)`

---

### T3: `AppShell` → flex-row + seam `sidebar` [064] [P]

**What**: Reestruturar a casca para **flex-row** (sidebar à esquerda + coluna `flex-1` com
header + `{children}` + bottomNav); trocar o seam `headerNav` pelo seam `sidebar`.
**Where**: `src/app/(app)/_components/app-shell.tsx` (modifica),
`src/app/(app)/_components/__tests__/app-shell.test.tsx` (estende).
**Depends on**: None (AppShell não importa `AppSidebar` — recebe-o como `ReactNode`; o teste usa
um stub)
**Reuses**: `AppHeader` (composição); padrão de seam da USP-061
**Requirement**: SIDE-01 (estrutura), APP-SHELL-06/07 (regressão dos seams)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `AppShellProps`: `personName`, `roleLabel`, `children`, `sidebar?`, `bottomNav?`
      (**remove** `headerNav?`).
- [ ] Estrutura: `<div className="flex min-h-screen">{sidebar}<div className="flex min-h-screen
      flex-1 flex-col"><AppHeader personName roleLabel />{children}{bottomNav}</div></div>`.
- [ ] `AppShell` **não** importa `AppSidebar` (apresentacional; MN-03 preservado); **não**
      declara `<main>` (A2/USP-061).
- [ ] RTL: com `sidebar={<nav data-testid="sidebar"/>}` injetado, renderiza dentro da casca
      (à esquerda do header); com `bottomNav` injetado, renderiza após o conteúdo; sem seams,
      só a chrome + children (banner presente). (A regressão de "Sair" fica com o `AppHeader`
      real inalterado neste passo — o reframe MN-01 é da T4.)
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥3 testes de casca passam/atualizados (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(identity): AppShell flex-row + seam sidebar (substitui headerNav) (USP-064)`

---

### T4: `AppHeader` — remover `nav` + montar `ProfileMenu` [064+065]

**What**: Trocar o bloco estático de identidade + `SignOutForm` do `AppHeader` por
`<ProfileMenu personName roleLabel signOut={<SignOutForm/>} />`; remover o prop/slot `nav?`
(a sidebar assumiu o desktop). Reenquadrar a garantia sem-beco-sem-saída (PROF-MN-05).
**Where**: `src/app/(app)/_components/app-header.tsx` (modifica),
`src/app/(app)/_components/__tests__/app-header.test.tsx` (atualiza),
`src/app/(app)/_components/__tests__/app-shell.test.tsx` (atualiza o MN-01 reframe — a casca
renderiza o `AppHeader` real).
**Depends on**: T2 (ProfileMenu), T3 (AppShell)
**Reuses**: `SignOutForm` (`@/modules/identity` barrel — permitido, `AppHeader` é Server),
`ProfileMenu` (T2), `cn`, `Link`
**Requirement**: PROF-01, PROF-03, PROF-06, **PROF-MN-05**; SIDE-01 (header sem nav desktop)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Remove o prop `nav?` e o slot `{nav}` do `AppHeader`.
- [ ] Renderiza, no canto direito, `<ProfileMenu personName={personName} roleLabel={roleLabel}
      signOut={<SignOutForm />} />` (SignOutForm criado no Server e passado como node — L-021).
- [ ] Mantém a marca→`/inicio` (sempre visível).
- [ ] `app-header.test.tsx` atualizado: o **trigger de perfil** está sempre presente
      (`aria-label`/`aria-haspopup`); abrir o menu (`fireEvent.click`) → nome + papel + Sair
      presentes; papel **omitido** quando `roleLabel=''` (abrir → `queryByTestId` ausente);
      o antigo teste "seam headerNav" é **removido** (seam extinto — justificado: sidebar assume).
- [ ] `app-shell.test.tsx` atualizado (**PROF-MN-05**, reframe de APP-SHELL-MN-01): para
      children arbitrário, sempre há header com marca→`/inicio` **e** o trigger de perfil
      visível; abrir o trigger → "Sair" presente. (Substitui o antigo `getByRole('button',
      {name:'Sair'})` incondicional — documentado como reenquadramento, não enfraquecimento.)
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥5 testes de header/casca passam/atualizados (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): AppHeader monta ProfileMenu e remove o seam nav desktop (USP-064/065)`

---

### T5: Migrar o `ThemeToggle` do canto flutuante global [065] [P]

**What**: Tirar o `ThemeToggle` flutuante do `layout.tsx` raiz (mantendo o `ThemeScript`
global) e reinstalá-lo flutuante em `(public)` e `(auth)`; em `(app)` ele vive só no
`ProfileMenu` (T2).
**Where**: `src/app/layout.tsx` (modifica), `src/app/(public)/layout.tsx` (modifica),
`src/app/(auth)/layout.tsx` (modifica), `src/shared/__tests__/theme-toggle-placement.test.ts`
(novo, source-scan); atualizar `src/app/layout` test se existente.
**Depends on**: None
**Reuses**: `ThemeToggle`/`ThemeScript` (`@/shared/ui`); molde source-scan dos guards existentes
**Requirement**: PROF-05, **PROF-MN-04**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `src/app/layout.tsx`: remove `<ThemeToggle className="fixed bottom-4 right-4 z-50
      shadow-md" />` do `<body>`; ajusta o import (deixa de usar `ThemeToggle` aqui); **mantém**
      `<ThemeScript />` no `<head>` e o resto intacto.
- [ ] `src/app/(public)/layout.tsx` **e** `src/app/(auth)/layout.tsx`: montam `<ThemeToggle
      className="fixed bottom-4 right-4 z-50 shadow-md" />` (import de `@/shared/ui`).
- [ ] `theme-toggle-placement.test.ts` (source-scan): afirma que `src/app/layout.tsx` **não**
      monta `<ThemeToggle` mas **mantém** `ThemeScript`; que `(public)/layout.tsx` **e**
      `(auth)/layout.tsx` **montam** `<ThemeToggle` (PROF-MN-04, PROF-05).
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥3 novos testes de placement passam (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(identity): mover ThemeToggle do canto flutuante global p/ (public)/(auth) + menu de perfil (USP-065)`

---

### T6: Wire `(app)/layout.tsx` (sidebar) + remover `AppDesktopMenu` + migrar guards [064] [shared]

**What**: Fazer o layout injetar `sidebar={<AppSidebar groups={groups}/>}` (removendo o
`AppDesktopMenu`/`headerNav`); **deletar** `app-desktop-menu.tsx` (+ teste); **migrar** a
asserção de membership dos guards (`app-desktop-menu.tsx` → removida; `app-sidebar.tsx`/
`profile-menu.tsx` já adicionadas em T1/T2); atualizar `layout.test.tsx`.
**Where**: `src/app/(app)/layout.tsx` (modifica), `src/app/(app)/layout.test.tsx` (atualiza),
`src/app/(app)/_components/app-desktop-menu.tsx` (**deletar**),
`src/app/(app)/_components/__tests__/app-desktop-menu.test.tsx` (**deletar**),
`src/shared/__tests__/app-shell-no-auth-pii.test.ts` + `app-shell-uses-tokens.test.ts`
(remover a asserção `toContain('app-desktop-menu.tsx')`).
**Depends on**: T1 (AppSidebar), T3 (AppShell seam `sidebar`), T4 (AppHeader final)
**Reuses**: `requireActivePerson`/`hubAccessFromRoles`/`buildHubLinks`/`describeActiveRoles`/
`selectPrimaryTabs` (`@/modules/identity`), `canAccessModerationQueue` (`@/modules/moderation`),
`AppShell`/`AppSidebar`/`AppBottomNav`; molde de teste em `layout.test.tsx`
**Requirement**: SIDE-01, **SIDE-MN-02** (ângulo composition-root); APP-SHELL-06 (regressão
USP-061 verde); A8 (remoção do dead code)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `(app)/layout.tsx`: remove `import { AppDesktopMenu }` e `headerNav={...}`; adiciona
      `import { AppSidebar } from './_components/app-sidebar'` e `sidebar={<AppSidebar
      groups={groups} />}`. `requireActivePerson()`, `HubAccess`/`groups`, `describeActiveRoles`,
      `bottomNav={<AppBottomNav tabs={selectPrimaryTabs(groups)} />}` — **inalterados**.
- [ ] `app-desktop-menu.tsx` e `app-desktop-menu.test.tsx` **deletados** (dead code — A8).
- [ ] Guards: remover `expect(scannedBasenames).toContain('app-desktop-menu.tsx')` de ambos
      (`app-shell-no-auth-pii.test.ts`, `app-shell-uses-tokens.test.ts`); `app-sidebar.tsx` e
      `profile-menu.tsx` já constam (T1/T2). Os guards seguem verdes varrendo o dir atual.
- [ ] `layout.test.tsx` atualizado: remove a asserção que abre o painel do `AppDesktopMenu`;
      afirma que a `sidebar` renderiza a nav role-aware (ex.: link `/candidato` para CANDIDATE);
      **negativo composição** (SIDE-MN-02): sem link de `/moderacao` para Pessoa sem acesso;
      **regressão USP-061**: header/trigger-de-perfil presentes; `requireActivePerson` chamado
      sem args; ambos os seams (`sidebar`/`bottomNav`) preenchidos.
- [ ] Nenhuma referência remanescente a `AppDesktopMenu`/`app-desktop-menu` no repo (grep limpo).
- [ ] Gate check passes: `npm run test`; **Build gate** ao final: `npm run typecheck && npm run
      lint && npm run test && npm run build`.
- [ ] Test count: ≥4 testes de layout passam/atualizados (no silent deletions)

**Tests**: unit
**Gate**: build
**Commit**: `feat(identity): injetar AppSidebar no layout (app) e remover AppDesktopMenu (USP-064)`

---

## Parallel Execution Map

```
Phase 1 (Componentes + migração, Parallel):
  T1 [064] AppSidebar          [P]
  T2 [065] ProfileMenu         [P]
  T3 [064] AppShell flex-row   [P]
  T5 [065] ThemeToggle migração[P]
  (arquivos de componente/layout distintos; edições de guard compartilhado — T1,T2 — sequenciadas)

Phase 2 (Header, Sequential):
  (T2,T3) ──→ T4 [064+065]

Phase 3 (Integração, Sequential):
  (T1,T3,T4) ──→ T6 [064]   [build gate]
```

**Parallelism constraint:** todos os tipos de teste são parallel-safe (unit/RTL/source-scan).
`[P]` é limitado só por dependências de código. Em Phase 1, T1/T2/T3/T5 são order-free (arquivos
de componente/layout distintos); a edição das asserções de membership dos guards (T1, T2) e do
`app-shell.test.tsx` (T3 vs. T4, fases distintas) é sequenciada por serem arquivos comuns — não
é dependência de código.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: `AppSidebar` + asserções de guard | 1 componente (+2 asserções) | ✅ Granular (coeso) |
| T2: `ProfileMenu` + asserções de guard | 1 componente (+2 asserções +1 static) | ✅ Granular (coeso) |
| T3: `AppShell` flex-row + seam | 1 file change (+test) | ✅ Granular |
| T4: `AppHeader` ProfileMenu + reframe MN-01 | 1 file change (+2 tests atualizados) | ✅ Granular (coeso) |
| T5: migração de montagem do ThemeToggle | 3 layouts (mesma mudança coesa) + 1 test | ✅ Granular (1 decisão) |
| T6: wire layout + remoção + migração de guards | 1 file change + deleção + migração de asserções | ✅ Granular (coeso: 1 integração) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none (independente, [P]) | ✅ Match |
| T2 | None | none (independente, [P]) | ✅ Match |
| T3 | None | none (independente, [P]) | ✅ Match |
| T4 | T2, T3 | (T2,T3) → T4 | ✅ Match |
| T5 | None | none (independente, [P]) | ✅ Match |
| T6 | T1, T3, T4 | (T1,T3,T4) → T6 | ✅ Match |

- Todo `Depends on` tem seta correspondente; toda seta corresponde a um `Depends on`.
- `[P]` na mesma fase não depende entre si: T1/T2/T3/T5 (Phase 1) são arquivos distintos; a
  edição de guard compartilhado (T1,T2) é sequenciada, não é dependência de código. ✅

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Componente de nav (Client, RTL) + guard | unit | unit | ✅ OK |
| T2 | Componente de chrome (Client, RTL) + guard | unit | unit | ✅ OK |
| T3 | Chrome (AppShell, RTL) | unit | unit | ✅ OK |
| T4 | Chrome (AppHeader, RTL) | unit | unit | ✅ OK |
| T5 | Montagem de layout (source-scan) | unit | unit | ✅ OK |
| T6 | Composition-root (layout, RTL) + guards | unit | unit | ✅ OK |

Nenhum `Tests: none`; nenhum deferral. Todas as camadas mapeiam ao tipo de teste exigido.
E2E autenticado = none por matriz (deferido, L-007/AD-025/AD-027). ✅

---

## 💠 Must-Not Ownership (Check 4)

| Must-Not | Owning task | Negative test (no Done-when da task) | Status |
| -------- | ----------- | ------------------------------------ | ------ |
| SIDE-MN-01 (nenhum link fora de `EXISTING_HUB_ROUTES`) | T1 | `app-sidebar.test.tsx` (acesso total → hrefs ∈ allowlist) | ✅ Owned |
| SIDE-MN-02 (nenhum grupo/link sem permissão) | T1 + T6 (composição) | `app-sidebar.test.tsx` (candidate-only) + `layout.test.tsx` | ✅ Owned |
| SIDE-MN-03 (sidebar sem sessão/PII/Prisma) | T1 | `app-shell-no-auth-pii.test.ts` (asserção de `app-sidebar.tsx`) | ✅ Owned |
| SIDE-MN-04 (sidebar tokens-only) | T1 | `app-shell-uses-tokens.test.ts` (asserção de `app-sidebar.tsx`) | ✅ Owned |
| SIDE-MN-05 (colapsada não deixa item sem nome acessível) | T1 | `app-sidebar.test.tsx` (colapsada → accessible name por link) | ✅ Owned |
| PROF-MN-01 (menu sem sessão/PII/Prisma) | T2 | `app-shell-no-auth-pii.test.ts` (asserção de `profile-menu.tsx`) | ✅ Owned |
| PROF-MN-02 (menu tokens-only) | T2 | `app-shell-uses-tokens.test.ts` (asserção de `profile-menu.tsx`) | ✅ Owned |
| PROF-MN-03 (ProfileMenu não importa o barrel identity) | T2 + T4 (build) | `profile-menu.test.tsx`/static-scan (sem `from '@/modules/identity'`) + build gate | ✅ Owned |
| PROF-MN-04 (sem ThemeToggle flutuante em `(app)`) | T5 | `theme-toggle-placement.test.ts` (raiz sem; public/auth com; ThemeScript no raiz) | ✅ Owned |
| PROF-MN-05 (sem beco sem saída — trigger sempre visível, Sair alcançável) | T4 | `app-shell.test.tsx`/`app-header.test.tsx` (trigger presente; abrir → Sair) | ✅ Owned |

Todo must-not tem task dona e teste negativo verde. MN-03/MN-04 de ambas as USPs reutilizam os
guards source-scan da USP-061 (varrem `(app)/_components/**`) — T1/T2 adicionam a asserção de
que os arquivos novos entram na varredura; T6 remove a asserção obsoleta (`app-desktop-menu.tsx`).
A allowlist da sidebar (SIDE-MN-01) é `EXISTING_HUB_ROUTES` (a sidebar não inclui `/inicio` — a
marca do header já leva ao hub). PROF-MN-03 materializa a lição **L-021** (Client Component +
barrel server-only quebra o build). PROF-MN-05 **reenquadra** APP-SHELL-MN-01 da USP-061
(supersessão documentada — spec 065 §A7), não a enfraquece.

---

## Tools / MCPs / Skills

Nenhum MCP ou skill extra necessário — é UI de rota apresentacional (Client) + reconfiguração
de montagem de layout + reuso de helpers/registry/`ThemeToggle` já existentes, tudo local ao
repo. `context7` é desnecessário (sem pergunta de API de biblioteca; os padrões Next.js App
Router Server/Client, o disclosure do `PublicNav` e a persistência do `ThemeToggle` já estão
estabelecidos). O Implementer usa a Execute flow da skill `bravi-spec-driven`; o Verifier roda
automaticamente após T6, verificando os must-nots de **ambas** as USPs (SIDE-* e PROF-*),
incluindo a supersessão de APP-SHELL-MN-01 (PROF-MN-05) e a migração do `ThemeToggle` (PROF-MN-04).
