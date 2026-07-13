# USP-057 — E-mails de decisão de moderação (NOT-03/04/05) — Specification

- **Fase:** 8 — Remediação do UAT · **Épico:** `ajustes-uat` · **Prioridade:** P1 (unidade), achados P1
- **Dossiê (fonte da verdade dos achados):** `.specs/features/ajustes-uat/uat-findings-2026-07-11.md` — linhas **REL-1 / MOD-4** (tabela Fase 8, l.59)
- **Dep:** USP-056 ✅ (fila lê `CANDIDATE_PROFILE` real — habilita o e-mail de perfil de candidato ponta a ponta)
- **Specs vizinhas (upstream — IDs canônicos, não re-derivar):**
  - `.specs/features/notificacoes-email/spec.md` — **NOT-03** (aprovação → e-mail ao autor), **NOT-04** (devolução → e-mail com **motivo obrigatório**), **NOT-05** (rejeição → e-mail com **motivo obrigatório**), **NOT-11** (envio só via port), **NOT-12** (envio não-crítico), **NOT-13** (PT-BR + motivo quando aplicável)
  - `.specs/features/moderacao-conteudo/usp-016-moderar-rascunho/spec.md` — **E-002/E-003/E-004** ("transicionar … **e enviar e-mail ao autor**" [com o motivo em E-003/E-004]); **GAP-3** (o `NotificationPort` entregue como **stub no-op**; adapter real + templates = USP-044)
  - `.specs/features/notificacoes-email/usp-044-notificacoes-email/spec.md` — **AC-044-D2** (passthrough de `EmailMessage` completo pelo dispatcher), **P-007** (sem e-mail órfão de tx revertida), **U44-MN-04 / P-008** (minimização de PII — só metadado/mínimo necessário)

> **💠 Adapt, don't re-derive.** Esta spec é um **adaptador**. Os requisitos de produto já existem upstream: **NOT-03/04/05** (épico USP-044) e **E-002/E-003/E-004** (USP-016) nomeiam o mesmo comportamento — "ao decidir a moderação, enviar e-mail ao autor (com o motivo em devolução/rejeição)". A USP-016 entregou esse ponto como **stub no-op** (GAP-3, `StubModerationNotification`) e o `design.md` da USP-044 **não menciona a decisão de moderação** entre os sítios de enqueue (sumiu em silêncio — daí o achado REL-1/MOD-4). Esta unidade **fecha o gap**: cria os templates e o sítio de **enfileiramento** (enqueue) no Outbox, dentro da tx de `transitionContent()`. Reusa NOT-03/04/05 e E-002/03/04 como IDs canônicos; os IDs locais `USP057-*` só nomeiam o recorte de remediação (resolução de destinatário por tipo, gating, atomicidade) e o rastreio de tarefa. **Nenhum requisito novo de produto é inventado.**

---

## Problem Statement

Toda decisão de moderação passa pela função canônica `transitionContent()` (ADR-0011 — única via de mudança de status). Ao aprovar / devolver / rejeitar um conteúdo, `transitionContent` chama o `ModerationNotificationPort` para notificar o autor — mas o binding em `src/shared/container.ts` (l.138) é o **`StubModerationNotification` no-op**, que apenas loga e **não enfileira nada**. Resultado do UAT (REL-1/MOD-4): o autor de uma vaga/serviço/perfil de candidato **nunca recebe** o e-mail de aprovação (NOT-03), de devolução com o motivo (NOT-04) ou de rejeição com o motivo (NOT-05), embora a infra de e-mail (port `EmailSender`, dispatcher assíncrono USP-044, tabela `Outbox`, 6 sítios de enqueue já existentes) esteja pronta e drenando a fila.

Esta US substitui o stub por um **adapter real** que **enfileira** o e-mail no Outbox na **mesma transação** da decisão — exatamente como os sítios `application-confirmation` (`apply-to-job.ts`) e `referral-notification` (`create-referral.ts`) já fazem — e adiciona os templates PT-BR de decisão de moderação. O **envio** (dispatch) permanece assíncrono via cron/Outbox (USP-044): aqui é **só enfileirar corretamente**.

