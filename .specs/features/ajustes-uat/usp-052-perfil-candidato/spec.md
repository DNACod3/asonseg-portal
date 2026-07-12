# USP-052 — Perfil do candidato consistente Specification

> **Unidade da Fase 8 — Remediação do UAT** (`.specs/project/ROADMAP.md`). Net-new (fora das 44 do PRD), como USP-045/049..060.
> **Fontes upstream (source of truth — adaptado, não re-derivado):**
> - **Dossiê do UAT** `.specs/features/ajustes-uat/uat-findings-2026-07-11.md` — achados **CAND-1, CAND-2, CAND-3, CAND-6** (tabela Fase 8) são as âncoras canônicas de cada correção.
> - Spec vizinha **USP-040** `.specs/features/extracao-cv-ia/usp-040-extracao-cv/spec.md` — ACs **CVE-04** (validação humana / persistência só após confirmação), **CVE-06** (consentimento `CV_AI_EXTRACTION`), **CVE-MN-03** (nunca invocar LLM sem consentimento).
> - Spec vizinha **USP-009** `.specs/features/cadastros-publicos/usp-009-cadastro-candidato/spec.md` — **CAD-01/CAD-05** (perfil em rascunho → moderação, consentimento da finalidade).
> - `CLAUDE.md` (sequência da Server Action, View Models/privacidade do titular, consents append-only), `docs/arch/project-guideline.md`.

## Problem Statement

O UAT de 2026-07-11 encontrou o cadastro/edição de candidato em `/candidato` inconsistente e destrutivo. Três defeitos de dados/estado e um beco sem saída de consentimento tornam o perfil do candidato não confiável: (1) **salvar o cadastro apaga campos que o formulário não exibe** — inclusive os dados que a extração de CV por IA (USP-040/CVE-04) confirmou; (2) **a UI mente o status** — afirma "rascunho" com o perfil já ativo e oferece uma ação que falha; (3) **o formulário nunca carrega o perfil existente** — toda edição é às cegas (o vetor do defeito 1); (4) **não há UI para conceder o termo `CV_AI_EXTRACTION`** — a USP-040 é um beco sem saída, com o upload eternamente bloqueado por `CONSENT_REQUIRED` sem meio de aceitar o termo.

Corrigir os quatro sem tocar arquitetura: o save preserva o que não gerencia, o status exibido é o real, o formulário vem pré-preenchido, e o upload de CV ganha o gate de aceite do termo (padrão `LgpdBox` + `grantConsent` já usado no cadastro).

## Goals

- [ ] Salvar o cadastro de candidato **nunca apaga** colunas que o formulário não envia (`skills_text`, `courses_text`, `education_area`, `availability`) — dados da extração de CV (CVE-04) são preservados.
- [ ] `activateCandidateRole` retorna o **status real** do perfil (não `'DRAFT'` hardcoded); a UI reflete o status real e **não oferece ação inválida** (sem caixa de rascunho nem "Enviar para moderação" quando o perfil não está em DRAFT).
- [ ] `/candidato` carrega o perfil existente e o formulário abre **pré-preenchido** (`defaultValues`), acabando com a edição às cegas.
- [ ] O `CvUploadForm` apresenta o **termo `CV_AI_EXTRACTION`** para aceite e registra o consentimento (`grantConsent`) antes do upload; com o consentimento já ativo, sobe direto.
- [ ] Zero mudança de arquitetura, migração ou dependência nova; PT-BR; tokens-only.

## Out of Scope

