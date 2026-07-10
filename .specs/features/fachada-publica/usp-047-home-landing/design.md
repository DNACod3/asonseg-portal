# USP-047 — Home/landing pública fiel ao protótipo — Design

> **Modo: Greenfield-adapter (não-ICE).** Sem card em `matriz-conexoes.md` → o Design é **gerado**, não
> resolvido. Fonte da verdade visual: `docs/prototipo/index.html` `#page-home` (L842-1034). Fonte da
> verdade de estilo: a Fundação de Design System da Fase 1 (`globals.css`, `tailwind.config.ts`,
> `src/shared/ui/`, guardas `DS-MN-*`) e a casca da USP-046 (`(public)/_components/**`, AD-025). O design
> **reutiliza** e **não re-deriva** tokens, fontes, dark-mode, primitivos, nem o `HomeIndicatorsView`.

**Spec**: `.specs/features/fachada-publica/usp-047-home-landing/spec.md`
**Status**: Draft

---

## 1. Visão geral da arquitetura

A home é a composição do **corpo** da rota `/` do grupo `(public)`. A casca (header/`<main>`/footer) já
vem do `(public)/layout.tsx` (USP-046); a USP-047 só provê o `{children}` de `page.tsx`.

```
src/app/(public)/layout.tsx            (USP-046 — SiteHeader + <main> + SiteFooter)  ── inalterado
└── src/app/(public)/page.tsx          (Server Component — USP-047 reescreve o corpo)
      • export const revalidate = 600  (ADR-0013 — preservado)
      • loadIndicators() + FALLBACK_INDICATORS + childLogger  (ADR-0026 — preservado)
      └── compõe, na ordem:
          ├── <HomeHero indicators={indicators} … />        (public)/_components/home-hero.tsx
          │     ├── <h1> + subtítulo + CTAs (Buscar Vagas / Publicar Vaga)
          │     ├── <HomeSearch action="/vagas" />           (public)/_components/home-search.tsx
          │     ├── <HomeFeaturedJobs jobs={…} />            (public)/_components/home-featured-jobs.tsx
          │     └── <HomeIndicatorsView indicators={…}/>     @/modules/reporting  (USP-041, inalterado)
          ├── <HomeHowItWorks />                             (public)/_components/home-how-it-works.tsx
          ├── <HomePersonas candidatoHref … empresaHref … /> (public)/_components/home-personas.tsx
          ├── <HomeServices servicosHref … />                (public)/_components/home-services.tsx
          └── <HomeCta candidatoHref … empresaHref … />      (public)/_components/home-cta.tsx
```

**Fronteira Server/Client:** **todos** os componentes de seção são **Server Components estáticos** — não
há estado nem handler client (a busca é um `<form>` GET declarativo; os CTAs são `<Link>`). Isso mantém
a home cacheável/ISR-friendly e mais simples que a casca (que precisou de um Client `PublicNav`). O único
dado dinâmico (os 3 contadores) é resolvido no server em `page.tsx` e passado por prop.

## 2. Componentização — decisão A-09 (segue AD-025)

Cada seção vira um componente próprio em `src/app/(public)/_components/` (mesma pasta/pattern da casca,
AD-025). Rationale: atomicidade (1 componente = 1 tarefa/RTL), reuso das guardas `casca-*` que já varrem
esse diretório, e `page.tsx` fica enxuto (carrega indicadores + compõe).

| Componente | Arquivo | Responsabilidade (uma) | Server/Client |
|---|---|---|---|
| `HomeSearch` | `home-search.tsx` | `<form role="search">` com input rotulado + submit; seam `action` (GET `/vagas`) | Server |
| `HomeFeaturedJobs` | `home-featured-jobs.tsx` | Stack de ≥2 cards de destaque de vaga (estático default; seam `jobs`) | Server |
| `HomeHero` | `home-hero.tsx` | Hero: `<h1>`+subtítulo+CTAs; compõe `HomeSearch`+`HomeFeaturedJobs`+`HomeIndicatorsView` | Server |
| `HomeHowItWorks` | `home-how-it-works.tsx` | "Como Funciona": overline+`<h2>`+3 passos (`StepIcon`) | Server |
| `HomePersonas` | `home-personas.tsx` | "Para Quem": 2 cards de persona + features + CTAs (seams) | Server |
| `HomeServices` | `home-services.tsx` | "Serviços": overline+`<h2>`+3 categorias+CTA (seam `servicosHref`) | Server |
| `HomeCta` | `home-cta.tsx` | Faixa de CTA final: `<h2>`+2 CTAs (seams) sobre gradiente token | Server |

