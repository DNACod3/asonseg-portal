# USP-037 — Encaminhar Pessoa para vaga — Specification

> **Source of truth (adapter mode).** Os critérios de aceite desta USP vivem no
> spec do épico `.specs/features/ficha-social-encaminhamento/spec.md` → história P1
> "Encaminhar Pessoa para vaga" (AC-1..AC-7 + Edge Cases). Este documento **indexa e
> reusa** aqueles ACs e os IDs de rastreabilidade **SOC-03 / SOC-04**; não deriva um
> conjunto paralelo. Os Must-Nots (REF-MN-0x) são **adições locais** que traduzem as
> proibições implícitas do épico (bloqueios) em ACs negativos de primeira classe.
>
> **Unidade agregada.** USP-037 e USP-038 são um único agregado `Referral`. O **design
> é único e coerente** (`../usp-037-encaminhar-vaga/design.md`), referenciado por ambas.
> USP-037 é dona do schema/migração do agregado (incluindo as colunas de resultado
> **nullable**); USP-038 não re-migra nada (só adiciona a ação/UI de resultado).

## Problem Statement

Hoje a ASONSEG não tem mecanismo formal para que a assistente social (AS),
coordenadores ou voluntários delegados **encaminhem institucionalmente** uma Pessoa já
cadastrada para uma vaga ativa. O encaminhamento precisa: ativar o papel candidato
automaticamente (aceite tácito), gerar uma candidatura vinculada com badge institucional
para a Empresa ver, e disparar um e-mail informativo à Pessoa — tudo de forma auditada e
em conformidade LGPD. É a ação central do épico e a fonte da métrica **MP8**
(nº de encaminhamentos criados).

## Goals

- [ ] AS/coordenador/voluntário com permissão delegada `REFER_PERSON_TO_JOB` encaminha uma Pessoa para uma **vaga ativa**, persistindo o `Referral`.
- [ ] O papel **candidato** é ativado automaticamente quando ausente, com **aceite tácito** `SOCIAL_REFERRAL_TO_JOB`, na mesma transação auditada.
- [ ] O encaminhamento gera **candidatura vinculada** (`Application` com `viaReferralId` + `viaEncaminhamento=true`) com badge **"Candidato encaminhado pela ASONSEG"** e enfileira e-mail informativo à Pessoa.
- [ ] Quando a Pessoa **não tem CV anexo**, o **resumo profissional textual** é exigido e persistido no `Referral`.
- [ ] O encaminhamento é **bloqueado** quando a vaga não está ativa (revalidado no momento da persistência).

## Out of Scope

