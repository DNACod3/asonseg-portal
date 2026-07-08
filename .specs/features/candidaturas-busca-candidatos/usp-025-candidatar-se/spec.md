# USP-025 — Candidatar-se a uma vaga (Specification)

> **Unidade U2 da Fase 3** — o *caminho de escrita* do agregado `Application`
> (candidatar + cancelar), planejado coeso com **USP-026**. Esta USP entrega o
> `applyToJob`; a USP-026 entrega o `cancelApplication`. A **migração única** e o
> **módulo único** de Server Actions são compartilhados (ver `design.md`).

## Source of truth (adapt, don't re-derive)

Esta spec é um **adaptador** da spec de épico e dos docs canônicos — não os reescreve:

| Fonte upstream | O que fixa | Âncora |
| --- | --- | --- |
| Spec de épico | História USP-025 (`CAN-01`) + edge cases de candidatura | `.specs/features/candidaturas-busca-candidatos/spec.md` |
| `technical-design.md` §3.4 / §2.5 | Sequência `applyToJob(jobId)` + contrato `Application` | `docs/arch/technical-design.md:353` e `:648` |
| STATE.md AD-012 | Forma mínima (só contagem) do `Application`; escrita/unicidade/encaminhamento **deferidos a esta USP** | `.specs/project/STATE.md` |
| STATE.md AD-007 | Padrão `Outbox` (enfileirar e-mail na mesma tx; dispatcher = USP-044) | `.specs/project/STATE.md` |
| CLAUDE.md | Sequência da Server Action sensível, View Models, DoD de testes | `CLAUDE.md` |

**IDs canônicos:** `CAN-01` (épico → USP-025) é o ID de topo. Esta spec o refina em
`CAN-025-NN` (uma por AC) e `CAN-025-MN-NN` (must-nots). Não cunha IDs paralelos.

## Problem Statement

Um candidato com perfil moderado (ativo) precisa manifestar interesse em uma vaga
ativa de forma silenciosa e única, com base legal LGPD (`JOB_APPLICATION`). Hoje a
tabela `applications` só é **lida** (contador do detalhe, AD-012): não há caminho de
escrita, nem garantia de unicidade da candidatura ativa sob concorrência. Sem isso não
há conexão candidato↔Empresa — o fluxo central de empregabilidade do portal.

## Goals

- [ ] Persistir uma candidatura (`Application`) de um candidato ativo a uma vaga ativa, dentro de `withAudit(APPLICATION_CREATED)`.
- [ ] Garantir **no máximo uma candidatura ativa** por `(candidato, vaga)` via constraint de banco (índice único parcial), à prova de concorrência.
- [ ] Verificar consentimento `JOB_APPLICATION` ativo **antes** de persistir e de expor o contato à Empresa.
- [ ] Enfileirar (não enviar) o e-mail de confirmação ao candidato na mesma transação (`Outbox`, AD-007).
- [ ] Oferecer o CTA "Candidatar-se" ao candidato ativo autenticado na página de detalhe da vaga.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Cancelar candidatura | USP-026 (mesmo agregado, dir irmão) — esta USP só cria. |
| Empresa ver lista de candidatos / revelar contato / `SENSITIVE_FIELD_VIEWED` | USP-027 (unidade separada). |
| Busca ativa de candidatos | USP-028. |
| Envio real do e-mail de confirmação (dispatcher do `Outbox`) | USP-044 — aqui só enfileira (AD-007). |
| FK `Referral` / `viaReferralId` e badge "Encaminhado pela ASONSEG" ativo | Model `Referral` é Fase 5 (USP-037). Materializa-se só o boolean `viaEncaminhamento=false` agora (ver Assumptions A-2). |
| Notificação à Empresa sobre nova candidatura | Candidatura é silenciosa no MVP (só o candidato recebe e-mail). |
| Página "minhas candidaturas" do candidato | Não é USP da Fase 3; o estado da candidatura é lido pontualmente na página de detalhe da vaga. |

---

## Assumptions & Open Questions

| # | Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- | --- |
| A-1 | **Módulo dono** do caminho de escrita | agent | `jobs` (`actions/apply-to-job.ts`, `schemas/application.schema.ts`, `domain/application-rules.ts`) | Não há módulo `candidaturas` na lista canônica de 11 (CLAUDE.md); `src/` é fechado (novo módulo = RFC). A relação `Application` mora em `Job`; AD-012 pôs a leitura (contador) em `jobs`; TD §2.5 agrupa "Vagas e candidaturas". `referrals` (Fase 5) importará este caminho via barrel `@/modules/jobs`. | y |
| A-2 | Badge de encaminhamento sem `Referral` | agent | Materializar `viaEncaminhamento Boolean @default(false)` **agora**; sempre `false` na Fase 3 | O model `Referral` (TD §4.5 `viaReferralId @unique`) é USP-037/Fase 5 e não existe. Materializar o boolean evita re-migração da tabela na Fase 5 e destrava a leitura do badge (USP-027). A USP-037 adicionará a FK `viaReferralId` e passará a setar `viaEncaminhamento=true`. **Divergência documentada de TD §4.5** (ver AD-017). | y |
| A-3 | **Estratégia de unicidade** | agent | Índice **único parcial** `(candidate_person_id, job_id) WHERE cancelled_at IS NULL` (SQL bruto na migração) | Garante 1 candidatura ativa e **permite recandidatura** após cancelar (a linha cancelada sai do índice). O `@@unique([jobId, candidatePersonId, appliedAt])` do TD §4.5 **não** impede duplicata ativa sob concorrência (appliedAt difere) — **não** será adotado. P2002 → `CONFLICT`. Mesmo padrão de `uq_person_company_active` (USP-013) e `consents_active_purpose_unique` (USP-043). | y |
| A-4 | **Autorização** do candidato | agent | Sessão (`getCurrentPerson`) + `CandidateProfile.publicationStatus = ACTIVE` (pré-condição) + `requireActiveConsent(JOB_APPLICATION)`. **Sem `requirePermission`** | Não existe `PermissionId` `APPLY_TO_JOB` no catálogo (só permissões institucionais/delegadas). Self-service não é RBAC-gated — mesmo padrão de `persons/actions/activate-candidate-role.ts`. O passo "requirePermission" da sequência canônica é substituído pelo gate de sessão+papel+consent. | y |
| A-5 | Superfície de UI do CTA | agent | Estender a página **pública** de detalhe da vaga (`(public)/vagas/[id]`), que já resolve `getCurrentPerson()` para CTA por papel; botão `'use client'` + `router.refresh()` | É a página onde o candidato vê a vaga. O CTA autenticado é aditivo (anônimo/público continua sem CTA — P-003/P-005 da USP-022 preservado para não-candidatos). | y |
| A-6 | E-mail de confirmação | agent | Novo template `application-confirmation` no port `EmailMessage`; enfileirado no `Outbox` (`topic:'email'`), guardado por `emailLogin` presente | AD-007 exige `tx.outbox.create`. Só o candidato recebe (silencioso p/ Empresa). Sem `emailLogin`, cria a candidatura sem enfileirar (como `add-responsible`). | y |

**Entry Gate (Tasks §0):** nenhum item acima tem **owner externo** não resolvido do qual a implementação dependa. O termo de consentimento `JOB_APPLICATION` já existe (usado pela USP-009). **Não há gate jurídico novo.** → Entry Gate **ABERTO**, prossegue para task breakdown.

**Open questions:** none — todas resolvidas ou logadas acima.

---

## User Stories

### P1: Candidatar-se a uma vaga ⭐ MVP

**User Story**: Como Pessoa com papel candidato **ativo**, quero candidatar-me a uma vaga ativa para que a Empresa veja meu interesse e considere meu perfil.

**Why P1**: Fluxo central de empregabilidade; sem candidatura não há conexão candidato↔Empresa.

**Acceptance Criteria**:

1. `CAN-025-01` — WHEN o candidato ativo (perfil `ACTIVE`) com consentimento `JOB_APPLICATION` ativo aciona "candidatar-se" em uma vaga ativa THEN o sistema SHALL persistir uma `Application` (`jobId`, `candidatePersonId`, `appliedAt`, `viaEncaminhamento=false`, `cancelledAt=null`) dentro de `withAudit(APPLICATION_CREATED)` e retornar `{ ok: true, data: { applicationId } }`.
2. `CAN-025-02` — WHEN a candidatura é persistida com sucesso THEN o sistema SHALL enfileirar (não enviar) uma linha `Outbox` `topic='email'`, template `application-confirmation`, na **mesma transação** do `withAudit`.
3. `CAN-025-03` — WHEN o candidato já tem candidatura ativa (não cancelada) à mesma vaga THEN o sistema SHALL bloquear a nova candidatura (`{ ok: false, error.code: 'CONFLICT' }`) sem criar segunda linha.
4. `CAN-025-04` — WHEN o perfil do candidato não está `ACTIVE` (inexistente/`DRAFT`/em moderação) THEN o sistema SHALL bloquear a candidatura (`PRECONDITION_FAILED`).
5. `CAN-025-05` — WHEN o candidato não possui consentimento `JOB_APPLICATION` ativo THEN o sistema SHALL impedir a candidatura (`CONSENT_REQUIRED`) sem criar `Application` nem enfileirar e-mail.
6. `CAN-025-06` — WHEN o candidato ativo autenticado abre uma vaga ativa à qual ainda não se candidatou THEN a página de detalhe SHALL exibir o CTA "Candidatar-se"; após candidatar com sucesso, SHALL refletir o estado "Você já se candidatou".