> **Colocação:** `(public)/_components/` é pasta privada do App Router (não vira rota) e mantém `src/`
> fechada (ainda sob `app/`), exatamente como AD-025 fixou. A guarda `closed-src-root` verifica só o topo
> de `src/` → OK.

## 3. Embed dos indicadores (USP-041) — reuso, sem regressão — HOME-05 / HOME-MN-03

O `page.tsx` **atual** já faz o certo e é **preservado**:

```ts
export const revalidate = 600;                 // ADR-0013 / REL41-MN-03 (guardado por home-revalidate.test.ts)
const FALLBACK_INDICATORS = { activeJobs: 0, activeCandidates: 0, verifiedCompanies: 0 };
async function loadIndicators() { try { return await getHomeIndicators() } catch { return FALLBACK_INDICATORS } }
```

A USP-047 só troca o corpo: `const indicators = await loadIndicators()` e passa `indicators` ao
`HomeHero`, que renderiza `<HomeIndicatorsView indicators={indicators} />` na posição dos "hero-stats".

- **Componente da USP-041 inalterado** → `HomeIndicators.test.tsx`, `home-indicators.int.test.ts`,
  `revalidate-home.test.ts` e `home-revalidate.test.ts` continuam verdes por construção.
- **Contrato preservado** (HOME-MN-03): a home **não** re-implementa contagem, **não** renderiza número
  cru (o `IndicatorCard` já aplica `applyMinimumDisplay` → "Em breve" < 5), e **não** eleva `revalidate`.
- **Barreira de PII estrutural**: `HomeIndicatorsView` recebe apenas `{activeJobs, activeCandidates,
  verifiedCompanies}: number` (REL41-MN-01) — não há como injetar PII por esse caminho.

## 4. Sistema de tokens / dark-mode — **reuso**, não re-derivação (A-08 → HOME-MN-02)

Toda a estilização usa as chaves semânticas já mapeadas em `tailwind.config.ts` (que resolvem para as
variáveis de `globals.css`, `:root` + `[data-theme="dark"]`). Mapa do protótipo → token:

| Elemento do protótipo (`#page-home`) | Classe token a usar |
|---|---|
| `.hero` fundo | `bg-background` (ou `bg-surface`) + espaçamento por utilitário |
| `.hero h1 span` (ênfase "talentos") | `text-primary` |
| `.btn.btn-primary` (CTAs) | primitivo `Button` (`variant="primary"`, `size="lg"`) via `asChild`+`Link` |
| `.btn.btn-secondary` | `Button variant="outline"` (ou `secondary`) |
| `.card`/`.job-card-mini` (destaque) | primitivo `Card` + `Badge` (tags "Administrativa"/"CLT") |
| `.job-card-mini-icon` bg `#DBEAFE` / `#FFEDD5` | `bg-primary/10` / `bg-cta/10` (tint por token) |
| SVG strokes `#2563EB` / `#F97316` | `text-primary` / `text-cta` (stroke `currentColor`) |
| `.overline` | `text-fg-muted` (uppercase/tracking por utilitário) + `font-heading` |
| `.section-header h2` | `font-heading text-fg` |
| `.step-icon.step-icon-blue/orange/green` | primitivo `StepIcon` (variantes) |
| `.persona-card`/`.servico-home-card` | `Card` + `bg-surface`/`border-border` |
| `.cta-section` `linear-gradient(135deg, var(--color-primary), #1D4ED8)` | `bg-gradient-to-br from-primary to-secondary` (precedente do logo da casca) |
| `.cta-btn-light` `background:white;color:primary` | `bg-white text-primary` (utilitário — não é `#hex`/paleta numérica) |
| `.cta-btn-ghost` `rgba(255,255,255,.15)` + `border rgba(255,255,255,.4)` | `bg-white/15 border-2 border-white/40 text-white` |

**Dark-mode:** mecanismo único `[data-theme="dark"]` (DS-MN-04). A home **não** reintroduz
`@media (prefers-color-scheme)` nem usa hex cru (HOME-MN-02). `text-white`/`bg-white` são utilitários
(o guard só pega `#RRGGBB` e `-<cor>-<número>`) e já são precedente aprovado na casca
(`site-header.tsx`/`site-footer.tsx`). Onde o protótipo tem valor bruto sem token (o azul mais escuro
`#1D4ED8`), usa-se o gradiente `from-primary to-secondary` — **não** se adiciona token novo (mudança de
DS fora de escopo).

## 5. Layout / responsividade (HOME-11)

- **Container:** cada seção usa `mx-auto max-w-6xl px-4 sm:px-6` (paridade com a casca `SiteHeader`/
  `SiteFooter`, que usam `max-w-6xl`). Seções full-bleed (hero, CTA final) têm fundo na largura total e
  container interno.
