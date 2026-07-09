# USP-033 — Manifestar interesse em serviço (spec)

> **Adapter de spec.** A fonte de requisitos é o épico
> `.specs/features/manifestacao-interesse-servico/spec.md` (P1 "Manifestar interesse")
> + PRD `docs/prd/prd-asonseg-portal-mvp.md` USP-033 (AC-033-1..3), USP-011 (AC-011-1,
> ativação automática do papel cliente) e USP-031 (AC-031-2/3, contato oculto até
> manifestação). Este arquivo **indexa** esses IDs e fixa os IDs de rastreio da USP;
> não os re-deriva.

**Fase:** 4 (Serviços + Manifestações) · **Unidade:** U3 · **Épico:** `manifestacao-interesse-servico`
**Módulo dono:** `@/modules/services` (agregado filho de `Service` — ver design §D1) · **Tudo NET-NEW.**
**Sizing:** **Large** (piso obrigatório — carrega must-nots de privacidade/LGPD e é fundacional do épico; nunca auto-rebaixado).
**Deps:** USP-011 (papel cliente / `ensureClientRole`), USP-029 (Service ACTIVE), USP-031 (seam da CTA).

## Problem statement

Cliente autenticado precisa sinalizar interesse num serviço ativo, de forma silenciosa,
receber **imediatamente** o contato do prestador, e o prestador ser avisado por e-mail —
com base legal (consentimento `SERVICE_HIRING`) e ativação automática do papel cliente na
primeira vez. Não há `ServiceInterest` no schema ainda (U2 deixou a relação de fora de
propósito — migração incremental planejada, análoga a USP-025 estendendo `applications`).

## Acceptance Criteria (rastreio)

| ID | Critério (EARS) | Origem |
|---|---|---|
| **AC-033-1** | QUANDO o cliente clica em "entrar em contato" num serviço ATIVO ENTÃO o sistema DEVE persistir a manifestação, exibir o contato do prestador e enfileirar e-mail ao prestador. | épico P1-1 / PRD AC-033-1 / AC-044-5 |
| **AC-033-2** | QUANDO o cliente ainda não tem o papel "cliente" ativo ENTÃO o sistema DEVE ativá-lo automaticamente, sem formulário adicional. | épico P1-2 / PRD AC-011-1 |
| **AC-033-3** | O sistema DEVE permitir múltiplas manifestações simultâneas em serviços **diferentes**. | épico P1-3 / PRD AC-033-3 |
| **AC-033-4** | QUANDO o consentimento `SERVICE_HIRING` não está ativo ENTÃO o sistema DEVE exigir e registrar o consentimento (aceite explícito do termo) **antes** de persistir a manifestação. | épico P1-4 |
| **AC-033-5** | QUANDO a manifestação é registrada ENTÃO o contato do prestador DEVE ser revelado ao cliente e permanecer visível **enquanto a manifestação estiver ativa**. | PRD AC-031-3 / épico goal |

## Must-nots (proibições de mundo — teste negativo obrigatório)

| ID | Proibição | Sensor |
|---|---|---|
| **SVC033-MN-01** | O contato do prestador (telefone/e-mail) **nunca** é carregado nem retornado a um viewer sem manifestação ativa (defesa RSC/Flight: recorte no `select`, não no JSX). | teste de não-vazamento no payload do detalhe anônimo/autenticado-sem-interesse |
| **SVC033-MN-02** | Papel `CLIENT` **nunca** chega a `ACTIVE` sem o `Consent SERVICE_HIRING` persistido na **mesma** transação (invariante P-001 de `ensureClientRole`). | teste: consent ausente + `consentAccepted!==true` ⇒ nada persistido |
| **SVC033-MN-03** | **No máximo uma** manifestação ATIVA por (cliente, serviço) — mesmo sob corrida (índice único parcial `WHERE cancelled_at IS NULL`). | teste de concorrência (2 inserts simultâneos ⇒ 1 ok + 1 CONFLICT) |
| **SVC033-MN-04** | Uma Pessoa **não** manifesta interesse no **próprio** serviço (autor == cliente). | teste: autor tenta manifestar ⇒ PRECONDITION_FAILED |
| **SVC033-MN-05** | Interesse **não** é aceito em serviço não-`ACTIVE` ou de prestador inativado (mesmo gate on-read de USP-031). | teste: serviço PAUSED/autor inativo ⇒ PRECONDITION_FAILED |

## Edge cases

- Serviço inexistente ⇒ `NOT_FOUND` (sem vazar existência).
- Consentimento recusado (`consentAccepted` ausente/false) e consent não-ativo ⇒ `CONSENT_REQUIRED`, sem persistir nem revelar contato.
- Já existe manifestação ativa para o mesmo serviço ⇒ `CONFLICT` (pré-check UX) / `P2002` (garantia no COMMIT).
- Falha ao enfileirar/enviar e-mail **não** reverte a manifestação nem a revelação (Outbox é best-effort assíncrono — AD-007; a criação da linha do Outbox é in-tx, mas o **dispatch** é USP-044).
- Termo `SERVICE_HIRING` indisponível/hash divergente (`loadTerm`) ⇒ `PRECONDITION_FAILED`.

## Success criteria

- [ ] Cliente sem papel manifesta em serviço ATIVO, papel `CLIENT` ativa automaticamente, consent `SERVICE_HIRING` registrado na mesma tx, contato do prestador revelado na tela e e-mail enfileirado ao prestador.
- [ ] Múltiplas manifestações em serviços diferentes coexistem; segunda manifestação ativa no **mesmo** serviço é barrada.
- [ ] Nenhum campo de contato do prestador entra no payload quando não há manifestação ativa.

## Out of scope (herdado do épico)

Chat interno, avaliação/reputação, confirmação de contratação, notificação ao cliente por
e-mail (contato é revelado on-screen; épico Out-of-Scope), coleta de mensagem opcional na UI
(coluna `message` criada nullable, mas o CTA MVP é 1-clique — ver design §D2).
