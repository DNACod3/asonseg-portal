# USP-056 — Moderação (remediação do UAT) — Specification

- **Fase:** 8 — Remediação do UAT · **Épico:** `ajustes-uat` · **Prioridade:** P1 (unidade), achados P1+P3
- **Dossiê (fonte da verdade dos achados):** `.specs/features/ajustes-uat/uat-findings-2026-07-11.md` — linhas **MOD-1, MOD-6, MOD-7, MOD-8** (tabela Fase 8)
- **Specs vizinhas (upstream — IDs canônicos, não re-derivar):**
  - `.specs/features/moderacao-conteudo/usp-016-moderar-rascunho/spec.md` — **E-001** (fila lista IN_MODERATION com indicador de tipo), **P-003** (motivo ≥ 20 caracteres significativos), **P-005** (autor ≠ moderador), **P-007** (só quem tem a permissão modera)
  - `.specs/features/moderacao-conteudo/usp-019-sugerir-categoria/spec.md` — **SUGG-04** (rejeitar sugestão; motivo **opcional** → `audit_log.justification`)
  - `.specs/features/identity-acesso-papeis/usp-008-permissoes-delegadas/` — catálogo `MODERATE_JOB` / `MODERATE_CV` / `MODERATE_SERVICE`
  - `.specs/features/cadastros-publicos/usp-009-cadastro-candidato/` — `submitCandidateForModeration` (DRAFT → IN_MODERATION do `CandidateProfile`)

> **💠 Adapt, don't re-derive.** Esta spec é um **adaptador**: cada correção realiza um AC/proibição que **já existe** upstream (E-001, P-003, P-005, P-007, SUGG-04). Reusa esses IDs como canônicos; os IDs locais `MODn-*` / `USP056-MN-*` só nomeiam o recorte de remediação e o rastreio de tarefa. Nenhum requisito novo de produto é inventado.

---

## Problem Statement

O UAT de 2026-07-11 encontrou quatro defeitos na moderação de conteúdo, todos corrigíveis **sem** alterar a arquitetura (moderação via `transitionContent`, adapter por `ContentKind` no container, RBAC `requirePermission`, `audit_log` append-only, View Models). A fila nunca mostra perfis de candidato em moderação (E-001 quebrado para CV/perfil), a heurística de "motivo significativo" aceita caractere repetido (P-003 furado), a UI oferece ações fadadas a erro para tipos que o voluntário não pode moderar (atrito sobre P-007) e a rejeição de sugestão de categoria dispara em 1 clique sem confirmação nem motivo (SUGG-04 não realizado na UI).

## Goals

- [x] **MOD-1** — A fila de moderação lista perfis de candidato `IN_MODERATION` lidos de `candidate_profiles`, realizando **E-001** também para conteúdo CV/perfil, via a leitura por `ContentKind.CANDIDATE_PROFILE` (padrão adapter por tipo já usado no container). Preserva **P-005**.
- [x] **MOD-6** — A heurística de motivo significativo (`isMeaningfulJustification`) rejeita justificativas de ≥ 20 caracteres compostas por repetição de um mesmo caractere ("aaaaaaaa…"), cumprindo **P-003** ("caracteres significativos"), **sem** rejeitar motivos legítimos curtos-porém-válidos, mantendo a mensagem PT-BR existente.
- [x] **MOD-7** — A UI da fila só oferece ações (aprovar/devolver/rejeitar) para os tipos que o viewer tem permissão delegada de moderar; a checagem autoritativa server-side (`requirePermission`, **P-007**) permanece intacta.
- [x] **MOD-8** — Rejeitar uma sugestão de categoria exige uma etapa de confirmação com campo de **motivo opcional**; se preenchido, o motivo vai para `audit_log.justification` (o backend `rejectTaxonomySuggestion` **já** aceita `reason` → **SUGG-04**).

## Out of Scope