## Goals

- [ ] **G1** — Três templates PT-BR de decisão de moderação (`moderation-approved`, `moderation-returned`, `moderation-rejected`), registrados na união `EmailMessage`, no renderer `ResendEmailSender` e no `KNOWN_TEMPLATES` do resolver do Outbox — realizando **NOT-03/04/05** no plano de conteúdo, com o **motivo** presente na devolução/rejeição (NOT-04/05/NOT-13) e sem PII indevida (NOT-13/U44-MN-04).
- [ ] **G2** — Um adapter real `OutboxModerationNotification` (implementando `ModerationNotificationPort`) que resolve o destinatário (autor) + título do conteúdo por `ContentKind`, monta o `EmailMessage` e **enfileira** via `tx.outbox.create(...)` na **mesma tx** da decisão — realizando **E-002/E-003/E-004** e **AC-044-D2**, substituindo o stub no `container.ts`.
- [ ] **G3** — Enfileirar **somente** nas três decisões do moderador (aprovar/devolver/rejeitar); nenhum e-mail nas demais transições da FSM (submissão, pausar/despausar, arquivar, expirar, reenvio do autor, inativação) — preservando o comportamento atual dessas transições.
- [ ] **G4** — Preservar as premissas invioláveis: enqueue não-crítico (soft-fail — falha não reverte a decisão, NOT-12/ADR-0011 R2); atomicidade com a tx (rollback da decisão ⇒ sem e-mail órfão, P-007); **zero** dispatch novo, **zero** dep nova, **zero** migração (reusa a tabela `Outbox`).

## Out of Scope

| Feature | Reason |
|---|---|
| **Envio/dispatch** do e-mail (drenar o Outbox, chamar `ResendEmailSender`, `processedAt`/retry/poison) | **USP-044** (já entregue, AD-023). Esta US **só enfileira**; o cron `/api/cron/dispatch-outbox` já drena `topic='email'` e faz passthrough de `EmailMessage` conhecido (AC-044-D2). Premissa inviolável: não implementar dispatch novo. |
| Payload leve `{ kind: 'MODERATION_DECISION', … }` + novo resolver/hidratador no dispatcher | Adotado **enqueue eager** (payload = `EmailMessage` completo), como `application-confirmation`/`referral-notification`. Payload leve exigiria um novo ramo `kind` em `resolve-outbox-email.ts` (código do dispatcher, USP-044) — maior superfície e risco. Ver `design.md §Tech Decisions`. |
| Novo `PermissionId`, nova entidade/tabela, nova migração | Premissa inviolável. Reusa `Outbox` (colunas existentes), a FSM e o `audit_log` intactos. |
| Opt-out granular (`email_prefs`) / lembrete / SPF-DKIM | Fora do épico desta unidade (USP-044 §ICE-ID Coverage — deferidos/gates operacionais). |
| E-mail de **submissão** à moderação, pausar/arquivar/expirar, reenvio do autor, inativação | Não previstos em NOT-03/04/05 (só as 3 **decisões**). Gating em **G3** garante que essas transições não disparam e-mail. |
| Fonte `ContentKind.CV` (fixture `_moderation_fixture`, vazia em prod) | Sem entidade/autor real; o CV vive dentro de `CandidateProfile`. `CV` → no-op (sem destinatário). O e-mail de perfil de candidato usa `CANDIDATE_PROFILE` (USP-056). |
| Alterar o contrato de `sendModerationDecision` além de threadar o `tx` | Só se adiciona o `tx` (1º parâmetro), espelhando `CompanyVerifyHookPort.onContentActivated(tx, …)`. Nada mais no contrato do port muda. |

---

## Assumptions & Open Questions

