# USP-048 — Navegação integrada das telas públicas — Design

> **Modo: Greenfield-adapter (não-ICE).** Sem card em `matriz-conexoes.md` → o Design é **gerado**, mas
> **resolve** e **reutiliza** artefatos reais existentes em vez de re-derivar: os **seams** da USP-047
> (`HOME-14` / `.../usp-047-home-landing/design.md §7`), as queries públicas reais (`searchJobs` USP-021,
> `searchServices`/`listServiceCategories` USP-030), as rotas reais (`/vagas`, `/vagas/[id]`, `/servicos`,
> `/cadastro`, `(app)/empresa/cadastrar`, `/login`), as guardas estáticas da Fase 7 e o padrão de resiliência
> `loadIndicators` (ADR-0026). Nenhuma decisão contradiz ADR/TD; nenhuma reentrada em `architecture-planning-idsd`.

**Spec**: `.specs/features/fachada-publica/usp-048-navegacao-integrada/spec.md`
**Status**: Draft

---

## 1. Visão geral da arquitetura

A USP-048 é **wiring no composition root**. `src/app/(public)/page.tsx` (Server Component, já dono do ISR e
do carregamento dos indicadores) passa a **também** carregar os dados públicos dos destaques e a **passar os
seams** (props/hrefs) para as seções da USP-047. As seções `home-*.tsx` permanecem **apresentacionais** —
recebem props; **não** importam módulos, sessão nem Prisma (guardas `casca-no-auth-pii`/`home-page-static`
seguem verdes). Duas seções ganham uma extensão de seam **mínima e retrocompatível** (um `href` opcional por
card) para poderem apontar ao detalhe/filtro real.

```
src/app/(public)/page.tsx   (Server Component — USP-048 estende o carregamento + passa seams)
  • export const revalidate = 600                         (ADR-0013 — preservado)
  • loadIndicators()  → HomeIndicators                    (USP-041 — preservado)
  • loadFeaturedJobs() → FeaturedJob[]                     (NOVO: searchJobs({page:1}, null) → map → slice 2; try/catch → mock)
  • loadServiceCategoryHrefs() → Record<bucket,string>    (NOVO: listServiceCategories() → resolve /servicos?categoria=<id>; try/catch → /servicos)
  └── compõe, passando os seams:
      ├── <HomeHero indicators jobs={featured}
      │             publicarVagaHref="/empresa/cadastrar" />   (empresa retarget — A-07)
      ├── <HomeHowItWorks />                                    (inalterado)
      ├── <HomePersonas empresaHref="/empresa/cadastrar"       (candidatoHref default /cadastro)
      │                 candidatoHref="/cadastro" />
      ├── <HomeServices categories={realCategoryCards} />       (categorias → filtro real — A-06)
      └── <HomeCta empresaHref="/empresa/cadastrar"
                   candidatoHref="/cadastro" />

Extensões de seam (apresentacionais, retrocompatíveis):
  home-featured-jobs.tsx   FeaturedJob.href?  → card vira <Link href> quando presente (senão, sem link)
  home-services.tsx        categoria.href?    → default = servicosHref; page injeta /servicos?categoria=<id>
```

**Fronteira Server/Client:** inalterada — tudo continua Server Component estático. Os reads rodam no server
(sob ISR); a navegação continua declarativa (`<Link>` / GET form), reproduzindo a **intenção** do
`showPage()` do protótipo via roteamento Next.js (não show/hide client).

**Onde o `showPage()` do protótipo mapeia (fluxo integrado):**

| Protótipo `showPage('…')` | Rota real (USP-048) | Ligado por |
|---|---|---|
| `home` | `/` | logo/nav "Início" (USP-046) |
| `vagas` | `/vagas` (+ `?q=` da busca) | nav "Vagas" + hero "Buscar Vagas" + `HomeSearch` |
| `vaga-detail` | `/vagas/{id}` | **card de destaque de vaga (NAV-02)** |
| `servicos` | `/servicos` (+ `?categoria=` dos cards) | nav "Serviços" + cards/CTA de `HomeServices` |
| `servico-detail` | `/servicos/{id}` | (fora do escopo da home; alcançável pela listagem) |
| `candidato-cadastro` | `/cadastro` | persona "Criar Meu Perfil" + CTA final + header "Cadastrar" |
| `empresa-cadastro` | `/empresa/cadastrar` | **hero "Publicar Vaga" + persona "Cadastrar Empresa" + CTA final (NAV-04)** |
| (login) | `/login` | header "Entrar" (USP-046) |

---

## 2. Code Reuse Analysis