| Feature | Reason |
|---|---|
| Novo `PermissionId` para perfil de candidato | `CANDIDATE_PROFILE` reusa `MODERATE_CV` (mapa `PERMISSION_BY_KIND` em `decide.ts`, decisão pré-existente USP-009/016). Não se altera o catálogo RBAC. |
| Nova tabela/entidade de conteúdo (`content_items`) | Premissa inviolável: status mora na entidade (`candidate_profiles.publication_status`). MOD-1 é **leitura** da tabela existente. |
| Migração de schema | Nenhuma. `candidate_profiles` já tem `publication_status` + índice `@@index([publicationStatus])`; `job_area`/`service_category` têm `reason`→audit já cabeado. |
| Fonte `ContentKind.CV` (fixture) | Permanece lendo `_moderation_fixture` (vazia em prod — não há entidade CV real; o CV vive dentro de `CandidateProfile`). Só `CANDIDATE_PROFILE` passa a ler a tabela real. |
| E-mails de decisão de moderação (NOT-03/04/05) | **USP-057** (depende desta). |
| Overlay/modal de confirmação (`role="dialog" aria-modal`) para MOD-8 | Precedente do projeto = **inline-expandível** (`PublishedContentManager`, `ModerationQueue`), sem dep de Dialog (DS-MN-05). "Diálogo de confirmação" = etapa inline Confirmar/Cancelar. |
| Regra de produto "editar/re-moderar perfil ACTIVE" | Fase 9 (H-5), fora do loop. |

---

## Assumptions & Open Questions

Cada ambiguidade resolvida (modo autônomo) ou registrada aqui. Nenhum item de owner externo bloqueia a implementação → **Entry Gate livre**.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| **Título do item de perfil na fila** | agent | `headline` do `CandidateProfile`; fallback `"Perfil de candidato"` quando `null`. | View Model expõe só título + autor (ADR-0010); `headline` é o resumo profissional já público na busca, não é PII sensível. Sem `headline` → rótulo genérico. | y |
| **Autor do item de perfil** | agent | `authorPersonId = personId` (o próprio candidato). | O perfil é auto-submetido pelo titular (`submitCandidateForModeration`). Resolve nome via `viewStaffPersonNames` como as outras fontes. | y |
| **Limiar da heurística MOD-6** | agent | Motivo significativo exige, além de ≥ 20 chars e não-só-pontuação, **≥ 5 letras distintas** (case-insensitive, sem acento). | Qualquer motivo PT-BR real de ≥ 20 chars tem ≥ 5 letras distintas ("Endereço incompleto." → 11; "CPF inválido no campo" → 11); mashes de caractere repetido/alfabeto curto ("aaaa…"→1, "abababab"→2) falham. Baixo risco de falso-positivo. Limiar documentado e ajustável. | y |
| **MOD-7: filtrar item vs. desabilitar botão** | agent | **Desabilitar/ocultar as ações por tipo** no componente da fila (item segue listado, sem controles acionáveis para o tipo não permitido); o servidor calcula os `ContentKind` moderáveis do viewer e passa ao componente. | Leitura literal do dossiê ("desabilitar/ocultar as ações"); preserva E-001 (fila lista todos os IN_MODERATION com indicador de tipo) e a UX de coordenador (todos os 3 MODERATE_* → tudo acionável, sem mudança). Prop opcional (default = todos moderáveis) preserva os testes existentes. | y |
| **MOD-6 aplica-se a devolver/rejeitar/inativar** | agent | Sim — `isMeaningfulJustification` é fonte única reusada por `schemas/decision.ts`, `transitionContent` (defesa em profundidade) e `inactivate`. Corrigir o domínio corrige os três. | P-003 vale para devolver/rejeitar (USP-016) e inativar (USP-018) — mesma regra. | y |
| **MOD-8: motivo opcional (não obrigatório)** | agent | Campo de motivo **opcional** (≤ 280 chars, schema existente); Confirmar sem motivo é válido. | SUGG-04 é explícito: motivo opcional, não entra em `JUSTIFICATION_REQUIRED_EVENTS` (exigir 20 chars atritaria "duplicata de X"). | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Perfis de candidato aparecem na fila de moderação ⭐ MVP

**User Story**: Como coordenador (ou voluntário com `MODERATE_CV`), quero ver os perfis de candidato enviados para moderação na mesma fila, para poder aprová-los/devolvê-los/rejeitá-los — hoje eles somem.

**Why P1**: E-001 (USP-016) exige a fila listar rascunhos IN_MODERATION de vaga/**CV**/serviço. Sem isso, todo candidato que envia o perfil fica preso indefinidamente — beco sem saída de fluxo (mesmo peso dos demais P1 da Fase 8).

**Acceptance Criteria**:

1. **[MOD1-01 → E-001]** WHEN o coordenador acessa a fila THEN o sistema SHALL incluir cada `CandidateProfile` com `publicationStatus = IN_MODERATION` como item de `contentKind = CANDIDATE_PROFILE`, com `contentId = personId`, `title = headline ?? "Perfil de candidato"` e `submittedAt = lastStatusChangeAt`, unido às fontes de vaga/serviço/fixture, ordenado por `submittedAt` ascendente e cortado em `QUEUE_PAGE_SIZE`.
2. **[MOD1-02 → P-005]** WHEN um `CandidateProfile` IN_MODERATION tem `personId == viewerPersonId` THEN o sistema SHALL NOT incluí-lo na fila (autor ≠ moderador).
3. **[MOD1-03]** WHEN a leitura de perfis roda THEN o sistema SHALL usar `select` explícito (`personId`, `headline`, `lastStatusChangeAt`), `orderBy` e `take` (paginação obrigatória — L-001), sem `include` amplo.
4. WHEN não há perfis IN_MODERATION THEN a fila SHALL comportar-se exatamente como hoje para vagas/serviços (sem regressão).

**Independent Test**: Com um `CandidateProfile` real em `IN_MODERATION` no banco, `viewModerationQueue({viewerPersonId})` retorna um item `CANDIDATE_PROFILE` com o `personId` como `contentId`; um perfil cujo `personId` é o viewer não aparece.

---

### P1: Heurística de motivo significativo bloqueia caractere repetido

**User Story**: Como autor de conteúdo devolvido/rejeitado, quero que o motivo recebido seja realmente descritivo, para saber o que corrigir — hoje "aaaaaaaa…" passa como motivo válido.

**Why P1**: P-003 (USP-016) exige "≥ 20 caracteres **significativos**". A regra atual (`/^[\s\-—.xX]+$/`) só barra pontuação/`x`, deixando passar qualquer caractere repetido.

**Acceptance Criteria**:

1. **[MOD6-01 → P-003]** WHEN o motivo, após `trim`, tem ≥ 20 caracteres mas menos de **5 letras distintas** (case-insensitive, acento-dobrado) THEN `isMeaningfulJustification` SHALL retornar `false` e a validação SHALL falhar com a mensagem PT-BR existente `JUSTIFICATION_NOT_MEANINGFUL_MESSAGE` ("Descreva o motivo de forma significativa para o autor.").
2. **[MOD6-02]** WHEN o motivo tem ≥ 20 caracteres, ≥ 5 letras distintas e não é só-pontuação THEN `isMeaningfulJustification` SHALL retornar `true` (motivo legítimo continua aceito).
3. **[MOD6-03]** WHEN a regra é aplicada THEN ela SHALL permanecer a **fonte única** reusada por `schemas/decision.ts`, `transitionContent` e `inactivate` (sem duplicar lógica).

**Independent Test**: `isMeaningfulJustification('a'.repeat(30))` → `false`; `isMeaningfulJustification('Faltou descrever as atividades do cargo')` → `true`; o schema Zod de devolução rejeita o primeiro com a mensagem PT-BR existente.

---

### P3: A fila só oferece ações que o viewer pode executar

**User Story**: Como voluntário com delegação parcial (ex.: só `MODERATE_JOB`), não quero ver botões de aprovar/rejeitar em itens de tipo que o backend vai negar — hoje clico e recebo erro P-007.

**Why P3**: Atrito de UX (o backend já nega corretamente); não é falha de segurança.

**Acceptance Criteria**:

1. **[MOD7-01 → P-007]** WHEN a página da fila é renderizada THEN o servidor SHALL calcular o conjunto de `ContentKind` moderáveis pelo viewer (coordenador → JOB, SERVICE, CV, CANDIDATE_PROFILE; voluntário → os tipos cuja permissão delegada ativa ele possui, via o mapa JOB→`MODERATE_JOB`, SERVICE→`MODERATE_SERVICE`, CV/CANDIDATE_PROFILE→`MODERATE_CV`) e passá-lo ao componente da fila.
2. **[MOD7-02]** WHEN um item é de um `ContentKind` **fora** do conjunto moderável do viewer THEN a UI SHALL NOT renderizar controles acionáveis (aprovar/devolver/rejeitar) para esse item (botões ocultos ou desabilitados), exibindo em seu lugar uma nota PT-BR de "sem permissão para moderar este tipo".
3. **[MOD7-03]** WHEN o viewer é coordenador (ou o prop não é informado) THEN a fila SHALL oferecer todas as ações como hoje (backward-compatible; sem regressão dos testes existentes).
4. **[MOD7-04 → P-007]** WHEN qualquer decisão é submetida THEN a Server Action SHALL continuar re-checando `requirePermission(MODERATE_<KIND>)` (defesa em profundidade — inalterada).