Cada ambiguidade resolvida (modo autônomo) ou registrada aqui. **Nenhum item de owner externo bloqueia a implementação → Entry Gate livre.**

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| **Estratégia de enqueue: eager vs. payload leve** | agent | **Eager** — o adapter resolve destinatário+título e grava um `EmailMessage` completo (`satisfies EmailMessage`) via `tx.outbox.create`, como `apply-to-job.ts` e `create-referral.ts`. | Os dois precedentes que o dossiê aponta são eager; evita adicionar um ramo `kind` novo ao resolver do dispatcher (código USP-044) → menor superfície, preserva os testes do dispatcher. Registro do template no `KNOWN_TEMPLATES` é aditivo (mesmo que os 8 templates atuais). | y |
| **Um template por decisão (3) vs. um template com discriminador** | agent | **Três** templates (`moderation-approved`/`-returned`/`-rejected`), um por NOT-03/04/05. | Convenção do projeto: 1 `template` por evento (9/9 templates atuais); `switch(message.template)` exaustivo. Assuntos e corpos distintos (aprovado→"publicado", sem motivo; devolvido→"ajustes" + motivo + reenvio; rejeitado→"não aprovado" + motivo). Rastreabilidade 1:1 NOT→template. | y |
| **Destinatário por `ContentKind`** | agent | JOB → `job.authorPersonId`; SERVICE → `service.authorPersonId`; CANDIDATE_PROFILE → `personId` (== `contentId`, auto-submetido); CV → sem autor real (no-op). E-mail/nome via `tx.person.findUnique({ select: { emailLogin, fullName } })` (precedente `apply-to-job.ts`). | Mapeamento já usado pela fila (`moderation-queue.ts`) e por USP-056. Sem helper cross-módulo para `emailLogin` — o adapter lê `tx.person` direto (mesmo padrão de `apply-to-job`). | y |
| **Título do conteúdo no e-mail** | agent | JOB/SERVICE → `title`; CANDIDATE_PROFILE → `headline ?? "Perfil de candidato"`. Rótulo de tipo PT-BR: "vaga" / "serviço" / "perfil de candidato". | Conteúdo público (título de vaga/serviço; `headline` é o resumo profissional público — não é PII sensível, ADR-0010). Fallback igual ao de USP-056 (MOD-1). | y |
| **Link ("área do autor") no e-mail** | agent | CTA por tipo, absoluto via `NEXT_PUBLIC_SITE_URL`: JOB → `/empresa`, SERVICE → `/prestador`, CANDIDATE_PROFILE → `/candidato` (rotas confirmadas existentes por USP-049/USP-054). | O dossiê pede "link para a área do autor"; precedente `password-reset` usa `ctaButton` com URL absoluta. Rotas de área confirmadas no UAT — evita link 404. | y |
| **Motivo no e-mail** | agent | Presente **só** em devolução (NOT-04) e rejeição (NOT-05), vindo de `notice.justification` (já obrigatório e validado ≥20 chars significativos por `transitionContent`/USP-016 P-003). Aprovação (NOT-03) **sem** motivo. | E-002 não exige motivo; E-003/E-004 exigem. O motivo já é author-facing por design (o moderador escreve para o autor). | y |
| **Enqueue permanece soft-fail (não-crítico)** | agent | Manter o wrapper `runSoftFail('notification', …)` em `transition-content.ts`: falha do enqueue loga e **não** reverte a decisão (NOT-12/ADR-0011 R2). | É o comportamento atual (com o stub) e há teste que o exige (`transition-content.test.ts` "R2: falha de notificação é soft-fail"). A decisão de moderação é mais importante que o e-mail. Atomicidade (P-007) segue garantida: o enqueue usa `tx`, logo rollback da decisão remove a linha. | y |
| **Threading do `tx` pelo port** | agent | Adicionar `tx` como 1º parâmetro de `sendModerationDecision(tx, notice)`, espelhando `CompanyVerifyHookPort.onContentActivated(tx, …)`. Stub e call-site atualizados juntos (build-green). | Enqueue eager na mesma tx exige o cliente transacional; passar `tx` é o padrão já usado pelo hook de Empresa no mesmo arquivo. Type de `tx` = o mesmo do `CompanyVerifyHookPort` (`AuditTx`). | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Autor é notificado por e-mail da decisão de moderação ⭐ MVP

**User Story**: Como **autor de conteúdo** (candidato, empresa-responsável ou prestador), quero **receber um e-mail** quando meu conteúdo é **aprovado**, **devolvido para ajustes** (com o motivo) ou **rejeitado** (com o motivo), para saber a decisão e o que fazer **sem precisar entrar no portal** — hoje o e-mail nunca é enviado (stub no-op).

