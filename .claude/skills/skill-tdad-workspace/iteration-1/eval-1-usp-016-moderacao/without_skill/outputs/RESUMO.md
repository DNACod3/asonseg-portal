# RESUMO — Testes-fonte (BDD + TDD) da USP-016

Geração dos facts (EARS → Fact) para a fase **Tasks** da bravi-spec-driven, feature
**USP-016 — Moderar rascunho de vaga, CV ou serviço**. Testes-fonte em estado **red**,
prontos para popular os campos `Tests`/`Gate` de cada task antes de implementar.

## Artefatos entregues (em `outputs/`)

| Arquivo | Conteúdo |
|---|---|
| `spec.md` | Stub da spec: US + ACs verbatim + fontes da verdade consultadas |
| `tests/bdd/usp-016-moderacao-rascunho.feature` | Gherkin PT-BR, 1 cenário por AC + bordas + segurança/concorrência, tags `@ac-016-N` |
| `tests/unit/usp-016-moderacao-rascunho.spec.ts` | Vitest red (`it` com stub `not implemented` + `it.todo`), espelha os cenários |
| `tests/e2e/usp-016-moderacao-rascunho.e2e.ts` | Playwright red (`test.fixme`) — USP-016 é fluxo crítico Top 8 #8 |
| `tests/traceability.md` | Matriz AC → tipo EARS → fact → path-alvo → status |

## Classificação EARS → fact

| AC | EARS | Fact |
|----|------|------|
| AC-016-1 | WHEN…SHALL | query/integração — fila ordenada por data de envio, só IN_MODERATION |
| AC-016-2 | WHEN…SHALL | integração `transitionContent` IN_MODERATION→ACTIVE + e-mail + auditoria + revalidation |
| AC-016-3 | WHEN…SHALL (+motivo) | integração →AWAITING_ADJUSTMENTS + cenário-irmão de borda (JUSTIFICATION_REQUIRED) |
| AC-016-4 | WHEN…SHALL (+motivo) | integração →REJECTED + cenário-irmão de borda |
| AC-016-5 | SHALL (ubíquo) | auditoria transversal: log com decisor, timestamp, motivo |

## Cobertura

- **5/5 ACs com fact** — sem lacunas bloqueantes de Kickoff Gate.
- Casos obrigatórios de Server Action sensível (project-guideline §12) incluídos além dos ACs:
  happy path, validação (motivo obrigatório), **permissão recusada** (`MODERATE_JOB/CV/SERVICE`
  → FORBIDDEN), **concorrência** (dois moderadores → INVALID_TRANSITION), e transição inválida.
- **Consentimento LGPD (`requireActiveConsent`) marcado N/A com justificativa**: moderação é ato
  administrativo sobre conteúdo de terceiro, não operação vinculada a finalidade do titular.

## Ancoragem no domínio (fonte da verdade)

Os facts derivam de ADR-0011 técnico (máquina de estados / `transitionContent` / tabela
`TRANSITIONS`), technical-design §3.3 (sequence) e §117-119 (permissões), ADR-T-0004 (audit
append-only) e ADR-T-0013 (revalidation). Eventos de auditoria usados: `CONTENT_APPROVED`,
`CONTENT_RETURNED`, `CONTENT_REJECTED`. Estados: `IN_MODERATION → {ACTIVE | AWAITING_ADJUSTMENTS
| REJECTED}` via `MODERATOR_ACTION`.

## Decisão pendente (não-bloqueante)

Confirmar na fase Execute o nome exato do evento de auditoria para "devolver"
(`CONTENT_RETURNED` assumido do diagrama de estados) contra o catálogo `@/modules/audit/events`.
Aprovar/rejeitar já constam no technical-design.

## Estado dos testes

Todos em **Red** — falham por ausência de implementação (stubs lançam `not implemented`;
E2E em `test.fixme`), nunca por erro de sintaxe/import. Na fase Execute movem-se para
`modules/moderation/__tests__/` e `e2e/`, conectando-se à `transitionContent` real.