### Componentes/queries/rotas existentes a alavancar

| Reuso | De onde | Como usar |
|---|---|---|
| `searchJobs(filters, viewer)` + `SearchJobsFilters`/`SEARCH_PAGE_SIZE` | `@/modules/jobs` (barrel) | `searchJobs({ page: 1 }, null)` no `page.tsx`; portão `status='ACTIVE' AND valid_until>=hoje AND company.is_verified=true` + View Model anonimizado já aplicados. Fatiar `result.items` para 2. |
| `JobListItem` (type) + `viewJobForVisitor` | `@/modules/jobs` (barrel `views` já embutido no retorno) | `result.items: JobListItem[]` já é o View Model anonimizado; **não** importar `@/modules/jobs/views` direto (guarda). Mapear `item → FeaturedJob`. |
| `searchServices(filters, viewer)` (se necessário) | `@/modules/services` (barrel) | Reservado (A-08 mantém a busca da home só em vagas). **Não usado** nesta USP salvo evolução. |
| `listServiceCategories()` → `ServiceCategoryOption {id,name}` | `@/modules/services` (barrel) | Resolver os 3 buckets do protótipo → `/servicos?categoria=<id>`; fallback `/servicos`. |
| `HomeHero`/`HomeFeaturedJobs`/`HomePersonas`/`HomeServices`/`HomeCta` + seus seams | `src/app/(public)/_components/home-*.tsx` (USP-047) | Passar props/hrefs; estender `FeaturedJob.href?` e `categoria.href?` (mínimo). |
| `getHomeIndicators`/`FALLBACK_INDICATORS`/`childLogger`/`loadIndicators` | `page.tsx` + `@/modules/reporting` | **Preservados**; os novos `load*()` copiam o padrão try/catch → fallback. |
| `Link` (`next/link`) | Next 15 | Card de destaque vira `<Link href>`; CTAs já usam `Button asChild`+`Link`. |
| Guardas `home-page-static`/`casca-no-auth-pii`/`casca-uses-tokens`/`casca-no-external-cdn`/`home-revalidate` | `src/shared/__tests__/` + `src/modules/reporting/__tests__/` | **Já varrem** `page.tsx` e `_components/**`; seguem verdes por construção (barrels não são padrão proibido). |
| Padrão RTL de página com mock de módulo (`vi.hoisted` + `vi.mock('@/modules/…')`) | `src/app/(public)/page.test.tsx` (USP-047) | Estender para mockar também `@/modules/jobs` e `@/modules/services`. |
| `search-jobs.int.test.ts` (portão ACTIVE já testado, AD-021) | `src/modules/jobs/__tests__/` | **Cobre** o `where` da query reusada → **nenhum int-test novo** necessário (nenhuma query nova). |

### Pontos de integração

| Sistema | Método de integração |
|---|---|
| Listagem real de vagas (`/vagas`, USP-021) | GET form `HomeSearch action="/vagas" name="q"`; `vagas/page.tsx` lê `first(sp.q)` (trim). Card de destaque → `/vagas/{item.id}` (`[id]` route). |
| Listagem real de serviços (`/servicos`, USP-030) | Cards de categoria → `/servicos?categoria=<id>`; `servicos/page.tsx` lê `first(sp.categoria)`. "Ver Todos" → `/servicos`. |
| Cadastro de empresa autenticado (`(app)/empresa/cadastrar`) | `<Link href="/empresa/cadastrar">`; `requireActivePerson` redireciona anônimo a `/login` (server-side, comportamento existente — não é dead end). |
| Cadastro de Pessoa (`/cadastro`) | CTAs de candidato (default preservado). |

---

## 3. Components (o que muda)

### `page.tsx` (composition root) — **modificado** (owner NAV-02/03/04/06, NAV-MN-01)

- **Purpose**: carregar os dados públicos dos destaques (anonimizados, resilientes) e passar os seams às seções.
- **Location**: `src/app/(public)/page.tsx`
- **Novos helpers (server-only, no arquivo):**
  - `loadFeaturedJobs(): Promise<FeaturedJob[]>` — `try { const r = await searchJobs({ page: 1 }, null); return r.items.slice(0, 2).map(toFeaturedJob); } catch { return [] }`. `[]` faz `HomeFeaturedJobs` cair no `DEFAULT_JOBS` (mock) via o próprio default da prop.
  - `toFeaturedJob(item: JobListItem): FeaturedJob` — mapeia `{ title: item.title, company: item.company.displayName, tags: [item.area, item.contractType].filter(Boolean), href: `/vagas/${item.id}` }`. **Só campos do View Model** (nunca PII). ⚠️ `item.area` e `item.contractType` são `string | null` já achatados (não `area.name`).
  - `loadServiceCategoryHrefs(): Promise<ServiceCategoryCard[]>` — `listServiceCategories()` → para cada bucket do protótipo, resolve `href = /servicos?categoria=<id>` casando por nome normalizado (ver §5); erro/sem-match → `href = /servicos`.