**Independent Test**: `ModerationQueue` renderizado com um item `CANDIDATE_PROFILE` e `viewerModeratableKinds = [JOB]` não expõe botão acionável de aprovar/rejeitar para aquele item; com `[JOB, SERVICE, CV, CANDIDATE_PROFILE]` (ou prop ausente) expõe.

---

### P3: Rejeitar sugestão de categoria pede confirmação + motivo opcional

**User Story**: Como aprovador de taxonomia, quero confirmar a rejeição de uma sugestão e opcionalmente registrar o porquê, para não remover por engano em 1 clique e deixar rastro na auditoria.

**Why P3**: SUGG-04 (USP-019) prevê motivo opcional → `audit_log.justification`; hoje a UI dispara direto, sem confirmação nem campo.

**Acceptance Criteria**:

1. **[MOD8-01 → SUGG-04]** WHEN o aprovador clica "Rejeitar" em uma sugestão THEN a UI SHALL abrir uma etapa de confirmação inline (Confirmar/Cancelar) com um campo de **motivo opcional** (≤ 280 caracteres), **sem** disparar a Server Action ainda.
2. **[MOD8-02 → SUGG-04]** WHEN o aprovador confirma THEN a UI SHALL chamar `rejectTaxonomySuggestion({ kind, id, reason })` incluindo `reason` **somente** quando preenchido (omitido/vazio → sem `reason`, permanecendo válido). O `reason`, quando presente, já é gravado em `audit_log.justification` pela action existente.
3. **[MOD8-03]** WHEN o aprovador cancela THEN a UI SHALL fechar a etapa sem chamar a action e o item SHALL permanecer na fila.
4. **[MOD8-04]** WHEN a rejeição é confirmada com sucesso THEN o item SHALL sair da fila e SHALL exibir a confirmação, como hoje (aprovar segue em 1 clique — só rejeitar ganha a confirmação).

**Independent Test**: Clicar "Rejeitar" abre um textarea de motivo e botões Confirmar/Cancelar sem chamar a action; digitar um motivo e Confirmar chama `rejectTaxonomySuggestion({kind,id,reason})`; Cancelar não chama nada.

---

## Edge Cases

- WHEN `CandidateProfile.headline` é `null` THEN o item da fila SHALL usar o título `"Perfil de candidato"`.
- WHEN o autor de um item não é resolvível por `viewStaffPersonNames` THEN `authorName` SHALL ser `null` (comportamento atual preservado).
- WHEN o motivo MOD-6 é `null`/`undefined`/vazio THEN `isMeaningfulJustification` SHALL retornar `false` (inalterado).
- WHEN o motivo MOD-8 excede 280 caracteres THEN o schema `resolveTaxonomySuggestionSchema` SHALL rejeitar com a mensagem existente (inalterado).
- WHEN um item de perfil e uma vaga têm o mesmo `submittedAt` THEN a ordenação SHALL ser estável quanto ao contrato atual (empate não quebra a fila).

---

## Must-Nots (world-level prohibitions)

| ID | WHEN … THEN system SHALL NOT … | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| **USP056-MN-01** | WHEN a fila é lida e um `CandidateProfile` IN_MODERATION tem `personId == viewerPersonId` THEN SHALL NOT incluí-lo na fila. | Autor moderar o próprio conteúdo (regressão de P-005 na nova fonte). | T2 | `moderation-queue` (unit+int): perfil do viewer ausente. |
| **USP056-MN-02** | WHEN o motivo tem ≥ 20 chars mas é um único caractere repetido ("aaaa…") THEN `isMeaningfulJustification` SHALL NOT retornar `true`. | Motivo vazio-de-conteúdo aceito (furo de P-003). | T1 | `justification` (unit): `'a'.repeat(30)` → false. |
| **USP056-MN-03** | WHEN o motivo é legítimo (≥ 20 chars, ≥ 5 letras distintas) THEN a heurística SHALL NOT retornar `false`. | Falso-positivo bloqueando moderador legítimo (regressão de usabilidade). | T1 | `justification` (unit): amostras reais → true; `decision.test.ts` verde. |
| **USP056-MN-04** | WHEN um item é de `ContentKind` fora do conjunto moderável do viewer THEN a UI SHALL NOT renderizar controle acionável de aprovar/devolver/rejeitar para ele. | UI oferecer ação fadada a erro P-007. | T4 | `moderation-queue.test.tsx`: item CV + kinds `[JOB]` → sem botão acionável. |
| **USP056-MN-05** | WHEN o aprovador clica "Rejeitar" em uma sugestão THEN a UI SHALL NOT chamar `rejectTaxonomySuggestion` sem uma etapa de confirmação intermediária. | Rejeição destrutiva em 1 clique sem revisão (SUGG-04 não realizado). | T5 | `taxonomy-suggestions-list.spec.tsx`: 1 clique em Rejeitar não chama a action. |
| **USP056-MN-06** | WHEN qualquer correção é aplicada THEN SHALL NOT introduzir mudança de status fora de `transitionContent`, nem nova tabela/migração, nem dep nova. | Violar as premissas invioláveis (arquitetura). | T1–T5 | Guards existentes + ausência de migração/dep no diff. |

