# USP-062 + USP-063 — Navegação da casca (app) Tasks (plano combinado, 1 unit)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `bravi-spec-driven` skill: **activate it by name and follow
its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.
The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation,
adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

> **Plano combinado 062+063 (executa como 1 unit).** As duas USPs são a mesma superfície
> (navegação role-aware de `buildHubLinks` nos seams da casca da USP-061), diferindo só na
> apresentação por breakpoint. Compartilham o helper puro `pickActiveHref`, a computação de
> `HubAccess` no composition-root e a **única** edição do `(app)/layout.tsx` que injeta os
> dois seams. Por isso o plano é **um só**, com este arquivo idêntico nos dois `dir:`. Cada
> task é marcada com a USP que serve: `[shared]` (fundação/integração), `[062]`
> (bottom bar), `[063]` (menu desktop).
>
> - **USP-062** (`.../usp-062-bottom-tab-bar/`) é dona de: BNAV-01..07, BNAV-MN-01..04.
> - **USP-063** (`.../usp-063-menu-desktop/`) é dona de: DNAV-01..05, DNAV-MN-01..04.
>
> Justificativa da lista única (não 2 encadeadas): `pickActiveHref` (T1) e a edição do
> layout (T6) são literalmente compartilhados; duas listas ou duplicariam a fundação ou
> criariam uma aresta de dependência cross-USP awkward num único PR. Como a unidade roda em
> 1 PR, a lista única é a opção não-redundante.

**Designs**:
- `.specs/features/app-shell-logado/usp-062-bottom-tab-bar/design.md`
- `.specs/features/app-shell-logado/usp-063-menu-desktop/design.md`

**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `CLAUDE.md` (§Testing Requirements — RTL component tests, matriz de
> Server Action N/A aqui), `docs/arch/project-guideline.md` (§18 DoD, §17 cobertura 70%/CI
> ≥65%), `vitest.config.ts`, `package.json` scripts. Repo samples/molds:
> `src/app/(public)/_components/__tests__/public-nav.test.tsx` (mock `usePathname`),
> `src/modules/identity/__tests__/hub-links.test.ts` (invariante 2^9 combos),
> `src/app/(app)/_components/__tests__/app-header.test.tsx` / `app-shell.test.tsx` (RTL de
> casca), `src/app/(app)/layout.test.tsx` (mock `@/modules/identity`),
> `src/shared/__tests__/app-shell-no-auth-pii.test.ts` / `app-shell-uses-tokens.test.ts`
> (guards source-scan reusados). Esta unidade adiciona **nenhum** domain service, Server
> Action, repository ou migração — só helpers puros + componentes de rota apresentacionais
> (Client) + registry de ícones. E2E autenticado deferido (lição **L-007**, precedente AD-025).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain helpers puros (`pickActiveHref`, `selectPrimaryTabs`, `BOTTOM_TAB_SHORT_LABELS`) | unit | All branches; 1:1 a BNAV-03/06/07 + DNAV-03; edges (root, aninhado, no-match, zero papéis, combos); invariante allowlist 2^9; cobertura exaustiva de rótulos | `src/modules/identity/__tests__/*.test.ts` | `npm run test` |
| Registry de ícones (`nav-icons.tsx`) | unit (RTL) | Cada href elegível → ícone não-fallback; href desconhecido → fallback; `<svg aria-hidden>` | `src/app/(app)/_components/__tests__/*.test.tsx` | `npm run test` |
| Componentes de nav (`AppBottomNav`, `AppDesktopMenu`) — Client | unit (RTL, mock `next/navigation`) | Render role-aware + active-state (aria-current) + seams/responsivo + toggle (desktop) + **negativos** (allowlist, role-absent) | `src/app/(app)/_components/__tests__/*.test.tsx` | `npm run test` |
| Composition-root (`(app)/layout.tsx`) | unit (RTL; mock `@/modules/identity`, `@/modules/moderation`, `next/navigation`) | Injeta ambos os seams com conteúdo role-aware; regressão da chrome USP-061 verde; role-absent negativo | `src/app/(app)/layout.test.tsx` | `npm run test` |
| Guards estáticos MN-03/MN-04 (reusados USP-061) | unit (source-scan) | Padrões proibidos ausentes em `(app)/_components/**`; os arquivos novos constam da varredura | `src/shared/__tests__/*.test.ts` | `npm run test` |
| E2E (navegação autenticada) | none (deferido — L-007 / AD-025) | — (build gate only) | — | build gate only |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (helpers puros) | Yes | Funções puras, sem IO | `identity/__tests__/hub-links.test.ts` (puro, sem DB) |
| unit (RTL componente/layout/ícones) | Yes | Isolamento por arquivo; só mocks (sem DB/conexão) | `public-nav.test.tsx`, `app-shell.test.tsx`, `layout.test.tsx` |
| unit (source-scan guard) | Yes | Lê arquivos-fonte read-only; sem estado mutável compartilhado | `app-shell-no-auth-pii.test.ts` |

