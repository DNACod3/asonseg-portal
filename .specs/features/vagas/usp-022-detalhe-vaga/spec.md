# USP-022 — Ver detalhe da vaga — Refactor (Fase 2 / Design System) — Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Os requisitos funcionais da USP-022 vivem nos
> artefatos ICE — `docs/IDSD/ice-portal-asonseg/intents/intent-USP-022.md` +
> `docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-022.md` (card da `matriz-conexoes.md`) — e a
> feature **já está implementada e mergeada** em `src/modules/jobs/`. Os IDs **E-001..E-005 / P-001..P-005 /
> L-001..L-003** permanecem **canônicos** e verbatim; esta spec **não os re-deriva**. Ela especifica o
> **delta de refactor da Fase 2**: adotar o Design System (AD-014) na tela de detalhe da vaga, na mesma
> disciplina da Fase 1 (AD-015) — **style-only, comportamento preservado**. IDs locais `U22-*` cobrem só o
> restyle.

## Problem Statement

O detalhe público da vaga (USP-022) está entregue e correto — `getActiveJobDetail` (on-read idêntico à
busca, retorna `null` → "vaga encerrada" em vez de 404 técnico), `viewJobDetail` como **única fonte de
anonimização** (ADR-0022/serializer), limiar do contador de candidaturas `N ≥ 3`
(`APPLICATION_COUNTER_THRESHOLD`, P-001), flags de CTA por papel (`canApply`, `showActivateCandidateCta`),
e — crucialmente — `generateMetadata` + JSON-LD `JobPosting` **sempre anônimos** (`viewJobDetail(row, null)`
independente de quem está logado), com `serializeJsonLd` escapando `<`/`>`/`&`/U+2028/U+2029 (XSS). Porém a
UI — `JobDetailView` (Server Component) e a rota `(public)/vagas/[id]` — usa Tailwind cru (`bg-blue-600`,
`text-gray-900/600`, pílulas `bg-gray-100`, `border-gray-100`) **sem nenhum** primitivo/token de
`@/shared/ui` (AD-014), destoando das telas já reestilizadas na Fase 1. Este refactor aplica o DS ao detalhe
**preservando 100% do comportamento** (anonimização em todos os canais, limiar do contador, estados
não-ativos, CTAs por papel, metadados/JSON-LD), ancorado nos testes existentes usados como preservação.

## Goals

- [ ] **G1** — Reestilizar `JobDetailView` (Server Component) e a casca `(public)/vagas/[id]` com os
      primitivos/tokens do DS (`Card`/`FormCard`, `Badge` para metadados/status, `Button` para os CTAs),
      barrel `@/shared/ui`, com paridade visual ao protótipo em light **e** dark — **sem alterar
      comportamento**.
- [ ] **G2** — Preservar como intocável a fatia de dados/serialização: `getActiveJobDetail` (on-read +
      contagem), `viewJobDetail` (anonimização + limiar do contador + flags por papel), `jobDetailJsonLd` +
      `serializeJsonLd`, e o uso de **`viewJobDetail(row, null)`** no `generateMetadata`/JSON-LD.
- [ ] **G3** — Preservar o comportamento sensível como **testes negativos verdes**: anonimização em todos
      os canais (E-001/P-002), limiar do contador (E-003/P-001), estados não-ativos → `null`/"vaga
      encerrada" sem botão candidatar (E-005/P-004/P-005), botão candidatar **somente exibição** (a ação é
      USP-025), CTA "ativar candidato" para autenticado-sem-papel (E-004/P-003).
- [ ] **G4** — Manter verdes os testes existentes (`get-job-detail.int.test.ts`, `job-detail.view.spec.ts`,
      `job-detail.spec.tsx`) e cobrir o delta de metadados anônimos com um teste que trava P-002.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar `getActiveJobDetail` (WHERE on-read, contagem `applications`), `viewJobDetail`/`companyDisplayName` (anonimização, ADR-0022), o limiar `APPLICATION_COUNTER_THRESHOLD` ou o schema `Application` | Refactor é **só de estilo**. Toda a fatia de leitura, anonimização e limiar é preservada e ancorada nos testes existentes. |