| Feature | Reason |
|---|---|
| Aceite prévio **explícito** da Pessoa antes do encaminhamento | Épico Out-of-Scope: encaminhamento institucional usa **aceite tácito** `SOCIAL_REFERRAL_TO_JOB`; a Pessoa recebe apenas e-mail informativo. |
| Registro do **resultado** do encaminhamento | É a **USP-038** (mesmo agregado; colunas já migradas por esta USP). |
| Visão consolidada da Pessoa (listar encaminhamentos num painel) | É a **USP-039**. Esta USP só cria o `Referral`; a leitura consolidada é da 039. |
| Envio real do e-mail (dispatcher) | AD-007: apenas **enfileiramos** no `Outbox`; o dispatcher é a **USP-044**. |
| Atualização automática de resultado via integração com a Empresa | Épico Out-of-Scope; resultado é manual (USP-038). |
| Coleta de região/CV no cadastro do candidato ativado por encaminhamento | Fora do escopo; o `Referral` guarda o resumo textual quando não há CV. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| Nome do evento de auditoria do encaminhamento é **`REFERRAL_CREATED`** (não `SOCIAL_REFERRAL_CREATED`). | agent | Usar `REFERRAL_CREATED` (já existe no catálogo `audit/events.ts:107`). | O catálogo já traz `REFERRAL_CREATED` + `REFERRAL_RESULT_REGISTERED`; o nome do prompt do orquestrador estava aproximado. **Nenhum evento novo é necessário.** | y |
| `REFER_PERSON_TO_JOB` já existe no catálogo de permissões (intrínseca a COORDINATOR/SOCIAL_ASSISTANT + delegável). | agent | **Confirmar, não adicionar** (`identity/domain/permissions.ts`, `PermissionId` no schema). | Já seedado à frente da implementação (precedente USP-008). | y |
| Papel candidato ativado por encaminhamento **não exige** consent base `PORTAL_ACCESS` da Pessoa (diverge de `ensureClientRole`). | agent | Ativar sem gate de `PORTAL_ACCESS`. | Edge case do épico: Pessoa cadastrada pela AS **sem credencial** (sem e-mail/senha) precisa poder ser encaminhada; a ação é **institucional** sob `SOCIAL_REFERRAL_TO_JOB` (base LGPD art. 7º IX). ⚠️ Divergência LGPD relevante — destacada no resumo ao orquestrador. | y |
| A base legal do papel candidato ativado por encaminhamento é `SOCIAL_REFERRAL_TO_JOB` (tácito), **distinta** do aceite self-service `JOB_APPLICATION`. | agent | Registrar consent tácito `SOCIAL_REFERRAL_TO_JOB` na tx; **não** exigir `JOB_APPLICATION`. | AC-037-2 é explícito ("aceite tácito SOCIAL_REFERRAL_TO_JOB"). `PURPOSE_ROLE_MAP[SOCIAL_REFERRAL_TO_JOB]=null` permanece null (revogar o consent do encaminhamento **não** cascateia revogação do papel candidato — a Pessoa pode ter candidaturas independentes). | y |
| A `Application` do encaminhamento é escrita por um helper **owned por `jobs`** (`createReferralApplication`), participante da tx do `Referral`; `referrals` não escreve na tabela `applications` diretamente. | agent | Novo helper tx-participante em `@/modules/jobs` (precedente `ensureClientRole` em persons chamado por services). | AD-017: Application é do módulo `jobs`; `referrals` importa de `@/modules/jobs`. `applyToJob` **não** serve (exige sessão do próprio candidato + consent `JOB_APPLICATION` + profile ACTIVE — incompatível com o encaminhamento). | y |
| `viaEncaminhamento` (boolean, já materializado por AD-017/USP-025) **coexiste** com o novo FK `viaReferralId`. | agent | Manter ambos; invariante `viaReferralId != null ⟺ viaEncaminhamento = true`. | USP-027 já lê `viaEncaminhamento` para o badge (AD-017 impact). O FK é o vínculo autoritativo (1:1) para USP-039. Evita re-migrar/re-cabear USP-027. | y |
| Badge institucional = **"Candidato encaminhado pela ASONSEG"** (literal canônico do PRD/épico AC-037-5), não a variante curta antes registrada nesta linha. | agent | Usar "Candidato encaminhado pela ASONSEG". | O PRD/épico (AC-037-5) e o código (`job-applicants-list.tsx`) já usam o literal longo; esta linha e o TD §3.5 estavam desalinhados (SOC-6, USP-059). | y |
| Múltiplos `Referral` para a mesma (Pessoa, vaga) ao longo do tempo são permitidos; a unicidade "uma candidatura ativa" é garantida **só** por `uq_application_active`. | agent | Sem índice único adicional no `Referral`. | Ver seção "Uniqueness". Um novo encaminhamento após cancelar a candidatura é válido (histórico). | y |
| Termo `social-referral-to-job/v1.0.md` + hash no `TERMS_REGISTRY` já existem. | agent | Reusar `loadTerm('SOCIAL_REFERRAL_TO_JOB')`. | Arquivo `legal/consent-terms/social-referral-to-job/v1.0.md` `status: aprovado`, hash registrado. | y |

**Open questions:** none — todas resolvidas ou logadas acima.

---

## Uniqueness & múltiplos encaminhamentos (AC-037-6)

- **Mesma Pessoa → vagas diferentes:** múltiplos `Referral` permitidos (AC-037-6). Nenhuma restrição.
- **Mesma Pessoa → mesma vaga:** o `Referral` cria uma `Application`, e o índice único parcial existente `uq_application_active ON applications (candidate_person_id, job_id) WHERE cancelled_at IS NULL` (AD-017) garante **no máximo 1 candidatura ativa** por (candidato, vaga). Logo, um 2º encaminhamento para a **mesma vaga enquanto há candidatura ativa** é **bloqueado** (pré-check UX → `CONFLICT`; garantia real = `INSERT` da Application dispara `P2002` dentro da tx → **rollback atômico do encaminhamento inteiro**, sem `Referral` órfão).
- **Após cancelar a candidatura (USP-026):** a linha cancelada sai do índice parcial; um **novo** `Referral` + nova `Application` para a mesma vaga são permitidos (histórico preservado).
- **Decisão:** **nenhum índice único adicional no `Referral`.** A invariante "uma candidatura ativa" mora só em `uq_application_active`; o vínculo 1:1 `Referral↔Application` é garantido por `viaReferralId @unique`.

