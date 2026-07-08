# USP-021 — Buscar vagas (pública) — Refactor (Fase 2 / Design System) — Design

**Spec**: `.specs/features/vagas/usp-021-buscar-vagas-publica/spec.md`
**Status**: Draft

> **Disciplina (AD-015).** Restyle **style-only**: muda-se **markup/classes**; não se tocam queries, View
> Models, semântica GET dos filtros, `revalidate`/ISR nem revalidação on-demand. Os testes existentes
> (integração de `searchJobs` + View specs) são os **testes de preservação**. Ver `project-guideline` (§5
> View Models, §10 UI, §18 DoD) e AD-014.

## 0. Comportamento preservado (fonte da verdade = código)

- **Query** `queries/search-jobs.ts`: WHERE on-read único (`j.status='ACTIVE' AND j.valid_until >=
  hojeSaoPaulo() AND c.is_verified=true`); 6 filtros AND opcionais; busca textual `unaccent` (índice GIN
  `job_search_trgm`) sobre título+descrição+requisitos; `ORDER BY published_at DESC NULLS LAST`;
  paginação obrigatória (`LIMIT/OFFSET`, `SEARCH_PAGE_SIZE=20`); `select` **condicional ao papel**
  (`jobListSelect(authenticated)` — `nomeFantasia` **nunca carregado** p/ anônimo, ADR-0017).
- **View Model** `views/job-list-item.view.ts` + `views/company-display.ts`: `viewJobForVisitor` →
  `companyDisplayName` (**fonte única de anonimização**, ADR-0022); `salaryVisible=false` ⇒ `salary=null`.
- **Rota** `(public)/vagas/page.tsx`: `revalidate=1800` (ADR-0019); lê `searchParams` PT
  (`q/area/regiao/regime/contrato/escolaridade/salarioMin/salarioMax/pagina`), mapeia p/ `SearchJobsFilters`,
  chama `getCurrentPerson()` + `searchJobs`; contagem `aria-live`; paginação preservando filtros;
  revalidação on-demand já cabeada (`NextCacheInvalidation`, transição de moderação).

Nada disso muda. O delta é 100% de apresentação, e **toda** a superfície da USP-021 é **Server Component**.

## 1. Architecture Overview

```mermaid
graph TD
    P["(public)/vagas/page.tsx (Server, ISR 1800)"] -->|searchParams inalterados| Q[searchJobs + viewJobForVisitor]
    P --> F[JobSearchFilters Server - form GET]
    P --> L[JobList Server]
    L --> C[JobCard Server]
    F -->|Input/Label/Button/FormRow| UI[@/shared/ui]
    C -->|Card/Badge| UI
    L -->|Card empty-state| UI
```

## 2. Code Reuse Analysis

### Primitivos do DS a adotar

| Primitivo | Uso | Substitui |
| --- | --- | --- |
| `Card` | raiz do `JobCard`; estado vazio do `JobList`; container do painel de filtros | `<article className="rounded-xl border border-gray-200 bg-white …">`, `border-dashed border-gray-300` |
| `Badge` | pílulas de metadados (área/região/regime/contrato) | `<li className="rounded-full bg-gray-100 … text-gray-700">` |
| `Input` / `Label` | campos de filtro (`q`, `salarioMin/Max`) | `<input className={fieldClass}>` (`focus:ring-blue-200`), `<label className={labelClass}>` |
| `Button` (+`asChild`) | "Filtrar" (submit) e "Limpar" (`asChild` → `<Link>`) | `<button className="bg-blue-600 …">`, `<Link>` cru |
| `FormRow` `cols` | agrupar pares de campos de filtro | grids ad-hoc |

### Padrões existentes (reusar)

- Server Component público `(public)/page.tsx` — padrão de `export const revalidate`.
- Cards já reestilizados da Fase 1 (se houver) — mesmo vocabulário de token.
- **View types intocáveis:** `JobListItem` (o card consome `company.displayName`/`isAnonymized` já
  resolvidos; a camada de componente **nunca** acessa `nomeFantasia`).

## 3. Refactor deltas — `job-card.tsx` (Server Component)

1. `<article className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">`
   → `<Card>` (que já traz `rounded-md border-border bg-surface shadow-sm hover:shadow-md`), envolvendo o
   `<a href={/vagas/${job.id}}>`.
2. Título `<h3 className="text-lg font-semibold text-gray-900">` → token `text-fg` (+ `font-heading` se
   aderente ao protótipo).
3. Empresa `<p className="mt-1 text-sm text-gray-600">{job.company.displayName}</p>` → `text-fg-muted`
   (**displayName preservado** — nunca nome real na camada de componente).
