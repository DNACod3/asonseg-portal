# USP-021 — Buscar vagas (pública) — Refactor (Fase 2 / Design System) — Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais da USP-021 vivem nos
> artefatos ICE — `docs/IDSD/ice-portal-asonseg/intents/intent-USP-021.md` +
> `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-021.md` (card da `matriz-conexoes.md`) — e a
> feature **já está implementada e mergeada** em `src/modules/jobs/`. Os IDs **E-001..E-005 / P-001..P-005 /
> L-001..L-004** permanecem **canônicos** e verbatim; esta spec **não os re-deriva**. Ela especifica o
> **delta de refactor da Fase 2**: adotar o Design System (AD-014) nas telas de busca de vagas, na mesma
> disciplina da Fase 1 (AD-015) — **style-only, comportamento preservado**. IDs locais `U21-*` cobrem só o
> restyle.

## Problem Statement

A busca pública de vagas (USP-021) está entregue e correta — `searchJobs` com filtro on-read
(`ACTIVE AND validUntil>=hojeSP AND company.isVerified`), 6 filtros em AND, busca textual sem acento
(`unaccent`/`pg_trgm`), paginação obrigatória (`take`/`OFFSET`), anonimização no serializer
(`viewJobForVisitor` → `companyDisplayName`, com o nome real nunca sequer carregado para anônimo, ADR-0017)
e ISR (`revalidate=1800`, ADR-0019). Porém a UI — `JobSearchFilters` (Server Component, form GET),
`JobCard`, `JobList` (Server Components) e a rota `(public)/vagas` — usa Tailwind cru (`bg-blue-600`,
`text-gray-*`, `border-gray-200`, `focus:ring-blue-200`, pílulas `bg-gray-100`) **sem nenhum** primitivo/token
de `@/shared/ui` (AD-014), destoando das telas já reestilizadas na Fase 1. Este refactor aplica o DS às
telas de busca **preservando 100% do comportamento** (filtro on-read, anonimização, paginação, ISR,
semântica GET dos filtros), ancorado nos testes de integração/View Model existentes usados como testes de
preservação.

## Goals

- [ ] **G1** — Reestilizar `JobSearchFilters`, `JobCard`, `JobList` e a rota `(public)/vagas` com os
      primitivos/tokens do DS (`Card`, `Badge`, `Button`, `Input`/`Label` para os campos de filtro), barrel
      `@/shared/ui`, com paridade visual ao protótipo em light **e** dark — **sem alterar comportamento**.
- [ ] **G2** — Preservar a fatia de dados intocada: `searchJobs` (on-read + 6 filtros AND + `unaccent` +
      `take`), `viewJobForVisitor` (anonimização), o `select` condicional ao papel (nome real nunca
      carregado p/ anônimo), a ordenação `publishedAt DESC` e `revalidate=1800` + revalidação on-demand.
- [ ] **G3** — Preservar a semântica **GET compartilhável** dos filtros (form `action="/vagas"
      method="get"` com os nomes PT `q/area/regiao/regime/contrato/escolaridade/salarioMin/salarioMax/pagina`)
      e o layout **não opressivo** (P-002: 2-3 filtros prioritários visíveis + `<details>` "Mais filtros").
- [ ] **G4** — Preservar o comportamento sensível como **testes negativos verdes**: anonimização
      (E-004/P-001), Empresa não verificada oculta (P-005), vaga expirada oculta on-read (P-003), campos
      restritos não expostos (P-004); e cobrir o restyle com guarda de estilo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar `searchJobs` (WHERE on-read, filtros AND, `unaccent`, `select`, paginação, ordenação) ou o schema `Job` (AD-011) | Refactor é **só de estilo**. A fatia de leitura e a anonimização são preservadas e ancoradas nos testes existentes. |