**Why P1**: NOT-03/04/05 (épico USP-044) e E-002/E-003/E-004 (USP-016) são **Must**. A infra de envio está pronta e drenando a fila; falta só enfileirar. Sem isso, a decisão de moderação (aprovar/devolver/rejeitar) é invisível ao autor — mesmo peso dos demais P1 da Fase 8. Devolução sem aviso do motivo torna o `AWAITING_ADJUSTMENTS` (corrigido no painel pela USP-054/MOD-3) um beco: o autor não sabe que foi devolvido nem por quê.

**Acceptance Criteria**:

1. **[USP057-01 → NOT-03 / E-002]** WHEN uma decisão transiciona um conteúdo de `IN_MODERATION` para `ACTIVE` (aprovação, `trigger = MODERATOR_ACTION`) e o autor tem `emailLogin` THEN o sistema SHALL enfileirar no `Outbox` (`topic='email'`) um `EmailMessage` `template='moderation-approved'`, `to = emailLogin do autor`, informando que o conteúdo foi **publicado** — **sem** motivo.
2. **[USP057-02 → NOT-04 / E-003 / NOT-13]** WHEN uma decisão transiciona de `IN_MODERATION` para `AWAITING_ADJUSTMENTS` (devolução) e o autor tem `emailLogin` THEN o sistema SHALL enfileirar um `EmailMessage` `template='moderation-returned'`, `to = emailLogin do autor`, contendo **o motivo** (`notice.justification`) e a orientação de ajustar/reenviar.
3. **[USP057-03 → NOT-05 / E-004 / NOT-13]** WHEN uma decisão transiciona de `IN_MODERATION` para `REJECTED` (rejeição) e o autor tem `emailLogin` THEN o sistema SHALL enfileirar um `EmailMessage` `template='moderation-rejected'`, `to = emailLogin do autor`, contendo **o motivo** (`notice.justification`).
4. **[USP057-04]** WHEN o adapter monta o e-mail THEN o destinatário e o título SHALL ser resolvidos por `ContentKind` (JOB→`job.authorPersonId`/`title`; SERVICE→`service.authorPersonId`/`title`; CANDIDATE_PROFILE→`personId`/`headline ?? "Perfil de candidato"`), com nome de saudação = `person.fullName` e rótulo de tipo PT-BR ("vaga"/"serviço"/"perfil de candidato").
5. **[USP057-05 → AC-044-D2 / P-007]** WHEN o e-mail é enfileirado THEN a escrita SHALL usar o cliente transacional recebido (`tx.outbox.create`), na **mesma transação** da decisão, com `payload` = `EmailMessage` completo reconhecido pelo passthrough do dispatcher (`resolveOutboxEmail`) — de modo que o rollback da decisão remova a linha (sem e-mail órfão).
6. **[USP057-06]** WHEN a transição **não** é uma das três decisões do moderador (i.e. `from ≠ IN_MODERATION` **ou** `to ∉ {ACTIVE, AWAITING_ADJUSTMENTS, REJECTED}`) THEN o sistema SHALL NOT enfileirar qualquer e-mail (submissão, pausar/despausar, arquivar, expirar, reenvio, inativação seguem sem e-mail).
7. **[USP057-07]** WHEN o autor não tem `emailLogin` (ou o conteúdo é `CV`/fixture sem autor real) THEN o sistema SHALL pular o enqueue sem erro (no-op logado), concluindo a decisão normalmente.
8. **[USP057-08 → NOT-12 / ADR-0011 R2]** WHEN o enqueue falha (erro do banco / resolução) THEN o sistema SHALL registrar em log e concluir a decisão de moderação **ok mesmo assim** (soft-fail), sem reverter a transição.
9. **[USP057-09 → NOT-13]** WHEN qualquer template de decisão é renderizado THEN assunto e corpo SHALL ser em PT-BR, com todos os valores interpolados passando por `escapeHtml`, contendo o nome do autor + rótulo de tipo + título do conteúdo (+ motivo em devolução/rejeição) + link para a área do autor.

