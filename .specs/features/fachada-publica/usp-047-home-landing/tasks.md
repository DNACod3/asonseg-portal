# USP-047 — Home/landing pública fiel ao protótipo — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tarefas com a skill de execução spec-driven: **ative-a pelo nome** —
`idsd-spec-driven` (o consumidor do pipeline) — e siga seu fluxo Execute e as Critical Rules. Não
procure arquivos de skill por caminho de filesystem. A skill é a fonte da verdade do fluxo (ciclo por
tarefa, delegação a sub-agentes, revisão de adequação, Verifier, sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

---

**Spec**: `.specs/features/fachada-publica/usp-047-home-landing/spec.md`
**Design**: `.specs/features/fachada-publica/usp-047-home-landing/design.md`
**Status**: Draft

> **Entry Gate (§0):** re-lidas as Assumptions & Open Questions do spec. Todos os itens têm
> `owner = agent` e `Confirmed? = y`; nenhum pende de terceiro. USP net-new, **sem card de matriz**
> (`docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` não tem entrada `047`) e **sem dependência de
> decisão externa**: as duas dependências — USP-046 (casca, já mergeada nesta branch) e USP-041
> (indicadores, `HomeIndicatorsView`) — **já foram entregues**; esta USP só as **consome**. USP-048
> depende **desta**, não o contrário. **Nenhum item externo pendente → gate aberto; a unidade entra em
> breakdown.**

---

## Test Coverage Matrix

> Gerada de `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD) e
> `vitest.config.ts` (coverage include = `src/shared/**/*.ts` + `src/modules/**/*.ts`; `.tsx` de UI/
> página **fora** do gate de cobertura por design do repo, mas roda na suíte). Mesma matriz da USP-046.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Componente de seção da home (`.tsx`) em `(public)/_components/` | unit (RTL) | Render + estrutura/cópia do protótipo + hrefs de seam + a11y + dark; 1:1 aos ACs. Fora do gate de cobertura, roda na suíte. | `src/app/(public)/_components/__tests__/*.test.tsx` | `npm run test` |
| Página `(public)/page.tsx` (composição) | unit (RTL) | Ordem das seções + indicadores presentes + fallback + ausência de `<main>` + 1 `<h1>`. | `src/app/(public)/page.test.tsx` | `npm run test` |
| Guarda estática de must-not (`.ts`) | unit (`node:fs`) | Assevera que o resultado proibido NÃO ocorre (scan de arquivos). Entra no gate de cobertura (`.ts` em `shared/`). | `src/shared/__tests__/home-page-static.test.ts` (+ `casca-*` existentes cobrindo `_components/**`) | `npm run test` |
| Rotas `(public)` (build) | none (build gate) | Build compila; seções da home no HTML de `/`. | — | `npm run build` |
| E2E home (deferido, DEF-4) | e2e (Playwright) | Top-flow: home abre com hero+indicadores+seções; CTAs navegam. Gated por label/push-master. **L-007:** só `e2e/*.spec.ts` real, nunca skeleton em `.specs/`. | `e2e/*.spec.ts` | `npm run test:e2e` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| RTL de componente/página (jsdom) | Yes | Render por teste, sem store compartilhado; cleanup do RTL; `getHomeIndicators` mockada por teste. | `vitest.setup.ts`, `(public)/page.test.tsx`, casca `__tests__/*` |
| Guarda estática (`node:fs`, read-only) | Yes | Só leitura de arquivos. | `src/shared/__tests__/casca-*.test.ts`, `closed-src-root.test.ts` |
| Build / typecheck / lint | No (processo único) | — | `package.json` scripts |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tarefas com unit/RTL/guarda | `npm run test` |
| Full | Após tarefas com typecheck/guarda relevante | `npm run typecheck && npm run test` |
| Build | Composição na página / fim de USP | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Componentes de seção folha (Parallel OK)

Independentes entre si — só consomem tokens/primitivos da fundação (`Button`, `Card`, `StepIcon`,
`Badge`, `Input`, `cn`) e `Link`.

```
T1 [P]   T2 [P]   T3 [P]   T4 [P]   T5 [P]   T6 [P]
```

### Phase 2: Composição do hero (Sequential)

`HomeHero` compõe `HomeSearch` (T1) + `HomeFeaturedJobs` (T2) + embute `HomeIndicatorsView` (USP-041).

```
T1,T2 → T7
```

### Phase 3: Composição na página + regressão (Sequential)

```
T3,T4,T5,T6,T7 → T8
```

### Phase 4: Guarda estática de must-not da página (Sequential)

```
T8 → T9
```

---

## Task Breakdown

### T1: `HomeSearch` (Server Component, estático) + RTL [P]

**What**: `<form role="search">` do hero com `<input>` rotulado (label acessível) + botão de submit;
`action` é seam prop (default GET `/vagas`, `name="q"`). Presentacional — sem estado/handler client.
**Where**: `src/app/(public)/_components/home-search.tsx`; `src/app/(public)/_components/__tests__/home-search.test.tsx`
**Depends on**: None
**Reuses**: `Input`/`Label`/`Button`/`cn` (`@/shared/ui`); tokens
**Requirement**: HOME-03, HOME-13, HOME-14

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] `<form role="search">` com `method="get"`, `action` default `/vagas`, `<input name="q">` **rotulado** (`<label>`/`aria-label`) e botão de submit com texto discernível.
- [ ] `action`/placeholder expostos como props (seam) com defaults; SVG decorativo `aria-hidden`.
- [ ] Só classes token (sem `#hex`/paleta fixa/CDN); nenhum import de sessão/Prisma/View Model/`lucide-react`.
- [ ] RTL confirma role `search`, input rotulado, botão de submit, e `action` default.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: suíte verde (guardas `casca-*` cobrem o novo arquivo).

**Tests**: unit · **TestGate**: quick
**Commit**: `feat(fachada-publica): HomeSearch (busca do hero, seam action)`

---

### T2: `HomeFeaturedJobs` (Server Component, estático) + RTL [P]

**What**: Stack de ≥2 cards de destaque de vaga do hero-visual, fiéis ao protótipo (título + empresa +
tags), com conteúdo **estático** default; seam `jobs?` para a USP-048 injetar dados vivos.
**Where**: `src/app/(public)/_components/home-featured-jobs.tsx`; `.../__tests__/home-featured-jobs.test.tsx`
**Depends on**: None
**Reuses**: `Card`/`Badge`/`cn` (`@/shared/ui`); tokens; paridade protótipo L873-900
**Requirement**: HOME-04, HOME-14

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] Renderiza ≥2 cards (default: "Auxiliar Administrativo"/Supermercado + tags "Administrativa"/"CLT"; "Técnico em Enfermagem"/Clínica) via `Badge` para as tags.
- [ ] Aceita seam `jobs?: FeaturedJob[]` (tipo exportado) com default estático; SVGs `aria-hidden`.
- [ ] Só classes token; nenhum import proibido (sessão/Prisma/View Model/lib de ícone).
- [ ] RTL confirma ≥2 cards com títulos/empresas/tags do default.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: suíte verde.

**Tests**: unit · **TestGate**: quick
**Commit**: `feat(fachada-publica): HomeFeaturedJobs (cards de destaque de vaga, seam jobs)`

---

### T3: `HomeHowItWorks` (Server Component) + RTL [P]

**What**: Seção "Como Funciona": overline "Como Funciona" + `<h2>` "Simples, rápido e gratuito" +
subtítulo + 3 passos (PASSO 01 "Crie seu perfil"; 02 "Busque e filtre"; 03 "Conecte-se") com ícone,
título e descrição do protótipo.
**Where**: `src/app/(public)/_components/home-how-it-works.tsx`; `.../__tests__/home-how-it-works.test.tsx`
**Depends on**: None
**Reuses**: `Card`/`StepIcon`/`cn`; tokens; paridade protótipo L906-938
**Requirement**: HOME-06, HOME-13

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] `<section>` com nome acessível (`aria-labelledby` → `<h2>`); overline + `<h2>` "Simples, rápido e gratuito" + 3 passos com `StepIcon` (variantes) e SVG inline `aria-hidden`.
- [ ] Grade responsiva (1-col mobile → 3-col desktop); só classes token.
- [ ] RTL confirma overline, `<h2>`, e os 3 títulos de passo.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: suíte verde.

**Tests**: unit · **TestGate**: quick
**Commit**: `feat(fachada-publica): HomeHowItWorks (seção Como Funciona)`

---

### T4: `HomePersonas` (Server Component) + RTL [P]

**What**: Seção "Para Quem": overline "Para Quem" + `<h2>` "Uma plataforma, duas perspectivas" + 2 cards
de persona ("Sou Candidato": 4 features + CTA "Criar Meu Perfil" → `candidatoHref`, default `/cadastro`;
"Sou Empresa": 4 features + CTA "Cadastrar Empresa" → `empresaHref`, default `/cadastro`).
**Where**: `src/app/(public)/_components/home-personas.tsx`; `.../__tests__/home-personas.test.tsx`
**Depends on**: None
**Reuses**: `Card`/`StepIcon`/`Button`(`asChild`)/`cn`; `Link`; tokens; paridade protótipo L943-980
**Requirement**: HOME-07, HOME-13, HOME-14

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] 2 cards de persona com título, lista de features (marcadores com SVG `aria-hidden`) e CTA (`Button asChild`+`Link`) para os hrefs de seam (defaults `/cadastro`); nenhum `href="#"`.
- [ ] `candidatoHref`/`empresaHref` como props (seam) com defaults; `<section>` nomeada.
- [ ] Só classes token; sem imports proibidos.
- [ ] RTL confirma os 2 cards, features, e os CTAs com `href` correto (defaults).
- [ ] Gate check passes: `npm run test`
- [ ] Test count: suíte verde.

**Tests**: unit · **TestGate**: quick
**Commit**: `feat(fachada-publica): HomePersonas (seção Para Quem + CTAs seam)`

---

### T5: `HomeServices` (Server Component) + RTL [P]

**What**: Seção "Serviços": overline "Serviços" + `<h2>` "Precisa de um profissional?" + subtítulo + 3
cards de categoria ("Serviços Domésticos"; "Reparos e Manutenção"; "Área Externa") → `servicosHref`
(default `/servicos`) + CTA "Ver Todos os Serviços" → `servicosHref`.
**Where**: `src/app/(public)/_components/home-services.tsx`; `.../__tests__/home-services.test.tsx`
**Depends on**: None
**Reuses**: `Card`/`StepIcon`/`Button`(`asChild`)/`cn`; `Link`; tokens; paridade protótipo L983-1021
**Requirement**: HOME-08, HOME-13, HOME-14

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] 3 cards de categoria com ícone (`StepIcon`) + título + descrição, cada um linkando `servicosHref` (default `/servicos`); CTA "Ver Todos os Serviços" → `servicosHref`.
- [ ] `servicosHref` como prop (seam) com default; `<section>` nomeada; SVGs `aria-hidden`.
- [ ] Só classes token; sem imports proibidos.
- [ ] RTL confirma overline, `<h2>`, 3 categorias linkando `/servicos`, e o CTA.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: suíte verde.

**Tests**: unit · **TestGate**: quick
**Commit**: `feat(fachada-publica): HomeServices (destaque de Serviços + CTA seam)`

---

### T6: `HomeCta` (Server Component) + RTL [P]

**What**: Faixa de CTA final: `<h2>` "Faça parte dessa iniciativa social" + subtítulo + 2 CTAs
("Cadastrar como Candidato" → `candidatoHref`, `/cadastro`; "Cadastrar como Empresa" → `empresaHref`,
`/cadastro`) sobre fundo em gradiente de token (`bg-gradient-to-br from-primary to-secondary`).
**Where**: `src/app/(public)/_components/home-cta.tsx`; `.../__tests__/home-cta.test.tsx`
**Depends on**: None
**Reuses**: `Button`(`asChild`)/`cn`; `Link`; tokens; paridade protótipo L1023-1033
**Requirement**: HOME-09, HOME-13, HOME-14

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] `<section>` nomeada com `<h2>` + subtítulo + 2 CTAs (`Button asChild`+`Link`) para os hrefs de seam (defaults `/cadastro`); nenhum `href="#"`.
- [ ] Fundo `from-primary to-secondary` (token); texto legível em light/dark (`text-white`/`bg-white` utilitários — sem `#hex`).
- [ ] Só classes token; sem imports proibidos.
- [ ] RTL confirma `<h2>` e os 2 CTAs com `href` correto (defaults).
- [ ] Gate check passes: `npm run test`
- [ ] Test count: suíte verde.

**Tests**: unit · **TestGate**: quick
**Commit**: `feat(fachada-publica): HomeCta (faixa de CTA final + CTAs seam)`

---

### T7: `HomeHero` (Server Component) + RTL

**What**: Hero: um único `<h1>` "Conectando **talentos** a oportunidades na comunidade" (ênfase via
`text-primary`) + subtítulo; CTAs "Buscar Vagas" (→ `verVagasHref`, `/vagas`) e "Publicar Vaga" (→
`publicarVagaHref`, `/cadastro`); compõe `<HomeSearch/>` (T1) + `<HomeFeaturedJobs/>` (T2) e **embute**
`<HomeIndicatorsView indicators={indicators} />` (USP-041, inalterado) na posição dos hero-stats.
**Where**: `src/app/(public)/_components/home-hero.tsx`; `.../__tests__/home-hero.test.tsx`
**Depends on**: T1, T2
**Reuses**: `HomeSearch`(T1), `HomeFeaturedJobs`(T2), `HomeIndicatorsView`+`HomeIndicators` type (`@/modules/reporting`), `Button`(`asChild`)/`cn`; `Link`; tokens
**Requirement**: HOME-01, HOME-02, HOME-05, HOME-13, HOME-MN-03

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] `<h1>` com "talentos" enfatizado (token) + subtítulo do protótipo; CTAs "Buscar Vagas"→`verVagasHref` e "Publicar Vaga"→`publicarVagaHref` (`Button asChild`+`Link`), com props de seam (defaults `/vagas` e `/cadastro`).
- [ ] Renderiza `<HomeSearch/>`, `<HomeFeaturedJobs/>` e `<HomeIndicatorsView indicators={indicators}/>` (prop `indicators: HomeIndicators` obrigatória) — **sem** re-implementar contagem nem alterar o componente da USP-041 (HOME-MN-03).
- [ ] Layout de 2 colunas no desktop (conteúdo + visual), empilhado no mobile; só classes token; sem imports proibidos.
- [ ] RTL (com `indicators` mockado + `HomeIndicatorsView` real ou stub) confirma: 1 `<h1>` com "talentos", subtítulo, os 2 CTAs com hrefs default, `role="search"` presente (via HomeSearch), ≥2 cards de destaque, e `data-testid="home-indicators"` presente.
- [ ] Gate check passes: `npm run test`
- [ ] Test count: suíte verde.

**Tests**: unit · **TestGate**: quick
**Commit**: `feat(fachada-publica): HomeHero (hero + busca + destaque + embed dos indicadores USP-041)`

---

### T8: Reescrever `(public)/page.tsx` (composição) + migrar `page.test.tsx`

**What**: Reescrever o corpo de `page.tsx` compondo `HomeHero` (com `indicators`) → `HomeHowItWorks` →
`HomePersonas` → `HomeServices` → `HomeCta`, na ordem, **sem** `<main>` (vem do layout) e **mantendo**
`export const revalidate = 600` + `loadIndicators()`/`FALLBACK_INDICATORS`/`childLogger`. Migrar
`page.test.tsx`: substituir a asserção do `<h1>` do esqueleto pela do hero e adicionar as asserções de
composição/a11y — **preservando** o contrato de indicadores (3 rótulos, "Em breve" < 5, fallback).
**Where**: `src/app/(public)/page.tsx` (reescrita); `src/app/(public)/page.test.tsx` (migração)
**Depends on**: T3, T4, T5, T6, T7
**Reuses**: as 5 seções (T3-T7); `getHomeIndicators`/`FALLBACK_INDICATORS` (padrão atual de `page.tsx`)
**Requirement**: HOME-10, HOME-11, HOME-12, HOME-13, HOME-MN-03, HOME-MN-04

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] `page.tsx` compõe as 5 seções na ordem; mantém `revalidate = 600` + `loadIndicators()`/fallback; **não** declara `<main>`; passa `indicators` ao `HomeHero`.
- [ ] `page.test.tsx` migrado: assertiona `<h1>` do hero ("Conectando…"/"talentos"); os 3 indicadores presentes (rótulos + valores) com `getHomeIndicators` mockada; cold start (< limiar) → "Em breve" ×3; fallback (query lança) → página carrega + "Em breve" ×3 (HOME-MN-03).
- [ ] `page.test.tsx` assertiona `queryByRole('main')` **ausente** e `getAllByRole('heading',{level:1})` **length 1** (HOME-MN-04).
- [ ] Guardas existentes verdes (não-regressão): `reporting/__tests__/home-revalidate.test.ts` (revalidate ≤ 600), `HomeIndicators.test.tsx`, e a suíte pública da casca.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`
- [ ] Test count: suíte verde; build compila `/` com as seções no HTML.

**Tests**: unit · **TestGate**: build
**Commit**: `feat(fachada-publica): compõe a home/landing em (public)/page.tsx (USP-047)`

---

### T9: Guarda estática de must-not da página (`home-page-static.test.ts`)

**What**: Guarda `node:fs` que varre `src/app/(public)/page.tsx` e falha se houver import de sessão/PII
(`getCurrentPerson`, `@/modules/*/views`, `@/shared/lib/prisma`, `'use server'`/actions) (HOME-MN-01) ou
`#RRGGBB`/paleta fixa/`system-ui`/`href="http`/`src="http` (HOME-MN-02). Confirma também que os
`home-*.tsx` são cobertos pelas guardas `casca-*` existentes (asseverar que a lista varrida as inclui).
**Where**: `src/shared/__tests__/home-page-static.test.ts`
**Depends on**: T8
**Reuses**: padrão `node:fs` de `src/shared/__tests__/casca-*.test.ts` / `closed-src-root.test.ts`
**Requirement**: HOME-MN-01, HOME-MN-02

**Tools**: MCP: NONE · Skill: `idsd-spec-driven`

**Done when**:
- [ ] Guarda varre `(public)/page.tsx`: 0 offenders para imports proibidos (sessão/PII/Prisma/ViewModel/`'use server'`) e 0 para `#RRGGBB`/paleta fixa/`system-ui`/CDN externo.
- [ ] Asserção de sanidade: a lista de arquivos varrida pelas guardas `casca-*` inclui ≥1 `home-*.tsx` (cobertura efetiva dos componentes) — ou teste dedicado equivalente.
- [ ] Suíte inteira verde, incluindo as 4 guardas `casca-*` e `home-revalidate.test.ts` (não-regressão).
- [ ] Gate check passes: `npm run typecheck && npm run test`
- [ ] Test count: suíte verde (a USP fecha com `npm run build` verde de T8 intacto).

**Tests**: unit · **TestGate**: full
**Commit**: `test(fachada-publica): guarda de must-not da home (sem PII/sessão, só token)`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]  HomeSearch
  ├── T2 [P]  HomeFeaturedJobs
  ├── T3 [P]  HomeHowItWorks
  ├── T4 [P]  HomePersonas
  ├── T5 [P]  HomeServices
  └── T6 [P]  HomeCta

