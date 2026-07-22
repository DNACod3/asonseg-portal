# USP-062 — Navegação mobile/tablet (bottom tab bar) Specification

## Problem Statement

A USP-061 entregou a casca da área logada (`AppShell`/`AppHeader`) com o header
persistente (marca→`/inicio`, identidade, Sair) e **dois seams vazios**: `headerNav`
(menu desktop, USP-063) e `bottomNav` (barra inferior, esta USP). Em telas pequenas
(`< md`) não há navegação primária: de qualquer rota `(app)/*` a única saída é o header
(marca→hub) ou o botão "voltar". Falta o atalho tátil de rodapé — o padrão mobile-first
esperado (H-3 do UAT, achados SOC-2/EMP-5).

Esta USP preenche o seam `bottomNav` com uma **bottom tab bar fixa, role-aware, com
ícones**, mostrando só os atalhos **primários** por papel (não os 13+ links do hub). O
menu completo em mobile continua alcançável via a aba "Início" (→ hub `/inicio`); o menu
completo em desktop é a USP-063.

## Fonte da verdade (upstream — Adapt, Don't Re-Derive)

USP net-new (fora das 44 do PRD, como USP-045…USP-061). Sem artefato upstream com IDs de
requisito; ancora-se em:

- **`.specs/project/ROADMAP.md` → Fase 10** (escopo por USP; USP-062 = bottom tab bar
  mobile/tablet com atalhos primários por papel, reaproveitando `buildHubLinks`).
- **USP-061** (`.specs/features/app-shell-logado/usp-061-casca-header/{spec,design}.md`) —
  a casca e o seam `bottomNav` que esta USP consome; decisões já tomadas (Server/Client,
  composition-root, must-nots de tokens/PII) **não** são re-derivadas aqui, são reutilizadas.
- **`src/modules/identity/domain/hub-links.ts`** — `buildHubLinks`/`hubAccessFromRoles`/
  `EXISTING_HUB_ROUTES`, a mesma fonte de dados do hub `/inicio` (USP-049). O invariante
  **HUB-MN-01** (nenhum href fora da allowlist) é herdado.

IDs de requisito são **locais** (`BNAV-NN` / `BNAV-MN-NN`), coerente com a numeração
net-new das fases 7–10 (CASCA-*, HUB-*, APP-SHELL-*).

## Goals

- [ ] Em `< md`, toda rota `(app)/*` mostra uma **bottom tab bar fixa** com os atalhos
      primários do papel da Pessoa, derivados de `buildHubLinks` (mesma fonte do hub).
- [ ] A barra é **role-aware**: só mostra o que o `HubAccess` da Pessoa permite; nunca
      linka fora de `EXISTING_HUB_ROUTES ∪ {/inicio}` (invariante HUB-MN-01 reaplicado).
- [ ] Cada aba tem **ícone SVG inline** (mesmo padrão do hambúrguer do `PublicNav`, sem
      biblioteca de ícones) + rótulo curto PT-BR; active-state por rota.
- [ ] Zero mudança no design system: tokens de `globals.css`, `cn` de `shared/ui`, SVG
      inline. Reaproveita os guards estáticos MN da USP-061 (tokens-only, sem PII/sessão).