| Alterar `viewJobForVisitor`/`companyDisplayName` (fonte única de anonimização, ADR-0022) | A anonimização é comportamento crítico (P-001/E-004); o restyle não a toca — só consome `company.displayName` já resolvido. |
| Mudar os nomes dos searchParams, o método GET dos filtros, ou a paginação por `?pagina=` | Quebraria URLs compartilháveis, ISR e o mapeamento PT→EN da página. |
| Alterar `revalidate`/revalidação on-demand (`NextCacheInvalidation`, ADR-0019) | Cache é comportamento (L-004); preservado. |
| Detalhe da vaga (OG/JSON-LD por vaga), expiração por cron, candidatura | Downstream — USP-022 / USP-024 / USP-025. |
| Novos requisitos funcionais de E-001..E-005 / P-001..P-005 / L-002/L-004 | Já entregues e cobertos pelos testes existentes. |
| Introduzir busca com JS/client-side no form de filtros | O form é Server Component GET (sem JS); converter para client não é objetivo do restyle e perderia a graça do progressive-enhancement. |

---

## Assumptions & Open Questions

Modo autônomo — decisões governantes já fixadas pelo dono (AD-015): aplicar DS a todas as telas, preservar
fluxo/arquitetura, mudar só estilo. Restante discricionário do agente (owner: `agent`).

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Todas as telas da USP-021 são **Server Components** (o form de filtros é GET sem JS); o restyle é validado por build + os View Model specs existentes, sem novos testes RTL de página. | agent | Restyle com gate de build; preservação via `search-jobs.int.test.ts` + `job-list-item.view.spec.ts`; guarda estática de estilo. | Padrão do repo p/ Server Component restilizado (AD-015: só `login`/`redefinir-senha` têm teste de página). | y |
| Os `<select>`/`<input type="search">`/`<input type="number">` dos filtros permanecem nativos, estilizados por tokens (`Input`/`Label` do DS onde couber), sem novo primitivo de combobox. | agent | Reusar `Input`/`Label` + classes token; **não** criar Select no escopo. | O DS (AD-014) não exporta Select; manter GET sem JS exige controles nativos. | y |
| O card de vaga (`JobCard`) passa a compor `Card` do DS; as pílulas de metadados (área/região/regime/contrato) viram `Badge` do DS. | agent | `Card` como raiz do card; `Badge variant` (blue/gray) para as pílulas; título/salário/data com tokens. | O DS tem `Card` e `Badge` prontos (AD-014); paridade com o protótipo de card público. | y |
| O `<details>` "Mais filtros" (P-002 não-opressivo) é preservado como mecanismo de expansão (progressive enhancement), só reestilizado. | agent | Manter `<details>/<summary>`; reestilizar com tokens; **não** trocar por accordion client. | Preserva mobile-first sem JS e o comportamento P-002; troca por client seria mudança de fluxo. | y |
| A anonimização não é responsabilidade da UI — os componentes recebem `company.displayName` já resolvido; o restyle não pode introduzir nenhum campo de nome real. | agent | Componentes seguem consumindo `JobListItem.company.displayName`/`isAnonymized`; nenhum acesso a `nomeFantasia` na camada de componente. | Fonte única no View Model (ADR-0022 / [[view-model-anonimizacao-nao-basta-rsc-flight]]); anônimo nem recebe o nome no payload. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Restyle da lista e do card de vagas para o Design System (AD-014) — só estilo ⭐ MVP

**User Story**: Como visitante (anônimo ou autenticado) buscando vagas, quero que a lista de resultados e
os cards de vaga tenham a identidade visual do portal, para uma experiência de descoberta coesa e legível.

**Why P1**: A busca pública é o principal vetor de descoberta (maior tráfego anônimo, RP-009); a
consistência visual é o objetivo da rodada Fase 2.

**Acceptance Criteria**:

1. QUANDO `JobList`/`JobCard` são renderizados ENTÃO o sistema DEVE compor o card com `Card` do DS e as
   pílulas de metadados com `Badge` do DS, importados de `@/shared/ui`, **sem** classes de paleta crua
   (`bg-blue-600`, `text-gray-*`, `border-gray-200`, `bg-gray-100`) nem hex literal.
2. QUANDO um card é renderizado ENTÃO o sistema DEVE exibir os mesmos dados de hoje (título, Empresa —
   **`company.displayName` já resolvido**, área, região, regime, contrato, salário se visível, data) e
   manter o link `/vagas/{id}` para o detalhe — sem acesso a nome real na camada de componente.