Todos os testes desta unidade são parallel-safe (sem integração/e2e, sem backing store
compartilhado). `[P]` é limitado só por dependências de **código** entre tasks.

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks com testes unit/RTL/guard | `npm run test` (dirigido no dev: `npx vitest run <path>`) |
| Full | Igual ao Quick — a unidade não adiciona integração/e2e | `npm run test` |
| Build | Após conclusão de fase / final | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Foundation (T1→T2 sequencial no mesmo arquivo; T3 [P])

```
T1 ──→ T2      (app-nav.ts: T1 cria pickActiveHref; T2 adiciona selectPrimaryTabs)
T3             (nav-icons.tsx — independente) [P]
```

### Phase 2: Componentes (Parallel)

```
(T1,T2,T3) ──→ T4 [062]
(T1)       ──→ T5 [063]     (T4 ∦ T5 — arquivos distintos, sem inter-dep)
```

### Phase 3: Integração (Sequential)

```
(T4,T5) ──→ T6
```

3 fases → execução inline (sem delegação a sub-agente; limiar é >3 fases).

---

## Task Breakdown

### T1: `pickActiveHref` — active-state longest-match (helper puro) [shared] [P]

**What**: Função pura que resolve o href "ativo" de um conjunto para um `pathname`, por
match exato-ou-descendente **mais longo** (corrige o prefixo simples do `isActive` do
PublicNav em rotas aninhadas).
**Where**: `src/modules/identity/domain/app-nav.ts` (novo), `src/modules/identity/index.ts`
(export), `src/modules/identity/__tests__/app-nav.test.ts` (novo).
**Depends on**: None
**Reuses**: precedente `isActive`/`public-nav.test.tsx` (semântica de active-state)
**Requirement**: BNAV-03, DNAV-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `pickActiveHref(hrefs: readonly string[], pathname: string): string | null` — candidato
      = `pathname === href` OU `pathname.startsWith(href + '/')`; retorna o candidato de maior
      `length`; sem candidato → `null`.
- [ ] Exportado do barrel `@/modules/identity`.
- [ ] Unit tests cobrem: match exato; descendente (`/candidato/x` → `/candidato`); raiz sem
      falso-match; **aninhado longest-match** (`/perfil/papeis` → `/perfil/papeis`, não
      `/perfil`); no-match → `null`; múltiplos candidatos → o mais longo vence.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥6 novos testes passam (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): pickActiveHref — active-state longest-match p/ nav da casca (app) (USP-062/063)`

---

### T2: `selectPrimaryTabs` + `BOTTOM_TAB_SHORT_LABELS` (helper puro) [062]

**What**: Reduzir os grupos de `buildHubLinks` ao subconjunto primário da bottom bar (Início
+ Perfil fixos + 1º link de cada grupo além de "Minha conta"), com rótulos curtos.
**Where**: `src/modules/identity/domain/app-nav.ts` (estende), `src/modules/identity/index.ts`
(exports: `selectPrimaryTabs`, `BOTTOM_TAB_SHORT_LABELS`, tipo `BottomTab`),
`src/modules/identity/__tests__/app-nav.test.ts` (estende).
**Depends on**: T1 (mesmo arquivo)
**Reuses**: `buildHubLinks`/`hubAccessFromRoles`/`EXISTING_HUB_ROUTES`/`HubLinkGroup`
(`domain/hub-links.ts`); molde do invariante 2^9 em `hub-links.test.ts`
**Requirement**: BNAV-01, BNAV-02, BNAV-06, BNAV-07, **BNAV-MN-01**, **BNAV-MN-02**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `interface BottomTab { href: string; label: string }`; `selectPrimaryTabs(groups:
      readonly HubLinkGroup[]): BottomTab[]` = `[{/inicio,'Início'},{/perfil,'Perfil'}]` +
      1º link de cada grupo cujo título ≠ "Minha conta", rótulo via `BOTTOM_TAB_SHORT_LABELS`.
- [ ] `BOTTOM_TAB_SHORT_LABELS: Record<string,string>` cobre `/inicio` + todos os
      `EXISTING_HUB_ROUTES` (tabela do design); `shortLabelFor(href)` cai no `link.label` se
      faltar (defensivo).
- [ ] Exportados do barrel `@/modules/identity`.
- [ ] Unit tests: zero papéis → exatamente `[Início, Perfil]`; candidate → +`/candidato`;
      institucional → +1 primária; combinado (público+institucional) → 4 abas, nunca >5;
      ordem determinística; **BNAV-MN-01**: para as 2^9 combinações de `HubAccess`, todo
      `tab.href ∈ EXISTING_HUB_ROUTES ∪ {'/inicio'}`; **BNAV-MN-02**: candidate-only → sem
      aba institucional; **cobertura exaustiva**: todo href de `EXISTING_HUB_ROUTES ∪ {/inicio}`
      tem rótulo curto não-vazio.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥7 novos testes passam (incl. os 2 negativos MN) (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): selectPrimaryTabs + rótulos curtos da bottom bar (USP-062)`