- [ ] Preenche o seam `bottomNav` **sem reescrever** a casca da USP-061.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Menu desktop (hambúrguer/dropdown) com a navegação completa | É a **USP-063** — preenche o seam `headerNav`. Roda como a mesma unidade, mas requisitos/artefatos separados |
| Mostrar **todos** os 13+ links do hub na barra | Bottom bar é para atalhos **primários** (≤5 abas). O completo em mobile = aba "Início" → hub `/inicio`; em desktop = USP-063 |
| Drawer/sheet "Mais" que abre o resto sobre a barra | Descartado: `selectPrimaryTabs` nunca excede 5 abas (ver A2), então não há overflow a acomodar; e um drawer exigiria mais estado/overlay (YAGNI). "Início"→hub já cobre o acesso ao resto |
| Header refletir sessão no grupo público `(public)` | É H-4 da Fase 9 (casca estática ISR) |
| E2E autenticado (Playwright) | Deferido — precedente L-007 / AD-025 / USP-061 A8 (repo sem seed de sessão Supabase no Playwright). Cobertura por RTL + guards + build |
| Novo `AuditEvent` de navegação | Navegação por `<Link>` não é operação sensível (sem auditoria, precedente USP-049/061) |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
| - | -------------------- | ----- | -------------- | --------- | ---------- |
| A1 | **Subconjunto de links da barra** = `[Início→/inicio]` + `[Perfil→/perfil]` fixos + **o primeiro link** de cada grupo presente de `buildHubLinks` além de "Minha conta" (isto é, o 1º de "Meus papéis" e o 1º de "Institucional"). Critério = "1 item primário por grupo" | agent | `selectPrimaryTabs(groups)` puro no domínio | Bottom bar convencional = 3–5 itens. O 1º link de cada grupo do `buildHubLinks` já é o mais representativo (`/candidato`, `/prestador`, `/moderacao`/`/relatorios`…). Início dá o caminho ao hub completo; Perfil garante ≥2 abas até p/ Pessoa sem papel | y |
| A2 | **Teto de 5 abas nunca é excedido** pela regra A1 | agent | Sem lógica de overflow/"Mais" | Máx. possível = Início + Perfil + 1(Meus papéis) + 1(Institucional) = **4 abas**. Por isso não há aba "Mais" nem drawer | y |
| A3 | **Rótulos curtos** vêm de um mapa puro `BOTTOM_TAB_SHORT_LABELS` (href→string), cobrindo `/inicio` + todos os `EXISTING_HUB_ROUTES` | agent | Mapa exaustivo no domínio | Os rótulos do hub são longos ("Área do candidato", "Fila de moderação") — inadequados p/ aba. Mapa exaustivo → teste de cobertura garante que todo href elegível tem rótulo curto (sem string crua/vazia) | y |
| A4 | **Ícones** = SVG inline num registry `nav-icons.tsx` (href→`<svg>`), `viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth={2}` (idêntico ao hambúrguer do `PublicNav`); href desconhecido → **ícone fallback** (círculo/ponto), nunca crash | agent | Registry com fallback | Não há lib de ícones (CLAUDE.md "Forbidden") nem deve ser adicionada. Mapeamento href→ícone é discricionário do Design (ver tabela em design.md) | y |
| A5 | **Active-state** usa `pickActiveHref(hrefs, pathname)` puro (match "exato-ou-descendente" mais longo), **não** o `isActive` do `PublicNav` | agent | Novo helper de longest-match no domínio | O `isActive` do PublicNav casa por prefixo simples — erraria em pares aninhados (marcaria `/perfil` ativo em `/perfil/papeis`). Longest-match resolve; mesmo aria (`aria-current="page"`), semântica diferente. Compartilhado com USP-063 | y |
| A6 | A barra é **Client Component** (`'use client'`); recebe `tabs: BottomTab[]` já computadas do composition-root (layout), não busca sessão | agent | Client, data via props | Precisa de `usePathname()` (active-state). Espelha `PublicNav` (Client) injetado no `SiteHeader` (Server). Mantém MN de PII (dados só via props do layout) | y |
| A7 | **Reserva de espaço**: a barra é `fixed bottom-0`; a barra renderiza também um **spacer in-flow** (`h-16 md:hidden`, `aria-hidden`) antes do `<nav>` fixo, para o conteúdo (`min-h-screen`) das ~30 páginas não ficar coberto no fim | agent | Spacer no próprio componente | Auto-contido em USP-062 (não edita as páginas nem a `AppShell`). Endereça o concern encaminhado pela USP-061 (bottom bar cobrir o fim de mains `min-h-screen`) | y |
| A8 | **Breakpoint** = `md` (Tailwind). Barra visível `< md` (`md:hidden`); some em `≥ md` (onde a USP-063 assume) | agent | `md:hidden` | Mesmo breakpoint do `PublicNav` (`hidden md:flex`/`md:hidden`). "mobile/tablet" = `< md` | y |
| A9 | Os **guards estáticos MN-03/MN-04 da USP-061** (`app-shell-no-auth-pii.test.ts`, `app-shell-uses-tokens.test.ts`) varrem `src/app/(app)/_components/**` recursivamente → cobrem automaticamente os arquivos novos desta USP; **não** se cria novo guard | agent | Reutilizar os guards existentes | Os guards já asseguram tokens-only e ausência de sessão/PII em todo o diretório. Os componentes novos só precisam mantê-los verdes (+asserção explícita de que os novos arquivos entram na varredura) | y |

**Owner de todos os itens = `agent`.** Nenhum item de owner externo pendente →
**Entry Gate (tasks.md §0) está livre**: a feature entra em task breakdown.

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Bottom tab bar role-aware em mobile/tablet ⭐ MVP