Phase 2 (após T1, T2):
  T7  HomeHero

Phase 3 (após T3, T4, T5, T6, T7):
  T8  page.tsx (composição) + page.test.tsx (migração)  [gate: build]

Phase 4 (após T8):
  T9  home-page-static.test.ts (guarda)                 [gate: full]
```

**Parallelism constraint:** T1-T6 são `[P]` — sem dependências entre si, tipos de teste
parallel-safe (RTL jsdom + guardas read-only), sem estado mutável compartilhado. T7/T8/T9 são
sequenciais (dependências de código + T8 é processo único de build).

---

## Pre-Approval Validation (as 3 checagens obrigatórias)

### Check 1 — Task Granularity

| Task | Escopo | Status |
|---|---|---|
| T1 HomeSearch | 1 componente + RTL | ✅ Granular |
| T2 HomeFeaturedJobs | 1 componente + RTL | ✅ Granular |
| T3 HomeHowItWorks | 1 componente + RTL | ✅ Granular |
| T4 HomePersonas | 1 componente + RTL | ✅ Granular |
| T5 HomeServices | 1 componente + RTL | ✅ Granular |
| T6 HomeCta | 1 componente + RTL | ✅ Granular |
| T7 HomeHero | 1 componente (compõe T1/T2 + embed) + RTL | ✅ Granular |
| T8 page.tsx + page.test.tsx | 1 arquivo de página (composição) + seu teste co-locado | ✅ Coeso (composição + migração do próprio teste) |
| T9 home-page-static.test.ts | 1 guarda estática | ✅ Granular |

### Check 2 — Diagram-Definition Cross-Check

| Task | Depends on (corpo) | Diagrama mostra | Status |
|---|---|---|---|
| T1 | None | Phase 1 (folha) | ✅ Match |
| T2 | None | Phase 1 (folha) | ✅ Match |
| T3 | None | Phase 1 (folha) | ✅ Match |
| T4 | None | Phase 1 (folha) | ✅ Match |
| T5 | None | Phase 1 (folha) | ✅ Match |
| T6 | None | Phase 1 (folha) | ✅ Match |
| T7 | T1, T2 | `T1,T2 → T7` | ✅ Match |
| T8 | T3, T4, T5, T6, T7 | `T3,T4,T5,T6,T7 → T8` | ✅ Match |
| T9 | T8 | `T8 → T9` | ✅ Match |

Tarefas `[P]` (T1-T6) não dependem umas das outras — coerente com o diagrama.

### Check 3 — Test Co-location Validation

| Task | Code Layer criado/modificado | Matriz exige | Task diz | Status |
|---|---|---|---|---|
| T1 | Componente `.tsx` em `(public)/_components/` | unit (RTL) | unit | ✅ OK |
| T2 | Componente `.tsx` em `(public)/_components/` | unit (RTL) | unit | ✅ OK |
| T3 | Componente `.tsx` em `(public)/_components/` | unit (RTL) | unit | ✅ OK |
| T4 | Componente `.tsx` em `(public)/_components/` | unit (RTL) | unit | ✅ OK |
| T5 | Componente `.tsx` em `(public)/_components/` | unit (RTL) | unit | ✅ OK |
| T6 | Componente `.tsx` em `(public)/_components/` | unit (RTL) | unit | ✅ OK |
| T7 | Componente `.tsx` em `(public)/_components/` | unit (RTL) | unit | ✅ OK |
| T8 | Página `(public)/page.tsx` + build | unit (RTL) + build gate | unit / build | ✅ OK |
| T9 | Guarda estática `.ts` em `shared/__tests__` | unit (`node:fs`) | unit | ✅ OK |

Nenhum `Tests: none`; nenhuma deferência de teste (cada componente carrega seu RTL; a guarda é o próprio
teste). ✅ Todas as tarefas passam a co-locação.

---

## Human Review (Dev Sênior — obrigatório antes/depois do Execute)

USP net-new de fachada pública com **must-nots** (PII/token/indicadores) → as 3 tabelas acima vão ao
**Dev Sênior para aprovação antes do Execute**; após o Execute, a mesma revisão confere o resultado
contra os checklists do `project-guideline` e as regras 🚨, usando a skill `pr-review` como
materializadora (mesmo rito da USP-046). O Verifier independente (author ≠ verifier) roda antes da
revisão humana e produz `validation.md` (checagem ancorada no spec + sensor de discriminação + status
dos 4 must-nots).
