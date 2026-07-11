# USP-048 — Navegação integrada das telas públicas — Tasks

**Design**: `.specs/features/fachada-publica/usp-048-navegacao-integrada/design.md`
**Spec**: `.specs/features/fachada-publica/usp-048-navegacao-integrada/spec.md`
**Status**: Draft

---

## 0. ICE Entry Gate — resultado: ✅ ABERTO (pode entrar em dev)

Detecção dos 5 sinais bloqueadores (a USP-048 é net-new, sem card na matriz; deps todas concluídas):

| Sinal | Presente? | Evidência |
|---|---|---|
| 1. Q-aberta(dono) | ❌ Não | Todas as ambiguidades resolvidas como assumptions (spec §Assumptions, `owner=agent`); modo autônomo. |
| 2. ❓ técnico/arquitetural | ❌ Não | Wiring sobre queries/rotas/seams **já entregues** (USP-021/030/046/047); nada a investigar. |
| 3. ADR Proposed / `[NECESSITA VALIDAÇÃO]` | ❌ Não | Reusa AD-025/AD-013/AD-021/ADR-0017/ADR-0026 (todos Accepted); nenhuma AD nova. |
| 4. Pré-condição D-NNN | ❌ Não | Deps USP-046 ✅, USP-047 ✅, USP-021 ✅, USP-030 ✅ (ROADMAP Fase 7; STATE §In-flight). |
| 5. Premissa PR-NNN aberta | ❌ Não | Nenhuma premissa de ledger consumida; unidade apresentacional/navegacional. |

**Conclusão:** nenhum sinal disparou → **prossegue** para o task breakdown.
**TESTING.md** lido (`docs/IDSD/.specs/codebase/TESTING.md`): Vitest jsdom (RTL `.tsx` roda mas fora do gate
de cobertura; guardas `.ts` em `src/shared/**` contam para o gate 65%); int-tests `*.int.test.ts` só no job
CI. **Sem skill-tdad** nesta unidade (net-new greenfield-adapter, sem `expectations-USP-048`) — os `Tests`
são populados diretamente, seguindo o precedente USP-046/047.

**Confirmed lessons carregadas** (`.specs/LESSONS.md`): L-007 (E2E real, não skeleton → DEF-1), L-011
(reusar rota `/empresa/cadastrar` → T4), L-013 (guarda node:fs; N/A p/ `href=`), L-014 (teste RTL isolado
por seam → T1/T2), L-002/L-005 (tensão frágil resolvida no design §5 → T4).

---

## Execution Plan

### Phase 1: Extensões de seam (Parallel)

Componentes apresentacionais, arquivos independentes, RTL parallel-safe.

```
T1 [P]   (home-featured-jobs.tsx)
T2 [P]   (home-services.tsx)
```

### Phase 2: Wiring no composition root (Sequential — mesmo arquivo `page.tsx`)

```
T1 ──→ T3 ──→ T4
         T2 ──┘
```

### Phase 3: Confirmação de fluxo + guarda de must-not + gate final (Sequential)

```
T1, T2, T4 ──→ T5
```

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]  home-featured-jobs seam
  └── T2 [P]  home-services seam

Phase 2 (Sequential — page.tsx):
  T1 ──→ T3 (live jobs)
  T2, T3 ──→ T4 (service links + empresa retarget)

Phase 3 (Sequential):
  T1, T2, T4 ──→ T5 (search RTL + dead-ends guard + gate cheio + build)
