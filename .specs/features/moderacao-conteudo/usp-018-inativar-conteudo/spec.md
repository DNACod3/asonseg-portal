# USP-018 — Inativar conteúdo já publicado — Specification

> **Fase 2 — Empresas + Vagas + Moderação.** Unidade: Moderação (net-new).
> **Sizing:** Large (risk floor — carrega must-nots, opera transição de estado irreversível de conteúdo público, e reusa a fundação `moderation` da qual outras USPs dependem).

## 💠 Upstream source of truth (adapt, don't re-derive)

Esta spec **indexa** as fontes canônicas abaixo e reusa seus IDs; não os reescreve.

| Fonte | Âncora | O que fixa |
| ----- | ------ | ---------- |
| PRD MVP | `docs/prd/prd-asonseg-portal-mvp.md` L468-479 (**AC-018-1, AC-018-2**), L335, L992, L1031 (RP-010) | História, motivo obrigatório, e-mail ao autor, log; substitui denúncia formal ausente |
| ADR-0011 (Aceito) | `docs/arch/0011-maquina-estados-moderacao.md` L42, L128, L187-193 | `ACTIVE → INACTIVATED` via `COORDINATOR_INACTIVATION` (`requiresJustification: true`); histórico no `audit_log`, sem tabela de transições |
| Épico 4 | `.specs/features/moderacao-conteudo/spec.md` (MOD-03) L59-70, L88-89 | ACs de inativação + edges (motivo obrigatório, transição inválida se não-ACTIVE) |
| STATE decisões | AD-005 (fundação `moderation` destrava USP-018), AD-009 (status na entidade, adapter por `ContentKind`) | Arquitetura da máquina de estados |
| Código existente | `src/modules/moderation/` (`transitionContent`, `TRANSITIONS`, `content-status.ts` L73), `src/modules/audit/events.ts` L61/L126, `src/modules/identity/domain/permissions.ts` L17 | A transição, o evento de auditoria e a permissão **já existem** |

**O que este documento adiciona ao upstream:** decomposição fina em ACs testáveis, os **must-nots** (o PRD não os expressa), e a reconciliação do nome do estado (ver Assumptions).

---

## Problem Statement

Depois que uma vaga (ou CV/serviço) é aprovada e fica pública (`ACTIVE`), um problema pode ser descoberto — conteúdo enganoso, empresa-fantasma que passou na verificação, denúncia externa por e-mail institucional (RP-010). O MVP não tem fluxo formal de denúncia; o coordenador precisa de uma "válvula de escape" para **remover conteúdo já publicado da vitrine pública imediatamente**, com motivo registrado e rastreável, sem apagar o registro (integridade referencial de candidaturas/auditoria).

## Goals