4. Pílulas de metadados `<li className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">` →
   `<Badge variant="gray">` (ou `blue` para a área). Salário/`<time>` com tokens.

**Preservado:** `Intl.NumberFormat` BRL, `formatDate`, `salaryLabel`, o link `/vagas/{id}`, a condição de
salário (`salary != null`).

## 4. Refactor deltas — `job-list.tsx` (Server Component)

1. Estado vazio `<div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">`
   → `<Card>` neutro com `text-fg-muted` (mantém a cópia "Nenhuma vaga encontrada").
2. `<ul className="flex flex-col gap-4">` de `<JobCard>` → manter estrutura, spacing por token.

## 5. Refactor deltas — `job-search-filters.tsx` (Server Component, form GET)

1. Constantes `fieldClass`/`labelClass` (paleta crua) → **remover**; usar `Input`/`Label`.
2. `<form action="/vagas" method="get" className="… rounded-xl border border-gray-200 bg-white …">` →
   envolver em `<Card>`; **`action`/`method` e os `name`s PT preservados** (U21-MN-05).
3. Campos primários (`q` `type="search"`, selects `area`/`regiao`) → `Input`/`Label` + `<select>` com
   token; agrupar com `FormRow` onde couber.
4. `<details ... open={hasMoreFilters}>` "Mais filtros" (secundários: `regime`, `contrato`, `escolaridade`,
   `salarioMin/Max`) → **preservar o `<details>/<summary>`** (progressive enhancement, P-002), reestilizar
   `<summary>` e o conteúdo com tokens.
5. "Filtrar" `<button className="bg-blue-600 …">` → `<Button type="submit" variant="primary">`; "Limpar"
   `<Link href="/vagas">` → `<Button variant="outline" asChild><Link href="/vagas">Limpar</Link></Button>`.

## 6. Refactor deltas — `(public)/vagas/page.tsx` (Server Component, ISR)

1. `<main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">` → manter
   container; título/subtítulo da página com `FormHeader` (ou `<h1 font-heading>` + token); cores → token.
2. Bloco de contagem (`aria-live="polite"`) e `<nav aria-label="Paginação">` (`pageHref`) → reestilizar com
   tokens/`Button` para os links de página; **lógica preservada**.
3. **Preservado sem tocar:** `export const revalidate = 1800`, leitura de `searchParams`, `Promise.all([
   getCurrentPerson(), listApprovedJobAreas(), listActiveRegions()])`, `searchJobs(filters, viewer)`, o
   `metadata` estático.

## 7. Data Models

Nenhum. O schema `Job` (AD-011) e a extensão `unaccent` já existem; o restyle não os toca.

## 8. Error Handling / Empty States

| Cenário | Comportamento (preservado) | Delta |
| --- | --- | --- |
| Nenhuma vaga | estado vazio do `JobList` | `Card` neutro + `text-fg-muted` |
| Filtro sem resultado | mesma via | idem |
| Salário oculto | `salary=null` no View Model | card omite (inalterado) |

## 9. Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Restyle acessar `company.nomeFantasia` diretamente no card (regressão de anonimização) | `job-card.tsx` | Vazamento de nome a anônimo (P-001/E-004) | Componente consome só `displayName`; `job-list-item.view.spec.ts` (anônimo ⇒ sem nome real) é must-not U21-MN-01; anônimo nem recebe o campo (`select` condicional). |
| Converter o form de filtros em client (perde GET/ISR/URL compartilhável) | `job-search-filters.tsx` | Quebra P-002/ISR e o mapeamento de searchParams | Preservar `action="/vagas" method="get"` e `<details>`; guarda U21-MN-05. |
| `Card` com `hover:shadow-md` conflitar com o `<a>` interno (área clicável) | `job-card.tsx` | Regressão de a11y/hit-area | Manter o `<a>` cobrindo o card (padrão atual); revisar foco no light/dark. |
| Guarda estática de paleta crua com falso-positivo | arquivos tocados | Ruído no gate | Guarda restrita a `className`; allowlist padrão `ds-*`. |

## 10. Tech Decisions (não óbvias)

| Decisão | Escolha | Rationale |
| --- | --- | --- |
| Form de filtros permanece GET sem JS | Sim — só restyle | Preserva ISR, URLs compartilháveis e progressive enhancement (P-002). |
| Pílulas → `Badge` | `variant` gray (metadados neutros), blue (área) | Vocabulário do DS; paridade com o protótipo. |
| Teste do restyle | Gate de build + View specs existentes | Todas as telas são Server Component; padrão do repo (AD-015). |

> **Decisões de projeto:** nenhuma nova — consome AD-014/AD-015. Nada a acrescentar em `STATE.md`.