---

### T3: `nav-icons.tsx` — registry de ícones SVG inline [062] [P]

**What**: Mapa `href → <svg>` inline (sem lib de ícones), com fallback seguro, para as abas
da bottom bar.
**Where**: `src/app/(app)/_components/nav-icons.tsx` (novo),
`src/app/(app)/_components/__tests__/nav-icons.test.tsx` (novo).
**Depends on**: None
**Reuses**: padrão SVG inline do `PublicNav` (`viewBox="0 0 24 24" stroke="currentColor"
strokeWidth={2}`); `cn` (`@/shared/ui`)
**Requirement**: BNAV-04, **BNAV-MN-04** (tokens-only)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `NavIcon({ href, className }): React.ReactElement` — lookup interno href→`<svg>`; href
      sem entrada → ícone **fallback** (círculo), nunca lança.
- [ ] Ícones para os hrefs elegíveis a aba (tabela do design): `/inicio`, `/perfil`,
      `/candidato`, `/prestador`, `/empresa/cadastrar`, `/moderacao`, `/relatorios`,
      `/encaminhamentos/novo`, `/cadastro-assistido`, `/credenciais/reivindicacoes`,
      `/permissoes`. Cada `<svg aria-hidden fill="none" stroke="currentColor" strokeWidth={2}>`.
- [ ] Tokens-only (sem hex cru, sem host externo, sem import de lib de ícone).
- [ ] RTL tests: cada href elegível → um `<svg>` (não o fallback); href desconhecido →
      fallback; svg é `aria-hidden`.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥3 novos testes passam (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): nav-icons — registry de ícones SVG inline da bottom bar (USP-062)`

---

### T4: `AppBottomNav` — bottom tab bar (Client) [062]

**What**: A barra fixa mobile/tablet — abas (ícone + rótulo) com active-state; `md:hidden`;
spacer de reserva.
**Where**: `src/app/(app)/_components/app-bottom-nav.tsx` (novo),
`src/app/(app)/_components/__tests__/app-bottom-nav.test.tsx` (novo); **estende** os guards
`src/shared/__tests__/app-shell-no-auth-pii.test.ts` e `app-shell-uses-tokens.test.ts`
(asserção de que `app-bottom-nav.tsx`/`nav-icons.tsx` constam da varredura).
**Depends on**: T1, T2, T3
**Reuses**: `usePathname` (next/navigation), `Link` (next), `cn` (`@/shared/ui`),
`pickActiveHref` (T1), `NavIcon` (T3), tipo `BottomTab` (T2); molde de mock em
`public-nav.test.tsx`
**Requirement**: BNAV-01, BNAV-03, BNAV-04, BNAV-05, **BNAV-MN-01**, **BNAV-MN-02**,
**BNAV-MN-03**, **BNAV-MN-04**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `'use client'`; props `{ tabs: BottomTab[]; className? }`; renderiza spacer
      `<div aria-hidden className="h-16 md:hidden" />` + `<nav aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 … md:hidden">` com um `<Link>` por aba
      (`NavIcon` + rótulo); tokens-only.
- [ ] `activeHref = pickActiveHref(tabs.map(t=>t.href), pathname)`; aba ativa recebe
      `aria-current="page"`; no máximo 1 ativa.
