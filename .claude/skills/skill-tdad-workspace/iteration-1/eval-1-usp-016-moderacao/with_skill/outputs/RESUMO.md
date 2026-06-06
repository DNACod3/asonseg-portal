# RESUMO de entrega — Facts USP-016 (Moderar rascunho de vaga, CV ou serviço)

Gerado pela skill-tdad (EARS → Fact). Testes-fonte da verdade, todos em estado **Red**.

## ACs processados (5/5, verbatim do PRD §5 Épico 4, L438-452)

| AC | Padrão EARS | Resumo |
|----|-------------|--------|
| AC-016-1 | WHEN…SHALL | Fila lista rascunhos "em moderação" ordenados por data de envio |
| AC-016-2 | WHEN…SHALL | Aprovar → status ACTIVE + e-mail ao autor |
| AC-016-3 | WHEN…SHALL (+IF) | Devolver → motivo obrigatório + AWAITING_ADJUSTMENTS + e-mail com motivo |
| AC-016-4 | WHEN…SHALL (+IF) | Rejeitar → motivo obrigatório + REJECTED + e-mail |
| AC-016-5 | SHALL (ubíquo) | Registrar log da decisão (autor, momento, motivo) |

## Facts gerados por tipo

- **BDD (Gherkin PT-BR):** `bdd/usp-016-moderar-rascunho.feature` — 1 funcionalidade, 11 cenários
  (happy paths, bordas, permissão, justificativa obrigatória, transição inválida, concorrência,
  esquema de cenário para auditoria, append-only). Tags `@ac-016-N` para rastreabilidade.
- **Unit/integração (Vitest red):** `unit/usp-016-moderar-rascunho.spec.ts` — cobre os 5 ACs +
  os casos obrigatórios de Server Action (§12): happy path, validação (motivo), permissão recusada,
  concorrência. Consentimento marcado N/A (justificado). Stubs lançam `not implemented` → red limpo.
- **Property-based (fast-check red):** `unit/usp-016-maquina-estados.property.spec.ts` — invariante
  da máquina de estados (project-guideline §12): só transições da tabela TRANSITIONS são aceitas;
  requiresJustification correto por transição.
- **E2E (Playwright red):** `e2e/usp-016-moderar-rascunho.e2e.ts` — fluxo crítico Top 8 nº 8
  (architecture §6). 4 cenários em `test.fixme`.
- **Rastreabilidade:** `traceability.md` — matriz AC→fact com path-alvo e status, bloco "## Facts"
  pronto para o corpo do issue (Kickoff Gate §22/§23).

## Cobertura

- **5/5 ACs com fact.** Nenhum AC sem fact → não há bloqueio de Kickoff Gate por ausência de cobertura.
- Permissões mapeadas: `MODERATE_JOB` / `MODERATE_CV` / `MODERATE_SERVICE` (enum PermissionId).
- Eventos de auditoria verbatim (ADR-T-0004): `CONTENT_APPROVED`,
  `CONTENT_RETURNED_FOR_ADJUSTMENTS`, `CONTENT_REJECTED`.

## Lacunas / decisões pendentes (não-bloqueantes)

1. **Campo de ordenação da fila (AC-016-1):** "data de envio" assumida como `submittedAt` (derivável
   do audit `CONTENT_SUBMITTED_TO_MODERATION`), ordem ascendente. Nome de campo não nomeado no
   technical-design — confirmar com Tech Lead (afeta o teste de integração, não o contrato).
2. **Fila única vs. por tipo:** PRD não especifica. Facts escritos com `contentKind` parametrizável;
   confirmar UX na fase Design.

## Para a bravi-spec-driven (campos Tests/Gate das tasks)

Usar o bloco "## Facts" de `traceability.md`. Paths-alvo na fase Execute:
`modules/moderation/__tests__/` (integração + properties), `modules/moderation/schemas/moderationDecisionInput.ts`
(Zod do motivo), `e2e/usp-016-moderar-rascunho.e2e.ts`.
