# Rastreabilidade EARS → Fact — USP-016 Moderar rascunho (vaga, CV ou serviço)

Fonte: PRD §Épico 4 USP-016. Gerado seguindo a metodologia EARS→Fact do projeto
(project-guideline §20–23). Cobertura: **5/5 ACs com fact**.

ADRs/contratos de apoio: ADR-0011 técnico (máquina de estados · `transitionContent`),
ADR-0015 negócio (moderação humana pré-publicação), ADR-T-0004 (audit append-only),
ADR-T-0013 (revalidation on-demand), technical-design §3.3 (sequence) e §117-119 (permissões).

| AC | Tipo EARS | Texto (verbatim) | Tipo de fact | Cenário BDD | Path-alvo do teste | Status |
|----|-----------|------------------|--------------|-------------|--------------------|--------|
| AC-016-1 | WHEN…SHALL | listar rascunhos com status "em moderação" ordenados por data de envio | query/integração | `@ac-016-1` | `modules/moderation/__tests__/moderationQueue.integration.test.ts::fila-ordenada` | Red |
| AC-016-2 | WHEN…SHALL | aprovar → status "ativo" + e-mail ao autor | integração (transitionContent) | `@ac-016-2` | `modules/moderation/__tests__/transitionContent.integration.test.ts::aprovar` | Red |
| AC-016-3 | WHEN…SHALL (+ motivo obrigatório) | devolver → motivo obrigatório + status "aguardando ajustes" + e-mail com motivo | integração + validação | `@ac-016-3` | `…transitionContent.integration.test.ts::devolver` + `…::devolver-sem-motivo` | Red |
| AC-016-4 | WHEN…SHALL (+ motivo obrigatório) | rejeitar → motivo obrigatório + status "rejeitado" + e-mail | integração + validação | `@ac-016-4` | `…transitionContent.integration.test.ts::rejeitar` + `…::rejeitar-sem-motivo` | Red |
| AC-016-5 | SHALL (ubíquo) | registrar log da decisão (autor/decisor, momento, motivo) | integração (auditoria) | `@ac-016-5` | `…transitionContent.integration.test.ts::auditoria-decisao` | Red |

## Casos obrigatórios de Server Action sensível (project-guideline §12)

Derivados do contrato canônico da Server Action, não listados explicitamente no PRD mas
parte do contrato de toda transição de moderação:

| Caso obrigatório | Aplica? | Cenário BDD | Path-alvo | Status |
|------------------|---------|-------------|-----------|--------|
| Happy path | Sim | `@ac-016-2/3/4 @happy-path` | `…transitionContent.integration.test.ts` | Red |
| Validação (motivo obrigatório) | Sim (devolver/rejeitar) | `@ac-016-3 @borda`, `@ac-016-4 @borda` | `…::devolver-sem-motivo`, `…::rejeitar-sem-motivo` | Red |
| Permissão recusada (`requirePermission` MODERATE_<KIND>) | Sim | `@seguranca` | `…transitionContent.integration.test.ts::permissao-recusada` | Red |
| Consentimento ausente (`requireActiveConsent`) | **Não** (justificado) | — | — | N/A |
| Concorrência (dois moderadores) | Sim | `@concorrencia` | `…::concorrencia-aprovacao` | Red |
| Transição inválida (estado não-moderável) | Sim | `@borda` (INVALID_TRANSITION) | `…::aprovar-estado-invalido` | Red |

**Justificativa do N/A de consentimento:** moderação é ato administrativo do coordenador
sobre conteúdo de terceiro; não é operação vinculada a finalidade LGPD do titular, logo
`requireActiveConsent` não se aplica (project-guideline §4 permite omitir quando justificado).

## Facts (bloco para o corpo do issue — Kickoff Gate)

- AC-016-1 → `modules/moderation/__tests__/moderationQueue.integration.test.ts::fila-ordenada`
- AC-016-2 (aprovar) → `…transitionContent.integration.test.ts::aprovar`
- AC-016-2 (transição inválida) → `…::aprovar-estado-invalido`
- AC-016-2 (concorrência) → `…::concorrencia-aprovacao`
- AC-016-3 (devolver) → `…::devolver`
- AC-016-3 (motivo obrigatório) → `…::devolver-sem-motivo`
- AC-016-4 (rejeitar) → `…::rejeitar`
- AC-016-4 (motivo obrigatório) → `…::rejeitar-sem-motivo`
- AC-016-5 (auditoria) → `…::auditoria-decisao`
- Permissão → `…::permissao-recusada`
- E2E (fluxo crítico Top 8 #8) → `e2e/usp-016-moderacao-rascunho.e2e.ts`

## Lacunas / decisões pendentes

- (nenhuma lacuna bloqueante) — todos os 5 ACs têm fact e os casos obrigatórios estão cobertos.
- Decisão menor a confirmar na Execute: nome exato dos eventos de auditoria para devolver
  (`CONTENT_RETURNED` assumido a partir do diagrama de estados ADR-0011 / catálogo audit
  `@/modules/audit/events`); aprovar/rejeitar já constam no technical-design (`CONTENT_APPROVED`,
  `CONTENT_REJECTED`). Validar contra o catálogo final do módulo audit.