- [ ] Um operador autorizado (coordenador ou voluntário com `INACTIVATE_PUBLISHED_CONTENT`) inativa um conteúdo `ACTIVE`, com **motivo textual obrigatório**, exclusivamente pela máquina de estados (`transitionContent`, trigger `COORDINATOR_INACTIVATION`).
- [ ] A inativação grava auditoria (`CONTENT_INACTIVATED_BY_COORDINATOR`) **na mesma transação** e notifica o autor (seam de notificação; entrega real diferida à USP-044).
- [ ] O conteúdo inativado **some da superfície pública imediatamente** (revalidação de `/vagas` **e** da página de detalhe `/vagas/[id]`), e nunca reaparece em listagens/detalhe on-read.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Re-publicar conteúdo inativado (`INACTIVATED → *`) | `INACTIVATED` é **terminal** na FSM atual (sem transição de saída em `TRANSITIONS`); reativar é decisão de governança distinta — USP futura. Ver INACT-MN-06. |
| Superfície real de inativação para CV / SERVICE | `CANDIDATE_PROFILE` tem adapter de status mas não tem vitrine pública (ADR-0010, CV não é público); `SERVICE` não tem adapter real (módulo `services` inexiste, cai no `_moderation_fixture`). A **action é genérica** por `ContentKind`, mas a fatia vertical demonstrável é JOB. |
| Fluxo formal de denúncia (report) | Não previsto no MVP (PRD RP-010); coordenador age sob alerta externo. |
| Entrega real do e-mail ao autor | Dispatcher de e-mail é da USP-044 (GAP-3 / AD-007); aqui só o **seam** `MODERATION_NOTIFICATION_TOKEN` é acionado (stub no-op em prod). |
| Alerta operacional de fila (>N pendentes) | Diferido (AD-005 / GAP-5). |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --------------------- | ----- | -------------- | --------- | ---------- |
| **Nome do estado-alvo:** PRD AC-018-1 diz "arquivado", mas o alvo é `INACTIVATED`, não `ARCHIVED`. | agent | `INACTIVATED` (trigger `COORDINATOR_INACTIVATION`) | ADR-0011 (Aceito) L42/L128 e o enum/domínio implementados distinguem `ARCHIVED` (ação do autor = encerramento) de `INACTIVATED` (válvula do coordenador). Código + ADR aceito > redação do PRD (cf. AD-006 "ICE > PRD", AD-009 "schema é fonte da verdade"). | y |
| **Fatia vertical = JOB.** CV/SERVICE ficam domain-ready (action genérica) mas sem superfície nesta USP. | agent | Superfície + query + testes E2E cobrem JOB; action aceita qualquer `ContentKind`. | JOB é o único `ContentKind` com adapter real **e** vitrine pública; entregar CV/SERVICE exigiria superfícies inexistentes (Fase 3+). | y |
| **E-mail ao autor** (AC-018-1) é satisfeito no seam, não na entrega. | external: USP-044 | Assertar que `MODERATION_NOTIFICATION_TOKEN.sendModerationDecision` é chamado; entrega real é USP-044. | `transitionContent` já dispara a notificação soft-fail; o adapter real é o dispatcher da USP-044 (AD-007/GAP-3). Não bloqueia esta USP (o seam existe). | y |
| **Superfície de inativação:** nova página `(app)/moderacao/publicados`. | agent | Página autenticada `force-dynamic`, guardada por coordenador-ou-delegado; lista JOBs `ACTIVE`. | Conteúdo `ACTIVE` **não** está na fila de moderação (que mostra `IN_MODERATION`); precisa de superfície própria. Coesão sob `(app)/moderacao/`. | y |
| **Autorização de render da página:** guard `canManagePublishedContent` (coordenador OU delegação `INACTIVATE_PUBLISHED_CONTENT`). | agent | Espelha `canAccessModerationQueue`; 404 se sem acesso (rota não se revela). | Padrão já estabelecido na USP-016 (`server/moderation-access.ts`). | y |
| **Migration necessária?** | agent | **NENHUMA.** | Enum `INACTIVATED`, regra de transição, evento `CONTENT_INACTIVATED_BY_COORDINATOR` (+ `JUSTIFICATION_REQUIRED_EVENTS`) e permissão já existem no schema/código. | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Inativar vaga publicada ⭐ MVP

**User Story**: Como coordenador (ou voluntário com `INACTIVATE_PUBLISHED_CONTENT`), quero inativar uma vaga que já está `ACTIVE` com motivo obrigatório, para responder a um problema descoberto após a publicação e removê-la da vitrine pública imediatamente.

**Why P1**: É a válvula de escape que substitui o fluxo de denúncia ausente (RP-010); sem ela, conteúdo problemático fica público sem recurso operacional.

**Acceptance Criteria**:

1. **[INACT-01 · AC-018-1]** WHEN um operador com `INACTIVATE_PUBLISHED_CONTENT` confirma a inativação de uma vaga `ACTIVE` informando um motivo significativo (≥ 20 chars, `isMeaningfulJustification`) THEN o sistema SHALL transicionar `ACTIVE → INACTIVATED` via `transitionContent` (trigger `COORDINATOR_INACTIVATION`) e retornar `{ ok: true }`.
2. **[INACT-02 · AC-018-1]** WHEN a inativação é solicitada sem motivo, ou com motivo < 20 chars, ou não-significativo (só pontuação/genérico) THEN o sistema SHALL rejeitar com `VALIDATION`/`JUSTIFICATION_REQUIRED` e NÃO alterar o status.
3. **[INACT-03 · AC-018-2]** WHEN a transição de inativação é aplicada THEN o sistema SHALL gravar um registro `audit_log` com `action=CONTENT_INACTIVATED_BY_COORDINATOR`, `entityType=JOB`, `entityId`, `before={status:'ACTIVE'}`, `after={status:'INACTIVATED'}`, `actorPersonId` e `justification`, **na mesma transação** do update de status.
4. **[INACT-04 · AC-018-1(email)]** WHEN a inativação commita THEN o sistema SHALL acionar o seam de notificação ao autor (`MODERATION_NOTIFICATION_TOKEN.sendModerationDecision` com `to=INACTIVATED` e o motivo) como side-effect soft-fail (falha do envio NÃO aborta a transição).
5. **[INACT-05]** WHEN a inativação commita THEN o sistema SHALL revalidar as rotas públicas afetadas: a listagem `/vagas` **e** a página de detalhe `/vagas/{contentId}`.
6. **[INACT-06]** WHEN um operador com acesso abre `(app)/moderacao/publicados` THEN o sistema SHALL listar as vagas `ACTIVE` (paginadas, `take`) com título, empresa e ação "Inativar"; quem não tem acesso recebe 404.
7. **[INACT-07]** WHEN o operador tenta inativar uma vaga que **não** está `ACTIVE` (ex.: já `INACTIVATED`, `PAUSED`, `EXPIRED`, `DRAFT`) THEN o sistema SHALL rejeitar como `INVALID_TRANSITION` (regra da FSM), sem alterar status.

**Independent Test**: Com uma vaga `ACTIVE` semeada, abrir `/moderacao/publicados` como coordenador; confirmar que aparece; inativar sem motivo → bloqueado; inativar com motivo válido → status vira `INACTIVATED`, existe 1 `audit_log CONTENT_INACTIVATED_BY_COORDINATOR`, `searchJobs`/`getActiveJobDetail` deixam de retorná-la, e `/vagas` + `/vagas/{id}` são revalidados.

---

### P2: Ação genérica por `ContentKind` (domain-ready)

**User Story**: Como sistema de moderação, quero que a action `inactivateContent` aceite qualquer `ContentKind`, para que CV e SERVICE reusem a mesma via quando suas superfícies existirem (Fase 3+).

**Why P2**: Evita retrabalho; a FSM já é genérica. Sem superfície nova nesta USP.

**Acceptance Criteria**:

1. **[INACT-08]** WHEN `inactivateContent` recebe `{ contentKind, contentId, justification }` THEN o sistema SHALL rotear pelo `DispatchingContentStatusRepository` (adapter por `ContentKind`) sem lógica específica de tipo na action.

**Independent Test**: Teste de integração inativando um `CANDIDATE_PROFILE` `ACTIVE` (adapter real existente) via a mesma action retorna `ok` e grava auditoria.

---

## Edge Cases