---

## User Story

### P1: Encaminhar Pessoa para vaga ⭐ MVP

**User Story**: Como assistente social, coordenador ou voluntário com permissão
delegada, quero encaminhar uma Pessoa já cadastrada para uma vaga ativa para que a
Empresa receba a recomendação institucional da ASONSEG.

**Why P1**: Prioridade Must no PRD. Ação central do épico e fonte da métrica MP8.

**Acceptance Criteria** (reusados do épico — canônicos):

1. **AC-037-1** QUANDO o usuário autorizado (`REFER_PERSON_TO_JOB`) submete um encaminhamento com Pessoa e vaga selecionadas ENTÃO o sistema DEVE persistir o encaminhamento (`Referral`).
2. **AC-037-2** QUANDO a Pessoa não tem papel candidato ativo ENTÃO o sistema DEVE ativar o papel candidato automaticamente, com **aceite tácito** `SOCIAL_REFERRAL_TO_JOB`, na mesma transação.
3. **AC-037-3** QUANDO a Pessoa não tem CV anexo ENTÃO o sistema DEVE exigir **resumo profissional textual obrigatório** como parte do encaminhamento e persisti-lo no `Referral`.
4. **AC-037-4** QUANDO o usuário informa o motivo do encaminhamento ENTÃO o sistema DEVE persistir o motivo como campo **opcional** (`justification`).
5. **AC-037-5** QUANDO o encaminhamento é persistido ENTÃO o sistema DEVE gerar **candidatura vinculada** ao encaminhamento (`Application.viaReferralId` + `viaEncaminhamento=true`), com badge **"Candidato encaminhado pela ASONSEG"**, e **enfileirar** e-mail informativo à Pessoa.
6. **AC-037-6** QUANDO o usuário encaminha a mesma Pessoa para vagas diferentes ENTÃO o sistema DEVE permitir **múltiplos** encaminhamentos.
7. **AC-037-7** QUANDO a vaga selecionada não está com status "ativo" ENTÃO o sistema DEVE **bloquear** o encaminhamento.

**Independent Test**: Logado como AS, encaminhar uma Pessoa **sem CV** para uma vaga
ativa; confirmar que o sistema exige o resumo profissional, ativa o papel candidato
(consent `SOCIAL_REFERRAL_TO_JOB` gravado), cria a candidatura com badge
"Candidato encaminhado pela ASONSEG" e enfileira o e-mail; repetir contra uma vaga inativa e
confirmar o bloqueio.

---

## Edge Cases

- **EC-1** QUANDO a Pessoa não possui CV anexo e o resumo profissional não é informado ENTÃO o sistema DEVE **bloquear a submissão** e exigir o resumo (→ REF-MN-03).
- **EC-2** QUANDO a Pessoa não possui credencial (cadastro sem e-mail feito pela AS) ENTÃO o sistema DEVE permitir o encaminhamento e a ativação do papel candidato, mas **manter o e-mail informativo sem efeito** (no-op de enfileiramento quando não há `emailLogin`).
- **EC-3** QUANDO a vaga muda de "ativo" para inativo **após a seleção mas antes da submissão** ENTÃO o sistema DEVE **revalidar o status dentro da transação** e bloquear (→ REF-MN-02).
- **EC-4** QUANDO já existe candidatura ativa para (Pessoa, vaga) ENTÃO o sistema DEVE bloquear o 2º encaminhamento com `CONFLICT` e **não** criar `Referral`/`Application` (rollback atômico, → REF-MN-01).
- **EC-5** QUANDO o input Zod é inválido (personId/jobId ausente/mal-formado) ENTÃO o sistema DEVE retornar `VALIDATION` sem escrever.

---

