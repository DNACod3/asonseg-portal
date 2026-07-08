# USP-028 — Empresa buscar candidatos (busca ativa) — Specification

> **Unidade U3 da Fase 3**, planejada em conjunto com a **USP-027** (candidatos da
> vaga). As duas expõem candidatos à Empresa via View Model; **esta** expõe **só
> dados não sensíveis** (busca ativa, sem relação de candidatura). View Model
> irmão (revelação de contato/CV): `../usp-027-empresa-ver-candidatos/design.md`.
>
> **Fonte da verdade upstream**: spec de épico
> `.specs/features/candidaturas-busca-candidatos/spec.md` (história "Empresa buscar
> candidatos", req. **CAN-04**). Os IDs `USP028-NN` decompõem CAN-04.

## Problem Statement

Uma Empresa precisa encontrar talentos **proativamente**, sem depender de receber
candidaturas. Mas um candidato que **não** se candidatou a nenhuma vaga da Empresa
não deu consentimento para expor seu contato àquela Empresa. Logo, a busca ativa
pode expor **apenas dados não sensíveis** do perfil moderado e ativo do candidato
(primeiro nome, cidade/região, área de interesse, escolaridade, resumo de
qualificações) — e **nunca** CPF, contato completo, endereço ou CV. Hoje não existe
nenhuma consulta de busca de candidatos nem View Model correspondente, e o
`CandidateProfile` sequer tem um campo estruturado de localização.

## Goals

- [ ] Permitir que o responsável ativo de uma Empresa liste candidatos com perfil
      **ACTIVE** (moderado) e Pessoa **ATIVO**, ordenados por data de cadastro.
- [ ] Filtrar por **área de interesse, escolaridade, disponibilidade, localização**
      e **texto livre** (sem acento), combinados em AND, com paginação obrigatória.
- [ ] Exibir, por candidato, **só** dados não sensíveis: primeiro nome, cidade/região,
      área de interesse principal, escolaridade e resumo de qualificações — via View
      Model `viewCandidateForSearch`.
- [ ] Garantir que CPF, contato completo, endereço e CV **jamais** sejam carregados
      (SELECT) ou emitidos para candidatos sem candidatura à Empresa — nem no payload
      RSC/Flight.
- [ ] Introduzir o campo estruturado de localização do candidato
      (`CandidateProfile.regionId`) que a busca por localização e a exibição exigem.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Ver contato/CV do candidato | Só via **USP-027** (candidatura ativa dá a base de consentimento). |
| Ranqueamento / matching / score | Épico: busca é por filtros + texto, sem score. |
| Coletar região no formulário de cadastro de candidato (USP-009) | Fora do escopo; USP-009 já entregue. USP-028 **adiciona a coluna**; a coleta no form é **follow-up** (seed popula demo). Ver Assumptions. |
| Busca semântica / FTS | MVP usa match exato + `unaccent` LIKE (mesma abordagem de `search-jobs`). |
| Auditoria de acesso | Dado é **não sensível** → **não** há `SENSITIVE_FIELD_VIEWED` (ver Must-Nots). |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Localização estruturada do candidato | agent | Adicionar `CandidateProfile.regionId String? @map("region_id") @db.Uuid` + relação `Region` (espelha `ProviderProfile.regionId`); migração **desta** USP | Precedente do projeto (AD-011/012): a 1ª USP que precisa do campo cria a migração mínima. `Region` (taxonomia) já existe. | y |
| Coleta de região no cadastro de candidato | agent (follow-up) | **Deferida**: `regionId` nasce `null` para candidatos reais; seed demo popula p/ E2E; exibição mostra "Região não informada" e filtro por localização só casa quem tem região | USP-009 já entregue; reabrir o form é fora do escopo de U3. Estado honesto: feature estruturalmente correta, inerte p/ dados sem região até o follow-up. | y |
| Filtro "disponibilidade" | agent | `availability` é texto livre → filtro por **`unaccent` contains** (case-insensitive) | Não há enum de disponibilidade; contains é determinístico e testável (ex.: "integral" casa "Período integral"). | y |
| Filtro/exibição de escolaridade | agent | Igualdade sobre `educationLevel` (valores de `EDUCATION_LEVELS`); label via `EDUCATION_LEVEL_LABELS` | Já é `String` validado na fronteira (Zod), mesmos valores da vaga. | y |
| "Resumo de qualificações" exibido | agent | `headline` (resumo) + `skillsText` truncado; **não** `experienceText` completo | Mantém "resumo"; campos são conteúdo próprio do candidato (não sensível), análogos à descrição da vaga. | y |
| "Primeiro nome" | agent | Derivado de `Person.fullName` (1º token) no serializer; `fullName` **nunca** emitido | AC pede só primeiro nome; `fullName` é PII → não sai (Must-Not). | y |
| Texto livre busca sobre | agent | `unaccent` LIKE em `headline + skillsText + coursesText + experienceText` (campos não sensíveis) | Mesma técnica de `search-jobs` (`immutable_unaccent`); nunca sobre CPF/contato. | y |
| Autorização | agent | Responsável ativo de Empresa: `viewer.roles.includes('COMPANY_RESPONSIBLE')` (+ página sob `[empresaId]` com `requireActiveResponsible`) | `CurrentPerson.roles` = grants ACTIVE; sem `PermissionId` de empregador. | y |
| Paginação | agent | `take` obrigatório, `SEARCH_PAGE_SIZE = 20`, `ORDER BY created_at DESC` | L-002 + AC "ordenados por data de cadastro". | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Empresa buscar candidatos (busca ativa) ⭐ MVP

**User Story**: Como Pessoa-responsável ativa de uma Empresa, quero buscar candidatos
por filtros (área de interesse, escolaridade, disponibilidade, localização) e texto
livre, vendo só dados não sensíveis, para encontrar profissionais para minhas vagas.

**Why P1**: Permite à Empresa encontrar talentos proativamente, sem depender de
candidaturas recebidas.

**Acceptance Criteria**:

1. WHEN o responsável acessa a busca de candidatos THEN o sistema SHALL listar
   candidatos com `CandidateProfile.publicationStatus = ACTIVE` **e** `Person.status = ATIVO`,
   ordenados por data de cadastro (mais recentes primeiro), paginados. *(USP028-01)*
2. WHEN o responsável aplica filtros (área, escolaridade, disponibilidade, localização,
   texto) THEN o sistema SHALL atualizar a lista respeitando **todos** os filtros (AND). *(USP028-02)*
3. WHEN a lista é exibida THEN o sistema SHALL exibir, por candidato: **primeiro nome**,
   cidade/região, área de interesse principal, escolaridade e resumo de qualificações. *(USP028-03)*
4. WHEN o candidato ainda **não** se candidatou a uma vaga da Empresa THEN o sistema
   SHALL **manter ocultos** CPF, contato completo, endereço e CV — não os carregando
   sequer no SELECT. *(USP028-04 / USP028-MN-01)*
5. WHEN a busca retorna candidatos THEN o sistema SHALL servir os dados via View Model
   `viewCandidateForSearch`, nunca consultando o Prisma diretamente para devolver a
   linha crua de outra Pessoa ao cliente. *(USP028-05 / USP028-MN-02)*

**Independent Test**: Como responsável, executar a busca sem filtros e verificar a
listagem de candidatos **ACTIVE/ATIVO** ordenados por cadastro; aplicar filtros
combinados (área+escolaridade+disponibilidade+localização+texto) e verificar AND;
confirmar que só primeiro nome, cidade/região, área, escolaridade e resumo aparecem,
e que CPF/contato/endereço/CV/sobrenome **não** aparecem no payload — para candidatos
sem candidatura à Empresa.

---

## Edge Cases

- WHEN a busca não retorna nenhum candidato para os filtros THEN o sistema SHALL
  exibir lista vazia com mensagem adequada ("Nenhum candidato encontrado"). *(USP028-07)*
- WHEN um perfil está `DRAFT`/`IN_MODERATION`/`REJECTED`/`ARCHIVED`/`INACTIVATED`
  THEN o sistema SHALL **excluí-lo** dos resultados. *(USP028-MN-03)*
- WHEN a Pessoa do candidato está `INATIVO` THEN o sistema SHALL **excluí-la**. *(USP028-MN-03)*
- WHEN o candidato não tem `regionId` THEN a busca por localização SHALL não casá-lo,
  e a exibição SHALL mostrar "Região não informada" (sem quebrar).
- WHEN o termo de texto excede o teto THEN o sistema SHALL truncá-lo em
  `SEARCH_TERM_MAX` (100). *(defensivo, igual `search-jobs`)*
- WHEN um não-responsável (ou anônimo) tenta a busca THEN o sistema SHALL negar
  (`FORBIDDEN`/redirect) sem retornar candidatos. *(USP028-08)*

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| USP028-MN-01 | na busca ativa, carregar (SELECT) ou emitir `cpf`, `emailLogin`, `phone`, `fullAddress` ou `cvStoragePath` de qualquer candidato | Vazamento de PII a Empresa sem relação de candidatura (inclui payload RSC/Flight) | T2, T3 | unit VM: chaves proibidas ausentes; int: sensor `JSON.stringify` sem CPF/e-mail/telefone/endereço/CV semeados; SELECT não pede esses campos |
| USP028-MN-02 | emitir o **nome completo** do candidato — só o primeiro nome | Exposição de PII (sobrenome) na busca aberta a Empresas | T2, T3 | unit VM: sobrenome semeado ausente do output; int: `JSON.stringify` não contém o sobrenome distintivo |
| USP028-MN-03 | retornar candidatos com `publicationStatus != ACTIVE` ou `Person.status != ATIVO` | Expor perfil não moderado / privado / inativo | T3 | int: semear DRAFT/IN_MODERATION/INATIVO → ausentes; só ACTIVE/ATIVO retorna |
| USP028-MN-04 | retornar mais de `SEARCH_PAGE_SIZE` linhas por chamada (busca sem `take`) | Fetch ilimitado (perf/DoS + PII em massa) — L-002 | T3 | int: semear > page size → `items.length <= SEARCH_PAGE_SIZE`, `total` correto |
| USP028-MN-05 | retornar linha crua de `Person`/`CandidateProfile` do Prisma ao cliente (fora do View Model) | Vazamento de campo por payload Flight | T2, T3 | tipo de retorno = View Model; int sensor de payload |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| USP028-01 | P1 (AC1) | Design | Pending |
| USP028-02 | P1 (AC2) | Design | Pending |
| USP028-03 | P1 (AC3) | Design | Pending |
| USP028-04 | P1 (AC4) | Design | Pending |
| USP028-05 | P1 (AC5) | Design | Pending |
| USP028-07 | Edge (vazio) | Design | Pending |
| USP028-08 | Edge (authz) | Design | Pending |
| USP028-MN-01 | Must-not | Design | Pending |
| USP028-MN-02 | Must-not | Design | Pending |
| USP028-MN-03 | Must-not | Design | Pending |
| USP028-MN-04 | Must-not | Design | Pending |
| USP028-MN-05 | Must-not | Design | Pending |

**ID format:** `USP028-NN` (realizam a req. de épico **CAN-04**); must-nots `USP028-MN-NN`.
**Coverage:** 12 requisitos, todos mapeados a tasks em `tasks.md` (0 unmapped).

---

## Success Criteria

- [ ] Responsável ativo lista candidatos **ACTIVE/ATIVO** por data de cadastro, com
      todos os filtros (área, escolaridade, disponibilidade, localização, texto) em AND
      e paginação obrigatória.
- [ ] Cada card mostra só primeiro nome, cidade/região, área, escolaridade e resumo.
- [ ] CPF, e-mail, telefone, endereço, CV e **sobrenome** nunca são SELECTados nem
      emitidos (sensor de discriminação sobre o payload passa).
- [ ] Perfis não-ACTIVE ou Pessoas INATIVO nunca aparecem.
- [ ] `CandidateProfile.regionId` adicionado (migração aplica limpa); exibição/filtro
      de localização operam sobre ele.