| Alterar `generateMetadata`, `jobDetailJsonLd`, `serializeJsonLd` (lógica/escape) | Anonimização de SEO/OG/JSON-LD em todos os canais (P-002) é comportamento crítico; o restyle não toca a serialização — só a apresentação HTML. |
| Implementar a **ação** de candidatar-se ou o caminho de escrita de `applications` | Downstream — USP-025. Aqui o botão "candidatar-se" é **somente exibição**; o restyle preserva isso. |
| Ativar perfil candidato (USP-009), criar conta (USP-001), expiração por cron (USP-024), edição/pausa (USP-023) | Downstream; o detalhe só linka. |
| Alterar `revalidate`/ISR do detalhe | Cache é comportamento (L-002); preservado (`revalidate=1800`). |
| Novos requisitos funcionais de E-001..E-005 / P-001..P-005 / L-001..L-003 | Já entregues e cobertos pelos testes existentes. |

---

## Assumptions & Open Questions

Modo autônomo — decisões governantes já fixadas pelo dono (AD-015): aplicar DS a todas as telas, preservar
fluxo/arquitetura, mudar só estilo. Restante discricionário do agente (owner: `agent`).

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| `JobDetailView` é Server Component e permanece assim; o restyle é validado pela suíte existente (`job-detail.spec.tsx` RTL + `job-detail.view.spec.ts`) + build. | agent | Restyle mantendo Server Component; preservação via specs existentes; sem converter para client. | Manter server preserva ISR e mantém a anonimização/serialização fora do cliente (ADR-0013 / [[view-model-anonimizacao-nao-basta-rsc-flight]]). | y |
| O botão "candidatar-se" (`canApply`) permanece **somente exibição** (`type="button"`, sem `onClick` de ação) — o disparo é da USP-025. | agent | Restyle troca por `Button` do DS mantendo o comportamento display-only; sem wiring de action. | E-002 aqui é só exibição; wiring seria invadir a USP-025. | y |
| O metadado/JSON-LD anônimo é preservado exatamente; o teste de P-002 verifica que nenhum canal (HTML/OG/Twitter/JSON-LD/canonical) contém `nomeFantasia` para anônimo. | agent | Adicionar/estender teste que assevera ausência do nome real em todos os canais para anônimo; a serialização em si não muda. | P-002 é o must-not de maior custo (LGPD/reputação); trava por teste, não por inspeção. | y |
| Pílulas de metadados (área, região, regime, contrato) viram `Badge`; superfícies de card/seções viram `Card`/`FormCard`; o contador e o estado "vaga encerrada" reestilizados com tokens. | agent | `Badge variant` (blue/gray); `Card`/`FormCard` para seções; contador com token; "vaga encerrada" em `Card` neutro + `Button asChild` p/ `/vagas`. | Primitivos prontos no DS (AD-014); paridade com o protótipo de detalhe. | y |
| Status não-`ACTIVE` continua resolvido **na query** (retorna `null`); o componente nunca decide visibilidade por status — só renderiza o estado "encerrada" quando recebe `null`. | agent | Preservar: componente de página faz `row == null ? <VagaIndisponivel/> : <JobDetailView/>`; sem lógica de status no componente. | On-read é a fonte da verdade (E-005/P-004/P-005); componente não pode reintroduzir vaga não-ativa. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Restyle do componente de detalhe da vaga para o Design System (AD-014) — só estilo ⭐ MVP

**User Story**: Como visitante (anônimo, candidato ou prestador) vendo uma vaga, quero que a página de
detalhe tenha a identidade visual do portal, para ler os dados e decidir candidatar-me com clareza.

**Why P1**: O detalhe é a última tela antes da decisão de candidatura; a consistência visual e a legibilidade
são o objetivo da rodada Fase 2.

**Acceptance Criteria**:

1. QUANDO `JobDetailView` é renderizado ENTÃO o sistema DEVE compor as seções com `Card`/`FormCard`, os
   metadados (área/região/regime/contrato) com `Badge`, e os CTAs com `Button` — importados de
   `@/shared/ui`, **sem** classes de paleta crua (`bg-blue-600`, `text-gray-*`, `bg-gray-100`,
   `border-gray-*`) nem hex literal.
2. QUANDO o detalhe é reestilizado ENTÃO o sistema DEVE **preservar** os dados exibidos e sua origem: a
   Empresa vem de `company.displayName` (já anonimizado/real pelo View Model), o salário respeita
   `salaryVisible`, e o contador só aparece quando `applicationCount != null` (limiar `N≥3`).