## Must-Nots (world-level prohibitions) — adições locais

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **REF-MN-01** | QUANDO já existe candidatura **ativa** para (Pessoa, vaga) THEN o sistema NÃO DEVE criar uma 2ª candidatura ativa nem um `Referral` órfão | Duplicidade de candidatura ativa via encaminhamento; contagem MP8 inflada; badge duplicado para a Empresa | T6 | `create-referral.int.test.ts` — 2º encaminhamento concorrente/duplicado → `CONFLICT`, exatamente 1 candidatura ativa, `Referral` do 2º attempt não persistido (rollback). Sensor: exercitar o índice `uq_application_active` (P2002), não só o pré-check da app (lição L-010). |
| **REF-MN-02** | QUANDO a vaga **não está ACTIVE** no momento da persistência THEN o sistema NÃO DEVE criar o `Referral` nem a `Application` | Encaminhar para vaga pausada/expirada/arquivada; candidatura inválida; e-mail enganoso à Pessoa | T6 | `create-referral.int.test.ts` — vaga PAUSED/EXPIRED (e flip ACTIVE→não-ACTIVE dentro da janela) → bloqueado, **zero** linhas persistidas. |
| **REF-MN-03** | QUANDO a Pessoa não tem CV anexo **e** nenhum resumo profissional é informado THEN o sistema NÃO DEVE criar o encaminhamento | Encaminhamento sem contexto profissional mínimo; recomendação institucional vazia | T3 (regra pura) + T6 (enforcement) | `referral-rules.spec.ts` (regra pura, 1:1) + `create-referral.int.test.ts` — sem CV + resumo vazio → `VALIDATION`, zero linhas. |
| **REF-MN-04** | QUANDO o ator não tem `REFER_PERSON_TO_JOB` (intrínseco ou delegado) THEN o sistema NÃO DEVE criar o encaminhamento | Encaminhamento por voluntário comum sem delegação; ação sensível sem RBAC | T6 | `create-referral.int.test.ts` — ator sem permissão → `FORBIDDEN`, zero linhas. |

---

## Requirement Traceability

Upstream (épico) canônico: **SOC-03**, **SOC-04** (ambos → USP-037). ACs reusam a
numeração do épico (AC-037-N). Must-nots são adições locais.

| Requirement ID | AC/Regra | Story | Phase | Status |
|---|---|---|---|---|
| SOC-03 | AC-037-1, AC-037-2, AC-037-4, AC-037-5 (write path: referral + role + application + e-mail) | USP-037 | Tasks | Pending |
| SOC-04 | AC-037-3, AC-037-6, AC-037-7, EC-1..EC-4 (guards/validações) | USP-037 | Tasks | Pending |
| REF-MN-01 | EC-4 (unicidade candidatura ativa) | USP-037 | Tasks | Pending |
| REF-MN-02 | AC-037-7, EC-3 (vaga ativa @persist) | USP-037 | Tasks | Pending |
| REF-MN-03 | AC-037-3, EC-1 (resumo quando sem CV) | USP-037 | Tasks | Pending |
| REF-MN-04 | AC-037-1 (RBAC) | USP-037 | Tasks | Pending |

**Coverage:** 6 requisitos rastreáveis (2 upstream + 4 must-not), todos mapeados a tasks (ver `tasks.md`).

---

## Success Criteria

- [ ] Encaminhamento cria `Referral` + `Application` vinculada (`viaReferralId`/`viaEncaminhamento=true`) com badge "Candidato encaminhado pela ASONSEG", ativa papel candidato (consent tácito `SOCIAL_REFERRAL_TO_JOB`) e enfileira e-mail — tudo numa transação auditada (`REFERRAL_CREATED` + `CANDIDATE_ROLE_ACTIVATED` + `CONSENT_GRANTED` + `APPLICATION_CREATED`).
- [ ] Sem CV + sem resumo → bloqueio `VALIDATION`; vaga não-ativa (inclusive flip dentro da janela) → bloqueio; duplicata ativa → `CONFLICT` com rollback.
- [ ] Pessoa sem `emailLogin` → encaminhamento OK, e-mail não enfileirado (no-op).
- [ ] Ator sem `REFER_PERSON_TO_JOB` → `FORBIDDEN`.
- [ ] MP8 mensurável a partir dos `Referral` persistidos.
