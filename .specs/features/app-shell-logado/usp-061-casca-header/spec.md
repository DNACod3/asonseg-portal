# USP-061 — Casca de navegação da área logada (Header persistente) Specification

## Problem Statement

A área autenticada `(app)/*` não tem app-shell: `src/app/(app)/layout.tsx` apenas
faz `await requireActivePerson()` (guard de sessão) e renderiza `{children}` puro —
nenhum Header/Nav global. Depois do UAT 2026-07-11 (achados **SOC-2 / EMP-5**, item
**H-3** da Fase 9→10), a única forma de sair de uma tela `(app)/*` é o botão "voltar"
do navegador ou reescrever a URL; a ação "Sair" vive solta no fim do hub `/inicio`
(`src/app/(app)/inicio/page.tsx`), inacessível de qualquer outra rota. Cada tela é
uma ilha.

Esta USP entrega **a casca (header persistente)** — o esqueleto onde as navegações
role-aware das **USP-062** (bottom tab bar mobile/tablet) e **USP-063** (menu desktop)
vão se encaixar sem retrabalho. Não entrega a navegação em si.

## Fonte da verdade (upstream — Adapt, Don't Re-Derive)

USP net-new (fora das 44 do PRD, como USP-045…USP-060). Não há artefato upstream com
IDs de requisito; ancora-se em:

- **`.specs/project/ROADMAP.md` → Fase 10** (escopo/limites por USP; USP-061 = casca/header).
- **`.specs/features/ajustes-uat/uat-findings-2026-07-11.md`** — achados **SOC-2 / EMP-5** (H-3).
- Precedente de casca **AD-025** (Fase 7 pública) — mesma disciplina de componentes de
  rota em `_components/` + seam data-driven, aplicada agora ao grupo `(app)`.

IDs de requisito são **locais** (`APP-SHELL-NN` / `APP-SHELL-MN-NN`), coerente com a
numeração net-new das fases 7-8 (CASCA-*, HUB-*).

## Goals

- [ ] Toda rota `(app)/*` renderiza dentro de uma casca com header persistente (marca +
      nome/papel da pessoa logada + Sair), sem editar as ~30 páginas do grupo.
- [ ] A ação "Sair" passa a ser alcançável de qualquer rota `(app)/*` (migra do rodapé
      solto de `/inicio` para a casca) — fonte única.
- [ ] A casca deixa **um ponto de extensão claro** (seams) para a navegação das USP-062/063,
      de modo que elas apenas preencham slots — sem reescrever a casca.
- [ ] Zero mudança no design system: só tokens de `globals.css`, `Button`/`cn` de
      `shared/ui`, e o padrão de SVG inline já usado (não há biblioteca de ícones).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Bottom tab bar mobile/tablet (a navegação em si) | É a **USP-062** — preenche o seam `bottomNav` desta casca |