**Independent Test**: Com um `CandidateProfile` real em `IN_MODERATION` (autor com `emailLogin`), o container real (adapter `OutboxModerationNotification`): `transitionContent(CANDIDATE_PROFILE, aprovar)` grava 1 linha `Outbox topic='email'` com `payload.template='moderation-approved'` e `payload.to = emailLogin`; devolver com motivo grava `moderation-returned` com o motivo no corpo; rejeitar com motivo grava `moderation-rejected`; `resolveOutboxEmail(payload)` devolve um `EmailMessage` válido para as três. Uma transição de pausa/arquivamento **não** grava linha. Um autor sem `emailLogin` **não** gera linha, e a decisão conclui `ok`.

---

## Edge Cases

- WHEN o autor não tem `emailLogin` THEN nenhum e-mail é enfileirado; a decisão conclui `ok` (no-op logado). *(precedente `apply-to-job`: `if (me?.emailLogin) {…}`)*
- WHEN `ContentKind === CV` (fixture, sem entidade/autor real em prod) THEN no-op (sem destinatário).
- WHEN `ContentKind === CANDIDATE_PROFILE` e `headline` é `null` THEN o título usa `"Perfil de candidato"`.
- WHEN o enqueue lança (falha de banco) THEN soft-fail: a decisão conclui `ok`, os demais side effects (cache, hook) e a revalidação da home seguem — comportamento idêntico ao teste "R2" atual.
- WHEN a decisão sofre rollback (conflito de concorrência / erro na tx) THEN a linha do Outbox enfileirada **não persiste** (mesma tx) — sem e-mail órfão (P-007).
- WHEN a transição é reenvio do autor (`AWAITING_ADJUSTMENTS → IN_MODERATION`, `AUTHOR_ACTION`) THEN **nenhum** e-mail (não é decisão do moderador; `from ≠ IN_MODERATION`).
- WHEN dois moderadores decidem concorrentemente (segunda decisão perde o `updateStatus`) THEN a segunda aborta **antes** do enqueue (o enqueue roda após `updateStatus` bem-sucedido) — no máximo 1 e-mail por decisão efetivada.

---

## Must-Nots (world-level prohibitions)

Cada uma com teste negativo (garantia 1 do bravi-spec-driven).

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **USP057-MN-01** | WHEN a transição não é uma das 3 decisões do moderador (`from ≠ IN_MODERATION` ou `to ∉ {ACTIVE, AWAITING_ADJUSTMENTS, REJECTED}`) THEN SHALL NOT enfileirar e-mail. | Spam ao autor em pausar/despausar/arquivar/expirar/submeter/reenviar/inativar. | T3 | adapter (unit): notice `PAUSED→ACTIVE` e `ACTIVE→PAUSED` → nenhum `tx.outbox.create`. |
| **USP057-MN-02** | WHEN enfileira o e-mail THEN SHALL NOT usar o cliente global `prisma` — SHALL usar o `tx` recebido (`tx.outbox.create`), para que o rollback da decisão remova a linha (sem e-mail órfão, P-007). | E-mail órfão de decisão revertida (viola P-007 / atomicidade). | T3 | adapter (unit): com `tx` fake, `fakeTx.outbox.create` chamado e `prisma.outbox.create` **não**; int (T4): decisão + linha na mesma tx. |
| **USP057-MN-03** | WHEN o adapter processa a decisão THEN SHALL NOT enviar/despachar o e-mail sincronamente (não resolver/chamar o `EmailSender`) — apenas **enfileirar**. | Invadir o escopo de dispatch da USP-044 / envio no caminho da request (latência, acoplamento). | T3 | adapter (unit): `EMAIL_SENDER_TOKEN` nunca resolvido; só `tx.outbox.create` é chamado. |
| **USP057-MN-04** | WHEN monta o `payload`/corpo do e-mail THEN SHALL NOT incluir PII indevida nem de terceiro (CPF, dados sensíveis, identidade/nome do **moderador**) — só nome do **autor** + rótulo de tipo + título + motivo + link. | Vazamento LGPD (U44-MN-04 / P-008 / NOT-13). | T1, T3 | template (unit): saída não contém CPF/campos sensíveis; adapter (unit): `payload.data` não carrega `actorPersonId`/moderador. |
| **USP057-MN-05** | WHEN qualquer alteração é aplicada THEN SHALL NOT introduzir migração/tabela nova, dep nova, dispatch novo, nem mudança de status fora de `transitionContent`; SHALL reusar a tabela `Outbox` e manter o `audit_log` append-only. | Violar premissas invioláveis (arquitetura). | T1–T4 | ausência de migração/dep no diff; passthrough via `KNOWN_TEMPLATES` (sem ramo `kind` novo no resolver). |
| **USP057-MN-06** | WHEN o enqueue falha THEN SHALL NOT abortar/reverter a decisão de moderação (enqueue não-crítico, soft-fail — NOT-12/ADR-0011 R2). | Perder a decisão por causa de falha de e-mail. | T2 | `transition-content.test.ts` "R2: falha de notificação é soft-fail" permanece **verde** (decisão `ok`). |

