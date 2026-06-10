# USP-016 — Moderar rascunho (vaga, CV ou serviço) — Specification

- **Issue:** [#117](https://github.com/DNACod3/asonseg-portal/issues/117) · **Épico:** #233 (Épico 4 — Moderação de Conteúdo) / Fase 2
- **Prioridade:** P1 (Must) · **Feature pai:** `moderacao-conteudo`
- **Origem PRD:** USP-016 (PRD v0.3 §5.2) · **Requisito:** MOD-01
- **Spec ICE:** `docs/IDSD/ice-portal-asonseg/` — card `matriz-conexoes.md` (USP-016), `intents/intent-USP-016.md`, `expectations/expectations-USP-016.md`
- **Sub-tasks:** #121 (máquina de estados), #122 (`transitionContent`), #123 (actions de decisão + fila)

---

## Problem Statement

Rascunhos de vaga, CV/perfil e serviço são enviados para moderação (`IN_MODERATION`), mas hoje não existe o módulo `moderation` nem o caminho canônico de decisão. Sem ele: (a) não há fila ordenada para o coordenador processar; (b) status seria alterado via `prisma.update` direto — sem auditoria, sem validação de transição, sem e-mail ao autor; (c) o gate qualitativo do portal (diferencial do MVP, ADR-0015) não existe.

Esta US estabelece a **fundação** do módulo `moderation`: a máquina de estados (`ContentStatus` + tabela `TRANSITIONS`), a função canônica `transitionContent()` (transação + auditoria + side effects) e as actions de decisão + a fila do coordenador. É dependência direta de USP-009/USP-017/USP-018/USP-020 e das tasks de publicação de vaga/serviço.

## Goals

- [ ] **G1** — Declarar a máquina de estados de moderação (`ContentStatus`, `ContentKind`, `TRANSITIONS`) e as regras puras de validação de transição (sem IO). *(E-001..E-004, AC6)*
- [ ] **G2** — Expor `transitionContent()` como **única via** de mudança de status, em transação com auditoria (`withAudit`) e side effects (e-mail ao autor, revalidação de cache, hook de Empresa verificada). *(AC2, AC5, AC6, P-006)*
- [ ] **G3** — Oferecer as actions de decisão (aprovar / devolver / rejeitar) com motivo textual obrigatório e significativo onde exigido. *(E-002, E-003, E-004, P-003)*
- [ ] **G4** — Oferecer a fila do coordenador: rascunhos `IN_MODERATION` ordenados por data de envio, com indicador de tipo, excluindo itens cujo autor é o próprio moderador. *(E-001, P-005, P-007)*

## Out of Scope

| Feature | Reason |
|---|---|
| Painel de verificação de Empresa "não verificada" / marcação `isVerified` (UI + fluxo) | **USP-017** — esta US só declara a transição JOB→ACTIVE e deixa um hook de side effect; o painel e a checklist são da USP-017 (P-002). |
| Atalho/ação de inativar conteúdo publicado (USP-018) | **USP-018** — a transição `ACTIVE→INACTIVATED` é declarada no `TRANSITIONS`, mas a action e o atalho na UI são da USP-018 (P-004). |
| Alerta operacional de fila (>10 pendentes ou item >48h) | Observabilidade (TD §8.3); **diferida** — sem SLA formal no MVP. Registrada como GAP-5 (E-005 / P-001). |
| Reenvio do autor após "aguardando ajustes" (`AWAITING_ADJUSTMENTS→IN_MODERATION`) | Transição declarada no `TRANSITIONS`; a action de reenvio pertence à US de edição do conteúdo. |
| Job de expiração de vaga (`ACTIVE→EXPIRED`) | USP de vagas / cron `expire-jobs.yml` (Fase 2, fora desta US). |
| Templates/entrega de e-mail (Resend) | **USP-044** — esta US depende do **port** de notificação; o adapter real e os templates são da USP-044 (GAP-4). |

## Requisitos & ACs

ACs verbatim do issue #117 + expectations ICE. IDs de requisito = IDs ICE (`E-NNN`/`P-NNN`/`L-NNN`).

| Req | AC (critério de aceite) | Em escopo? |
|---|---|---|
| **E-001** | QUANDO o coordenador (ou voluntário com permissão delegada) acessa a fila de moderação ENTÃO o sistema DEVE listar rascunhos com status `IN_MODERATION` ordenados por data de envio (mais antigo primeiro), com indicador de tipo (vaga/CV/serviço). | ✅ (#123) |
| **E-002** | QUANDO o coordenador aprova um rascunho ENTÃO o sistema DEVE transicionar para `ACTIVE` via `transitionContent` e enviar e-mail ao autor. | ✅ (#122/#123) |
| **E-003** | QUANDO o coordenador devolve para ajustes ENTÃO o sistema DEVE exigir motivo textual significativo, transicionar para `AWAITING_ADJUSTMENTS` e enviar e-mail ao autor com o motivo. | ✅ (#122/#123) |
| **E-004** | QUANDO o coordenador rejeita ENTÃO o sistema DEVE exigir motivo textual, transicionar para `REJECTED` e enviar e-mail ao autor com o motivo. | ✅ (#122/#123) |
| **AC5** | QUANDO uma decisão é tomada ENTÃO o sistema DEVE registrar log de auditoria na mesma transação. | ✅ (#122) |
| **AC6** | QUANDO uma transição é solicitada ENTÃO o sistema DEVE validá-la contra a máquina de estados (`transitionContent`), nunca atualizando status direto via Prisma. | ✅ (#121/#122) |
| **P-003** | NÃO PODE aceitar motivo vazio, caractere único, espaços ou genérico ("x", "—", "ok") em devolver/rejeitar — **≥ 20 caracteres** significativos. | ✅ (#123 schema) |
| **P-005** | NÃO PODE permitir que o autor do conteúdo seja o moderador desse item — item não aparece na fila dele (ADR-0024). | ✅ (#123 query) |
| **P-006** | NÃO PODE permitir operação de moderação que não passe pelo registro de auditoria padrão — `transitionContent` é a única via. | ✅ (#122) |
| **P-007** | NÃO PODE permitir moderação por usuário sem a permissão correspondente (catálogo USP-008, item 1/2/3). | ✅ (#123 `requirePermission`) |
| **L-001** | Listagem da fila ≤ 2s p95; submit da decisão ≤ 2s p95. | ✅ (NFR — `take`, `select` explícito) |
| **L-003** | Log imutável (append-only, ADR-0008) com decisor, item, decisão, motivo, data/hora. | ✅ (#122 via `audit_log`) |
| **E-005 / P-001** | Alerta operacional quando fila >10 pendentes ou item >48h. | ⏸ Diferido (GAP-5) |
| **P-002** | Aprovação de vaga de Empresa "não verificada" exige painel da USP-017. | ⏭ USP-017 |
| **P-004** | Exibir, ao lado de cada item moderado, atalho para inativar (USP-018). | ⏭ USP-018 |

## Independent Test

Um coordenador autenticado (com permissão de moderação) abre a fila e vê três rascunhos `IN_MODERATION` (uma vaga, um CV, um serviço), o mais antigo primeiro, **sem** os itens que ele mesmo criou. Ele aprova o primeiro (vira `ACTIVE`, autor recebe e-mail, há entrada de auditoria), devolve o segundo com motivo "Faltou descrever as atividades do cargo" (vira `AWAITING_ADJUSTMENTS`, e-mail com o motivo), e tenta rejeitar o terceiro com motivo "x" → bloqueado por motivo insuficiente; rejeita com motivo válido (vira `REJECTED`, e-mail). Nenhuma mudança de status ocorreu fora de `transitionContent`, e toda decisão tem log de auditoria na mesma transação.

## Módulos tocados

- **`src/modules/moderation`** (novo) — `domain/` (#121), `ports/` + `adapters/` + `actions/transitionContent` (#122), `actions/` de decisão + `queries/` + `views/` + `components/` + UI route (#123).
- **`prisma/schema.prisma`** — `enum ContentStatus` (já previsto; pode já existir via USP-009 — verificar para não colidir).
- **Reuso:** `withAudit` (`@/modules/audit`), `requirePermission` (`@/modules/identity`), `ActionResult` (`@/shared/errors`), `@/modules/audit/events` (catálogo de eventos).

## Lacunas & Decisões pendentes

- **GAP-1 (catálogo de eventos):** adicionar `CONTENT_APPROVED`, `CONTENT_RETURNED_FOR_ADJUSTMENTS`, `CONTENT_REJECTED`, `CONTENT_SUBMITTED_TO_MODERATION` ao catálogo `@/modules/audit/events` (#122).
- **GAP-2 (`ContentStatus` enum):** ✅ **verificado (2026-06-10)** — o enum **não existe** no `prisma/schema.prisma` (só há os enums de identity/consents/companies). A USP-009 (#36) não foi desenvolvida. **Decisão:** a #121 é a **owner** do `enum ContentStatus` (domínio TS em `moderation/domain` + enum Prisma). A USP-009 (#36) e demais USPs de conteúdo **reusam**, nunca redeclaram (atualizar o T1 da USP-009 quando ela for retomada).
- **GAP-8 (nenhum model de conteúdo existe ainda — dependência de ordenação):** ⚠ **descoberto (2026-06-10)** — não há `Job`/`Service`/`CandidateProfile` no schema (só `Company`). `transitionContent` (#122) faz `loadContentStatus`/`updateContentStatus` em colunas `status` dessas tabelas inexistentes. **Decisão:** abstrair o acesso atrás de um `ContentStatusRepository` (port) resolvido por `ContentKind` via `shared/container.ts`; o adapter Prisma concreto de cada tipo chega com a US do respectivo conteúdo. #121 (domínio puro) **não** é afetada. #122 entrega o port + 1 adapter concreto mínimo para o primeiro tipo disponível (ou tabela de fixture nos testes de integração) — registrar o tipo escolhido.
- **GAP-3 (port de notificação / USP-044):** `transitionContent` depende de um `NotificationPort` para o e-mail ao autor. O adapter Resend real e os templates são da USP-044 — entregar **port + adapter stub** (no-op logado) atrás de `shared/container.ts`, com testes mockando o port.
- **GAP-4 (hook Empresa verificada / USP-017):** o side effect `triggerVerifiedCompanyFlagIfApplicable` (JOB 1ª vez → `ACTIVE`) fica como **hook/port** chamado por `transitionContent`; a implementação do flag + painel é da USP-017.
- **GAP-5 (alerta de fila / E-005):** diferido — sem SLA no MVP. Registrar decisão em STATE.md.
- **GAP-6 (Estimate da #123):** ✅ **resolvido (2026-06-10)** — #123 estimada em 8h; Estimate da pai #117 recalculado para 20h (= 4+8+8), conforme regra 3 do OpenWolf.
- **GAP-7 (permissão):** confirmar os IDs do catálogo de permissões de moderação (itens 1/2/3, USP-008 / D-006) usados em `requirePermission` — D-006 é dependência aberta do card.