**User Story**: Como Pessoa autenticada num celular/tablet, quero uma barra de abas fixa
no rodapé com meus atalhos principais, para navegar entre minhas áreas com um toque sem
voltar ao hub ou reescrever a URL.

**Why P1**: É o núcleo da USP — resolve o beco sem saída mobile-first (H-3). Sem ela, a
área logada segue sem navegação primária em telas pequenas.

**Acceptance Criteria**:

1. WHEN uma Pessoa renderiza qualquer rota `(app)/*` num viewport `< md` THEN o sistema
   SHALL renderizar uma bottom tab bar fixa (landmark `nav`, `aria-label`) no rodapé da
   viewport. `[BNAV-01]`
2. WHEN a barra renderiza THEN ela SHALL incluir uma aba fixa "Início" (→ `/inicio`) e uma
   aba fixa "Perfil" (→ `/perfil`), e **uma** aba primária para cada grupo presente de
   `buildHubLinks` além de "Minha conta" (o 1º link de "Meus papéis" e o 1º de
   "Institucional"), no total ≤5 abas. `[BNAV-02]`
3. WHEN o `pathname` atual corresponde ao destino de uma aba (exato ou rota-descendente)
   THEN essa aba SHALL ser marcada ativa (`aria-current="page"`) pela regra de match mais
   longo; no máximo **uma** aba ativa por vez. `[BNAV-03]`
4. WHEN uma aba renderiza THEN ela SHALL exibir um ícone SVG inline (`aria-hidden`) +
   rótulo curto PT-BR; href sem ícone mapeado SHALL usar um ícone fallback (sem crash).
   `[BNAV-04]`
5. WHEN o viewport é `≥ md` THEN a barra SHALL estar oculta (`md:hidden`), e SHALL reservar
   espaço inferior em mobile (spacer) para nunca cobrir o fim do conteúdo da página.
   `[BNAV-05]`

**Independent Test**: Renderizar `AppBottomNav` (RTL, `usePathname` mockado) com `tabs`
derivadas de acessos variados: ver Início+Perfil+abas de grupo, ícones/rótulos, a aba
ativa por rota, e a ausência de abas de papéis não concedidos.

### P1: Seleção determinística dos atalhos primários (`selectPrimaryTabs`) ⭐ MVP

**User Story**: Como responsável pela consistência da navegação, quero que a escolha de
quais links viram aba seja uma função pura determinística, para testá-la 1:1 e garantir o
invariante de allowlist sem depender de render.

**Why P1**: Concentra a política de "primário" e o invariante HUB-MN-01 num núcleo puro
(testável, coverage-safe — lição do repo sobre queda de branch por barrels).

**Acceptance Criteria**:

1. WHEN `selectPrimaryTabs(groups)` recebe os grupos de `buildHubLinks` THEN ele SHALL
   retornar Início + Perfil + o 1º link de cada grupo além de "Minha conta", com rótulo
   curto (`BOTTOM_TAB_SHORT_LABELS`), em ordem determinística. `[BNAV-06]`
2. WHEN a Pessoa não tem um papel THEN `selectPrimaryTabs` SHALL omitir a aba desse papel
   (deriva dos grupos já filtrados por `buildHubLinks`). `[BNAV-07]`

**Independent Test**: Chamar `selectPrimaryTabs(buildHubLinks(access))` para acessos
variados; verificar as abas produzidas e a ordem, sem render.

---

## Edge Cases

- WHEN a Pessoa tem **zero** papéis (só "Minha conta") THEN a barra SHALL ter exatamente
  2 abas: Início e Perfil (nunca vazia). `[BNAV-02]`
- WHEN a Pessoa tem papel público **e** institucional THEN a barra SHALL ter 4 abas
  (Início, Perfil, 1×Meus papéis, 1×Institucional) — nunca >5. `[BNAV-02/A2]`
- WHEN `pathname` não casa nenhuma aba (ex.: rota profunda sem aba correspondente) THEN
  **nenhuma** aba fica ativa (`pickActiveHref` → `null`). `[BNAV-03]`
- WHEN um href de aba não tem ícone mapeado THEN o registry retorna o ícone fallback (não
  quebra o render). `[BNAV-04]`
