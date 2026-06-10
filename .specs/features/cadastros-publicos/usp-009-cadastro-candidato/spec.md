# USP-009 — Cadastro de candidato (papel) — Specification

> **Issue:** [#31](https://github.com/DNACod3/asonseg-portal/issues/31) · **Épico:** #231 (Épico 2 — Cadastros Públicos) · **Prioridade:** P1 (Must)
> **Feature pai:** [`cadastros-publicos`](../spec.md) · **Origem:** PRD USP-009 · **Spec ICE:** `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md`
> **Sub-tasks (PRs):** #36 (model) · #41 (schemas+domain) · #44 (server actions) · #46 (UI)

## Problem Statement

Uma Pessoa autenticada precisa **ativar o papel de candidato** preenchendo dados pessoais,
qualificações, escolaridade e áreas de interesse (e, opcionalmente, anexando currículo) para
aparecer nas buscas de empresas e candidatar-se a vagas. Hoje o módulo `persons` só implementa
inativação/reativação de Pessoa (USP-007/USP-045) — não há nenhuma estrutura de perfil de
candidato, nem fluxo de coleta de consentimento LGPD por finalidade no ato da ativação, nem
transição do conteúdo do perfil para moderação. Sem esse fluxo o portal não cumpre seu propósito
central de empregabilidade.

## Goals

- [ ] **G1** — Pessoa autenticada ativa o papel de candidato; o perfil/CV nasce em status `DRAFT` (rascunho).
- [ ] **G2** — Campos obrigatórios (escolaridade, área de interesse principal, telefone) validados na fronteira (Zod) com mensagens PT-BR.
- [ ] **G3** — Candidato envia o perfil para moderação → status `IN_MODERATION` via máquina de estados (`transitionContent()`), nunca `prisma.update` direto.
- [ ] **G4** — Consentimento LGPD registrado por finalidade na ativação: `PORTAL_ACCESS` + `JOB_APPLICATION` (e `CV_AI_EXTRACTION` quando houver anexo de CV).
- [ ] **G5** — Tela autenticada (`(app)/candidato`) com formulário RHF+Zod, aceite de consentimento e ação de envio para moderação.
- [ ] **G6** — Ativação idempotente: reativar o papel não duplica o `CandidateProfile`.

## Out of Scope

| Item | Razão |
|---|---|
| Extração de CV por IA (parsing, pré-preenchimento) | USP-040 (`cv-extraction`). Aqui só a **estrutura** dos campos `cv*` no model e o ponto de invocação/placeholder. |
| Aprovação pelo coordenador (fila, regras internas, ativação visível, e-mail) — parte de AC-4 | Módulo de moderação (USP-016+) e notificações (USP de e-mail). Aqui só a **transição de saída** DRAFT→IN_MODERATION. |
| Upload/UI de anexo de CV | USP-040. A tela (#46) deixa um ponto de integração (placeholder). |
| Busca de candidatos por empresas / View Model para empregador | USP de candidaturas-busca (`candidaturas-busca-candidatos`). |
| Cadastro/login da Pessoa (conta) | Épico 1 (Identidade, USP-001..008). |

## Requisitos & Acceptance Criteria

ACs **verbatim** do PRD/issue #31 (não parafrasear — é contrato). IDs de requisito: CAD-01..CAD-05.

| Req | AC (verbatim) | Em escopo nesta US? |
|---|---|---|
| **CAD-01** | QUANDO a Pessoa submete o cadastro com escolaridade, área de interesse principal e telefone preenchidos ENTÃO o sistema DEVE ativar o papel de candidato com status "rascunho" (DRAFT) para o conteúdo do perfil/CV. | ✅ Total |
| **CAD-02** | QUANDO a Pessoa anexa CV (PDF/DOC/DOCX até 5MB) ENTÃO o sistema DEVE invocar extração automática por IA e pré-preencher campos para validação (ver USP-040). | 🟡 Parcial — só estrutura `cv*` + placeholder; parsing fica na USP-040. |
| **CAD-03** | QUANDO o candidato envia o perfil para moderação ENTÃO o sistema DEVE alterar o status para "em moderação" (IN_MODERATION) e enfileirar para o coordenador — via `transitionContent()`. | ✅ Em escopo — `transitionContent()` **disponível** (USP-016 mergeada). A fila do coordenador já existe; falta plugar o `ContentKind.CANDIDATE_PROFILE` (ver Lacunas). |
| **CAD-04** | QUANDO o perfil é aprovado pelo coordenador ENTÃO o sistema DEVE ativar o candidato (visível na busca) e enviar e-mail. | 🔴 Fora — lado coordenador (moderação USP-016 + e-mail). |
| **CAD-05** | QUANDO a Pessoa ativa o papel ENTÃO o sistema DEVE registrar consentimento LGPD ativo para `PORTAL_ACCESS` e `JOB_APPLICATION` (e `CV_AI_EXTRACTION` quando houver anexo de CV). | ✅ Total |
| **EDGE** | Rejeitar submissão sem escolaridade/área/telefone (Zod); idempotência ao reativar papel; bloquear sem aceite de consentimento. | ✅ Total |

## Independent Test (do PRD)

Autenticar uma Pessoa, preencher escolaridade + área de interesse principal + telefone, submeter,
e verificar que o papel de candidato existe com `CandidateProfile.publicationStatus = DRAFT`; enviar
para moderação e verificar `IN_MODERATION`; (lado coordenador — AC-4 — testado na USP-016).

## Módulos tocados

`persons` (CandidateProfile, actions, schemas, domain, UI) · `consents` (`requireActiveConsent`, `grantConsent`) · `moderation` (`transitionContent`, `ContentKind`, `ContentStatus`, `ContentStatusRepository` — **disponível, USP-016**) · `audit` (`withAudit`) · `identity` (`requirePermission`) · rota `(app)/candidato`.

## Lacunas & Decisões (atualizado 2026-06-10 — USP-016 mergeada)

- **GAP-1 — ✅ RESOLVIDO (com trabalho de integração).** O módulo `moderation` e `transitionContent()` **existem** (USP-016, `@/modules/moderation`). Assinatura: `transitionContent({ contentKind, contentId, to, trigger, justification?, actorPersonId }) → ActionResult<{from,to}>`. **Porém** o `ContentKind` só tem `JOB`/`CV`/`SERVICE` — **falta `CANDIDATE_PROFILE`** — e o container registra hoje **um único** `ContentStatusRepository` (`PrismaModerationContentRepository`) sobre a tabela transitória `_moderation_fixture`. → **Trabalho herdado pela #44** (conforme AD-005 da USP-016):
  1. adicionar `CANDIDATE_PROFILE` ao enum `ContentKind` e as transições em `TRANSITIONS` (DRAFT→IN_MODERATION via `AUTHOR_ACTION`);
  2. criar adapter concreto `PrismaCandidateProfileStatusRepository implements ContentStatusRepository` sobre a tabela `candidate_profiles`;
  3. refatorar o `container.ts` para **despacho por `ContentKind`** (hoje é singleton único) e registrar o novo adapter.
- **GAP-2 — 🟡 reduzido.** A transição DRAFT→IN_MODERATION **já é auditada dentro** do `transitionContent` (emite `CONTENT_SUBMITTED_TO_MODERATION` via `eventTypeFor`). Logo **não** é preciso evento próprio de submissão. **Resta** apenas o evento de **ativação do papel**: `CANDIDATE_ROLE_ACTIVATED` **não está** no catálogo `@/modules/audit/events` (só `ROLE_GRANT_ACTIVATED`). → Decisão em #44: adicionar `CANDIDATE_ROLE_ACTIVATED` ou reutilizar `ROLE_GRANT_ACTIVATED` (recomendado: específico).
- **GAP-3 — ✅ RESOLVIDO.** `ContentStatus` enum agora vive em `@/modules/moderation` **e** no `schema.prisma` (entregue pela USP-016). → #36 **referencia** o enum existente no `CandidateProfile` (`publicationStatus ContentStatus @default(DRAFT)`), **não redeclara**.
- **GAP-4:** `Person` precisa da relação reversa `candidateProfile CandidateProfile?` e `JobArea` da relação reversa — incluir na migration de #36. (inalterado)