- [ ] `md:hidden` presente (BNAV-05); spacer presente (reserva de espaço).
- [ ] RTL (mock `next/navigation`): renderiza todas as abas passadas (ícone+rótulo);
      active-state correto por `pathname`; **BNAV-MN-01 (negativo)**: com `tabs` derivadas de
      `selectPrimaryTabs(buildHubLinks(<acesso total>))`, todo `href` renderizado ∈
      `EXISTING_HUB_ROUTES ∪ {'/inicio'}`; **BNAV-MN-02 (negativo)**: com `tabs` de
      candidate-only, nenhuma âncora para `/moderacao`/`/relatorios`/etc.
- [ ] **BNAV-MN-03/MN-04**: os guards `app-shell-no-auth-pii`/`app-shell-uses-tokens` seguem
      **verdes** com os arquivos novos; adicionar em cada guard uma asserção de que
      `app-bottom-nav.tsx` e `nav-icons.tsx` estão no conjunto varrido (torna o must-not
      explícito, não silencioso).
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥6 novos testes de componente + 2 asserções de guard passam (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): AppBottomNav — bottom tab bar mobile/tablet (USP-062)`

---

### T5: `AppDesktopMenu` — menu disclosure no header (Client) [063]

**What**: O menu hambúrguer do header com a navegação completa role-aware, agrupada, com
toggle e active-state; `hidden md:block`.
**Where**: `src/app/(app)/_components/app-desktop-menu.tsx` (novo),
`src/app/(app)/_components/__tests__/app-desktop-menu.test.tsx` (novo); **estende** os guards
`app-shell-no-auth-pii.test.ts` e `app-shell-uses-tokens.test.ts` (asserção de que
`app-desktop-menu.tsx` consta da varredura).
**Depends on**: T1
**Reuses**: **molde direto** do `PublicNav` (`useState`, botão `aria-expanded`/
`aria-controls`/`aria-label`, SVG hambúrguer inline, painel, fecha ao clicar), `usePathname`,
`Link`, `cn`, `pickActiveHref` (T1), tipo `HubLinkGroup`; molde de mock em `public-nav.test.tsx`
**Requirement**: DNAV-01, DNAV-02, DNAV-03, DNAV-04, DNAV-05, **DNAV-MN-01**, **DNAV-MN-02**,
**DNAV-MN-03**, **DNAV-MN-04**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `'use client'`; props `{ groups: HubLinkGroup[]; className? }`; wrapper `hidden md:block`
      (DNAV-05); botão disclosure com SVG hambúrguer inline, `aria-expanded`,
      `aria-controls="app-menu-panel"`, `aria-label` dinâmico (DNAV-04).
- [ ] Painel (`open === true`) = `<nav id="app-menu-panel" aria-label="Navegação da conta">`
      com um bloco por grupo (título como cabeçalho) e um `<Link>` por link (DNAV-01/02).
- [ ] `activeHref = pickActiveHref(<flatten de hrefs>, pathname)`; link ativo recebe
      `aria-current="page"`; fecha (`setOpen(false)`) ao clicar num link (DNAV-03/04).
- [ ] Tokens-only (`text-fg`/`text-fg-muted`/`text-primary`/`border-border`/`bg-surface`/
      `shadow-*`/`rounded-*`).
- [ ] RTL (mock `next/navigation`): botão abre/fecha o painel (`fireEvent.click`); render
      agrupado só dos grupos passados; **active-state aninhado** (`pathname='/perfil/papeis'`
      → `/perfil/papeis` ativo, `/perfil` **não**); **DNAV-MN-01 (negativo)**: com `groups` de
      acesso total, todo `href` de âncora ∈ `EXISTING_HUB_ROUTES`; **DNAV-MN-02 (negativo)**:
      com `groups` de candidate-only, sem grupo "Institucional"/links de moderação.
- [ ] **DNAV-MN-03/MN-04**: guards seguem verdes; adicionar asserção de que
      `app-desktop-menu.tsx` consta da varredura em cada guard.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: ≥7 novos testes de componente + 2 asserções de guard passam (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): AppDesktopMenu — menu de navegação no header desktop (USP-063)`

---

### T6: Injetar os dois seams no `(app)/layout.tsx` (composition-root) [shared]