- WHEN o conteúdo da página é `min-h-screen` THEN o spacer garante que o último conteúdo
  seja rolável acima da barra fixa. `[BNAV-05]`

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, independentemente do caminho. Cada um exige um teste negativo
que afirma que o resultado proibido não ocorre (ver validate.md §6b).

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| -- | ------------------------------- | -------- | ----------- | ------------- |
| BNAV-MN-01 | WHEN a barra renderiza, para **qualquer** combinação de acessos, THEN ela SHALL NOT produzir uma aba cujo `href ∉ (EXISTING_HUB_ROUTES ∪ {/inicio})` | Link morto / vazamento de prefixo de route-group (`/app/…`, rota-bare inexistente) — mesma classe do HUB-MN-01 | T2 | `app-nav.test.ts` (2^9 combos de `HubAccess` → todo `tab.href ∈` allowlist) + `app-bottom-nav.test.tsx` (render) |
| BNAV-MN-02 | WHEN o `HubAccess` da Pessoa não concede um papel/área THEN a barra SHALL NOT renderizar a aba primária desse papel/área | Expor atalho a área sem permissão (mesma classe do HUB-MN-02) | T2, T4 | `app-nav.test.ts` (candidate-only → sem aba institucional) + `app-bottom-nav.test.tsx` |
| BNAV-MN-03 | WHEN os componentes da barra renderizam THEN os arquivos de `(app)/_components/**` SHALL NOT importar `prisma` / `getCurrentPerson` / `requireActivePerson` / View Models (`@/modules/*/views`) / Server Actions (`@/modules/*/actions`) / `'use server'` — dados só via props do composition-root | Renderizar PII de Pessoa que não é a da sessão na chrome global (classe de vazamento) | T3, T4 | `src/shared/__tests__/app-shell-no-auth-pii.test.ts` (guard da USP-061, varre o diretório todo — cobre os arquivos novos) |
| BNAV-MN-04 | WHEN os componentes da barra renderizam THEN eles SHALL NOT usar hex cru / paleta fixa / CDN externa / lib de ícone ou de estado — tokens-only (DS intacto) | Deriva do design system ("não muda o design system") | T3, T4 | `src/shared/__tests__/app-shell-uses-tokens.test.ts` (guard da USP-061, varre o diretório todo) |

> **Nota sobre MN-03/MN-04:** os guards são os da USP-061 (varredura recursiva de
> `src/app/(app)/_components/**`), reaproveitados por A9 — os arquivos novos entram na
> varredura automaticamente. As tasks T3/T4 adicionam uma asserção explícita de que os
> novos arquivos constam do conjunto varrido (evita falso-verde por diretório trocado).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| BNAV-01 | P1: Bottom tab bar | T4, T6 | ✅ Verified |
| BNAV-02 | P1: Bottom tab bar | T2, T4 | ✅ Verified |
| BNAV-03 | P1: Bottom tab bar (active-state) | T1, T4 | ✅ Verified |
| BNAV-04 | P1: Bottom tab bar (ícones) | T3, T4 | ✅ Verified |
| BNAV-05 | P1: Bottom tab bar (responsivo/reserva) | T4 | ✅ Verified |
| BNAV-06 | P1: `selectPrimaryTabs` | T2 | ✅ Verified |
| BNAV-07 | P1: `selectPrimaryTabs` (role-aware) | T2 | ✅ Verified |
| BNAV-MN-01 | P1: Bottom tab bar | T2, T4 | ✅ Verified |
| BNAV-MN-02 | P1: Bottom tab bar | T2, T4 | ✅ Verified |
| BNAV-MN-03 | P1: Bottom tab bar | T3, T4 | ✅ Verified |
| BNAV-MN-04 | P1: Bottom tab bar | T3, T4 | ✅ Verified |

**ID format:** `BNAV-[NUMBER]`; must-nots `BNAV-MN-[NUMBER]`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 total, 11 mapped to tasks (plano combinado 062+063 — ver `tasks.md`),
0 unmapped.

---

## Success Criteria

- [ ] Em `< md`, toda rota `(app)/*` mostra a bottom tab bar com atalhos primários por papel.
- [ ] Nenhuma aba fora de `EXISTING_HUB_ROUTES ∪ {/inicio}`; nenhuma aba de área sem permissão.
- [ ] Ícones SVG inline + rótulos curtos; active-state correto (longest-match, ≤1 ativa).
- [ ] Barra some em `≥ md`; não cobre o fim do conteúdo (spacer).
- [ ] 4 must-nots com teste negativo verde (2 no domínio puro + 2 guards estáticos reusados).
- [ ] typecheck/lint verdes, `npm run test` verde, `NODE_ENV=production` build OK, zero migração.