- **Imports permitidos**: `searchJobs`, `type JobListItem` de `@/modules/jobs`; `listServiceCategories` de `@/modules/services` (barrels — **não** deep `views/`/`actions/`). Mantém `getHomeIndicators` de `@/modules/reporting`.
- **Dependencies**: as queries reusadas; `childLogger` (log de falha, como `loadIndicators`).
- **Reuses**: padrão `loadIndicators` try/catch; `revalidate=600`.

### `home-featured-jobs.tsx` — **estendido** (owner NAV-02, seam A-09)

- **Purpose**: renderizar cards de destaque; quando `href` presente, o card é um `<Link>` para o detalhe.
- **Mudança mínima**: `FeaturedJob` ganha `href?: string`. No `map`, se `job.href` → envolver o `<Card>` em
  `<Link href={job.href} className="block">` (padrão idêntico ao de `HomeServices`); senão, render atual.
- **Retrocompat**: `DEFAULT_JOBS` (mock) não tem `href` → segue sem link (comportamento atual intacto).
- **Reuses**: `Card`, `Badge`, `cn`, `Link`.

### `home-services.tsx` — **estendido** (owner NAV-03, seam A-09)

- **Purpose**: cards de categoria linkando ao filtro real.
- **Mudança mínima**: aceitar `categories?: ServiceCategoryCard[]` (default = os 3 estáticos atuais, cada um
  com `href = servicosHref`). Cada card usa `category.href` no `<Link>` (hoje usa `servicosHref` para todos).
  "Ver Todos os Serviços" continua `servicosHref`.
- **Tipo**: `ServiceCategoryCard = { variant; title; description; icon; href }`.
- **Retrocompat**: sem prop `categories` → 3 cards estáticos com `href=/servicos` (comportamento atual).
- **Reuses**: `Card`, `StepIcon`, `Button`, `Link`, `cn`.

> **Não mudam de assinatura:** `HomeHero` (já tem `jobs?`/`publicarVagaHref?`), `HomePersonas`/`HomeCta` (já
> têm `candidatoHref?`/`empresaHref?`), `HomeSearch` (já GET `/vagas` `name="q"`), `SiteHeader`/`PublicNav`
> (nav primária confirmada). O wiring desses é **só passar props no `page.tsx`**.

---

## 4. Data Models

**Nenhum model Prisma novo, nenhuma migração.** Apenas tipos de view apresentacional (já existentes/estendidos):

```typescript
// home-featured-jobs.tsx (estendido)
export interface FeaturedJob {
  title: string;
  company: string;          // = JobListItem.company.displayName (anonimizado p/ viewer=null)
  tags?: string[];
  iconVariant?: 'blue' | 'orange';
  href?: string;            // NOVO: `/vagas/${id}` quando vivo; ausente no mock
}

// home-services.tsx (estendido)
interface ServiceCategoryCard {
  variant: 'orange' | 'blue' | 'green';
  title: string;
  description: string;
  icon: ReactElement;
  href: string;             // `/servicos?categoria=<id>` (real) ou `/servicos` (fallback)
}
```

`JobListItem` (consumido, **não** redefinido) — de `@/modules/jobs` (`views/job-list-item.view.ts`):
`{ id, title, area: string|null, region: string|null, contractType: string|null, salary: {min,max}|null, company: { displayName: string, isAnonymized: boolean } }` — `area`/`region`/`contractType` **já achatados** para `string|null`; `company.displayName` = "Empresa do setor de …" p/ anônimo (`viewer=null`); **sem** `nomeFantasia`/PII.

---

## 5. Resolução categoria→id (A-06) — resolvendo a fragilidade no design (L-002/L-005)

O protótipo tem 3 buckets fixos (copy/ícones): **"Serviços Domésticos"**, **"Reparos e Manutenção"**,
**"Área Externa"**. `listServiceCategories()` retorna as categorias reais `{id,name}` da taxonomia semeada.