3. QUANDO a lista está vazia ENTÃO o sistema DEVE manter o estado "Nenhuma vaga encontrada" reestilizado
   com tokens (sem `border-dashed` de paleta crua).
4. QUANDO as telas são abertas em modo escuro ENTÃO o sistema DEVE resolver as cores via tokens
   (`data-theme`) — paridade light/dark.

**Independent Test**: `npm run build` compila as rotas; guarda estática confirma ausência de paleta crua nos
arquivos tocados; abrir `/vagas` em light/dark e confirmar paridade; `job-list-item.view.spec.ts` permanece
verde (anonimização preservada).

---

### P1: Restyle do painel de filtros e da página de busca (ISR) — só estilo ⭐ MVP

**User Story**: Como visitante, quero filtrar vagas por área/região/regime e busca textual num painel
limpo e não opressivo, com a identidade do portal, para achar vagas relevantes sem fricção.

**Why P1**: O painel de filtros é a superfície de interação da busca; P-002 (não opressivo) é requisito.

**Acceptance Criteria**:

1. QUANDO `JobSearchFilters` é renderizado ENTÃO o sistema DEVE usar `Input`/`Label`/`Button` do DS e
   tokens, **preservando** o `<form action="/vagas" method="get">` e os nomes de searchParam PT
   (`q/area/regiao/regime/contrato/escolaridade/salarioMin/salarioMax`).
2. QUANDO o painel é reestilizado ENTÃO o sistema DEVE **preservar** o layout P-002: filtros prioritários
   (busca + área + região/regime) visíveis e os demais (escolaridade, contrato, faixa salário) dentro do
   `<details>` "Mais filtros" (progressive enhancement, mobile-first), com os botões "Filtrar" (`Button`
   primário) e "Limpar" (`Button` `asChild` para `<Link href="/vagas">`).
3. QUANDO a página `(public)/vagas` é renderizada ENTÃO o sistema DEVE **preservar** `export const
   revalidate = 1800`, a leitura de `searchParams`, a chamada a `getCurrentPerson()` + `searchJobs`, a
   contagem de resultados (`aria-live`) e a paginação (`?pagina=` preservando filtros).
4. QUANDO a página é aberta em modo escuro ENTÃO o sistema DEVE renderizar corretamente via tokens.

**Independent Test**: Abrir `/vagas?area=…&regiao=…&q=…` em light/dark e confirmar filtros aplicados e
paridade; `npm run build` compila a rota; `search-jobs.int.test.ts` permanece verde (filtro/paginação/busca
preservados).

---

## Edge Cases

- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** converter os Server Components de busca em
  Client Components (preserva ISR e mantém a lógica de anonimização fora do cliente).
- QUANDO uma vaga tem `salaryVisible=false` ENTÃO o card DEVE continuar omitindo o salário (o View Model
  já entrega `salary=null`) — o restyle não reintroduz o valor.
- QUANDO o termo de busca tem acento/caixa diferente ENTÃO a busca DEVE continuar casando via `unaccent`
  (inalterado — comportamento de dados).
- QUANDO um primitivo recebe `className` extra ENTÃO o sistema DEVE mesclar via `cn` sem contradizer
  classes de token.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Os `MN` de comportamento reusam os **testes de integração