```

`[P]` só em T1/T2: sem dependências, arquivos distintos, RTL parallel-safe (sem estado mutável
compartilhado). T3/T4 **não** são `[P]` (compartilham `page.tsx`/`page.test.tsx`). T5 depende do estado
final de `page.tsx` + `home-*.tsx`.

---

## Task Breakdown

### T1: Estender `HomeFeaturedJobs` com seam `href` por card [P]

**What**: Adicionar `href?: string` a `FeaturedJob`; quando presente, o card é um `<Link href>` (para o
detalhe real da vaga); quando ausente (mock default), permanece sem link (retrocompat).
**Where**: `src/app/(public)/_components/home-featured-jobs.tsx` (+ `__tests__/home-featured-jobs.test.tsx`)
**Depends on**: None
**Reuses**: `Link` (`next/link`), `Card`/`Badge`/`cn` (`@/shared/ui`); padrão de `<Link className="block">`
de `home-services.tsx` L117.
**Requirement**: NAV-02 (seam A-09)

**Pointers resolvidos:**
- `FeaturedJob` atual: `{ title, company, tags?, iconVariant? }` (L10-15). Adicionar `href?: string`.
- No `.map` (L68), envolver o `<Card>` em `<Link href={job.href} className="block">` **só se** `job.href`.
- `DEFAULT_JOBS` (L17-29) permanece **sem** `href` → sem link (comportamento atual intacto).

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `FeaturedJob` tem `href?: string`; card com `href` renderiza `<a href=…>` envolvendo o card; sem `href` não renderiza `<a>`.
- [ ] RTL isolado do seam (L-014): `<HomeFeaturedJobs jobs={[{title:'X',company:'Y',href:'/vagas/abc'}]}>` → `getByRole('link')` com `href="/vagas/abc"`; default mock → nenhum link.
- [ ] `casca-uses-tokens`/`casca-no-auth-pii` seguem verdes sobre o arquivo (sem hex/paleta/import proibido).
- [ ] Gate: `npm run test` verde; contagem da suíte não regride (sem deleções silenciosas); +≥2 testes novos.

**Tests**: unit (RTL)
**TestGate**: quick (`npm run test`)
**Commit**: `feat(persons): destaque de vaga com link para detalhe (seam href, USP-048 NAV-02)`
> nota de escopo: componente vive em `(public)/_components`; usar o scope de commit da rodada Fase 7 (ex.: `feat(jobs)` ou o scope adotado na USP-047) — alinhar com o padrão da branch.

---

### T2: Estender `HomeServices` com seam `href` por categoria [P]

**What**: Aceitar `categories?: ServiceCategoryCard[]` (default = os 3 cards estáticos atuais, cada um com
`href = servicosHref`); cada card usa seu `href` no `<Link>` (hoje todos usam `servicosHref`). "Ver Todos os
Serviços" continua `servicosHref`.
**Where**: `src/app/(public)/_components/home-services.tsx` (+ `__tests__/home-services.test.tsx`)
**Depends on**: None
**Reuses**: `Card`/`StepIcon`/`Button`/`cn` (`@/shared/ui`), `Link`; estrutura atual dos cards (L115-125).
**Requirement**: NAV-03 (seam A-09)

**Pointers resolvidos:**
- `SERVICE_CATEGORIES` (L72-91): 3 buckets `{variant,title,description,icon}`. Novo tipo
  `ServiceCategoryCard = { ...atual, href: string }`.
- Props (L93-96): adicionar `categories?: ServiceCategoryCard[]`; default = os 3 estáticos com `href = servicosHref`.
- No `.map` (L116), o `<Link href={servicosHref}>` (L117) passa a `<Link href={category.href}>`.
- "Ver Todos os Serviços" (L129) permanece `servicosHref`.

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `HomeServices` aceita `categories?`; sem a prop → 3 cards com `href=/servicos` (comportamento atual).
- [ ] RTL isolado do seam (L-014): `<HomeServices categories={[{...,href:'/servicos?categoria=x'}]}>` → card com `href="/servicos?categoria=x"`; sem prop → cards com `href="/servicos"`.
- [ ] `casca-uses-tokens`/`casca-no-auth-pii` verdes sobre o arquivo.
- [ ] Gate: `npm run test` verde; sem deleções silenciosas; +≥2 testes novos.

**Tests**: unit (RTL)
**TestGate**: quick (`npm run test`)
**Commit**: `feat(services): categorias da home linkam ao filtro real (seam href, USP-048 NAV-03)`

---

### T3: Ligar o destaque de vagas a dados reais anonimizados em `page.tsx`

**What**: No composition root, carregar as top-2 vagas ACTIVE reais (anonimizadas) e passá-las ao
`HomeHero.jobs`; fallback gracioso ao mock em vazio/erro (ADR-0026). É o item de maior valor/risco (must-not
de PII).
**Where**: `src/app/(public)/page.tsx` (+ `src/app/(public)/page.test.tsx`)
**Depends on**: T1
**Reuses**: `searchJobs` + `type JobListItem` de `@/modules/jobs` (**barrel** — não deep `views/`);
padrão try/catch de `loadIndicators` (L30-37); `childLogger`; `HomeHero.jobs` (já existe, L20/59).
**Requirement**: NAV-02, NAV-MN-01

**Pointers resolvidos (VERBATIM — do módulo jobs):**
- `searchJobs(filters: SearchJobsFilters, viewer: CurrentPerson | null): Promise<SearchJobsResult>`.
  Chamar `searchJobs({ page: 1 }, null)` → `viewer=null` = **anônimo** (sem PII).
- `SearchJobsResult = { items: JobListItem[]; page; pageSize; total }`. Fatiar `items.slice(0, 2)`.
- `JobListItem = { id, title, area: string|null, region: string|null, contractType: string|null, salary: {min,max}|null, company: { displayName: string, isAnonymized: boolean } }` (`views/job-list-item.view.ts`). ⚠️ `area`/`region`/`contractType` **já achatados** para `string|null` (não `area.name`). Para `viewer=null`, `company.displayName` = "Empresa do setor de …" — **nunca** `nomeFantasia` (nem é selecionado, `jobListSelect(false)`).
- Portão do `where` (já garantido pela query): `status='ACTIVE' AND valid_until>=hoje(SP) AND company.is_verified=true`.
- Mapper `toFeaturedJob(item): FeaturedJob = { title: item.title, company: item.company.displayName, tags: [item.area, item.contractType].filter(Boolean), href: `/vagas/${item.id}` }` — **só campos do View Model** (`item.area`/`item.contractType` são `string|null`).
- `loadFeaturedJobs(): Promise<FeaturedJob[]>` = `try { return (await searchJobs({page:1}, null)).items.slice(0,2).map(toFeaturedJob) } catch (err) { log.error(...); return [] }`. `[]` → `HomeFeaturedJobs` cai no `DEFAULT_JOBS`.
- Passar `<HomeHero indicators jobs={await loadFeaturedJobs()} … />`.
- **Guarda a respeitar** (`home-page-static.test.ts`): proibido em `page.tsx` — `getCurrentPerson`, `requireActivePerson`, `@/modules/*/views`, `@/shared/lib/prisma`, `@/modules/*/actions`, `'use server'`. O barrel `@/modules/jobs` **não** casa nenhum → permitido (como `@/modules/reporting` já é).

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `page.tsx` importa `searchJobs`/`JobListItem` do barrel `@/modules/jobs`; `loadFeaturedJobs`+`toFeaturedJob` implementados; `HomeHero` recebe `jobs`.
- [ ] `page.test.tsx` mocka `@/modules/jobs` (padrão `vi.hoisted`+`vi.mock`): `searchJobs` resolve com um `JobListItem` anonimizado → card com `title` + `company.displayName` + `getByRole('link', {href:/vagas/{id}})`; `queryByText('<nomeFantasia>')` **ausente** (NAV-MN-01 killable).
- [ ] `page.test.tsx`: `searchJobs` **rejeita** → cards estáticos (`Auxiliar Administrativo`) presentes, home intacta (heading hero presente) — fallback (ADR-0026); e `searchJobs` resolve `items:[]` → idem fallback.
- [ ] `home-page-static.test.ts` **verde** (nenhum import proibido em `page.tsx` após adicionar o barrel).
- [ ] `revalidate = 600` inalterado; `home-revalidate.test.ts` verde; indicadores da USP-041 intactos (asserts existentes de `page.test.tsx` preservados).
- [ ] Gate: `npm run test` verde; sem deleções silenciosas.

**Tests**: unit (RTL) + guarda estática existente (verde)
**TestGate**: quick (`npm run test`)
**Commit**: `feat(jobs): home exibe destaque de vagas ACTIVE reais anonimizadas (USP-048 NAV-02/MN-01)`

---

### T4: Ligar categorias de serviço ao filtro real + retarget dos CTAs de empresa em `page.tsx`

**What**: (a) Carregar `listServiceCategories()`, resolver os 3 buckets → `/servicos?categoria=<id>` (fallback
`/servicos`) e passar via `HomeServices.categories`; (b) reapontar os CTAs de **empresa**
(`publicarVagaHref`/`empresaHref`) para `/empresa/cadastrar`, mantendo candidato em `/cadastro`.
**Where**: `src/app/(public)/page.tsx` (+ `src/app/(public)/page.test.tsx`)
**Depends on**: T2, T3
**Reuses**: `listServiceCategories` + `type ServiceCategoryOption` de `@/modules/services` (**barrel**); seams
já existentes `HomeHero.publicarVagaHref`, `HomePersonas.empresaHref/candidatoHref`, `HomeCta.empresaHref/candidatoHref`.
**Requirement**: NAV-03, NAV-04

**Pointers resolvidos:**
- `listServiceCategories(): Promise<ServiceCategoryOption[]>`, `ServiceCategoryOption = { id, name }` (barrel `@/modules/services`).
- `/servicos` lê `first(sp.categoria)` → `categoryId` (USP-030) — o filtro `categoria=<id>` é honrado.
- Helper puro `resolveCategoryHref(bucketKey, categories): string` — match por nome **normalizado**
  (lowercase + sem acento) por palavra-chave (`domestic` / `repar`|`manuten` / `extern`|`jardin`); sem match
  ou lista vazia → `/servicos` (design §5, contrato de fallback determinístico — L-002/L-005).
- `loadServiceCategoryHrefs()` = `try { const cats = await listServiceCategories(); return buildCards(cats) } catch { return buildCards([]) }` — `buildCards([])` → 3 cards com `href=/servicos`.
- Passar `<HomeServices categories={await loadServiceCategoryHrefs()} />`.
- Retarget (rota real `(app)/empresa/cadastrar`, `requireActivePerson`→`/login` p/ anônimo; L-011):
  `<HomeHero … publicarVagaHref="/empresa/cadastrar" />`,
  `<HomePersonas empresaHref="/empresa/cadastrar" candidatoHref="/cadastro" />`,
  `<HomeCta empresaHref="/empresa/cadastrar" candidatoHref="/cadastro" />`.
- Guarda: `@/modules/services` (barrel) permitido (não casa padrão proibido).

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `page.tsx` importa `listServiceCategories`/`ServiceCategoryOption` do barrel; `resolveCategoryHref`+`loadServiceCategoryHrefs` implementados; `HomeServices` recebe `categories`.
- [ ] `page.tsx` passa `publicarVagaHref`/`empresaHref="/empresa/cadastrar"` a `HomeHero`/`HomePersonas`/`HomeCta`; `candidatoHref="/cadastro"`.
- [ ] `page.test.tsx` mocka `@/modules/services`: `listServiceCategories` com nomes conhecidos → card de categoria com `href` contendo `categoria=<id>`; mock vazio/rejeita → `href="/servicos"` (fallback).
- [ ] `page.test.tsx`: CTA de empresa ("Cadastrar Empresa"/"Publicar Vaga"/"Cadastrar como Empresa") → `href="/empresa/cadastrar"`; CTA candidato ("Criar Meu Perfil"/"Cadastrar como Candidato") → `href="/cadastro"` (NAV-04).
- [ ] `home-page-static.test.ts` **verde** (barrels não disparam import proibido).
- [ ] Gate: `npm run test` verde; sem deleções silenciosas; asserts de indicadores/`<main>`/`<h1>` preservados.

**Tests**: unit (RTL)
**TestGate**: quick (`npm run test`)
**Commit**: `feat(services): categorias reais no destaque + retarget dos CTAs de empresa (USP-048 NAV-03/NAV-04)`

---

### T5: Confirmar fluxo de busca (NAV-01) + guarda de dead-ends (NAV-MN-02) + gate cheio & build

**What**: (a) Estender `home-search.test.tsx` para confirmar o GET `/vagas` preservando `?q=` (termo e
vazio); (b) criar a guarda estática `nav-no-dead-ends.test.ts` (NAV-MN-02); (c) rodar o **gate cheio +
build** confirmando não-regressão de todos os contratos da Fase 7 (NAV-06).
**Where**: `src/app/(public)/_components/__tests__/home-search.test.tsx` (estender) +
`src/shared/__tests__/nav-no-dead-ends.test.ts` (novo)
**Depends on**: T1, T2, T4
**Reuses**: padrão `node:fs`/`readdirSync` das guardas `casca-*`/`home-page-static` (mesmo esqueleto);
RTL de `home-search.tsx` (já GET `/vagas` `name="q"`, sem mudança de código).
**Requirement**: NAV-01, NAV-05, NAV-06, NAV-MN-02

**Pointers resolvidos:**
- `home-search.tsx` já é `<form role="search" method="get" action="/vagas">` + `<Input name="q">` (default
  `action='/vagas'`). Sem mudança de código — só asserção: `getByRole('search')` com `getAttribute('action')='/vagas'`,
  `getAttribute('method')='get'`, input `name="q"`; submissão com termo vazio permanece `action='/vagas'`.
- Nova guarda `nav-no-dead-ends.test.ts` (padrão de `home-page-static.test.ts` L40-52): varrer
  `src/app/(public)/page.tsx` + `src/app/(public)/_components/home-*.tsx` e falhar se houver `href="#"`,
  `href=""`, `href='#'` (regex `href=["']#?["']|href=["']#`). Offenders → `[]`.