- **Chave de match**: nome **normalizado** (lowercase + remoção de acentos/espaços) do bucket vs. o `name`
  real; escolher a categoria cujo nome normalizado seja igual **ou** contenha a palavra-chave do bucket
  (`domestic`, `repar`/`manuten`, `extern`/`jardin`). A lógica de match vive em um **helper puro testável**
  no `page.tsx` (ou co-localizado), não espalhada.
- **Fallback garantido (contrato)**: qualquer bucket sem match, ou `listServiceCategories()` vazio/erro →
  `href = /servicos`. **Nunca** um id inventado, **nunca** `href="#"`. Isso torna o comportamento
  determinístico e testável independentemente do seed exato (resolve a tensão de fragilidade no spec/design,
  não no implementador).
- **Testabilidade**: `page.test.tsx` mocka `listServiceCategories` com nomes conhecidos → assert `href`
  contém `categoria=<id>`; mocka vazio → assert `href=/servicos`.

---

## 6. Error Handling Strategy (resiliência / ISR / build)

Mesma filosofia do `loadIndicators` (ADR-0026 — tolerância on-read; MEMORY: build é gate confiável mesmo
sem DB porque os loaders têm fallback):

| Cenário | Tratamento | Impacto no visitante |
|---|---|---|
| `searchJobs` lança / DB indisponível (inclusive no `next build`/ISR) | `loadFeaturedJobs` captura, loga (`childLogger`), retorna `[]` → `HomeFeaturedJobs` usa `DEFAULT_JOBS` (mock) | Vê o destaque estático fiel; home compila e carrega |
| `searchJobs` retorna vazio (0 vagas ACTIVE) | `r.items.slice(0,2)` = `[]` → `HomeFeaturedJobs` usa `DEFAULT_JOBS` | Idem (nunca lista vazia/quebrada) |
| `listServiceCategories` lança/vazio | `loadServiceCategoryHrefs` captura → todos os cards com `href=/servicos` | Cards levam à listagem geral (sem pré-filtro) |
| Bucket sem categoria correspondente | `href=/servicos` para aquele card | Idem |
| Anônimo aciona CTA de empresa | `<Link>`→`/empresa/cadastrar`→`requireActivePerson`→`/login` (server) | Vai ao login (fluxo desenhado, não é erro) |

`revalidate = 600` **preservado** (não elevado). Os reads rodam sob ISR (cache 10min) — sem hit por request.

---

## 7. Aplicação dos Must-Nots (enforcement)

| Must-Not | Mecanismo | Owning task |
|---|---|---|
| **NAV-MN-01** (destaque sem PII/não-ACTIVE/viewer-real/imports proibidos) | (a) o read é `searchJobs(..., null)` → View Model anonimizado (`displayName`, nunca `nomeFantasia`); (b) `toFeaturedJob` só copia campos do View Model; (c) `page.test.tsx`: mock retornando `JobListItem` anonimizado → card mostra `displayName`, `queryByText(nomeFantasia)` ausente; (d) `home-page-static.test.ts` **existente** falha se `page.tsx` importar `getCurrentPerson`/`views`/`prisma`/`actions`/`'use server'` — segue verde pois barrels não são proibidos; (e) `casca-no-auth-pii` verde sobre `home-*.tsx` (que permanecem apresentacionais). | T3 |
| **NAV-MN-02** (sem dead end / sem bypass moderação / sem hex-CDN) | (a) nova guarda `nav-no-dead-ends.test.ts` (node:fs) varre `(public)/page.tsx` + `home-*.tsx` por `href="#"`/vazio → `[]`; (b) o filtro ACTIVE é do `searchJobs`/`searchServices` (nenhum Prisma direto na home — guarda existente); (c) `casca-uses-tokens`/`casca-no-external-cdn`/`home-page-static` (hex/paleta/CDN) seguem verdes. Per **L-013**: se a guarda escanear imports, casar `from "x"` **e** bare `import "x"` — aqui o padrão é `href=`, não import, então N/A. | T6 |

> **Discriminação (killable) exigida pelo Verifier:** NAV-MN-01 é morto por um mutante que troque `null` por
> um viewer real (ou `displayName` por `nomeFantasia`) → o teste RTL do card falha. NAV-MN-02 é morto por um
> mutante que reintroduza `href="#"` em qualquer `home-*.tsx` → a guarda `node:fs` acusa o offender.

---

## 8. Estratégia de testes