**Independent Test**: Com candidato de perfil `ACTIVE` e consentimento `JOB_APPLICATION`, candidatar-se a uma vaga ativa e verificar: `Application` persistida (com `viaEncaminhamento=false`), linha `Outbox` `application-confirmation` enfileirada na mesma tx, evento `APPLICATION_CREATED` no `audit_log`, e nova candidatura à mesma vaga bloqueada com `CONFLICT`.

---

## Edge Cases

- `CAN-025-E1` — WHEN a vaga não está mais ativa (não `ACTIVE`, expirada `validUntil < hoje(SP)`, ou Empresa não verificada) THEN o sistema SHALL bloquear a candidatura (`PRECONDITION_FAILED`), reusando o `where` on-read de `search-jobs.ts`.
- `CAN-025-E2` — WHEN a vaga (`jobId`) não existe THEN o sistema SHALL retornar `NOT_FOUND`.
- `CAN-025-E3` — WHEN o `jobId` é inválido (não-UUID/ausente) THEN o sistema SHALL retornar `VALIDATION` (Zod) sem tocar o banco.
- `CAN-025-E4` — WHEN não há sessão ativa THEN o sistema SHALL retornar `UNAUTHENTICATED`.
- `CAN-025-E5` — WHEN duas tentativas concorrentes do mesmo candidato à mesma vaga chegam simultaneamente THEN exatamente **uma** cria a `Application` e a outra recebe `CONFLICT` (índice único parcial / P2002) — invariante: 1 linha ativa.
- `CAN-025-E6` — WHEN o candidato havia cancelado uma candidatura anterior à mesma vaga THEN uma nova candidatura SHALL ser aceita (nova linha ativa; a cancelada permanece como histórico) — a recandidatura é entregue pela USP-026, mas a **constraint** que a habilita nasce aqui.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| `CAN-025-MN-01` | WHEN já existe candidatura ativa para `(candidato, vaga)` — inclusive sob requisições concorrentes — THEN SHALL NOT criar uma segunda `Application` ativa | Duplicata/spam de candidatura + contador (E-003) inflado | T1 (índice único parcial) + T4 (catch P2002→CONFLICT) | `@ac-can-025-mn-01` corrida `Promise.all` → 1 linha ativa, 1 `CONFLICT` |
| `CAN-025-MN-02` | WHEN não há consentimento `JOB_APPLICATION` ativo THEN SHALL NOT persistir `Application` nem enfileirar o e-mail | Violação LGPD — tratar candidatura sem base legal | T4 | `@ac-can-025-mn-02` sem consent → `CONSENT_REQUIRED`, 0 linhas em `applications`, 0 em `outbox` |
| `CAN-025-MN-03` | WHEN a vaga não está ativa/expirada/Empresa-não-verificada, OU o perfil do candidato não está `ACTIVE`, THEN SHALL NOT persistir `Application` | Candidatura a vaga morta / por perfil não moderado | T4 | `@ac-can-025-mn-03` vaga expirada → `PRECONDITION_FAILED`, 0 linhas; perfil `DRAFT` → `PRECONDITION_FAILED`, 0 linhas |

---

## Requirement Traceability

| Requirement ID | Story / origem | Phase | Status |
| --- | --- | --- | --- |
| CAN-01 (épico) | USP-025 | Design | In Design |
| CAN-025-01 | AC-1 | Tasks | Pending |
| CAN-025-02 | AC-2 (Outbox) | Tasks | Pending |
| CAN-025-03 | AC-3 (duplicata) | Tasks | Pending |
| CAN-025-04 | AC-4 (perfil) | Tasks | Pending |
| CAN-025-05 | AC-5 (consent) | Tasks | Pending |
| CAN-025-06 | AC-6 (CTA) | Tasks | Pending |
| CAN-025-E1..E6 | Edge cases | Tasks | Pending |
| CAN-025-MN-01 | Must-not (unicidade) | Tasks | Pending |
| CAN-025-MN-02 | Must-not (consent) | Tasks | Pending |
| CAN-025-MN-03 | Must-not (vaga/perfil) | Tasks | Pending |

**Coverage:** 14 requisitos (6 AC + 6 edge + 3 must-not, alguns compartilham task). Mapeamento a tasks em `tasks.md`.

## Success Criteria

- [ ] Candidato ativo com consentimento `JOB_APPLICATION` candidata-se a uma vaga ativa; a `Application` (com `viaEncaminhamento=false`) é persistida e o e-mail `application-confirmation` é enfileirado na mesma tx.
- [ ] A unicidade da candidatura ativa é garantida pelo banco, inclusive sob concorrência (1 ativa por candidato/vaga; recandidatura possível após cancelar).
- [ ] Candidatura sem consentimento, com perfil não-ativo, ou a vaga não-ativa/expirada é bloqueada sem efeito colateral (0 linhas, 0 outbox).
- [ ] Todo caminho feliz gera `APPLICATION_CREATED` no `audit_log`.
- [ ] O CTA "Candidatar-se" aparece para o candidato ativo autenticado e some após candidatar.