| Feature | Reason |
|---|---|
| **Decidir se editar um perfil ACTIVE deve re-moderar** | É o item **H-5 da Fase 9** (avaliação humana do PO). Esta USP apenas **para de mentir** o status e **não** decide re-moderação. O comportamento de persistência hoje (upsert preserva o status, não rebaixa) é mantido intacto. |
| Exibir/editar `skills_text`, `courses_text`, `education_area`, `availability` no formulário de cadastro | A correção mínima do CAND-1 é o save **omitir** os não enviados (não exibi-los). Esses campos seguem sob o fluxo de CV (`confirmCvFields`, USP-040). Adicioná-los ao form é follow-up de produto. |
| Alterar o backend de upload/extração/confirmação de CV (`uploadCv`/`extractCvFromUpload`/`confirmCvFields`) | A USP-040 já os entrega corretos (`uploadCv` já exige `requireActiveConsent('CV_AI_EXTRACTION')`). Esta USP adiciona **só o gate de UI** que faltava para conceder o termo. |
| Cascata de revogação de consentimento, fila de moderação de CV, e-mails de decisão | Outras unidades da Fase 8 (USP-053/056/057). |
| Coleta de região do candidato no form | Follow-up pré-existente (AD-018), fora do escopo. |
| E2E autenticado do fluxo `/candidato` | Padrão do repo (L-007): sem infra de seed de sessão Supabase no Playwright; cobertura autoritativa em unit/component/integração. |

---

## Assumptions & Open Questions

Toda ambiguidade é resolvida ou registrada aqui. Modo autônomo: itens de owner `agent` são resolvidos por discrição, ancorados no código/dossiê/specs vizinhas.

