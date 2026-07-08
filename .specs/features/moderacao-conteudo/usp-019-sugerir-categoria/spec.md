# USP-019 — Sugerir nova categoria de serviço ou área de vaga — Specification

> **Fase 2 — Empresas + Vagas + Moderação.** Unidade: Moderação (net-new).
> **Sizing:** Large (risk floor — carrega must-nots de integridade de taxonomia + auditoria; a taxonomia é dado fundacional consumido por vagas/serviços/candidatos).

## 💠 Upstream source of truth (adapt, don't re-derive)

| Fonte | Âncora | O que fixa |
| ----- | ------ | ---------- |
| PRD MVP | `docs/prd/prd-asonseg-portal-mvp.md` L481-491 (**AC-019-1, AC-019-2, AC-019-3**), L102, L335, L992-995 | História, "Outro/sugerir nova" texto livre, enfileirar para aprovação, aprovar → catálogo padronizado |
| Épico 4 | `.specs/features/moderacao-conteudo/spec.md` (MOD-04) L72-83, L92 | ACs de sugestão + edge de duplicata (decisão humana na aprovação) |
| taxonomia-inicial.md | `docs/operacao/taxonomia-inicial.md` L9-10, L85 | `isSuggestion=false` (semeadas/aprovadas) vs `isSuggestion=true` (sugeridas); dedup por `name @unique`; **aprovação por fluxo de moderação, não pelo seed** |
| Schema/código | `prisma/schema.prisma` `JobArea`/`ServiceCategory` (`isSuggestion`, `suggestedBy`, `approvedAt`, `approvedBy`, `name @unique`); `audit/events.ts` `CATEGORY_SUGGESTED`/`CATEGORY_APPROVED`; `identity/domain/permissions.ts` `APPROVE_CATEGORY_SUGGESTION`; `jobs/queries/list-approved-job-areas.ts` (`isSuggestion:false`) | Persistência, eventos e permissão **já existem** |

**O que este documento adiciona:** decomposição fina, os **must-nots** (não expressos no PRD), a regra de dedup normalizada, a semântica de rejeição (delete) e a reconciliação do aprovador (ver Assumptions).

---

## Problem Statement

O catálogo de áreas de vaga (`JobArea`) e categorias de serviço (`ServiceCategory`) é pré-cadastrado pela diretoria (AD-013 / taxonomia-inicial.md). Quando nenhuma opção existente serve, o usuário que publica precisa **sugerir uma nova**, sem poder poluir o catálogo diretamente. A sugestão deve entrar como **pendente** (invisível para seleção), ser **revisada** por quem tem `APPROVE_CATEGORY_SUGGESTION`, e só então integrar o catálogo padronizado — tudo auditado, sem duplicatas.

## Goals

