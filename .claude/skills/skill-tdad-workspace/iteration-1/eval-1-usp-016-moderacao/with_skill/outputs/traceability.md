# Rastreabilidade EARS → Fact — USP-016 Moderar rascunho (vaga, CV ou serviço)

Fonte: PRD §5 Épico 4 USP-016 (linhas 438-452). Gerado por skill-tdad.
Apoio: ADR-0015 (negócio), ADR-T-0011 (máquina de estados), ADR-T-0004 (auditoria append-only),
technical-design §3.3 + enum PermissionId, architecture-document §6 (fluxo crítico Top 8 nº 8),
project-guideline §4/§6/§12.

**Cobertura: 5/5 ACs com fact.** Sem lacunas bloqueantes.

| AC | Tipo EARS | Texto (verbatim) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| AC-016-1 | WHEN…SHALL | WHEN o coordenador acessa a fila de moderação, the system SHALL listar rascunhos com status "em moderação" ordenados por data de envio. | integração (query) | `@ac-016-1` | `modules/moderation/__tests__/listModerationQueue.integration.test.ts::lista-ordenada-por-data` | Red |
| AC-016-1 | (caso obrigatório) | — permissão de acesso à fila — | integração | `@ac-016-1 @permissao` | `…listModerationQueue.integration.test.ts::permissao-recusada` | Red |
| AC-016-2 | WHEN…SHALL | WHEN o coordenador aprova, the system SHALL alterar status para "ativo" e enviar e-mail ao autor. | integração (transitionContent) | `@ac-016-2` | `modules/moderation/__tests__/approveContent.integration.test.ts::aprovar-ativa-e-notifica` | Red |
| AC-016-2 | (borda) | — transição inválida + concorrência — | integração + property | `@ac-016-2 @transicao-invalida` / `@concorrencia` | `…approveContent.integration.test.ts::transicao-invalida` · `…::concorrencia` · `modules/moderation/__tests__/properties/transitions.property.test.ts` | Red |
| AC-016-3 | WHEN…SHALL (+ IF) | WHEN o coordenador devolve para ajustes, the system SHALL exigir motivo textual obrigatório, alterar status para "aguardando ajustes" e enviar e-mail ao autor com o motivo. | integração + Zod | `@ac-016-3` / `@justificativa-obrigatoria` | `modules/moderation/__tests__/returnForAdjustments.integration.test.ts::devolve-com-motivo` · `…::justificativa-obrigatoria` + `modules/moderation/schemas/moderationDecisionInput.ts` (Zod) | Red |
| AC-016-4 | WHEN…SHALL (+ IF) | WHEN o coordenador rejeita definitivamente, the system SHALL exigir motivo textual, alterar status para "rejeitado" e enviar e-mail ao autor. | integração + Zod | `@ac-016-4` / `@justificativa-obrigatoria` | `modules/moderation/__tests__/rejectContent.integration.test.ts::rejeita-com-motivo` · `…::justificativa-obrigatoria` + `modules/moderation/schemas/moderationDecisionInput.ts` (Zod) | Red |
| AC-016-5 | SHALL (ubíquo) | The system SHALL registrar log da decisão (autor, momento, motivo). | integração (audit) | `@ac-016-5` (Esquema do Cenário) + `@imutabilidade` | `modules/moderation/__tests__/*.integration.test.ts::audit-*` (assert CONTENT_APPROVED / CONTENT_RETURNED_FOR_ADJUSTMENTS / CONTENT_REJECTED) | Red |

## Facts (bloco para o corpo do issue — Kickoff Gate, §22/§23)

- AC-016-1 (fila ordenada) → `modules/moderation/__tests__/listModerationQueue.integration.test.ts::lista-ordenada-por-data`
- AC-016-1 (permissão) → `…listModerationQueue.integration.test.ts::permissao-recusada`
- AC-016-2 (aprovar) → `modules/moderation/__tests__/approveContent.integration.test.ts::aprovar-ativa-e-notifica`
- AC-016-2 (transição inválida) → `…approveContent.integration.test.ts::transicao-invalida`
- AC-016-2 (concorrência) → `…approveContent.integration.test.ts::concorrencia` (it.todo)
- AC-016-2/3/4 (invariante da máquina) → `modules/moderation/__tests__/properties/transitions.property.test.ts`
- AC-016-3 (devolver) → `modules/moderation/__tests__/returnForAdjustments.integration.test.ts::devolve-com-motivo`
- AC-016-3 (motivo obrigatório) → `…returnForAdjustments.integration.test.ts::justificativa-obrigatoria` + schema Zod `moderationDecisionInput.ts`
- AC-016-4 (rejeitar) → `modules/moderation/__tests__/rejectContent.integration.test.ts::rejeita-com-motivo`
- AC-016-4 (motivo obrigatório) → `…rejectContent.integration.test.ts::justificativa-obrigatoria` + schema Zod
- AC-016-5 (auditoria) → assertions de `CONTENT_APPROVED` / `CONTENT_RETURNED_FOR_ADJUSTMENTS` / `CONTENT_REJECTED` nos testes acima (autor + timestamp + motivo) + append-only
- E2E (fluxo crítico Top 8 nº 8) → `e2e/usp-016-moderar-rascunho.e2e.ts`

## Notas de derivação

- **Consentimento LGPD não se aplica** a esta US: moderar é ação administrativa do coordenador,
  não vinculada a finalidade de consentimento do moderador. O caso obrigatório "consentimento ausente"
  (§12) é justificadamente N/A — registrado no cabeçalho do `.spec.ts`.
- **`requirePermission`** usa `MODERATE_JOB` / `MODERATE_CV` / `MODERATE_SERVICE` conforme `contentKind`
  (enum `PermissionId`, technical-design L117-119). Voluntário delegado modera com a mesma permissão.
- **Justificativa obrigatória** (`requiresJustification: true`) só em devolver/rejeitar; aprovar não exige
  (ADR-T-0011, tabela `TRANSITIONS`). Erro tipado: `JUSTIFICATION_REQUIRED`.
- **Eventos de auditoria** verbatim do ADR-T-0004 L19: `CONTENT_APPROVED`,
  `CONTENT_RETURNED_FOR_ADJUSTMENTS`, `CONTENT_REJECTED`.
- **Status PT-BR ↔ enum**: "ativo"=ACTIVE, "aguardando ajustes"=AWAITING_ADJUSTMENTS,
  "rejeitado"=REJECTED, "em moderação"=IN_MODERATION (ADR-T-0011).

## Lacunas / decisões pendentes

- **Ordenação da fila (AC-016-1):** o AC diz "por data de envio". Assumido = `submittedAt`
  (momento da transição DRAFT→IN_MODERATION, derivável do `audit_log` evento
  `CONTENT_SUBMITTED_TO_MODERATION`), ordem ascendente (mais antigo primeiro = mais urgente).
  Campo exato não nomeado no technical-design — **confirmar com Tech Lead** se haverá coluna
  `submittedAt` na tabela do conteúdo ou se a fila deriva do audit_log. Não bloqueia o gate
  (comportamento testável de qualquer forma), mas o nome do campo afeta o teste de integração.
- **Conteúdo de "fila"**: o PRD não especifica se a fila é única (mistura JOB/CV/SERVICE) ou por tipo.
  Os facts foram escritos com `contentKind` parametrizável, cobrindo ambos. Confirmar UX na fase Design.