**What**: Fazer o layout computar `HubAccess`/`groups` e injetar `headerNav`
(`AppDesktopMenu`) + `bottomNav` (`AppBottomNav`), preenchendo os seams da casca da USP-061.
**Where**: `src/app/(app)/layout.tsx` (modifica), `src/app/(app)/layout.test.tsx` (estende).
**Depends on**: T4, T5
**Reuses**: `requireActivePerson`/`hubAccessFromRoles`/`buildHubLinks`/`selectPrimaryTabs`/
`describeActiveRoles` (`@/modules/identity`), `canAccessModerationQueue`
(`@/modules/moderation`), `AppShell`/`AppBottomNav`/`AppDesktopMenu`; **molde** de computação
de `access` em `inicio/page.tsx`; molde de teste em `layout.test.tsx`/`inicio/page.test.tsx`
**Requirement**: BNAV-01, DNAV-01, DNAV-02, **BNAV-MN-02**, **DNAV-MN-02** (ângulo
composition-root); APP-SHELL-06 (seams agora preenchidos — regressão da USP-061 verde)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Mantém `export const dynamic = 'force-dynamic'` e `await requireActivePerson()`.
- [ ] Computa `access = { ...hubAccessFromRoles(person.roles), moderation: await
      canAccessModerationQueue(person) }` e `groups = buildHubLinks(access)` (espelha o hub).
- [ ] `<AppShell personName roleLabel headerNav={<AppDesktopMenu groups={groups} />}
      bottomNav={<AppBottomNav tabs={selectPrimaryTabs(groups)} />}>{children}</AppShell>`.
- [ ] Remove o comentário-placeholder `// USP-062/063: …` (agora implementado).
- [ ] RTL test (mock `requireActivePerson` + `canAccessModerationQueue` + `next/navigation`;
      mantém `hubAccessFromRoles`/`buildHubLinks`/`selectPrimaryTabs`/componentes reais):
      para uma Pessoa com um papel (ex.: CANDIDATE), ambos os seams renderizam conteúdo
      role-aware (aba/link de `/candidato`); **negativo composição** (BNAV-MN-02/DNAV-MN-02):
      nenhum link/aba de `/moderacao` para uma Pessoa sem acesso; **regressão USP-061**:
      header/identidade/"Sair" ainda presentes; `requireActivePerson` chamado sem args.
- [ ] Gate check passes: `npm run test`; **Build gate** ao final: `npm run typecheck && npm run
      lint && npm run test && npm run build`.
- [ ] Test count: ≥4 novos testes de layout passam (no silent deletions)

**Tests**: unit
**Gate**: build
**Commit**: `feat(identity): injetar headerNav/bottomNav no layout (app) — nav role-aware (USP-062/063)`

---

## Parallel Execution Map

```
Phase 1 (Foundation):
  T1 ──→ T2        (mesmo arquivo app-nav.ts — sequencial)
  T3 [P]           (nav-icons.tsx — independente)

Phase 2 (Componentes, Parallel):
  (T1,T2,T3) done, então:
    ├── T4 [062]   (bottom bar) — deps T1,T2,T3
    └── T5 [063]   (menu desktop) — deps T1
    (T4 ∦ T5: arquivos distintos, sem inter-dependência)

Phase 3 (Integração, Sequential):
  (T4,T5) ──→ T6
```

**Parallelism constraint:** todos os tipos de teste são parallel-safe (unit/RTL/source-scan).
`[P]` é limitado só por dependências de código. T3 é order-free na Phase 1 (arquivo distinto
de T1/T2). T4 e T5 são order-free na Phase 2 (arquivos distintos). T4/T5 **ambos** editam os
guards compartilhados (`app-shell-*.test.ts`) para adicionar suas asserções de varredura — se
executados literalmente em paralelo, sequenciar essas edições de guard (edições em arquivo
comum); a lógica de componente em si não colide.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: `pickActiveHref` puro + export | 1 função + barrel | ✅ Granular |
| T2: `selectPrimaryTabs` + labels + tipo | 1 função + 1 mapa + 1 tipo (mesmo arquivo, coeso) | ✅ Granular |
| T3: `nav-icons` registry | 1 componente/registry | ✅ Granular |
| T4: `AppBottomNav` + asserções de guard | 1 componente (+2 asserções) | ✅ Granular (coeso) |
| T5: `AppDesktopMenu` + asserções de guard | 1 componente (+2 asserções) | ✅ Granular (coeso) |
| T6: wire layout + layout test | 1 file change (composition-root) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none (independente) | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | none (independente, [P]) | ✅ Match |
| T4 | T1, T2, T3 | (T1,T2,T3) → T4 | ✅ Match |
| T5 | T1 | (T1) → T5 | ✅ Match |
| T6 | T4, T5 | (T4,T5) → T6 | ✅ Match |