- [ ] Uma Pessoa autenticada sugere uma nova área/categoria como texto livre; ela é persistida com `isSuggestion=true`, `suggestedBy`, e **não fica selecionável**.
- [ ] Um aprovador (`APPROVE_CATEGORY_SUGGESTION`) vê as sugestões pendentes numa fila e **aprova** (vira `isSuggestion=false`, selecionável) ou **rejeita** (removida do catálogo), sempre com auditoria.
- [ ] Nomes que normalizam para uma entrada já existente **não** geram duplicata (dedup case/acento-insensível + `name @unique`).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Entrada de sugestão de **categoria de serviço** via formulário de oferta de serviço | O fluxo de oferta de serviço (prestador) é Fase 3+ (módulo `services` inexiste). A **action é genérica** (`JOB_AREA` \| `SERVICE_CATEGORY`) e testada nos dois `kind`; a **entrada UI** nesta USP é a de área de vaga (superfície real via `JobForm`). |
| Renomear/editar uma categoria aprovada | Não previsto (taxonomia-inicial.md: renomear é via migração/moderação dedicada). |
| Sugerir/inativar **Região** | `Region` usa `isActive` (toggle), não `isSuggestion`; fora do escopo (taxonomia-inicial.md L84). |
| Notificar o sugerente da decisão | Sem requisito de e-mail no PRD para sugestão; auditoria é a trilha. Pode entrar com o dispatcher da USP-044. |
| Aprovação por papel `DIRETORIA`/`BOARD` dedicado | Não existe permissão para BOARD no catálogo RBAC; aprovador é `APPROVE_CATEGORY_SUGGESTION` (ver Assumptions). |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --------------------- | ----- | -------------- | --------- | ---------- |
| **Aprovador:** PRD diz "diretoria"; o RBAC vests a aprovação em `APPROVE_CATEGORY_SUGGESTION`. | agent | Aprovador = quem detém `APPROVE_CATEGORY_SUGGESTION` (COORDINATOR inerente + delegável). | Não há papel/permissão de BOARD no catálogo (`ROLE_PERMISSIONS`); a permissão dedicada já existe e é o mecanismo implementado. "Diretoria" mapeia ao detentor da permissão. | y |
| **Semântica de rejeição:** rejeitar **remove** a linha (DELETE). | agent | Reject ⇒ `prisma.<taxonomy>.delete`, dentro de `withAudit(CATEGORY_SUGGESTION_REJECTED)` (before-state preservado no `audit_log`). | Schema não tem colunas de rejeição (só `approvedAt/approvedBy`); histórico vive no `audit_log` (AD-008/AD-009 philosophy). Sugestão pendente **não** é referenciada por nenhuma vaga (não é selecionável — SUGG-MN-01) ⇒ DELETE é seguro (sem FK dependente). Evita migração e libera o nome para nova sugestão legítima. Alternativa considerada (colunas `rejectedAt/rejectedBy`) descartada por exigir migração sem ganho no MVP. | y |
| **Migration necessária?** | agent | **NENHUMA de schema.** Requer adicionar a constante de evento `CATEGORY_SUGGESTION_REJECTED` ao catálogo `audit/events.ts` (mudança de código, não de DB — `audit_log.action` é string). | Persistência/permissão já existem; `CATEGORY_SUGGESTED`/`CATEGORY_APPROVED` já no catálogo; falta só o evento de rejeição. | y |
| **Quem pode sugerir:** qualquer Pessoa autenticada ATIVA. | agent | `requireActivePerson()`; sem gate por papel. | PRD: "Pessoa autenticada (publicando vaga ou serviço)"; a entrada prática já está atrás do papel do formulário de publicação. | y |
| **Dedup:** case/acento-insensível sobre `name`. | agent | `foldForDedup(name)` = trim + colapsar espaços + `lower` + remover acentos; comparado contra todas as entradas do mesmo `kind` (sugeridas + aprovadas). `name @unique` é a guarda de último recurso. | `name @unique` é case-sensitive no Postgres ⇒ "Tecnologia" vs "tecnologia" escapariam sem fold. Poucas entradas (<30) ⇒ comparar folded é barato e DB-agnóstico. | y |
| **Nome armazenado:** texto do usuário limpo (trim + colapso de espaços), preservando o casing digitado. | agent | Sem title-case automático; sem rename na aprovação. | Menor surpresa; rename é out of scope. | y |
| **Motivo de rejeição:** opcional. | agent | Campo opcional; se informado, vai em `audit_log.justification`. Não entra em `JUSTIFICATION_REQUIRED_EVENTS`. | Sugestão é baixo risco; exigir 20 chars atritaria "duplicata de X". | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Sugerir e aprovar nova área de vaga ⭐ MVP

**User Story**: Como Pessoa autenticada publicando uma vaga, quero sugerir uma nova área quando nenhuma serve, para que minha vaga seja categorizada corretamente; e como aprovador, quero revisar e aprovar/rejeitar a sugestão.

**Why P1**: Sem isso, o catálogo é rígido e o usuário fica sem opção adequada; é a válvula de extensibilidade da taxonomia.

**Acceptance Criteria**:

1. **[SUGG-01 · AC-019-1]** WHEN uma Pessoa autenticada envia uma sugestão de área com texto livre válido THEN o sistema SHALL criar uma `JobArea` com `isSuggestion=true`, `suggestedBy=<personId>`, `approvedAt=null`, e gravar `audit_log CATEGORY_SUGGESTED` na mesma transação, retornando `{ ok: true }`.
2. **[SUGG-02 · AC-019-2]** WHEN a sugestão é criada THEN o sistema SHALL NÃO torná-la selecionável (não aparece em `listApprovedJobAreas`) e SHALL enfileirá-la na fila de pendentes (`isSuggestion=true AND approvedAt IS NULL`).
3. **[SUGG-03 · AC-019-3]** WHEN um ator com `APPROVE_CATEGORY_SUGGESTION` aprova a sugestão THEN o sistema SHALL setar `isSuggestion=false`, `approvedAt=now`, `approvedBy=<personId>`, gravar `audit_log CATEGORY_APPROVED` na mesma transação, e a área SHALL passar a aparecer em `listApprovedJobAreas`.
4. **[SUGG-04]** WHEN um ator com `APPROVE_CATEGORY_SUGGESTION` rejeita a sugestão THEN o sistema SHALL remover a linha (DELETE) dentro de `withAudit(CATEGORY_SUGGESTION_REJECTED)` (before-state no log), e a sugestão SHALL sumir da fila e continuar não-selecionável.
5. **[SUGG-05]** WHEN o texto sugerido normaliza (`foldForDedup`) para uma entrada já existente (sugerida ou aprovada) do mesmo `kind` THEN o sistema SHALL NÃO criar uma segunda linha e SHALL retornar um erro amigável (`DUPLICATE` — "essa área já existe / já foi sugerida").
6. **[SUGG-06]** WHEN um ator com acesso abre `(app)/moderacao/sugestoes` THEN o sistema SHALL listar as sugestões pendentes de **ambos** os tipos (áreas + categorias) com autor e data; quem não tem acesso recebe 404.
7. **[SUGG-07 · AC-019-1]** WHEN a Pessoa está no formulário de vaga e escolhe "Outro / sugerir nova" no campo de área THEN o sistema SHALL permitir digitar a sugestão como texto livre e submetê-la via `suggestTaxonomy`.

**Independent Test**: Publicar uma vaga, escolher "Outro / sugerir nova área", digitar "Jardinagem", confirmar; verificar que `JobArea` "Jardinagem" existe com `isSuggestion=true` e NÃO aparece no select; como coordenador, abrir `/moderacao/sugestoes`, aprovar; verificar `isSuggestion=false` e que passa a aparecer no select. Repetir sugerindo "jardinagem" → bloqueado por dedup.

---

### P2: Ação genérica por `TaxonomyKind` (categoria de serviço)

**User Story**: Como sistema, quero que `suggestTaxonomy`/aprovar/rejeitar aceitem `JOB_AREA` **ou** `SERVICE_CATEGORY`, para reuso quando a oferta de serviço existir.

**Why P2**: Simetria; evita retrabalho. Sem entrada UI de serviço nesta USP.

**Acceptance Criteria**:

1. **[SUGG-08]** WHEN as actions recebem `kind = SERVICE_CATEGORY` THEN o sistema SHALL operar sobre `ServiceCategory` com a mesma semântica (sugerir/aprovar/rejeitar/dedup/auditoria).

**Independent Test**: Teste de integração cobre `SERVICE_CATEGORY` no sugerir + aprovar + dedup.

---

## Edge Cases