- **Grades:** `grid grid-cols-1 … sm:grid-cols-2 / lg:grid-cols-3` conforme a seção — 1 coluna no mobile,
  expande no desktop (mesmos breakpoints Tailwind usados pela casca/`HomeIndicatorsView`, que já usa
  `grid-cols-1 sm:grid-cols-3`). Nenhum conteúdo largo deve provocar scroll horizontal do `<body>`.
- **Hero:** duas colunas no desktop (conteúdo + visual), empilhadas no mobile.

## 6. Contrato de acessibilidade (resumo dos ACs de a11y — HOME-13 / HOME-MN-04)

| Landmark/atributo | Onde | AC |
|---|---|---|
| **Um único** `<h1>` (hero) | `HomeHero` | HOME-01 / HOME-MN-04 |
| `<h2>` por seção + hierarquia h2→h3 | cada seção | HOME-06/07/08/09 |
| `<section aria-labelledby>` (ou `aria-label`) com nome acessível | cada seção | HOME-13 |
| `<form role="search">` + `<label>`/`aria-label` no input | `HomeSearch` | HOME-03 |
| SVGs decorativos `aria-hidden="true"`; ícones-ação com texto | todas | HOME-13 |
| **Nenhum** segundo `<main>` (vem do layout) | `page.tsx` | HOME-MN-04 |
| Links/botões com texto discernível (sem `href="#"`) | CTAs | HOME-02/07/08/09 |

## 7. Seams para USP-048 (navegação integrada) — G6 / HOME-14

Cada seção recebe seus alvos como **props com default de rota real** (nada hard-coded que a USP-048
precise reescrever):

| Seam (prop) | Componente | Default (USP-047) | O que a USP-048 faz |
|---|---|---|---|
| `verVagasHref` | `HomeHero` | `/vagas` | (já real) eventual scroll/estado |
| `publicarVagaHref` / `empresaHref` | `HomeHero`/`HomePersonas`/`HomeCta` | `/cadastro` (A-05) | retarget ao fluxo de cadastro de **empresa** |
| `candidatoHref` | `HomePersonas`/`HomeCta` | `/cadastro` | diferenciação do fluxo de **candidato** |
| `servicosHref` | `HomeServices` | `/servicos` | (já real) |
| `action` (busca) | `HomeSearch` | GET `/vagas` (`name="q"`) | busca→resultados vivos / escopo integrado (vagas+serviços) / comportamento client |
| `jobs` (destaque) | `HomeFeaturedJobs` | 2 cards estáticos (protótipo) | injeta **dados vivos** de vaga em destaque |

Como todos são props com default, **a home é 100% funcional e fiel sem a USP-048**; a USP-048 pluga sem
tocar a mecânica das seções (mesmo contrato de seam que a USP-046 estabeleceu com `PublicNav.items`).

## 8. Reuso (o que já existe e será consumido)

| Reuso | De onde | Uso |
|---|---|---|
| `HomeIndicatorsView` (+ `HomeIndicators` type) | `@/modules/reporting` (USP-041) | embed dos 3 indicadores no hero (HOME-05), inalterado |
| `getHomeIndicators` / `FALLBACK_INDICATORS` / `childLogger` | `page.tsx` atual + `@/modules/reporting` | carregamento server + fallback (preservado) |
| `Button` (`asChild`/Slot, `variant`, `size`) | `@/shared/ui` (DS-06) | todos os CTAs sobre `<Link>` |
| `Card` | `@/shared/ui` | superfícies de card (destaque, passos, personas, serviços) |
| `StepIcon` | `@/shared/ui` | contêiner colorido dos ícones (Como Funciona / personas / serviços) |
| `Badge` | `@/shared/ui` | tags dos mini-cards de vaga ("Administrativa"/"CLT") |
| `Input` / `Label` | `@/shared/ui` | campo de busca rotulado (HomeSearch) |
| `cn` | `@/shared/ui` | merge de `className` nos seams |
| Tokens/dark (`bg-surface`, `text-fg*`, `border-border`, `bg-primary/10`, `font-heading`) | `globals.css`+`tailwind.config.ts` | toda a estilização |
| `next/link` `Link` | Next 15 App Router | navegação declarativa dos CTAs |
| Guardas `casca-uses-tokens`/`casca-no-external-cdn`/`casca-no-auth-pii`/`casca-no-icon-state-lib` | `src/shared/__tests__/casca-*.test.ts` (USP-046) | **já varrem `(public)/_components/**`** → cobrem os `home-*.tsx` automaticamente |
| `home-revalidate.test.ts` | `src/modules/reporting/__tests__/` | guarda estática `revalidate ≤ 600` sobre `page.tsx` (HOME-MN-03c) — deve seguir verde |
| Padrão RTL de página/componente | `(public)/page.test.tsx`, `(public)/_components/__tests__/*.test.tsx` (casca), `vitest.setup.ts` | RTL das seções |