---

## Requirement Traceability

| Requirement ID | Story | Upstream | Phase | Status |
|---|---|---|---|---|
| MOD1-01 | P1 fila CV | E-001 (USP-016) | Tasks (T2) | Done |
| MOD1-02 | P1 fila CV | P-005 (USP-016) | Tasks (T2) | Done |
| MOD1-03 | P1 fila CV | L-001 (USP-016) | Tasks (T2) | Done |
| MOD6-01 | P1 heurística | P-003 (USP-016) | Tasks (T1) | Done |
| MOD6-02 | P1 heurística | P-003 (USP-016) | Tasks (T1) | Done |
| MOD6-03 | P1 heurística | — | Tasks (T1) | Done |
| MOD7-01 | P3 ações por permissão | P-007 (USP-016) | Tasks (T3) | Done |
| MOD7-02 | P3 ações por permissão | P-007 | Tasks (T4) | Done |
| MOD7-03 | P3 ações por permissão | — | Tasks (T4) | Done |
| MOD7-04 | P3 ações por permissão | P-007 | Tasks (T3/T4) | Done |
| MOD8-01 | P3 confirmação sugestão | SUGG-04 (USP-019) | Tasks (T5) | Done |
| MOD8-02 | P3 confirmação sugestão | SUGG-04 | Tasks (T5) | Done |
| MOD8-03 | P3 confirmação sugestão | — | Tasks (T5) | Done |
| MOD8-04 | P3 confirmação sugestão | — | Tasks (T5) | Done |
| USP056-MN-01 | must-not | P-005 | Tasks (T2) | Done |
| USP056-MN-02 | must-not | P-003 | Tasks (T1) | Done |
| USP056-MN-03 | must-not | P-003 | Tasks (T1) | Done |
| USP056-MN-04 | must-not | P-007 | Tasks (T4) | Done |
| USP056-MN-05 | must-not | SUGG-04 | Tasks (T5) | Done |
| USP056-MN-06 | must-not | premissas | Tasks (T1–T5) | Done |

**Coverage:** 20 requisitos, todos mapeados a tarefas (T1–T5). 0 unmapped.

---

## Success Criteria

- [x] Um `CandidateProfile` IN_MODERATION real aparece na fila de `/moderacao` como "Perfil de candidato" e pode ser aprovado/devolvido/rejeitado ponta a ponta (integração: `moderation-queue.int.test.ts`; aprovar/devolver/rejeitar já cobertos para `CANDIDATE_PROFILE` por `decide.test.ts`/`transition-content` — inalterados).
- [x] "aaaaaaaaaaaaaaaaaaaa" é rejeitado como motivo; "Faltou descrever as atividades" é aceito — ambos via a fonte única `isMeaningfulJustification`.
- [x] Voluntário com só `MODERATE_JOB` não vê botões acionáveis em itens de serviço/perfil; coordenador vê tudo (sem regressão).
- [x] Rejeitar sugestão pede confirmação + motivo opcional; motivo preenchido chega em `audit_log.justification` (via `reason` já existente em `rejectTaxonomySuggestion`, inalterado).
- [x] `npm run typecheck`, `npm run lint`, `npm run test` (unit) e `npm run test:integration` verdes; **zero migração, zero dep nova**; suíte de moderação pré-existente preservada (com as atualizações intencionais de MOD-7/MOD-8 documentadas).
