# USP-038 — Registrar resultado do encaminhamento manualmente — Specification

> **Source of truth (adapter mode).** Os critérios de aceite vivem no spec do épico
> `.specs/features/ficha-social-encaminhamento/spec.md` → história P1 "Registrar resultado do
> encaminhamento manualmente" (AC-1..AC-3). Este documento **indexa e reusa** aqueles ACs e o ID
> **SOC-05**; não deriva conjunto paralelo. Must-nots (REF38-MN-0x) são adições locais.
>
> **Unidade agregada.** Mesmo agregado `Referral` da USP-037. O **design é único**
> (`../usp-037-encaminhar-vaga/design.md`); esta USP referencia-o e só adiciona a fatia de
> registro de resultado. **Sem migração nova** — as colunas `result / resultObservation /
> resultRegisteredBy / resultRegisteredAt` e o enum `ReferralResult` **já foram criados (nullable)
> pela migração da USP-037**.

## Problem Statement

Após encaminhar uma Pessoa (USP-037), a ASONSEG precisa **registrar manualmente** o
resultado do encaminhamento (contratado, não selecionado, em análise, sem resposta)
quando souber por canal externo, para acompanhar o impacto institucional. Alimenta a
métrica **MP9** (% de encaminhamentos com resultado positivo — HIRED).

## Goals

- [ ] Usuário autorizado (`REGISTER_REFERRAL_RESULT`) registra o resultado de um `Referral` existente, persistindo `result` + `resultObservation` + `resultRegisteredBy` + `resultRegisteredAt`.
- [ ] O valor do resultado é restrito ao enum `ReferralResult` (HIRED / NOT_SELECTED / UNDER_REVIEW / NO_RESPONSE).

## Out of Scope

| Feature | Reason |
|---|---|
| Criação do `Referral` / candidatura / ativação de papel | É a **USP-037** (mesmo agregado). Esta USP só muta o resultado num `Referral` existente. |
| Migração de schema | As colunas de resultado **já existem** (migração da USP-037). |
| Atualização automática do resultado via integração com a Empresa | Épico Out-of-Scope; registro é **manual**. |
| Notificação/e-mail ao registrar resultado | Não previsto pelo épico; sem efeito colateral de notificação nesta USP. |
| Visão consolidada que exibe o resultado | É a **USP-039**. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| Nome do evento de auditoria = **`REFERRAL_RESULT_REGISTERED`** (já no catálogo). | agent | Usar o evento existente; **nenhum evento novo**. | `audit/events.ts:108`. | y |
| `REGISTER_REFERRAL_RESULT` já existe no catálogo (intrínseco COORDINATOR/SOCIAL_ASSISTANT + delegável). | agent | **Confirmar, não adicionar** (`identity/domain/permissions.ts`, `PermissionId`). | Já seedado. | y |
| O resultado é **mutável/re-registrável**: cada registro sobrescreve `result`/`resultObservation` e **atualiza** `resultRegisteredBy`/`resultRegisteredAt`; cada registro é auditado. | agent | Permitir atualização (ex.: UNDER_REVIEW → HIRED). | O épico não proíbe; o acompanhamento real evolui (a AS descobre o desfecho depois). MP9 lê o estado corrente. `resultRegisteredAt` sempre reflete o último registro. | y |
| `resultObservation` é **opcional**. | agent | Aceitar registro sem observação. | AC-1 cita observação, mas não a torna obrigatória; observação é contexto textual livre. | y |
| Registrar resultado **não** exige `requireActiveConsent` (não é operação vinculada a finalidade sobre a Pessoa). | agent | Pular o passo de consent da sequência (N/A). | Ação interna institucional da AS sobre dado do encaminhamento; não age em nome da Pessoa. | y |

**Open questions:** none — todas resolvidas ou logadas acima.

---

## User Story

### P1: Registrar resultado do encaminhamento manualmente ⭐ MVP

**User Story**: Como assistente social ou usuário autorizado, quero registrar
manualmente o resultado de um encaminhamento (contratado, não selecionado, em análise,
sem resposta) quando souber por canal externo para que a ASONSEG acompanhe o impacto
institucional do encaminhamento.

**Why P1**: Prioridade Must no PRD. Alimenta a métrica MP9.

**Acceptance Criteria** (reusados do épico — canônicos):

