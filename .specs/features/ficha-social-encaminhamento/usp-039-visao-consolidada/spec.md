# USP-039 — Visão consolidada da Pessoa (Specification)

> **Fonte da verdade (upstream, não re-derivar).** Esta USP adapta a spec de épico
> `.specs/features/ficha-social-encaminhamento/spec.md` (história P1 "Visão consolidada da
> Pessoa", AC-1..AC-4 + o edge case do coordenador). O ID de rastreabilidade **`SOC-06`** do
> épico é canônico aqui — não invento um conjunto paralelo. Contratos técnicos pré-definidos:
> `docs/arch/technical-design.md` §Fase 5 (View Model **`viewPersonForSocialAssistant`**,
> consolidado) e §"role Role" (enum `SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR`/`VOLUNTEER`).
> PRD `docs/prd/prd-asonseg-portal-mvp.md` (Épico 9 / USP-039). PROJECT.md §LGPD
> ("visibilidade por papel", "dado sensível").

**Unidade:** U3 (capstone de leitura) da Fase 5 · **Epic:** `ficha-social-encaminhamento`
**Deps:** USP-036 (ficha — satisfeita nesta branch); lê naturalmente dados de USP-037/038
(encaminhamentos) e das Fases 2–4 (candidaturas, serviços, manifestações, vínculos). · **Gate:** —
**Módulo dono do View Model:** `persons` (`viewPersonForSocialAssistant` é View Model de Pessoa, TD §Fase 5).

---

## Problem Statement

A AS/diretoria precisa de uma **visão integral** da relação de uma Pessoa com a ASONSEG num
**painel único**: dados pessoais, papéis ativos, ficha socioeconômica (dado **sensível**),
candidaturas (ativas e históricas), encaminhamentos e resultados, serviços oferecidos,
manifestações de interesse e papéis organizacionais (vínculos Pessoa↔Empresa). Hoje esses dados
vivem espalhados por 5 módulos e não há um ponto único que os consolide **respeitando a
visibilidade por papel** — em especial, a ficha socioeconômica (renda/benefício/moradia/
composição) não pode aparecer para um **coordenador**, e um **voluntário comum** não pode acessar
o painel de forma alguma. Esta USP é **somente leitura** e **crítica de privacidade**.

## Goals

- [ ] Servir à AS/diretoria (`SOCIAL_ASSISTANT`/`BOARD`) um painel único com **todas** as dimensões da Pessoa.
- [ ] Servir ao **coordenador** (`COORDINATOR`) o mesmo painel **sem** os campos sensíveis da ficha socioeconômica (visibilidade por papel).
- [ ] **Negar** por completo o acesso ao **voluntário comum** (`VOLUNTEER` sem papel autorizado) — na rota e na montagem.
- [ ] Montar o painel via o View Model **`viewPersonForSocialAssistant`**, **fonte única de anonimização**, compondo os reads por-dimensão já existentes (sem Prisma cru cross-Person).
- [ ] Garantir, por **defesa em 2 barreiras**, que os campos sensíveis da ficha **nunca** sejam SELECIONADOS do DB nem serializados no payload RSC/Flight para um coordenador (ou qualquer viewer não-AS/BOARD).

## Out of Scope

| Feature | Reason |
|---|---|
| Qualquer **escrita** (editar ficha, encaminhar, registrar resultado) a partir do painel | USP-039 é read-only. Edição da ficha = USP-036 (`ficha-social`); encaminhar = USP-037; resultado = USP-038. O painel pode **linkar** para essas telas, não executá-las. |
| **Scoping por área** do coordenador (restringir *quais* Pessoas um coordenador pode abrir) | Não há vínculo Pessoa↔área modelado no MVP; `DelegatedPermission.scopeArea` governa permissões delegadas, não visibilidade de Pessoa. Coordenador abre o painel operacional de qualquer Pessoa, como já faz na tela de gestão (USP-007). Ver Assumption #3 (**flag LGPD-adjacente**). |
| Novo model / migração | USP-039 é agregação de leitura; todos os models já existem (`SocioeconomicRecord`, `Application`, `Referral`, `Service`, `ServiceInterest`, `PersonCompanyGrant`). **Sem migração.** |
| Enriquecer "dados pessoais" com CPF/endereço/contato no painel | O View Model base (`viewPersonForStaff`) expõe nome/status/papéis/inativação; adicionar PII exigiria re-derivar a privacidade de identidade. Fora do escopo; ver Assumption #2. |
| Entidade Família estruturada / triagem | Fora do MVP (ADR-0012). |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|---|
| 1 | **Conjunto de papéis autorizados a abrir o painel = `{SOCIAL_ASSISTANT, BOARD, COORDINATOR}`.** Voluntário comum (`VOLUNTEER`) e demais papéis (CANDIDATE/PROVIDER/CLIENT/COMPANY_RESPONSIBLE) → **negado**. | agent | Guarda de domínio `canViewConsolidatedPerson(roles)` = contém `SOCIAL_ASSISTANT` ∨ `BOARD` ∨ `COORDINATOR`. | Espelha **exatamente** `ACCESS_REPORT_ROLES = ['SOCIAL_ASSISTANT','BOARD','COORDINATOR']` do precedente `reporting/actions/access-report.ts` (mesmo "painel consolidado de Pessoa"), e a área de gestão de Pessoa já serve coordenador/diretoria (USP-007). AC-039-1 (AS/BOARD tudo) + AC-039-3 (coordenador operacional) ⇒ os três autorizados; AC-039-2 nega voluntário. | y |
| 2 | **"Dados pessoais + papéis ativos" = os campos de `viewPersonForStaff`** (id, nome, status, papéis ATIVOS, metadados de inativação). **Sem** CPF/endereço/contato no painel. | agent | Compor `viewPersonForStaff(personId)` como a dimensão de identidade. | É um View Model de privacidade já existente (staff vê outra Pessoa) e evita re-derivar a privacidade de identidade / scope creep. **Flag:** se a AS precisar de contato/CPF no painel, estender `viewPersonForStaff` é follow-up (não desta USP). | n |
| 3 | **Coordenador vê "dados operacionais relevantes à sua área" ≡ todas as dimensões operacionais EXCETO a ficha socioeconômica sensível.** O scoping *por área* (quais Pessoas) **não** é modelado no MVP. | agent (base legal/escopo confirmável por **DPO/diretoria**) | Coordenador: painel completo **menos** a ficha (renda/benefício/moradia/composição). Sem restrição de *quais* Pessoas pode abrir. | Não há vínculo Pessoa↔área no schema; restringir por área exigiria modelagem net-new fora do escopo. A ficha é a única dimensão sensível (USP-036 já a restringe a AS/BOARD). **A implementação NÃO depende disso** (default é implementável) → não abre Entry Gate. **FLAG LGPD-adjacente ao dono** no retorno do Planner. | n |
| 4 | **Auditoria de abertura do painel = reusar `SENSITIVE_FIELD_VIEWED`** disparado pela leitura da ficha (`getSocioeconomicRecord`) quando o viewer é AS/BOARD. **Sem** novo evento `PERSON_CONSOLIDATED_VIEW_ACCESSED`. | agent | Quando AS/BOARD abre o painel e a ficha existe, `getSocioeconomicRecord` (reusado) já grava `SENSITIVE_FIELD_VIEWED`. Coordenador não lê a ficha ⇒ nenhum `SENSITIVE_FIELD_VIEWED` (correto: não viu dado sensível). | Consistente com USP-036/027/035 (audit-on-read). Adicionar evento novo ao catálogo fechado exigiria ADR/runbook (header de `events.ts`) — desnecessário: o acesso sensível real é a ficha, já auditada. | y |
| 5 | **`viewPersonForSocialAssistant` mora em `persons`, mas NÃO importa os barrels `jobs`/`referrals`/`services`/`companies`** (risco de ciclo de módulo, lição AD-019 — o barrel `@/modules/persons` arrasta Prisma p/ o bundle e cria import circular). A **página `(app)`** (raiz de composição) busca as dimensões cross-módulo e as passa ao assembler. | agent | O assembler em `persons` importa **só** o seu próprio read da ficha (`getSocioeconomicRecord`) + `viewPersonForStaff`; recebe as demais dimensões já buscadas como input tipado. A página orquestra os fetches (importa cada barrel). | Mantém `persons` como *sink* (sem depender de jobs/referrals/services/companies) → sem ciclo. O assembler continua sendo a **fonte única de anonimização + gate da ficha** (AC-039-4). Padrão: páginas são a raiz de composição (como a página da ficha compõe `viewPersonForStaff` + `getSocioeconomicRecord`). | y |
| 6 | **Rota = `(app)/pessoas/[id]/visao-consolidada`** (sub-rota irmã de `ficha-social`), **não** sobrepor a página `(app)/pessoas/[id]` (gestão/inativação USP-007). | agent | Nova sub-rota dedicada ao painel consolidado, ao lado de `ficha-social`. | Reusa a família de rotas de gestão de Pessoa (onde a ficha da USP-036 vive); isola a composição role-condicional + guarda mais estrita sem regredir a página de inativação (USP-007). Espelha o precedente irmão `ficha-social`. | y |
| 7 | **Painel read-only, sem consent gate.** Base legal = legítimo interesse / mandato institucional (mesma da leitura da ficha na USP-036). | agent | Não exigir `requireActiveConsent`. | Coerente com USP-036 (leitura da ficha) e com o precedente `access-report` (relatório de acesso da Pessoa, gated só por papel). | y |
| 8 | **Dimensões de lista são paginadas com `take`** (candidaturas, encaminhamentos, serviços, manifestações, vínculos) — teto de linhas por dimensão, sem N+1. | agent | `take` explícito por read (ex.: 20–100 conforme precedente do módulo); `select` restrito (nunca PII de terceiros — cpf/endereço/contato). | CLAUDE.md (paginação obrigatória; `select`/`take`; anti-N+1). Volume MVP é baixo, mas o teto é obrigatório. | y |

**Open questions:** none — todas resolvidas ou registradas acima. Nenhum item com owner **externo**
de que a **implementação dependa** → **Entry Gate fechado** (ver `tasks.md` §0). Assumptions #2 e #3
são flagadas ao dono no retorno do Planner por serem LGPD/privacidade-adjacentes, mas não bloqueiam
(defaults = precedente/edge case, implementáveis).

---

## User Story

### P1: Visão consolidada da Pessoa ⭐ MVP

**User Story**: Como **assistente social ou diretoria**, quero abrir a ficha de uma Pessoa e ver
dados pessoais, papéis ativos, ficha socioeconômica, candidaturas ativas e históricas,
encaminhamentos, serviços oferecidos, manifestações de interesse e papéis organizacionais na
ASONSEG, para que eu tenha visão integral da relação da Pessoa com a ASONSEG.

**Why P1**: Prioridade *Must* no PRD (USP-039). Consolida todas as dimensões da Pessoa para
subsidiar o acompanhamento social e a tomada de decisão.

**Acceptance Criteria** (todas rastreiam a `SOC-06`):

1. **[SOC-06 / AC-039-1]** WHEN um viewer autorizado com papel `SOCIAL_ASSISTANT` ou `BOARD` abre a ficha consolidada de uma Pessoa THEN o sistema SHALL exibir, em painel único, **todas** as dimensões: dados pessoais + papéis ativos, ficha socioeconômica, candidaturas (ativas e históricas), encaminhamentos, serviços oferecidos, manifestações de interesse e papéis organizacionais (vínculos Pessoa↔Empresa).
2. **[SOC-06 / AC-039-2]** WHEN um **voluntário comum** (`VOLUNTEER` sem `SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR`) tenta acessar a visão consolidada THEN o sistema SHALL **negar o acesso** (`notFound()` na rota; assembler retorna `null`) e não retornar nenhuma dimensão da Pessoa.
3. **[SOC-06 / AC-039-3]** WHEN um `COORDINATOR` acessa a visão consolidada THEN o sistema SHALL exibir apenas os dados operacionais (todas as dimensões **exceto** a ficha socioeconômica sensível), respeitando a visibilidade por papel.
4. **[SOC-06 / AC-039-4]** WHEN os dados da Pessoa são montados para exibição THEN o sistema SHALL fazê-lo via View Model **`viewPersonForSocialAssistant`**, que controla a visibilidade dos campos por papel do visualizador — **fonte única de anonimização** do painel.

**Independent Test**: Logado como AS, abrir a ficha consolidada de uma Pessoa com encaminhamentos,
candidaturas e ficha social e confirmar que **todas** as dimensões aparecem no painel único; logar
como **voluntário comum** e confirmar negação de acesso; logar como **coordenador** e confirmar
acesso ao painel operacional **sem** os campos sensíveis da ficha (nenhum valor de renda/benefício/
moradia/composição no que é servido).

---

## Edge Cases

- **[SOC-06]** WHEN um `COORDINATOR` acessa a visão consolidada (dado sensível fora do escopo AS/diretoria) THEN o sistema SHALL **omitir os campos da ficha socioeconômica no View Model** — e, por defesa em profundidade, **não SELECIONÁ-los do DB** (o assembler não chama `getSocioeconomicRecord` para não-AS/BOARD), de modo que nenhum valor sensível entra no payload RSC/Flight. *(Este é o edge case do épico e a essência do SOC-039-MN-01.)*
- WHEN a Pessoa **não tem** ficha socioeconômica ainda THEN o painel (para AS/BOARD) SHALL exibir a seção da ficha como "sem registro" (`null`), sem erro; **nenhum** `SENSITIVE_FIELD_VIEWED` é gravado (nada sensível foi lido).
- WHEN a Pessoa **não tem** candidaturas/encaminhamentos/serviços/manifestações/vínculos THEN cada dimensão SHALL exibir estado vazio ("nenhum registro"), sem erro.
- WHEN a Pessoa está **inativa** (`PersonStatus.INATIVO`) THEN o painel SHALL exibi-la normalmente (status + metadados de inativação de `viewPersonForStaff`), mantendo a restrição de acesso por papel.
- WHEN a Pessoa **não existe** THEN a rota SHALL responder `notFound()` (assembler retorna `null`), sem vazar existência.
- WHEN qualquer dimensão de lista excede o teto THEN o read SHALL paginar via `take` (sem carregar tudo em memória; sem N+1).

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo que asserta que o
resultado proibido não ocorre (ver `validate.md` §6b). Uma mutação que remova a barreira deve
tornar o teste **vermelho** (discriminação).

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **SOC-039-MN-01** | WHEN o painel consolidado é montado para um viewer **sem** `SOCIAL_ASSISTANT`/`BOARD` (coordenador ou qualquer não-AS/BOARD autorizado) THEN o sistema SHALL NOT SELECIONAR do DB, incluir no `ConsolidatedPersonView` retornado, nem serializar no payload RSC/Flight **qualquer** campo sensível da ficha socioeconômica (renda/`incomeBracket`, benefício/`socialBenefit`, moradia/`housingSituation`, composição/`familyComposition`). | Exposição LGPD da ficha socioeconômica a coordenador (ou outro viewer não-AS/BOARD) via o painel consolidado. **Defesa em 2 barreiras:** (B1) o assembler **não chama** `getSocioeconomicRecord` para não-AS/BOARD → os campos nunca são SELECIONADOS; (B2) o `ConsolidatedPersonView` para não-AS/BOARD **não tem** os campos da ficha (strip estrutural no serializer) — reforço mesmo que B1 falhe. | T6 (assembler: B1+B2), T7 (componente: sem seção de ficha p/ coordenador), T8 (rota/página) | **T6:** viewer `COORDINATOR` + Pessoa **com** ficha populada → `getSocioeconomicRecord` **não** é chamado (spy), `JSON.stringify(view)` **não** casa `/incomeBracket-value|social-benefit-text|OWNED|composição/`, `view.ficha` ausente/`null`, **nenhum** `SENSITIVE_FIELD_VIEWED` gravado; viewer `SOCIAL_ASSISTANT` → ficha presente + `SENSITIVE_FIELD_VIEWED` gravado. **T7:** com `ficha=null`, o componente não renderiza nenhum rótulo/valor sensível. **T8:** page test — coordenador renderiza o painel sem a seção da ficha e `getSocioeconomicRecord` não é chamado. |
| **SOC-039-MN-02** | WHEN um **voluntário comum** (`VOLUNTEER` sem `SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR` e sem papel autorizado) tenta acessar a visão consolidada THEN o sistema SHALL NOT retornar **nenhum** dado consolidado da Pessoa — a rota nega (`notFound()`) **e** o assembler retorna `null`; nenhuma dimensão é buscada nem serializada. | Acesso não autorizado ao **dossiê inteiro** da Pessoa (nome, papéis, candidaturas, encaminhamentos, serviços, vínculos) por um voluntário. Defesa em profundidade: guarda de rota **e** guarda no assembler. | T1 (guarda de domínio), T6 (assembler → `null`), T8 (guarda de rota → `notFound()`) | **T1:** `VOLUNTEER`, `CANDIDATE`, `PROVIDER`, `CLIENT`, `COMPANY_RESPONSIBLE`, `[]` → `canViewConsolidatedPerson === false`; `SOCIAL_ASSISTANT`/`BOARD`/`COORDINATOR` → `true`. **T6:** assembler com viewer `VOLUNTEER` → retorna `null`, nenhum read de dimensão chamado. **T8:** page test — `VOLUNTEER` → `notFound()`, `viewPersonForSocialAssistant`/reads nunca chamados. |

> **Nota:** não há campo sensível em nenhuma dimensão além da **ficha socioeconômica** — as demais
> (candidaturas, encaminhamentos, serviços, manifestações, vínculos) expõem apenas dados
> operacionais/públicos (títulos de vaga/serviço, nomes de Empresa, nomes de terceiros — públicos
> por ADR-0010 — status e datas). Os reads por-dimensão usam `select` restrito que **nunca**
> seleciona PII de terceiros (cpf/nascimento/endereço/contato). Por isso os must-nots concentram-se
> na ficha (MN-01) e no acesso do voluntário (MN-02).

---

## Requirement Traceability

| Requirement ID | Story | AC | Phase | Status |
|---|---|---|---|---|
| SOC-06 | USP-039 | AC-039-1, AC-039-2, AC-039-3, AC-039-4 + edge coordenador | Tasks | Pending |
| SOC-039-MN-01 | USP-039 (must-not, adição local) | edge coordenador / ficha | Tasks | Pending |
| SOC-039-MN-02 | USP-039 (must-not, adição local) | AC-039-2 | Tasks | Pending |

**IDs canônicos:** `SOC-06` vem do épico (upstream) — reusado, não duplicado. Os `SOC-039-MN-*` são
**adições locais** (tradução das proibições de privacidade que o formato upstream não expressa como
AC negativa; o edge case do coordenador vira MN-01).

**Coverage:** 3 requisitos · 3 a mapear em tasks · 0 sem mapeamento.

---

## Success Criteria

- [ ] AS/diretoria vê o painel único com **todas** as dimensões (incl. ficha) de uma Pessoa; abertura audita `SENSITIVE_FIELD_VIEWED` quando a ficha existe.
- [ ] Coordenador vê o painel operacional **sem** a ficha; nenhum campo sensível é SELECIONADO nem serializado (MN-01 verde, discriminado por mutação).
- [ ] Voluntário comum tem acesso **negado** na rota e no assembler; nenhuma dimensão vaza (MN-02 verde, discriminado).
- [ ] Montagem via `viewPersonForSocialAssistant` (fonte única de anonimização), compondo os reads por-dimensão existentes + os 4 reads mínimos novos; **sem** Prisma cru cross-Person; **sem** migração.
- [ ] Todas as dimensões de lista paginadas (`take`), sem N+1; `select` restrito sem PII de terceiros.