- WHEN o texto sugerido é vazio, só espaços, < 2 chars, ou > limite (ex.: 60) THEN o sistema SHALL rejeitar com `VALIDATION`.
- WHEN dois usuários sugerem o mesmo nome quase-simultaneamente THEN a segunda inserção SHALL falhar (dedup app-level ou `name @unique`) e retornar `DUPLICATE`, sem 500.
- WHEN o aprovador tenta aprovar/rejeitar um `id` inexistente ou já resolvido THEN o sistema SHALL retornar `NOT_FOUND`.
- WHEN a sugestão coincide semanticamente (não exatamente) com uma existente ("TI" vs "Tecnologia") THEN o aprovador PODE rejeitá-la manualmente (decisão humana — SUGG-04), pois o dedup automático não a pega.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| -- | ------------------------------------- | -------- | ----------- | ------------- |
| **SUGG-MN-01** | WHEN uma sugestão está pendente (`isSuggestion=true`, `approvedAt=null`) THEN o sistema SHALL NOT oferecê-la como opção selecionável em formulários de vaga/serviço. | Conteúdo classificado com taxonomia não-aprovada (polui o catálogo). | T3 | Teste: `listApprovedJobAreas` (e a query de serviço) excluem `isSuggestion=true`. |
| **SUGG-MN-02** | WHEN o ator não possui `APPROVE_CATEGORY_SUGGESTION` THEN o sistema SHALL NOT aprovar nem rejeitar sugestões. | Qualquer autenticado alterando o catálogo global. | T5, T6 | Teste: aprovar/rejeitar sem permissão ⇒ `FORBIDDEN`; sem mudança de estado. |
| **SUGG-MN-03** | WHEN o nome sugerido normaliza para uma entrada existente do mesmo `kind` THEN o sistema SHALL NOT criar uma segunda linha. | Duplicatas ("Tecnologia"/"tecnologia"/"tecnologìa") fragmentando o catálogo. | T4 | Teste: sugerir variação de caso/acento de nome existente ⇒ `DUPLICATE`, contagem de linhas inalterada. |
| **SUGG-MN-04** | WHEN qualquer sugestão/aprovação/rejeição é aplicada THEN o sistema SHALL NOT persistir a mudança sem o `audit_log` correspondente na mesma transação. | Alteração de dado fundacional sem trilha (LGPD/governança). | T4, T5, T6 | Teste: cada operação grava exatamente 1 evento (`CATEGORY_SUGGESTED`/`CATEGORY_APPROVED`/`CATEGORY_SUGGESTION_REJECTED`); falha de auditoria ⇒ rollback. |
| **SUGG-MN-05** | WHEN uma sugestão é rejeitada THEN o sistema SHALL NOT deixá-la selecionável nem na fila de pendentes. | Sugestão recusada "vazando" para o catálogo. | T6 | Teste: pós-rejeição a linha some da fila e do select. |

---

## Requirement Traceability

| Requirement ID | Upstream | Story | Phase | Status |
| -------------- | -------- | ----- | ----- | ------ |
| SUGG-01 | AC-019-1 / MOD-04 | P1 | Tasks | Pending |
| SUGG-02 | AC-019-2 / MOD-04 | P1 | Tasks | Pending |
| SUGG-03 | AC-019-3 / MOD-04 | P1 | Tasks | Pending |
| SUGG-04 | MOD-04 edge (rejeitar duplicata) | P1 | Tasks | Pending |
| SUGG-05 | taxonomia dedup (`name @unique`) | P1 | Tasks | Pending |
| SUGG-06 | AC-019-2 (fila) | P1 | Tasks | Pending |
| SUGG-07 | AC-019-1 (Outro/sugerir) | P1 | Tasks | Pending |
| SUGG-08 | AD-013 (genérico) | P2 | Tasks | Pending |
| SUGG-MN-01 | goal (não selecionável) | must-not | Tasks | Pending |
| SUGG-MN-02 | PRD L335/L992 (RBAC) | must-not | Tasks | Pending |
| SUGG-MN-03 | taxonomia L9 (dedup) | must-not | Tasks | Pending |
| SUGG-MN-04 | AC (auditoria) | must-not | Tasks | Pending |
| SUGG-MN-05 | goal (rejeição) | must-not | Tasks | Pending |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 13 total (8 ACs + 5 must-nots), all to be mapped to tasks.

---

## Success Criteria

- [ ] Usuário sugere uma área via "Outro/sugerir nova"; ela fica pendente e invisível no select.
- [ ] Aprovador aprova → vira selecionável; rejeita → some, sem virar selecionável.
- [ ] Nenhuma duplicata (caso/acento) entra no catálogo.
- [ ] Toda sugestão/aprovação/rejeição tem exatamente 1 `audit_log` (append-only) na mesma transação.
- [ ] Sem permissão, ninguém aprova/rejeita.
- [ ] Gates verdes: typecheck, lint, unit, integração, build (sem migration de schema; só novo evento de auditoria no catálogo).