1. **AC-038-1** QUANDO o usuário autorizado (`REGISTER_REFERRAL_RESULT`) registra o resultado em um encaminhamento ENTÃO o sistema DEVE persistir o **resultado**, a **observação textual** e a **data do registro**.
2. **AC-038-2** QUANDO o usuário seleciona o resultado ENTÃO o sistema DEVE **restringir** os valores a `HIRED`, `NOT_SELECTED`, `UNDER_REVIEW` ou `NO_RESPONSE` (enum `ReferralResult`).
3. **AC-038-3** QUANDO o resultado é registrado ENTÃO o sistema DEVE persistir o **autor** do registro (`resultRegisteredBy`) e a **data** (`resultRegisteredAt`).

**Independent Test**: Logado como usuário autorizado, abrir um encaminhamento existente,
selecionar o resultado "contratado" (HIRED) com observação, salvar e reabrir confirmando
a persistência do resultado, observação, autor e data.

---

## Edge Cases

- **EC-1** QUANDO o `referralId` não existe ENTÃO o sistema DEVE retornar `NOT_FOUND` sem escrever.
- **EC-2** QUANDO o valor de `result` está fora do enum ENTÃO o sistema DEVE retornar `VALIDATION` sem escrever (→ REF38-MN-01).
- **EC-3** QUANDO o ator não tem `REGISTER_REFERRAL_RESULT` ENTÃO o sistema DEVE retornar `FORBIDDEN` sem escrever (→ REF38-MN-02).
- **EC-4** QUANDO um resultado é re-registrado num `Referral` que já tinha resultado ENTÃO o sistema DEVE sobrescrever e **atualizar** `resultRegisteredBy`/`resultRegisteredAt`, auditando o novo registro.

---

## Must-Nots (world-level prohibitions) — adições locais

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **REF38-MN-01** | QUANDO o valor de `result` está fora de {HIRED, NOT_SELECTED, UNDER_REVIEW, NO_RESPONSE} THEN o sistema NÃO DEVE persistir o resultado | Estado inválido em `Referral.result`; MP9 corrompida | T2 | `register-referral-result.int.test.ts` — valor inválido → `VALIDATION`, coluna `result` inalterada. |
| **REF38-MN-02** | QUANDO o ator não tem `REGISTER_REFERRAL_RESULT` (intrínseco ou delegado) THEN o sistema NÃO DEVE registrar/modificar o resultado | Registro de resultado por não-autorizado; adulteração de métrica institucional | T2 | `register-referral-result.int.test.ts` — ator sem permissão → `FORBIDDEN`, nenhuma coluna de resultado escrita. |
| **REF38-MN-03** | QUANDO um `result` é persistido THEN o sistema NÃO DEVE deixar `resultRegisteredBy`/`resultRegisteredAt` nulos (sem proveniência) | Resultado sem autor/data; auditoria/atribuição perdida | T2 | `register-referral-result.int.test.ts` — após registro, `resultRegisteredBy`=ator e `resultRegisteredAt`≠null sempre. |

---

## Requirement Traceability

Upstream (épico) canônico: **SOC-05** (→ USP-038). ACs reusam a numeração do épico (AC-038-N).

| Requirement ID | AC/Regra | Story | Phase | Status |
|---|---|---|---|---|
| SOC-05 | AC-038-1, AC-038-2, AC-038-3, EC-1..EC-4 | USP-038 | Tasks | Pending |
| REF38-MN-01 | AC-038-2, EC-2 (enum restrito) | USP-038 | Tasks | Pending |
| REF38-MN-02 | EC-3 (RBAC) | USP-038 | Tasks | Pending |
| REF38-MN-03 | AC-038-3 (proveniência) | USP-038 | Tasks | Pending |

**Coverage:** 4 requisitos (1 upstream + 3 must-not), todos mapeados a tasks.

---

## Success Criteria

- [ ] Resultado registrável entre HIRED / NOT_SELECTED / UNDER_REVIEW / NO_RESPONSE, com observação (opcional), autor e data, numa tx auditada (`REFERRAL_RESULT_REGISTERED`).
- [ ] Valor fora do enum → `VALIDATION`; `referralId` inexistente → `NOT_FOUND`; ator sem permissão → `FORBIDDEN`; nenhum deles escreve.
- [ ] Re-registro sobrescreve e atualiza autor/data.
- [ ] MP9 mensurável a partir dos resultados persistidos (HIRED / total com resultado).