- Todo `Depends on` tem seta correspondente; toda seta corresponde a um `Depends on`.
- `[P]` na mesma fase não depende entre si: T3 ∦ T1/T2 (Phase 1, arquivos distintos);
  T4 ∦ T5 (Phase 2, arquivos de componente distintos — a edição de guard compartilhada é
  sequenciada, não é dependência de código). ✅

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Domain helper puro | unit | unit | ✅ OK |
| T2 | Domain helper puro | unit | unit | ✅ OK |
| T3 | Registry de ícones (RTL) | unit | unit | ✅ OK |
| T4 | Componente de nav (Client, RTL) + guard | unit | unit | ✅ OK |
| T5 | Componente de nav (Client, RTL) + guard | unit | unit | ✅ OK |
| T6 | Composition-root (layout, RTL) | unit | unit | ✅ OK |

Nenhum `Tests: none`; nenhum deferral. Todas as camadas mapeiam ao tipo de teste exigido.
E2E autenticado = none por matriz (deferido, L-007/AD-025). ✅

---

## 💠 Must-Not Ownership (Check 4)

| Must-Not | Owning task | Negative test (no Done-when da task) | Status |
| -------- | ----------- | ------------------------------------ | ------ |
| BNAV-MN-01 (nenhuma aba fora de `EXISTING_HUB_ROUTES ∪ {/inicio}`) | T2 (puro, 2^9) + T4 (render) | `app-nav.test.ts` (combos) + `app-bottom-nav.test.tsx` | ✅ Owned |
| BNAV-MN-02 (nenhuma aba de área sem permissão) | T2 + T4 + T6 (composição) | `app-nav.test.ts` (candidate-only) + `app-bottom-nav.test.tsx` + `layout.test.tsx` | ✅ Owned |
| BNAV-MN-03 (barra sem sessão/PII/Prisma) | T3, T4 | `app-shell-no-auth-pii.test.ts` (varre o dir; asserção dos arquivos novos) | ✅ Owned |
| BNAV-MN-04 (barra tokens-only) | T3, T4 | `app-shell-uses-tokens.test.ts` (varre o dir; asserção dos arquivos novos) | ✅ Owned |
| DNAV-MN-01 (nenhum link fora de `EXISTING_HUB_ROUTES`) | T5 | `app-desktop-menu.test.tsx` (acesso total → hrefs ∈ allowlist) | ✅ Owned |
| DNAV-MN-02 (nenhum grupo/link sem permissão) | T5 + T6 (composição) | `app-desktop-menu.test.tsx` (candidate-only) + `layout.test.tsx` | ✅ Owned |
| DNAV-MN-03 (menu sem sessão/PII/Prisma) | T5 | `app-shell-no-auth-pii.test.ts` (asserção de `app-desktop-menu.tsx`) | ✅ Owned |
| DNAV-MN-04 (menu tokens-only) | T5 | `app-shell-uses-tokens.test.ts` (asserção de `app-desktop-menu.tsx`) | ✅ Owned |

Todo must-not tem task dona e teste negativo verde. MN-03/MN-04 reutilizam os guards
source-scan da USP-061 (que varrem `(app)/_components/**` recursivamente) — as tasks T4/T5
adicionam a asserção explícita de que os arquivos novos entram na varredura, evitando
falso-verde. A allowlist da bottom bar (BNAV-MN-01) é `EXISTING_HUB_ROUTES ∪ {'/inicio'}`
(a aba fixa Início é o hub, rota real de `(app)`, fora da allowlist de *links* do hub); a do
menu desktop (DNAV-MN-01) é `EXISTING_HUB_ROUTES` (o menu não inclui `/inicio` — a marca do
header já leva ao hub).

---

## Tools / MCPs / Skills

Nenhum MCP ou skill extra necessário — é UI de rota apresentacional (Client) + helpers puros
+ registry de SVG inline, tudo local ao repo. `context7` é desnecessário (sem pergunta de
API de biblioteca; os padrões Next.js App Router Server/Client e o disclosure do PublicNav já
estão estabelecidos pela casca das Fases 7/10). O Implementer usa a Execute flow da skill
`bravi-spec-driven`; o Verifier roda automaticamente após T6, verificando os must-nots de
**ambas** as USPs (BNAV-* e DNAV-*).