- Confirmação de não-regressão (rodam na suíte, devem estar verdes): `home-page-static.test.ts`,
  `casca-uses-tokens.test.ts`, `casca-no-external-cdn.test.ts`, `casca-no-auth-pii.test.ts`,
  `casca-no-icon-state-lib.test.ts`, `home-revalidate.test.ts`, `public-nav.test.tsx` (nav primária +
  active-state, NAV-05), `page.test.tsx` (indicadores/`<main>`/`<h1>`, NAV-06).
> **L-013**: esta guarda casa `href=`, não import — não aplica a exigência de `from`/bare `import`; anotado.
> **DEF-1 (L-007)**: E2E permanece deferido; **não** criar skeleton em `.specs/` — se um `e2e/*.spec.ts` real
> for adicionado, é fora desta task e não é gate de merge.

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `home-search.test.tsx` confirma `<form method="get" action="/vagas">` + input `name="q"` (termo preenchido e vazio → `/vagas`) — NAV-01.
- [ ] `nav-no-dead-ends.test.ts` varre `page.tsx` + `home-*.tsx`, offenders (`href="#"`/vazio) = `[]` — NAV-MN-02; mutante que injete `href="#"` num `home-*.tsx` faz a guarda falhar (killable).
- [ ] Guardas/tests de não-regressão verdes: `home-page-static`, `casca-*`, `home-revalidate`, `public-nav`, `page.test.tsx` (NAV-05/NAV-06).
- [ ] **Gate cheio**: `npm run typecheck` ✓ · `npm run lint` ✓ · `npm run test` ✓ (suíte inteira, sem deleções silenciosas) · `npm run build` ✓ (a rota `/` compila com os loaders resilientes, mesmo sem DB no build).
- [ ] Nenhum `href="#"` em toda a home; nenhum import proibido em `page.tsx`/`home-*.tsx`.

