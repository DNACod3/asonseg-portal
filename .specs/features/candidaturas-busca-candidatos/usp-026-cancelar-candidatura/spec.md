# USP-026 — Cancelar candidatura (Specification)

> **Unidade U2 da Fase 3** — a metade *cancelar* do agregado `Application`, planejada coesa
> com **USP-025** (candidatar). A **migração é única e pertence à USP-025** (adiciona
> `viaEncaminhamento` + o índice único parcial que habilita a recandidatura). Esta USP
> **não migra schema**: entrega apenas o `cancelApplication` e a UI de cancelar. Ver
> `design.md` (auto-suficiente, com o estado de schema relevante restated).

## Source of truth (adapt, don't re-derive)

| Fonte upstream | O que fixa | Âncora |
| --- | --- | --- |
| Spec de épico | História USP-026 (`CAN-02`) + edge case de cancelamento | `.specs/features/candidaturas-busca-candidatos/spec.md` |
| USP-025 (dir irmão) | Agregado `Application`, migração compartilhada, `applyToJob` (usado na recandidatura) | `.specs/features/candidaturas-busca-candidatos/usp-025-candidatar-se/` |
| STATE.md AD-012 | `cancelledAt` (soft-cancel; null=ativa) já existe | `.specs/project/STATE.md` |
| `audit/events.ts` | `APPLICATION_CANCELLED` já no catálogo (não exige justification) | `src/modules/audit/events.ts:79` |
| CLAUDE.md | Sequência da Server Action sensível, DoD de testes | `CLAUDE.md` |

**IDs canônicos:** `CAN-02` (épico → USP-026). Refinado em `CAN-026-NN` (AC) e `CAN-026-MN-NN` (must-nots).

## Problem Statement

Um candidato precisa desfazer uma candidatura que não faz mais sentido, dando controle
sobre seus próprios dados (LGPD) e liberando a **recandidatura** à mesma vaga. O campo
`cancelledAt` (soft-cancel) já existe (AD-012), mas não há caminho de escrita para
preenchê-lo, nem garantia de que o cancelamento seja idempotente e restrito ao dono.

## Goals

- [ ] Marcar uma candidatura ativa do próprio candidato como cancelada (`cancelledAt`), dentro de `withAudit(APPLICATION_CANCELLED)`.
- [ ] Restringir o cancelamento ao **dono** da candidatura (sem vazar existência de candidaturas de terceiros).
- [ ] Tornar o cancelamento idempotente/seguro: cancelar já-cancelada/inexistente não altera estado nem emite auditoria.
- [ ] Habilitar a recandidatura à mesma vaga após o cancelamento (nova `Application` ativa).
- [ ] Oferecer o CTA "Cancelar candidatura" ao candidato com candidatura ativa na página de detalhe da vaga.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Migração de schema (`viaEncaminhamento` + índice único parcial) | Pertence à USP-025 (migração única do agregado). |
| Criar candidatura (`applyToJob`) | USP-025 — esta USP só cancela (e usa `applyToJob` na prova de recandidatura). |
| Empresa ver/deixar de ver o candidato na lista | USP-027 — aqui garante-se apenas que a contagem ativa (`cancelledAt IS NULL`) exclui a cancelada. |
| Notificação de cancelamento à Empresa | Candidatura é silenciosa no MVP. |

---

## Assumptions & Open Questions

| # | Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- | --- |
| A-1 | Módulo dono | agent | `jobs` (`actions/cancel-application.ts`) — mesma decisão da USP-025 (A-1) | Coesão do agregado; barrel `@/modules/jobs`. | y |
| A-2 | **Owner + existência** foldados | agent | Query escopada a `candidatePersonId = person.id`; não encontrada → `NOT_FOUND` (sem revelar candidatura de terceiro) | Evita canal de enumeração de candidaturas alheias e resolve MN-01 sem `FORBIDDEN` que vaze existência. | y |
| A-3 | **Consent no cancelamento** | agent | **Não** exige `requireActiveConsent` | Cancelar é retirar tratamento de dados — sempre permitido ao titular; exigir consent para retirar seria incoerente. | y |
| A-4 | **Idempotência** | agent | Pré-check (`cancelledAt != null` → erro) **+** `updateMany where cancelledAt:null` (optimistic) na tx | Duplo cancelamento concorrente: só um `count===1`; o outro não muta estado nem emite auditoria (MN-02). | y |
| A-5 | Identificador de entrada | agent | `applicationId` (uuid) no input; **sem `personId`** (P-002) | A candidatura tem id estável; opera-se sobre a sessão. | y |
| A-6 | Recandidatura | agent | Nova `Application` (novo id); a cancelada permanece como histórico | O índice único parcial (USP-025) só conta `cancelled_at IS NULL` → nova linha ativa é aceita. Sem "descancelar". | y |