| Menu desktop (hambúrguer/dropdown) + active-state por rota | É a **USP-063** — preenche o seam `headerNav` desta casca |
| Consumir `buildHubLinks`/`hubAccessFromRoles` para renderizar links | Deferido a USP-062/063 (computam o acesso no layout e injetam nos seams). USP-061 só deixa o seam. Ver Assumptions A4/A6 |
| Centralizar `<main>` na casca (remover `<main>` das ~30 páginas `(app)`) | Blast radius alto; a casca provê `<header>`, não `<main>`. Ver Assumptions A2 |
| Header refletir sessão no grupo **público** (`(public)`) | É o item H-4 da Fase 9 (casca estática ISR); esta casca é só do grupo `(app)` |
| Busca/lista de Pessoas para AS | Metade de H-3 gated por PO+DPO (segue na Fase 9) |
| Qualquer `AuditEvent` de navegação/logout novo | Logout reusa `signOutAction` (sem auditoria, por precedente USP-049) |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
| - | -------------------- | ----- | -------------- | --------- | ---------- |
| A1 | "Papel ativo" = **conjunto** dos papéis ATIVOS (`CurrentPerson.roles`), rotulados via `ALL_ROLE_LABELS`, unidos por " · " | agent | Renderizar todos os papéis ativos, em ordem determinística (ordem das chaves de `ALL_ROLE_LABELS`) | O modelo não tem conceito de "papel ativo" único (não há role-switcher no MVP); `roles: string[]` | y |
| A2 | A casca provê `<header>` (+ seam `bottomNav`), **não** `<main>`; cada página `(app)` mantém seu próprio `<main className="min-h-screen …">` | agent | Não centralizar `<main>` | Centralizar exigiria editar ~30 páginas (blast radius) e foge do escopo "casca/header". `<header>` é landmark banner irmão do `<main>` de cada página (HTML/a11y válidos). Diverge de AD-025 (casca pública centralizou `<main>`) **de propósito** — grupo de rota diferente; NÃO supersede AD-025 (feature-local) | y |
| A3 | USP-061 introduz **zero Client Component**; toda a casca é Server Component | agent | Server-only | Não há interatividade nesta USP (sem `usePathname`, sem toggle de menu). A navegação interativa (Client, `usePathname`/estado) chega em USP-062/063 injetada nos seams — espelha SiteHeader (Server) / PublicNav (Client) | y |
| A4 | Formato do seam = **dois slots `React.ReactNode`** (`headerNav` p/ USP-063, `bottomNav` p/ USP-062) — estilo `actions` do `PublicNav`, não um prop de dados `HubLinkGroup[]` | agent | ReactNode slots | As duas superfícies de nav têm posições de layout diferentes (dropdown no header × barra fixa embaixo); um único prop de dados não serve às duas. Acoplamento mínimo: 062/063 donos do próprio shape | y |
| A5 | Relocação do logout **supersede a *localização*** do `HUB-06` (SignOutForm solto no rodapé de `/inicio`, USP-049) — a capacidade é preservada e **reforçada** (Sair alcançável de toda rota `(app)`) | agent | Mover Sair para a casca; remover o solto de `/inicio` | Fonte única de logout; elimina drift/duplicação. `inicio/page.test.tsx` é atualizado com justificativa — **não** é enfraquecimento silencioso de teste | y |
| A6 | USP-061 **não** consome `buildHubLinks` para renderizar nada; só deixa o seam. 062/063 computam `hubAccessFromRoles`/`buildHubLinks` no layout e injetam nos slots | agent | Deferir o consumo do hub-links | YAGNI; 062/063 são donas da navegação. A casca fica agnóstica ao shape dos links | y |
| A7 | Marca do header linka para `/inicio` (hub autenticado), reusando o visual de marca do `SiteHeader` (badge "A" + wordmark ASONSEG); sublabel exato = discricionário | agent | Reusar visual do SiteHeader, `href="/inicio"` | Dá o "caminho de volta ao hub" persistente já nesta USP (mitiga o beco antes mesmo de 062/063) | y |
| A8 | E2E autenticado **deferido** (precedente L-007 / AD-025) — cobertura por RTL (componente) + guards estáticos + build | agent | Sem novo spec Playwright | Repo não tem seed de sessão Supabase no Playwright; padrão do projeto | y |

**Owner de todos os itens = `agent`.** Nenhum item de owner externo pendente →
**Entry Gate (tasks.md §0) está livre**: a feature entra em task breakdown.

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Header persistente com identidade da pessoa logada ⭐ MVP

**User Story**: Como Pessoa autenticada, quero um header presente em toda tela da área
logada mostrando quem sou e me dando uma saída, para nunca ficar presa numa tela sem
navegação.

**Why P1**: É o coração da fase — resolve o beco sem saída do UAT (SOC-2/EMP-5). Sem o
header persistente, 062/063 não têm onde se apoiar.

**Acceptance Criteria**:

1. WHEN uma Pessoa renderiza qualquer rota `(app)/*` THEN o sistema SHALL renderizar um
   header persistente (landmark `banner`) acima do conteúdo da página. `[APP-SHELL-01]`