- WHEN duas inativações concorrentes disputam a mesma vaga THEN a segunda SHALL falhar como `INVALID_TRANSITION` (concorrência otimista `updateStatus ... WHERE status = from`, ADR-0011 R3), sem dupla auditoria.
- WHEN a vaga não existe (`contentId` inválido) THEN o sistema SHALL retornar `NOT_FOUND`.
- WHEN o motivo tem exatamente 20 chars significativos THEN SHALL ser aceito (limite inclusivo).
- WHEN o side-effect de cache falha THEN a transição SHALL permanecer commitada (soft-fail) e o ISR de fallback cobre.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
| -- | ------------------------------------- | -------- | ----------- | ------------- |
| **INACT-MN-01** | WHEN qualquer camada muda o status de um conteúdo para `INACTIVATED` THEN o sistema SHALL NOT fazê-lo por `prisma.<model>.update({ status })` direto — só via `transitionContent`. | Bypass da FSM/auditoria/concorrência (AC6/P-006). | T3 | Guard estático (sem `.update`/`.updateMany` com `status:` fora de adapters) + teste: inativar não-ACTIVE ⇒ `INVALID_TRANSITION` (prova roteamento pela FSM). |
| **INACT-MN-02** | WHEN a inativação é solicitada sem motivo significativo THEN o sistema SHALL NOT alterar o status. | Remoção arbitrária sem prestação de contas ao autor (P-003). | T2, T3 | Teste: justificativa vazia/curta/genérica ⇒ erro, status inalterado. |
| **INACT-MN-03** | WHEN o ator não possui `INACTIVATE_PUBLISHED_CONTENT` (nem é coordenador) THEN o sistema SHALL NOT inativar o conteúdo. | Escalada de privilégio; qualquer autenticado derrubando conteúdo alheio. | T3 | Teste: ator sem permissão ⇒ `FORBIDDEN`, status inalterado. |
| **INACT-MN-04** | WHEN um conteúdo está `INACTIVATED` THEN o sistema SHALL NOT exibi-lo em nenhuma superfície pública (busca, listagem, detalhe, metadados/JSON-LD). | Vazamento de conteúdo removido (fracasso do próprio objetivo). | T5 | Teste: pós-inativação `searchJobs` e `getActiveJobDetail` excluem a vaga; detalhe ⇒ `null`/404. |
| **INACT-MN-05** | WHEN uma inativação é aplicada THEN o sistema SHALL NOT commitar a mudança de status sem o `audit_log` correspondente na mesma transação. | Remoção sem trilha forense (LGPD/governança). | T3 | Teste: existe exatamente 1 `CONTENT_INACTIVATED_BY_COORDINATOR`; simular falha de auditoria ⇒ rollback (status permanece `ACTIVE`). |
| **INACT-MN-06** | WHEN o alvo de uma transição é sair de `INACTIVATED` (`INACTIVATED → ACTIVE/DRAFT/...`) THEN o sistema SHALL NOT permitir (estado terminal nesta USP). | Re-publicação silenciosa de conteúdo removido por decisão administrativa. | T1 | Teste de domínio: `isValidTransition(kind, INACTIVATED, *, *) === false` para todos os `to`/trigger. |

---

## Requirement Traceability

| Requirement ID | Upstream | Story | Phase | Status |
| -------------- | -------- | ----- | ----- | ------ |
| INACT-01 | AC-018-1 / MOD-03 | P1 | Tasks | Pending |
| INACT-02 | AC-018-1 / edge MOD-03 | P1 | Tasks | Pending |
| INACT-03 | AC-018-2 / MOD-03 | P1 | Tasks | Pending |
| INACT-04 | AC-018-1 (email) | P1 | Tasks | Pending |
| INACT-05 | MOD-03 (revalidação ISR) | P1 | Tasks | Pending |
| INACT-06 | MOD-03 | P1 | Tasks | Pending |
| INACT-07 | edge MOD-03 (não-ACTIVE) | P1 | Tasks | Pending |
| INACT-08 | AD-005/AD-009 (genérico) | P2 | Tasks | Pending |
| INACT-MN-01 | ADR-0011 L128 (P-006) | must-not | Tasks | Pending |
| INACT-MN-02 | AC-018-1 (P-003) | must-not | Tasks | Pending |
| INACT-MN-03 | PRD L335/L992 (RBAC) | must-not | Tasks | Pending |
| INACT-MN-04 | goal (remoção pública) | must-not | Tasks | Pending |
| INACT-MN-05 | AC-018-2 (auditoria) | must-not | Tasks | Pending |
| INACT-MN-06 | ADR-0011 (terminal) | must-not | Tasks | Pending |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 14 total (8 ACs + 6 must-nots), all to be mapped to tasks.

---

## Success Criteria

- [ ] Coordenador inativa uma vaga `ACTIVE` com motivo e ela some de `/vagas` e `/vagas/[id]` imediatamente.
- [ ] Toda inativação tem exatamente 1 `audit_log CONTENT_INACTIVATED_BY_COORDINATOR` com motivo + ator (append-only).
- [ ] Zero caminhos de mudança de status para `INACTIVATED` fora de `transitionContent`.
- [ ] Ator sem permissão nunca inativa; motivo ausente nunca inativa; conteúdo não-ACTIVE nunca inativa; `INACTIVATED` nunca reabre.
- [ ] Gates verdes: typecheck, lint, unit, integração, build (sem nova migration).