## 9. Aplicação dos Must-Nots (enforcement)

| Must-Not | Mecanismo | Owning task |
|---|---|---|
| HOME-MN-01 (sem sessão/PII/Prisma/ViewModel/Server Action) | (a) guarda **nova** `home-page-static.test.ts` varre `(public)/page.tsx` e falha se importar `getCurrentPerson`/`@/modules/*/views`/`@/shared/lib/prisma`/`'use server'`/actions; (b) guarda `casca-no-auth-pii` **existente** já varre `_components/**` → cobre os `home-*.tsx`. | T9 (+ T1..T8 mantêm os componentes limpos) |
| HOME-MN-02 (só token, sem CDN) | (a) `home-page-static.test.ts` varre `page.tsx` p/ `#RRGGBB`/paleta fixa/`system-ui`/`http(s)`; (b) guardas `casca-uses-tokens`/`casca-no-external-cdn` **existentes** varrem `_components/**` → cobrem os `home-*.tsx` a cada `npm run test`. | T9 (+ co-locação em T1..T7) |
| HOME-MN-03 (não regredir indicadores/ISR) | `page.test.tsx` (Em breve < 5 + fallback + testid) **preservado/migrado** (T8) + `home-revalidate.test.ts` **verde** (T8) + `HomeHero` renderiza o `HomeIndicatorsView` real (T7). | T7, T8 |
| HOME-MN-04 (sem 2º `<main>` / múltiplos `<h1>`) | asserção RTL em `page.test.tsx`: `queryByRole('main')` ausente + `getAllByRole('heading',{level:1})` length 1. | T8 |

## 10. Estratégia de testes

- **RTL (`.tsx`, fora do gate de cobertura, mas roda na suíte):** um teste por componente de seção
  (`home-search`, `home-featured-jobs`, `home-hero`, `home-how-it-works`, `home-personas`, `home-services`,
  `home-cta`) + `page.test.tsx` migrado (composição/ordem, indicadores, fallback, sem `<main>`, 1 `<h1>`).
  Precedente: `(public)/_components/__tests__/*.test.tsx` (casca), `(public)/page.test.tsx`.
- **Guardas estáticas (`.ts`, entram no gate de cobertura):** `home-page-static.test.ts` (novo, HOME-MN-01/02
  sobre `page.tsx`); os 4 `casca-*` existentes passam a cobrir os `home-*.tsx` (nada a escrever, só manter
  verde); `home-revalidate.test.ts` (existente, HOME-MN-03c).
- **Build:** `npm run build` compila `/` e confirma as seções no HTML renderizado (paridade estrutural).
- **Regressão:** a suíte pública existente segue verde; `page.test.tsx` é o único teste **editado** (o
  `<h1>` do esqueleto vira o `<h1>` do hero — migração planejada, análoga à remoção do `<main>` da USP-046).
- **E2E (deferido, DEF-4 / L-007):** um cenário Playwright "home abre com hero+indicadores+seções e CTAs
  navegam" pode entrar em `e2e/` como top-flow, **mas** — lição **L-007** — só como `e2e/*.spec.ts` real
  com asserções vivas (nunca skeleton em `.specs/`); não é gate de merge (roda `skipped` em PR comum).

## 11. Decisão de projeto (nenhuma nova; segue AD-025)

USP-047 **não** propõe AD novo: reusa **AD-025** (USP-046) para a colocação em `(public)/_components/` e o
padrão de seams. Nenhuma decisão contradiz ADR/TD; nenhuma reentrada em `architecture-planning-idsd`.
(O Planner não edita `STATE.md`.)

## 12. Ideias deferidas (seams → USP-048, salvo indicação)

- **DEF-1:** Ligar a **busca** do hero a resultados vivos / escopo integrado (vagas+serviços) e qualquer
  comportamento client — via o seam `action` de `HomeSearch` (USP-048).
- **DEF-2:** Injetar **dados vivos** nos cards de destaque de vaga (e, se aplicável, destaque de serviços)
  — via o seam `jobs` de `HomeFeaturedJobs` (USP-048).
- **DEF-3:** Retarget dos CTAs de **empresa** (`publicarVagaHref`/`empresaHref`) ao fluxo real de cadastro
  de empresa e diferenciação candidato/empresa no `/cadastro` — via os seams de href (USP-048).
- **DEF-4:** E2E dedicado da home promovido a top-flow no gate de E2E (herdado do DEF-4 da USP-046; L-007).