| # | Assumption / decisão | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|---|
| A-01 | Abordagem mínima do CAND-1 | agent | **Partial update**: no ramo `update` do upsert, cada coluna opcional só entra no payload quando a **chave está presente** no input (`!== undefined`); o ramo `create` mantém `?? null`. | Dossiê CAND-1 ("update omite campos não enviados… partial update só das chaves presentes"). Preserva o teste unit "todos os opcionais" (todas as chaves presentes → incluídas) e corrige o vetor real (form envia só obrigatórios + opcionais renderizados → chaves de CV ausentes → preservadas). Sem tocar `create` (perfil novo não tem o que preservar). | y |
| A-02 | Campos que o form de cadastro gerencia | agent | `educationLevel`, `primaryAreaOfInterestId`, `phone` (→ `Person`), `headline`, `experienceText`. **Não** gerencia `educationArea`, `skillsText`, `coursesText`, `availability` (donos: `confirmCvFields`/USP-040). | Leitura de `candidate-form.tsx`: só esses 5 campos são registrados no RHF. `educationLevel`/`experienceText` são escritos pelos dois fluxos (ambos os renderizam) — sem conflito. | y |
| A-03 | Fonte do status real (CAND-2) | agent | Capturar `publicationStatus` do **retorno do `upsert`** (`select: { publicationStatus: true }`) dentro do `withAudit` e retorná-lo (precedente `grantConsent`, que captura o retorno do callback de `withAudit`). | O upsert já preserva o status; basta ler o valor persistido e devolvê-lo em vez do literal `'DRAFT'`. Sem query extra. | y |
| A-04 | Tipo do `publicationStatus` no resultado | agent | `ContentStatus` (import type de `@prisma/client`) — substitui o literal `'DRAFT'` do `ActivateCandidateRoleResult`. | O enum de status do conteúdo é `ContentStatus` (schema.prisma). O form já tipa `status: string \| null`. | y |
| A-05 | UI para status ≠ DRAFT/IN_MODERATION/ACTIVE (REJECTED, AWAITING_ADJUSTMENTS, PAUSED, EXPIRED, ARCHIVED, INACTIVATED) | agent | Não renderiza caixa acionável (nem rascunho, nem moderação). Para `ACTIVE`, exibe aviso informativo não-acionável ("perfil ativo e visível nas buscas"); demais status, superfície neutra. | Escopo do CAND-2 é **parar de mentir** e não oferecer transição inválida. Fluxos de reenvio/ajuste (ex.: AWAITING_ADJUSTMENTS) são território de outras USPs; aqui, não decidir nem oferecer. Respeita H-5 (sem implicar re-moderação). | y |
| A-06 | Fonte do `phone` para `defaultValues` (CAND-3) | agent | `person.phone` da sessão (`requireActivePerson()` retorna `CurrentPerson` com `phone`). Campos de perfil vêm do read de `candidate_profiles`. | Confirmado em `identity/server/session.ts` (`CurrentPerson.phone`). Evita join/query extra; funciona mesmo sem perfil (candidato novo). | y |
| A-07 | Reuso do View Model do titular (CAND-3) | agent | `viewPersonForSelf` (USP-049) **não serve** — retorna só nome/e-mail/CPF/papéis, sem `phone` nem campos de `candidate_profiles`. Usar um read escopado do próprio perfil (titular vê o próprio dado → Prisma direto é permitido, CLAUDE.md §Privacy), expandindo o `findUnique` já existente em `candidato/page.tsx` para incluir os campos editáveis. | Sem duplicar VM; o titular lendo o próprio dado dispensa View Model de terceiro. Mantém o read no composition-root (página), como já é hoje. | y |
| A-08 | Como o `CvUploadForm` concede o consentimento (CAND-6) | agent | Chamar `grantConsent({ purpose: 'CV_AI_EXTRACTION' })` **antes** de `uploadCv`, quando o consentimento não está ativo e o termo foi aceito no checkbox — espelhando `candidate-form.tsx` (que chama `activateAdditionalRole` antes de `activateCandidateRole`). Import direto de `@/modules/consents/actions/grant-consent` (arquivo `'use server'` → stub RPC client-safe; `eslint-disable no-restricted-imports`, mesmo precedente do `candidate-form.tsx`). | `grantConsent({purpose})` é autossuficiente (carrega o termo, valida hash, idempotente, audita `CONSENT_GRANTED`). `CV_AI_EXTRACTION` não tem papel vinculado (`PURPOSE_ROLE_MAP: null`) → sem efeito colateral de papel. | y |
| A-09 | Onde o termo `CV_AI_EXTRACTION` é carregado (CAND-6) | agent | Server-side na página `candidato/page.tsx` via `loadTerm('CV_AI_EXTRACTION')` + `stripTermFrontMatter`, passado como prop `term` ao `CvUploadForm` (Client Component); `alreadyGranted` via `requireActiveConsent(person.id, 'CV_AI_EXTRACTION')`. | Mesmo padrão de `term`/`alreadyCandidate` já usado com `CandidateForm`. O termo existe em `legal/consent-terms/cv-ai-extraction/v1.0.md` e está no `TERMS_REGISTRY`. | y |
| A-10 | **H-5 (editar ACTIVE re-modera?)** | **PO (externo — Fase 9)** | Não decidir; manter comportamento atual (upsert preserva status, sem rebaixamento). A implementação **não depende** da resolução de H-5 — apenas para de mentir o status e não oferece ação inválida. | Escopo explícito da tarefa. Como a correção é segura sob qualquer resolução futura de H-5, **o Entry Gate NÃO é disparado** (§0 de tasks.md). | n (fora do escopo) |
| A-11 | Preservação dos testes existentes | agent | Manter as asserções comportamentais existentes de `candidate-actions.test.ts`, `candidate-actions.int.test.ts`, `CandidateForm.test.tsx`, `page.test.tsx`, `CvUploadForm.test.tsx`. Atualizações **necessárias** (mocks que agora devem retornar `publicationStatus`; props novas obrigatórias) são feitas sem enfraquecer asserções; onde uma asserção codificava o bug, é corrigida (não removida). | Regra do skill (nunca enfraquecer/deletar testes para passar). Ver `design.md §Risks` para o inventário exato de atualizações. | y |

**Open questions:** none — todas resolvidas/registradas acima. **A-10 (H-5) é externa (Fase 9) mas a implementação não depende dela → Entry Gate LIVRE.**

---

## User Stories

### P1: Salvar o cadastro nunca apaga dados do candidato ⭐ MVP

**User Story**: Como candidato que edita meu perfil, quero que salvar o cadastro **preserve** os campos que o formulário não exibe (incluindo os que a IA extraiu do meu CV), para não perder informações silenciosamente.

**Why P1**: CAND-1 (P1) — destrói dados confirmados via CVE-04. Perda de dados silenciosa é o pior tipo de defeito de confiança.

**Acceptance Criteria**:

1. **(PERF-01 — CAND-1)** QUANDO `activateCandidateRole` atualiza um perfil existente com um input que **não inclui** `educationArea`/`skillsText`/`coursesText`/`availability` ENTÃO o sistema DEVE persistir **apenas** os campos gerenciados pelo formulário e **preservar** os demais valores já persistidos.
2. **(PERF-01b — CAND-1, ramo presente)** QUANDO o input **inclui** um campo opcional (chave presente) ENTÃO o sistema DEVE persistir o valor enviado (edição legítima do campo renderizado, ex.: `headline`/`experienceText`).
3. **(PERF-01c — CAND-1, create intacto)** QUANDO `activateCandidateRole` **cria** um perfil novo ENTÃO o sistema DEVE mapear os opcionais ausentes para `null` (comportamento atual do ramo `create` preservado — não há dado a preservar).

**Independent Test**: Persistir `skills_text`/`courses_text`/`education_area`/`availability` num perfil; chamar `activateCandidateRole` só com obrigatórios; verificar no DB que esses quatro campos permanecem inalterados e que `educationLevel`/`primaryAreaOfInterestId` foram atualizados.

---

### P1: A UI reflete o status real do perfil ⭐ MVP

**User Story**: Como candidato, quero que a tela mostre o status **real** do meu perfil e só ofereça ações válidas, para não receber "transição não permitida" ao clicar em algo que a UI sugeriu.

**Why P1**: CAND-2 (P1) — retorno hardcoded `'DRAFT'` faz a UI afirmar "rascunho" com o perfil ACTIVE e oferecer "Enviar para moderação" que falha.

**Acceptance Criteria**:

1. **(PERF-02 — CAND-2 backend)** QUANDO `activateCandidateRole` conclui ENTÃO o resultado DEVE conter o `publicationStatus` **real persistido** (lido do `upsert`), não o literal `'DRAFT'`; o `audit.after.publicationStatus` DEVE refletir o mesmo valor real.
2. **(PERF-03 — CAND-2 UI)** QUANDO o status do perfil é `DRAFT` ENTÃO o formulário DEVE exibir a caixa de rascunho com "Enviar para moderação"; QUANDO é `IN_MODERATION` DEVE exibir o aviso "em moderação"; QUANDO é `ACTIVE` DEVE exibir um aviso informativo não-acionável e **não** oferecer "Enviar para moderação".
3. **(PERF-03b — CAND-2 UI, demais status)** QUANDO o status é outro (REJECTED/AWAITING_ADJUSTMENTS/PAUSED/EXPIRED/ARCHIVED/INACTIVATED) ENTÃO o formulário **não** DEVE oferecer "Enviar para moderação" (superfície neutra — sem decidir re-moderação, H-5).

**Independent Test**: `activateCandidateRole` com perfil ACTIVE retorna `publicationStatus: 'ACTIVE'`; renderizar `CandidateForm` com status `ACTIVE` e verificar ausência do botão "Enviar para moderação".

---

### P2: O formulário carrega o perfil existente (pré-preenchido)

**User Story**: Como candidato que já tem perfil, quero que `/candidato` abra com meus dados preenchidos, para editar com contexto (e não sobrescrever às cegas).

**Why P2**: CAND-3 (P2) — form sempre vazio; edição às cegas é o vetor do CAND-1.

**Acceptance Criteria**:

1. **(PERF-04 — CAND-3)** QUANDO `/candidato` carrega para uma Pessoa com `candidate_profiles` existente ENTÃO a página DEVE ler os campos editáveis (`educationLevel`, `primaryAreaOfInterestId`, `headline`, `experienceText`) e o `phone` da sessão, e passá-los como `defaultValues` ao formulário, que abre **pré-preenchido**.
2. **(PERF-04b — CAND-3, candidato novo)** QUANDO não há perfil ENTÃO o formulário DEVE abrir vazio (comportamento atual preservado).

**Independent Test**: Renderizar a página com `candidateProfile.findUnique` retornando valores e verificar que o `CandidateForm` recebe `defaultValues` correspondentes.