3. QUANDO o visitante é **candidato ativo** ENTÃO o botão "candidatar-se" (`canApply`) DEVE ser exibido com
   `Button` do DS **somente como exibição** (a ação é USP-025); quando **autenticado sem papel candidato**,
   o CTA "Ativar perfil candidato" (`showActivateCandidateCta`) → `/candidato`; quando **anônimo**, o CTA
   "Criar conta para candidatar-se" → `/cadastro`.
4. QUANDO a vaga **não** casa o on-read (não-ativa/expirada/Empresa não verificada) ENTÃO a página DEVE
   exibir o estado "Vaga encerrada / temporariamente indisponível" reestilizado + `Button asChild` para
   `/vagas`, **sem** botão candidatar — nunca 404 técnico (comportamento preservado da query).
5. QUANDO o detalhe é aberto em modo escuro ENTÃO o sistema DEVE resolver as cores via tokens
   (`data-theme`) — paridade light/dark.

**Independent Test**: `job-detail.spec.tsx` (RTL) permanece verde e passa a asseverar o uso dos primitivos;
`job-detail.view.spec.ts` verde (anonimização + limiar); abrir `/vagas/[id]` (ativa / encerrada) em
light/dark e confirmar paridade e CTAs por papel.

---

### P1: Restyle da casca de página do detalhe (ISR) + preservação dos metadados anônimos (P-002) ⭐ MVP

**User Story**: Como operador/DPO, quero que o restyle do detalhe preserve a anonimização da Empresa em
todos os canais técnicos (HTML, OG, Twitter, JSON-LD, canonical), para não vazar identidade a anônimos/crawlers.

**Why P1**: P-002 é o must-not de maior custo (LGPD/reputação). O restyle toca `page.tsx`, que hospeda
`generateMetadata` e injeta o JSON-LD — a preservação precisa ser travada por teste.

**Acceptance Criteria**:

1. QUANDO a casca `(public)/vagas/[id]/page.tsx` é reestilizada ENTÃO o sistema DEVE **preservar**
   `export const revalidate = 1800`, o `getCurrentPerson()` + `getActiveJobDetail`, o branch
   `row == null ? <VagaIndisponivel/> : <JobDetailView/>`, e a injeção do `<script type="application/ld+json">`
   **somente** quando `row != null`.
2. QUANDO `generateMetadata`/JSON-LD renderizam ENTÃO o sistema DEVE **preservar** o uso de
   `viewJobDetail(row, null)` (**sempre anônimo**, independente do viewer) e o `serializeJsonLd` (escape XSS).
3. QUANDO um visitante/crawler **anônimo** acessa ENTÃO o sistema NÃO DEVE expor `nomeFantasia` em nenhum
   canal — `<title>`, description, OG, Twitter Card, JSON-LD `hiringOrganization`, URL canônica.
4. QUANDO a página é aberta em modo escuro ENTÃO o sistema DEVE renderizar corretamente via tokens.

**Independent Test**: Teste (integração/render de metadados) confirma que, para anônimo, nenhum canal contém
`nomeFantasia`; `npm run build` compila a rota; abrir vaga ativa e encerrada e confirmar comportamento.

---

## Edge Cases

- QUANDO o restyle é aplicado ENTÃO o sistema DEVE **não** converter `JobDetailView`/página em Client
  Component (preserva ISR e mantém anonimização/serialização fora do cliente).
- QUANDO `applicationCount < 3` ENTÃO o contador DEVE continuar **não** aparecendo (o View Model entrega
  `null`) — o restyle não reintroduz a contagem bruta.
- QUANDO `salaryVisible=false` ENTÃO o salário DEVE continuar omitido (View Model entrega `salary=null`).
- QUANDO a vaga é não-ativa por link direto ENTÃO a página DEVE exibir "vaga encerrada" (nunca 404) e
  **nunca** o botão candidatar (P-005) — inalterado pelo restyle.