2. WHEN o header renderiza THEN ele SHALL exibir um elemento de marca que **linka para
   `/inicio`** (hub autenticado). `[APP-SHELL-02]`
3. WHEN o header renderiza para uma Pessoa com ≥1 papel ativo THEN ele SHALL exibir o
   `fullName` da Pessoa e o(s) rótulo(s) PT-BR do(s) papel(is) ativo(s) (via
   `ALL_ROLE_LABELS`, unidos por " · "). `[APP-SHELL-03]`
4. WHEN o header renderiza para uma Pessoa com **zero** papéis ativos THEN ele SHALL
   exibir o `fullName` e SHALL omitir a linha de papel (sem rótulo vazio/placeholder).
   `[APP-SHELL-04]`
5. WHEN o header renderiza THEN ele SHALL prover um controle "Sair" funcional que submete
   `signOutAction`, reusando o `SignOutForm` existente. `[APP-SHELL-05]`

**Independent Test**: Renderizar `AppShell`/`AppHeader` (RTL) com dados de uma Pessoa e
ver marca→`/inicio`, nome, rótulo de papel e o botão "Sair"; renderizar com `roles: []`
e ver o nome sem linha de papel.

---

### P1: Seam de composição para a navegação (habilita USP-062/063) ⭐ MVP

**User Story**: Como quem vai implementar USP-062/063, quero que a casca já exponha
pontos de extensão nomeados para a navegação, para injetar bottom bar e menu desktop
sem reescrever a casca.

**Why P1**: Sem o seam, USP-062/063 teriam de retrabalhar a casca — exatamente o que
o escopo da fase manda evitar.

**Acceptance Criteria**:

1. WHEN a casca renderiza THEN ela SHALL expor um seam de navegação de header
   (`headerNav`) e um seam de navegação inferior (`bottomNav`), cada um renderizando o
   conteúdo injetado quando presente. `[APP-SHELL-06]`
2. WHEN nenhuma navegação é injetada (default da USP-061) THEN a casca SHALL renderizar
   corretamente só com a chrome do header (marca + identidade + Sair), com os seams
   vazios (sem buraco visual, sem erro). `[APP-SHELL-07]`

**Independent Test**: Renderizar `AppShell` sem os props de seam → só o header; renderizar
com `headerNav={<nav data-testid="x"/>}` e `bottomNav={<div data-testid="y"/>}` → ambos
aparecem nas posições esperadas.

---

### P1: Logout consolidado na casca (migração) ⭐ MVP

**User Story**: Como Pessoa autenticada, quero um único "Sair" sempre no mesmo lugar
(o header), para não depender de rolar até o fim do hub.

**Why P1**: Fecha o achado (Sair inacessível fora de `/inicio`) e evita dois controles
concorrentes.

**Acceptance Criteria**:

1. WHEN o logout migra para a casca THEN o hub `/inicio` SHALL deixar de renderizar seu
   próprio `SignOutForm` solto (logout tem fonte única: a casca). `[APP-SHELL-08]`

**Independent Test**: Renderizar `HubPage` isolada (RTL) → **não** há botão "Sair" (ele
vem da casca, testado em `AppHeader`).

---

## Edge Cases

- WHEN a Pessoa tem múltiplos papéis ativos THEN o header SHALL exibir todos os rótulos,
  em ordem determinística (ordem de `ALL_ROLE_LABELS`), unidos por " · ". `[APP-SHELL-03]`
- WHEN `roles` contém uma string desconhecida (não mapeada em `ALL_ROLE_LABELS`) THEN o
  helper SHALL ignorá-la (defensivo — não quebra, não exibe a string crua).