---

### P1: Gate de aceite do termo `CV_AI_EXTRACTION` no upload de CV ⭐ MVP

**User Story**: Como candidato, quero aceitar o termo de extração de currículo por IA na própria tela de upload, para poder enviar meu CV (hoje o upload é bloqueado sem meio de conceder o consentimento).

**Why P1**: CAND-6 (P1) — USP-040 é beco sem saída: `uploadCv` exige `CV_AI_EXTRACTION` ativo (CVE-06/CVE-MN-03) e nenhuma UI concede o termo (CAD-05 manda registrar quando houver anexo).

**Acceptance Criteria**:

1. **(PERF-05 — CAND-6)** QUANDO o candidato **não** tem `CV_AI_EXTRACTION` ativo ENTÃO o `CvUploadForm` DEVE apresentar o termo (`LgpdBox` + corpo + checkbox de aceite) e desabilitar o envio até o aceite; ao aceitar e enviar, DEVE registrar o consentimento via `grantConsent({ purpose: 'CV_AI_EXTRACTION' })` **antes** de `uploadCv`.
2. **(PERF-05b — CAND-6, já concedido)** QUANDO o consentimento já está ativo ENTÃO o `CvUploadForm` **não** DEVE exibir o termo e DEVE prosseguir direto ao upload (paridade com `alreadyCandidate` do `CandidateForm`).
3. **(PERF-05c — CAND-6, falha de grant)** QUANDO `grantConsent` falha ENTÃO o sistema DEVE exibir a mensagem de erro em PT-BR e **não** DEVE prosseguir para `uploadCv`.

**Independent Test**: Renderizar `CvUploadForm` com `alreadyGranted={false}`: o envio fica desabilitado sem aceite; ao marcar o checkbox e enviar, `grantConsent` é chamado antes de `uploadCv`. Com `alreadyGranted={true}`, sobe direto (fluxo da USP-040 intacto).

---

## Edge Cases

- QUANDO o input inclui `headline`/`experienceText` como string vazia (campo renderizado limpo pelo usuário) ENTÃO o sistema DEVE persistir o valor (campo gerenciado pelo form) — não confundir "vazio enviado" com "não enviado".
- QUANDO o perfil não existe (candidato novo) ENTÃO `defaultValues` é vazio e o fluxo de `create` (ramo `?? null`) permanece inalterado.
- QUANDO o termo `CV_AI_EXTRACTION` está indisponível (`loadTerm` lança `TermLoaderError`) ENTÃO a página DEVE passar `term=null` e o `CvUploadForm` DEVE desabilitar o upload com aviso PT-BR (mesmo tratamento do termo de candidatura na página).
- QUANDO o consentimento `CV_AI_EXTRACTION` já está ativo mas o candidato reabre a tela ENTÃO nenhum termo é reexibido e o upload segue direto.
- QUANDO o candidato tenta enviar o CV sem aceitar o termo (checkbox desmarcado, sem consentimento ativo) ENTÃO `uploadCv` **não** é despachado (gate de UI) — reforça a barreira de backend CVE-MN-03.
- QUANDO o status persistido é ACTIVE e o candidato re-salva o formulário ENTÃO o status **não** é rebaixado (upsert preserva) e a UI mostra ACTIVE (não rascunho) — sem decidir re-moderação (H-5).

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer. Cada um exige um **teste negativo** que assevera o resultado proibido não ocorre (ver `validate.md §6b`). Owning task + Negative test preenchidos em `tasks.md` (Check 4).