- QUANDO um primitivo recebe `className` extra ENTÃO o sistema DEVE mesclar via `cn` sem contradizer tokens.

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Os `MN` de comportamento reusam os **testes existentes**
como testes negativos (o restyle não pode torná-los vermelhos); os `MN` de estilo usam guarda estática.

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U22-MN-01 | QUANDO um **anônimo** (visitante ou crawler) acessa o detalhe ENTÃO o sistema NÃO DEVE expor `nomeFantasia` em **nenhum** canal: HTML visível, payload Flight, OG, Twitter Card, JSON-LD `hiringOrganization`, URL canônica. | Vazamento de identidade de Empresa por qualquer canal técnico (E-001/P-002, LGPD). | T2 (metadados) + T1 (componente) | `job-detail.view.spec.ts` (anônimo ⇒ `displayName` por setor, nunca `nomeFantasia`) + teste de metadados/JSON-LD: nenhum canal contém o nome real para anônimo. |
| U22-MN-02 | QUANDO `applicationCount` é 0, 1 ou 2 ENTÃO o sistema NÃO DEVE exibir o contador de candidaturas. | Efeito psicológico inverso com N baixo (P-001). | T1 (preservação) | `job-detail.view.spec.ts` — N<3 ⇒ `applicationCount = null` (UI não renderiza); N≥3 ⇒ número. |
| U22-MN-03 | QUANDO a vaga **não** está `ACTIVE` (pausada/arquivada/expirada/Empresa rebaixada) ENTÃO o sistema NÃO DEVE renderizar o detalhe navegável nem o botão candidatar — deve exibir "vaga encerrada". | Sinais contraditórios / candidatura a vaga inválida (E-005/P-004/P-005). | T1 (preservação) | `get-job-detail.int.test.ts` — vaga não-ACTIVE/expirada/Empresa não-verificada ⇒ `null`; componente renderiza "vaga encerrada" sem botão candidatar. |
| U22-MN-04 | QUANDO o restyle troca o botão "candidatar-se" por `Button` do DS ENTÃO o sistema NÃO DEVE cabear a ação de candidatura (escrita em `applications`). | Invadir a USP-025 / candidatura silenciosa não intencional. | T1 | `job-detail.spec.tsx` — botão "candidatar-se" é `type="button"` display-only; nenhuma escrita/action disparada. |
| U22-MN-05 | QUANDO `JobDetailView`/página são reestilizados ENTÃO o sistema NÃO DEVE reter utilitário de paleta crua (`bg-blue-600`, `text-gray-*`, `bg-gray-100`, `border-gray-*`) nem hex literal para superfícies temáticas. | "DS construído mas não adotado" — regressão visual / quebra de dark-mode. | T1 (componente) + T2 (página) | Guarda estática (`node:fs`) sobre os arquivos tocados: zero ocorrência de paleta crua/hex. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| E-001 / P-002 (upstream, canônico) | USP-022 | Verified (entregue) | Preservado |
| E-002 (upstream, canônico) | USP-022 | Verified (entregue) | Preservado |
| E-003 / P-001 (upstream, canônico) | USP-022 | Verified (entregue) | Preservado |
| E-004 / P-003 (upstream, canônico) | USP-022 | Verified (entregue) | Preservado |
| E-005 / P-004 / P-005 (upstream) | USP-022 | Verified (entregue) | Preservado |
| L-001 / L-002 / L-003 (upstream) | USP-022 | Verified (entregue) | Preservado |
| U22-STYLE-01 (local) | P1 Restyle detalhe | Tasks | Pending |
| U22-STYLE-02 (local) | P1 Restyle página + metadados | Tasks | Pending |
| U22-MN-01..05 (local) | P1 Restyle / preservação | Tasks | Pending |

- **U22-STYLE-01**: Restyle de `JobDetailView` com `Card`/`Badge`/`Button`/tokens (AC P1-detalhe 1-5).
- **U22-STYLE-02**: Restyle da casca `(public)/vagas/[id]` + preservação dos metadados anônimos (AC P1-página 1-4).

**Coverage:** 13+ itens (6 upstream preservados, 7 locais); 7 locais mapeados a tasks.

---

## Success Criteria

- [ ] `JobDetailView` e a página `/vagas/[id]` usam exclusivamente primitivos/tokens de `@/shared/ui`;
      paridade visual com o protótipo em light e dark.
- [ ] Nenhuma mudança de comportamento: on-read/`null`→"encerrada", anonimização em todos os canais, limiar
      do contador, CTAs por papel, botão candidatar display-only, ISR — todos preservados.
- [ ] Os 5 must-nots têm teste negativo verde (3 de preservação reusam os specs existentes; P-002 reforçado
      por teste de metadados; estilo via guarda).
- [ ] Suíte da USP-022 permanece verde; gates `typecheck`, `lint`, `test`, `test:integration`, `build`.