---

## Requirement Traceability

| Requirement ID | Story | Upstream (canônico) | Phase | Status |
|---|---|---|---|---|
| USP057-01 | P1 | NOT-03 / E-002 (USP-044/016) | Tasks (T1,T3) | Pending |
| USP057-02 | P1 | NOT-04 / E-003 | Tasks (T1,T3) | Pending |
| USP057-03 | P1 | NOT-05 / E-004 | Tasks (T1,T3) | Pending |
| USP057-04 | P1 | E-002/03/04 (destinatário=autor) | Tasks (T3) | Pending |
| USP057-05 | P1 | AC-044-D2 / P-007 (USP-044) | Tasks (T2,T3) | Pending |
| USP057-06 | P1 | — (gating) | Tasks (T3) | Pending |
| USP057-07 | P1 | NOT-12 (no-op sem destinatário) | Tasks (T3) | Pending |
| USP057-08 | P1 | NOT-12 / ADR-0011 R2 | Tasks (T2) | Pending |
| USP057-09 | P1 | NOT-13 | Tasks (T1) | Pending |
| USP057-MN-01 | must-not | — | Tasks (T3) | Pending |
| USP057-MN-02 | must-not | P-007 | Tasks (T3,T4) | Pending |
| USP057-MN-03 | must-not | escopo USP-044 | Tasks (T3) | Pending |
| USP057-MN-04 | must-not | U44-MN-04 / P-008 / NOT-13 | Tasks (T1,T3) | Pending |
| USP057-MN-05 | must-not | premissas invioláveis | Tasks (T1–T4) | Pending |
| USP057-MN-06 | must-not | NOT-12 / ADR-0011 R2 | Tasks (T2) | Pending |

**Coverage:** 15 requisitos, todos mapeados a tarefas (T1–T4). 0 unmapped.

---

## Success Criteria

- [ ] Um `CandidateProfile` (autor com `emailLogin`) em `IN_MODERATION`: aprovar/devolver/rejeitar via `transitionContent` grava, respectivamente, 1 linha `Outbox topic='email'` com `moderation-approved`/`-returned`/`-rejected`, `to` = e-mail do autor, e o motivo no corpo nas duas últimas (integração real).
- [ ] `resolveOutboxEmail(payload)` reconhece os 3 templates (passthrough AC-044-D2) e devolve um `EmailMessage` válido; `ResendEmailSender.render()` renderiza os 3 (assunto/corpo PT-BR).
- [ ] Transições que **não** são decisão do moderador (pausar/despausar/arquivar/expirar/submeter/reenviar/inativar) e autor sem `emailLogin` **não** geram linha no Outbox.
- [ ] `StubModerationNotification` substituído por `OutboxModerationNotification` no `container.ts`; a suíte de `transitionContent` (incl. "R2: soft-fail") permanece **verde** (atualização mecânica dos fakes para a assinatura `(tx, notice)`, asserções preservadas).
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` (unit) e `npm run test:integration` verdes; **zero migração, zero dep nova, zero dispatch novo**; nenhum e-mail é **enviado** aqui (só enfileirado — dispatch = USP-044).