| ID | WHEN [contexto] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| PERF-MN-01 | QUANDO `activateCandidateRole` atualiza um perfil e o input **não inclui** `skillsText`/`coursesText`/`educationArea`/`availability` ENTÃO o sistema NÃO DEVE sobrescrever essas colunas (não pode gravar `null`/valor por cima do já persistido) | Destruição silenciosa de dados confirmados pela extração de CV (CVE-04) | T1 | int: perfil com `skillsText`/etc. setados + `activateCandidateRole` só com obrigatórios → colunas inalteradas; unit: payload `update` não contém essas chaves |
| PERF-MN-02 | QUANDO `activateCandidateRole` retorna OU o formulário renderiza após o save ENTÃO o sistema NÃO DEVE reportar/exibir um `publicationStatus` diferente do persistido, nem oferecer "Enviar para moderação" para perfil não-`DRAFT` | Usuário recebe "transição não permitida" ao acionar ação inválida; status enganoso | T2 (backend), T3 (UI) | unit: action com perfil ACTIVE retorna `ACTIVE` (não `DRAFT`); component: form com status `ACTIVE` não renderiza "Enviar para moderação" |
| PERF-MN-03 | QUANDO `CV_AI_EXTRACTION` não está ativo E o termo não foi aceito (checkbox desmarcado) ENTÃO o `CvUploadForm` NÃO DEVE despachar `uploadCv` | Beco sem saída (upload eternamente bloqueado) e processamento de CV via LLM sem base legal (reforça CVE-MN-03) | T4 | component: `alreadyGranted=false` + checkbox desmarcado → clicar "Enviar e extrair" não chama `uploadCv` (nem `grantConsent`) |

---

## Requirement Traceability

| Requirement ID | Story | Achado/AC upstream | Phase | Status |
|---|---|---|---|---|
| PERF-01 | P1 (sem perda) | CAND-1 / CVE-04 | Execute (T1) | Implementing |
| PERF-01b | P1 (sem perda) | CAND-1 | Execute (T1) | Implementing |
| PERF-01c | P1 (sem perda) | CAND-1 | Execute (T1) | Implementing |
| PERF-02 | P1 (status real) | CAND-2 | Execute (T2) | Implementing |
| PERF-03 | P1 (status real) | CAND-2 | Execute (T3) | Implementing |
| PERF-03b | P1 (status real) | CAND-2 | Execute (T3) | Implementing |
| PERF-04 | P2 (defaultValues) | CAND-3 | Execute (T3, T5) | Implementing |
| PERF-04b | P2 (defaultValues) | CAND-3 | Execute (T3) | Implementing |
| PERF-05 | P1 (gate CV) | CAND-6 / CVE-06 / CAD-05 | Execute (T4, T5) | Implementing |
| PERF-05b | P1 (gate CV) | CAND-6 | Execute (T4) | Implementing |
| PERF-05c | P1 (gate CV) | CAND-6 | Execute (T4) | Implementing |
| PERF-MN-01 | P1 (sem perda) | CAND-1 / CVE-04 | Execute (T1) | Implementing |
| PERF-MN-02 | P1 (status real) | CAND-2 | Execute (T2, T3) | Implementing |
| PERF-MN-03 | P1 (gate CV) | CAND-6 / CVE-MN-03 | Execute (T4) | Implementing |

**ID format:** `PERF-NN` / `PERF-MN-NN`. Âncoras upstream = achados do dossiê (CAND-1/2/3/6) + ACs das USP-040/009 (canônicos, referenciados, não re-derivados).
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 14 total (11 ACs + 3 must-nots), a mapear a tasks em `tasks.md`.

---

## Success Criteria

- [ ] Editar um perfil existente com só os campos do formulário **não zera** `skills_text`/`courses_text`/`education_area`/`availability` (teste negativo verde).
- [ ] `activateCandidateRole` devolve o status real; UI mostra o status real e nunca oferece transição inválida (teste negativo verde).
- [ ] `/candidato` abre pré-preenchido para perfil existente; vazio para candidato novo.
- [ ] `CvUploadForm` concede `CV_AI_EXTRACTION` (aceite do termo → `grantConsent` → `uploadCv`); com consentimento ativo, sobe direto; sem aceite, não despacha `uploadCv` (teste negativo verde).
- [ ] Testes existentes de `activateCandidateRole` e `CvUploadForm` preservados (asserções comportamentais mantidas; atualizações só onde o contrato mudou legitimamente).
- [ ] `typecheck` + `lint` + `build` (NODE_ENV=production) verdes; **sem migração, sem dep nova**.