- WHEN a Pessoa tem zero papéis ativos THEN a linha de papel é omitida. `[APP-SHELL-04]`
- WHEN a credencial está em 1º acesso THEN a Pessoa **nunca** chega à casca: o
  `requireActivePerson()` do layout redireciona a `/trocar-senha` (comportamento herdado,
  não re-implementado aqui).

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, independentemente do caminho. Cada um exige um teste negativo
que afirma que o resultado proibido não ocorre (ver validate.md §6b).

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| -- | ------------------------------- | -------- | ----------- | ------------- |
| APP-SHELL-MN-01 | WHEN qualquer rota `(app)/*` renderiza THEN a casca SHALL NOT renderizar o conteúdo da página sem o header persistente **com** "Sair" e link de marca→`/inicio` | Beco sem saída do UAT (tela alcançável só por URL, saída só no "voltar" do navegador) | T3 | `app-shell.test.tsx` (children embrulhados + header/Sair/marca sempre presentes) |
| APP-SHELL-MN-02 | WHEN a casca provê "Sair" THEN o hub `/inicio` SHALL NOT renderizar também seu próprio `SignOutForm` | Dois controles de logout concorrentes / drift | T5 | `inicio/page.test.tsx` (render isolado do hub não tem botão "Sair") |
| APP-SHELL-MN-03 | WHEN a casca renderiza identidade (nome/papel) THEN os componentes de `(app)/_components/**` SHALL NOT importar `prisma` / `getCurrentPerson` / `requireActivePerson` / View Models (`@/modules/*/views`) / Server Actions (`@/modules/*/actions`) / `'use server'` — a identidade só flui do composition-root (layout) | Renderizar PII de uma Pessoa que **não** é a da sessão na chrome global (classe de vazamento) | T6 | `src/shared/__tests__/app-shell-no-auth-pii.test.ts` (varredura de imports proibidos, espelho de `casca-no-auth-pii`) |
| APP-SHELL-MN-04 | WHEN a casca renderiza THEN os componentes SHALL NOT usar hex cru / CDN externa / lib de ícone ou de estado — tokens-only (DS intacto) | Deriva do design system ("não muda o design system") | T7 | `src/shared/__tests__/app-shell-uses-tokens.test.ts` (espelho de `casca-uses-tokens`/`casca-no-external-cdn`) |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| APP-SHELL-01 | P1: Header persistente | T2, T3, T4 | Verified |
| APP-SHELL-02 | P1: Header persistente | T2 | Verified |
| APP-SHELL-03 | P1: Header persistente | T1, T2, T4 | Verified |
| APP-SHELL-04 | P1: Header persistente (edge) | T1, T2, T4 | Verified |
| APP-SHELL-05 | P1: Header persistente | T2 | Verified |
| APP-SHELL-06 | P1: Seam de composição | T3 | Verified |
| APP-SHELL-07 | P1: Seam de composição | T3 | Verified |
| APP-SHELL-08 | P1: Logout consolidado | T5 | Verified |
| APP-SHELL-MN-01 | P1: Header persistente | T3 | Verified |
| APP-SHELL-MN-02 | P1: Logout consolidado | T5 | Verified |
| APP-SHELL-MN-03 | P1: Header persistente | T4, T6 | Verified |
| APP-SHELL-MN-04 | P1: Header persistente | T7 | Verified |

**ID format:** `APP-SHELL-[NUMBER]`; must-nots `APP-SHELL-MN-[NUMBER]`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 12 total, 12 mapped to tasks, 0 unmapped. Status `Verified` — the
independent Verifier (author ≠ verifier) ran two passes: an initial pass flagged
1 spec-precision gap (APP-SHELL-04, surviving mutant on the role-omission assertion),
fixed in commit `fb4cbbf` and re-verified killed. Final verdict: **PASS**. See
`.specs/features/app-shell-logado/usp-061-casca-header/validation.md`.

---

## Success Criteria

- [x] Toda rota `(app)/*` mostra o header persistente (marca→`/inicio` + nome + papel + Sair).
- [x] "Sair" alcançável de qualquer rota `(app)/*`; removido o solto de `/inicio` (fonte única).
- [x] `AppShell` expõe `headerNav`/`bottomNav`; USP-062/063 preenchem slots sem tocar a casca.
- [x] 4 must-nots com teste negativo verde (2 componente + 2 guard estático).
- [x] typecheck/lint verdes, `npm run test` verde, `NODE_ENV=production` build OK, zero migração.