**Entry Gate (Tasks §0):** nenhum item com owner externo não resolvido. Depende da migração da USP-025 (owner `agent`, planejada no dir irmão). → Entry Gate **ABERTO**.

**Open questions:** none.

---

## User Stories

### P1: Cancelar candidatura ⭐ MVP

**User Story**: Como candidato, quero cancelar uma candidatura que eu fiz para desfazer uma candidatura que não faz mais sentido.

**Why P1**: Dá controle ao candidato sobre suas candidaturas e libera a recandidatura.

**Acceptance Criteria**:

1. `CAN-026-01` — WHEN o candidato cancela uma candidatura **ativa** e sua THEN o sistema SHALL preencher `cancelledAt` dentro de `withAudit(APPLICATION_CANCELLED)`, excluindo-a da contagem ativa (`cancelledAt IS NULL`), e retornar `{ ok: true, data: { applicationId } }`.
2. `CAN-026-02` — WHEN uma candidatura foi cancelada THEN o sistema SHALL permitir nova candidatura à mesma vaga posteriormente (nova `Application` ativa aceita pelo índice único parcial).
3. `CAN-026-03` — WHEN o candidato com candidatura ativa abre a vaga THEN a página de detalhe SHALL exibir o CTA "Cancelar candidatura"; após cancelar, SHALL voltar a exibir "Candidatar-se".

**Independent Test**: Cancelar uma candidatura ativa e verificar que `cancelledAt` foi preenchido, que a contagem ativa cai (a cancelada sai), que `APPLICATION_CANCELLED` foi registrado, e que uma nova candidatura à mesma vaga (`applyToJob`) passa a ser aceita.

---

## Edge Cases

- `CAN-026-E1` — WHEN o candidato cancela uma candidatura **já cancelada** THEN o sistema SHALL retornar erro (`PRECONDITION_FAILED`) sem alterar `cancelledAt` (timestamp estável) nem emitir auditoria.
- `CAN-026-E2` — WHEN o `applicationId` não existe (ou pertence a outro candidato) THEN o sistema SHALL retornar `NOT_FOUND` sem alterar estado.
- `CAN-026-E3` — WHEN o `applicationId` é inválido (não-UUID/ausente) THEN o sistema SHALL retornar `VALIDATION` sem tocar o banco.
- `CAN-026-E4` — WHEN não há sessão ativa THEN o sistema SHALL retornar `UNAUTHENTICATED`.
- `CAN-026-E5` — WHEN dois cancelamentos concorrentes da mesma candidatura chegam simultaneamente THEN exatamente **um** preenche `cancelledAt` e o outro não muta estado (optimistic `updateMany`).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| `CAN-026-MN-01` | WHEN um candidato tenta cancelar uma candidatura que **não é dele** THEN SHALL NOT cancelá-la (sem alterar `cancelledAt`, sem emitir `APPLICATION_CANCELLED`) | Adulteração da candidatura de terceiro / vazamento de existência | T1 | `@ac-can-026-mn-01` PessoaB cancela candidatura da PessoaA → `NOT_FOUND`; linha da A intacta; 0 auditoria |
| `CAN-026-MN-02` | WHEN se cancela uma candidatura já cancelada ou inexistente THEN SHALL NOT mutar estado nem emitir `APPLICATION_CANCELLED` | Efeito colateral de duplo-cancelamento / reescrita de `cancelledAt` / auditoria espúria | T1 | `@ac-can-026-mn-02` cancelar 2x → 2º retorna erro; `cancelledAt` inalterado (mesmo timestamp); exatamente 1 evento no `audit_log` |

---

## Requirement Traceability

| Requirement ID | Story / origem | Phase | Status |
| --- | --- | --- | --- |
| CAN-02 (épico) | USP-026 | Design | In Design |
| CAN-026-01 | AC-1 (cancelar) | Tasks | Pending |
| CAN-026-02 | AC-2 (recandidatura) | Tasks | Pending |
| CAN-026-03 | AC-3 (CTA) | Tasks | Pending |
| CAN-026-E1..E5 | Edge cases | Tasks | Pending |
| CAN-026-MN-01 | Must-not (ownership) | Tasks | Pending |
| CAN-026-MN-02 | Must-not (idempotência) | Tasks | Pending |

**Coverage:** 10 requisitos (3 AC + 5 edge + 2 must-not). Mapeamento em `tasks.md`.

## Success Criteria

- [ ] Candidato cancela candidatura ativa própria: `cancelledAt` preenchido, `APPLICATION_CANCELLED` no `audit_log`, contagem ativa cai.
- [ ] Cancelar de terceiro → `NOT_FOUND`, sem efeito; cancelar já-cancelada → erro, sem efeito.
- [ ] Após cancelar, `applyToJob` à mesma vaga é aceito (recandidatura).
- [ ] O CTA "Cancelar candidatura" aparece quando há candidatura ativa e volta a "Candidatar-se" após cancelar.