/ View Model existentes** como testes negativos (o restyle não pode torná-los vermelhos); os `MN` de estilo
usam guarda estática.

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U21-MN-01 | QUANDO um visitante **anônimo** vê a lista/o card ENTÃO o sistema NÃO DEVE expor o nome real da Empresa (`nomeFantasia`) em nenhum campo — só o rótulo por setor. | Vazamento de identidade de Empresa a anônimo (E-004/P-001, ADR-0017). | T1 (preservação) | `job-list-item.view.spec.ts` — anônimo ⇒ `company.displayName = "Empresa do setor de X"`, `isAnonymized=true`, `nomeFantasia` ausente; autenticado ⇒ nome real. |
| U21-MN-02 | QUANDO a busca é executada ENTÃO o sistema NÃO DEVE listar vaga de Empresa **não verificada**, nem vaga **não `ACTIVE`**, nem vaga com **validade vencida** (mesmo se o job de expiração atrasou). | Conteúdo não moderado / de empresa-fantasma / expirado aparecendo ao público (P-003/P-005). | T2 (preservação) | `search-jobs.int.test.ts` — só `ACTIVE`+não-expirada+`company.isVerified` aparece; expirada por validade some com status `ACTIVE`. |
| U21-MN-03 | QUANDO o endpoint público responde ENTÃO o sistema NÃO DEVE expor dados restritos por ADR-0017 (contato, dados de responsáveis, `companyId` cru p/ anônimo). | Vazamento de PII/dados sensíveis pelo payload (P-004). | T2 (preservação) | `search-jobs.int.test.ts` / `job-list-item.view.spec.ts` — `select` explícito; nenhum campo restrito no `JobListItem`. |
| U21-MN-04 | QUANDO `JobSearchFilters`/`JobCard`/`JobList`/página são reestilizados ENTÃO o sistema NÃO DEVE reter utilitário de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-*`, `bg-gray-100`) nem hex literal para superfícies temáticas. | "DS construído mas não adotado" — regressão visual / quebra de dark-mode. | T1 (card/list) + T3 (filtros/página) | Guarda estática (`node:fs`) sobre os arquivos tocados: zero ocorrência de paleta crua/hex. |
| U21-MN-05 | QUANDO o painel de filtros é reestilizado ENTÃO o sistema NÃO DEVE despejar os 6 filtros numa barra opressiva (todos visíveis) nem alterar os nomes de searchParam / o método GET. | Quebra do requisito de usabilidade P-002 e das URLs compartilháveis/ISR. | T3 | Guarda estática/render — `<details>` "Mais filtros" presente com os filtros secundários; `method="get"` e nomes PT preservados. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| E-001 (upstream, canônico) | USP-021 | Verified (entregue) | Preservado |
| E-002 (upstream, canônico) | USP-021 | Verified (entregue) | Preservado |
| E-003 (upstream, canônico) | USP-021 | Verified (entregue) | Preservado |
| E-004 / P-001 (upstream) | USP-021 | Verified (entregue) | Preservado |
| E-005 (upstream, canônico) | USP-021 | Verified (entregue) | Preservado |
| P-003 (upstream, canônico) | USP-021 | Verified (entregue) | Preservado |
| P-004 (upstream, canônico) | USP-021 | Verified (entregue) | Preservado |
| P-005 (upstream, canônico) | USP-021 | Verified (entregue) | Preservado |
| P-002 (upstream — UI não opressiva) | USP-021 | Verified (entregue) | Preservado |
| L-002 / L-004 (upstream) | USP-021 | Verified (entregue) | Preservado |
| U21-STYLE-01 (local) | P1 Restyle card/lista | Tasks | Pending |
| U21-STYLE-02 (local) | P1 Restyle filtros/página | Tasks | Pending |
| U21-MN-01..05 (local) | P1 Restyle / preservação | Tasks | Pending |

- **U21-STYLE-01**: Restyle de `JobCard`/`JobList` com `Card`/`Badge`/tokens (AC P1-lista 1-4).
- **U21-STYLE-02**: Restyle de `JobSearchFilters` + página `(public)/vagas` (AC P1-filtros 1-4).

**Coverage:** 15+ itens (10 upstream preservados, 7 locais); 7 locais mapeados a tasks.

---

## Success Criteria

- [ ] `JobSearchFilters`, `JobCard`, `JobList` e a página `/vagas` usam exclusivamente primitivos/tokens de
      `@/shared/ui`; paridade visual com o protótipo em light e dark.
- [ ] Nenhuma mudança de comportamento: `searchJobs` (on-read/filtros/unaccent/paginação/ordenação),
      anonimização, semântica GET, ISR — todos preservados.
- [ ] Os 5 must-nots têm teste negativo verde (3 de preservação reusam integração/View specs; 2 de estilo
      via guarda).
- [ ] Suíte da USP-021 permanece verde; gates `typecheck`, `lint`, `test`, `test:integration`, `build`.