**Tests**: unit (RTL) + guarda estática (nova, entra no gate de cobertura)
**TestGate**: full (`npm run typecheck && npm run lint && npm run test && npm run build`)
**Commit**: `test(jobs): fluxo de busca + guarda de dead-ends da navegação integrada (USP-048 NAV-01/MN-02)`

> **Remediação pós-merge (PR #289, revisão de IA) — dois findings sobre T5:**
> 1. 💡 O escopo do `nav-no-dead-ends.test.ts` cobria só `page.tsx` + `home-*.tsx`, deixando a casca
>    (`site-header.tsx`/`site-footer.tsx`/`public-nav.tsx`) fora do alcance de NAV-MN-02 — justamente onde os
>    `href="#"` do protótipo estático viviam. Ampliado para todo `.tsx` não-teste de `_components/`.
> 2. ⚠️ O bloco RTL de NAV-01 em `home-search.test.tsx` só reafirmava o contrato estático (já coberto por
>    HOME-03) sem provar o round-trip real. Fechado com `e2e/home/navegacao-integrada.spec.ts` (E2E vivo,
>    4 testes, L-007) + reframing honesto do `describe` RTL (sem "confirma o fluxo").
>
> Detalhe completo em `validation.md` §"Remediação — PR #289 AI review".

---

## Validação Pré-Aprovação (3 checks obrigatórios)

### Check 1 — Task Granularity

| Task | Escopo | Status |
|---|---|---|
| T1: seam `href` em `home-featured-jobs` | 1 componente + teste | ✅ Granular |
| T2: seam `categories/href` em `home-services` | 1 componente + teste | ✅ Granular |
| T3: destaque de vagas vivo em `page.tsx` | 1 arquivo (composition root) + teste; 1 concern (live jobs) | ✅ Granular |
| T4: links de categoria + retarget empresa em `page.tsx` | 1 arquivo + teste; 2 concerns coesos (wiring de seams restantes, mesmo arquivo) | ✅ OK (coeso, mesmo arquivo) |
| T5: search RTL + guarda dead-ends + gate cheio | 2 arquivos de teste + gate final | ✅ OK (verificação integrada) |

### Check 2 — Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama (setas) | Status |
|---|---|---|---|
| T1 | None | (sem entrada) | ✅ Match |
| T2 | None | (sem entrada) | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T2, T3 | T2 → T4, T3 → T4 | ✅ Match |
| T5 | T1, T2, T4 | T1 → T5, T2 → T5, T4 → T5 | ✅ Match |

`[P]`: T1 e T2 não dependem um do outro (arquivos distintos) → parallel válido. T3/T4 compartilham
`page.tsx` → **não** `[P]` (sequenciais). ✅

### Check 3 — Test Co-location Validation

| Task | Layer criado/modificado | Matriz exige | Task diz | Status |
|---|---|---|---|---|
| T1 | Componente RSC apresentacional (`home-featured-jobs.tsx`) | RTL (unit) — precedente USP-047 | unit (RTL) | ✅ OK |
| T2 | Componente RSC apresentacional (`home-services.tsx`) | RTL (unit) | unit (RTL) | ✅ OK |
| T3 | Composition root Server Component + data load (`page.tsx`) | RTL (unit) via `page.test.tsx` (mock de módulo) — precedente USP-047 | unit (RTL) | ✅ OK |
| T4 | `page.tsx` (data load + hrefs) | RTL (unit) via `page.test.tsx` | unit (RTL) | ✅ OK |
| T5 | Guarda estática `.ts` (`src/shared/**`, entra no gate) + RTL | guarda estática + unit | unit + guarda | ✅ OK |

**Nota:** nenhuma task cria uma **query/Server Action nova** → **nenhum int-test novo** exigido; o `where`
ACTIVE de `searchJobs`/`searchServices` já é coberto por `search-jobs.int.test.ts`/`search-services.int.test.ts`
(AD-021). Não há `Tests: none` por deferimento — cada task carrega os próprios testes executáveis.

---

## Cobertura de Requisitos (spec → tasks)

| Requirement | Task(s) |
|---|---|
| NAV-01 (busca → `/vagas?q=` + vazio) | T5 |
| NAV-02 (destaque vagas ACTIVE reais → `/vagas/{id}` + fallback) | T1, T3 |
| NAV-03 (categorias reais → `/servicos?categoria=<id>` + fallback) | T2, T4 |
| NAV-04 (empresa → `/empresa/cadastrar`; candidato → `/cadastro`) | T4 |
| NAV-05 (nav/header rotas reais + active-state, confirmado) | T5 (confirmação `public-nav.test`) |
| NAV-06 (barrels-only, sem dead ends, sem regressão de contratos) | T3, T4, T5 |
| NAV-MN-01 (destaque sem PII/não-ACTIVE/viewer-real/imports proibidos) | T3 (+ guarda `home-page-static` existente) |
| NAV-MN-02 (sem dead ends / bypass moderação / hex-CDN) | T5 (guarda `nav-no-dead-ends`) |

**Coverage:** 8/8 requisitos mapeados; 0 não mapeados.

---

## MCPs e Skills por task

Nenhuma task requer MCP externo nem skill de terceiros. `context7` disponível se surgir dúvida de API do
Next 15 (`<Link>`/GET forms/ISR), mas o wiring reusa padrões já presentes no repo (não previsto). Sem
`skill-tdad` (unidade net-new sem `expectations-USP-048`; `Tests` populados diretamente, precedente USP-047).
</content>