- **RTL (`.tsx`) — co-locados:**
  - `home-featured-jobs.test.tsx` (estendido): seam `href` isolado (L-014) — `<HomeFeaturedJobs jobs={[{title,company,href:'/vagas/abc'}]}>` renderiza um `<a href="/vagas/abc">`; default mock sem link.
  - `home-services.test.tsx` (estendido): seam `categories` isolado (L-014) — card com `href=/servicos?categoria=x`; sem prop → `href=/servicos`.
  - `home-search.test.tsx` (estendido): `<form method="get" action="/vagas">` + input `name="q"` (termo e vazio) — NAV-01.
  - `page.test.tsx` (migrado): mocka `@/modules/reporting` + `@/modules/jobs` + `@/modules/services`; assert (i) destaque vivo com `displayName` + `href=/vagas/{id}`, sem `nomeFantasia` (NAV-02/MN-01); (ii) fallback ao mock quando `searchJobs` rejeita/vazio; (iii) categoria com `categoria=` vs `/servicos` (NAV-03); (iv) CTAs de empresa `/empresa/cadastrar`, candidato `/cadastro` (NAV-04); (v) indicadores/`<main>`/`<h1>` intactos (NAV-06).
- **Guardas estáticas (`.ts`, entram no gate de cobertura):** nova `nav-no-dead-ends.test.ts` (NAV-MN-02);
  `home-page-static.test.ts`/`casca-*` **existentes** verdes (NAV-MN-01/MN-02 — sanidade após barrels);
  `home-revalidate.test.ts` verde (ISR≤600).
- **Integração:** **nenhum int-test novo** — o `where` ACTIVE de `searchJobs`/`searchServices` já é coberto
  por `search-jobs.int.test.ts`/`search-services.int.test.ts` (AD-021). Nenhuma query nova = nada a testar em DB.
- **Build:** `npm run build` compila `/` com os loaders resilientes (fallback) — confirma que a home
  integrada compila mesmo sem DB no build.
- **Regressão:** suíte pública existente verde; `page.test.tsx` é o teste **editado** (mocks/asserts novos),
  análogo à migração planejada da USP-047.
- **E2E (deferido, DEF-1 / L-007):** um top-flow Playwright "home → busca → /vagas?q= → detalhe" e "home →
  CTA empresa → /login" pode entrar em `e2e/`, **mas** só como `e2e/*.spec.ts` real com asserções vivas
  (nunca skeleton em `.specs/`); não é gate de merge (roda `skipped` em PR comum). Requer seed de vaga
  ACTIVE para o destaque — por isso deferido nesta unidade.

---

## 9. Decisão de projeto (nenhuma nova AD; segue precedentes)

USP-048 **não** propõe ADR/AD novo: reusa **AD-025** (colocação em `(public)/_components/` + padrão de seams,
USP-046), **AD-013** (ISR), **ADR-0017** (visibilidade conservadora / anonimização), **AD-021** (int-test do
`where` na feature dona), **ADR-0026** (tolerância on-read/fallback). O retarget do CTA de empresa reusa a
rota existente `(app)/empresa/cadastrar` (L-011 — não abrir namespace novo). Nenhuma decisão contradiz
ADR/TD; nenhuma reentrada em `architecture-planning-idsd`. (O Planner não edita `STATE.md`; a rodada da
Fase 7 registra AD-025 ao fim, conforme STATE.)

## 10. Lições aplicadas (confirmed + candidatas relevantes)

- **L-007 (confirmed)**: E2E fica deferido; se adicionado, `e2e/*.spec.ts` real, nunca skeleton em `.specs/` → §8 (DEF-1).
- **L-011**: reusar rota existente (`/empresa/cadastrar`) em vez de abrir namespace → A-07.
- **L-013**: guardas `node:fs` de import casam `from "x"` e bare `import "x"` → a guarda de dead-ends usa `href=`, não import (N/A), mas anotado caso vire guarda de import.
- **L-014**: cada seam entregue (`FeaturedJob.href`, `categories`) ganha teste RTL **isolado**, não só via composição → §8.
- **L-002/L-005**: tensão de match frágil (categoria→id) resolvida no design com fallback determinístico → §5.

## 11. Ideias deferidas

- **DEF-1:** E2E dedicado da home integrada (busca→resultado→detalhe; CTA empresa→login) como top-flow real
  em `e2e/` (requer seed de vaga ACTIVE) — L-007.
- **DEF-2:** Busca integrada vagas+serviços no hero e/ou destaque **vivo** de serviços (listagem, não só
  categoria) — se o protótipo evoluir; o seam `action` de `HomeSearch` e um futuro seam de `HomeServices`
  suportam sem reescrever.
- **DEF-3:** Itens de nav "Sou Candidato/Sou Empresa" via `PublicNav.items` (CASCA-15), se fidelidade de nav
  passar a ser exigida (A-04).
</content>
