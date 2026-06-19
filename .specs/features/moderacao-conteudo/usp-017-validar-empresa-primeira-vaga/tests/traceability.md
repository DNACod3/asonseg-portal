# USP-017 — Matriz de rastreabilidade AC → fact

> Fonte: `expectations-USP-017.md`. Cada AC tem ≥1 fact. Status `green` = implementado e verde
> (typecheck+lint+unit+integração). Path = onde o fact aterrissou no módulo dono.

| AC (verbatim resumido) | Tipo de fact | Cenário BDD (tag) | Path (impl) | Sub-task | Status |
|---|---|---|---|---|---|
| **E-001** painel + banner + checklist em Empresa não verificada | unit/RTL + integração (query) | `@ac-017-1` | `moderation/queries/__tests__/moderation-queue.{test,int.test}.ts`, `moderation/components/__tests__/verification-panel.test.tsx` | #157 | green |
| **E-002** aprovar → verifica + log + snapshot, mesma tx | integração | `@ac-017-2 @e-002` | `moderation/__tests__/company-verify-hook.int.test.ts` | #156 | green |
| **E-002/P-004** snapshot usa dados vigentes (não rascunho) | integração | `@ac-017-2 @p-004` | `moderation/__tests__/company-verify-hook.int.test.ts` | #156 | green |
| **E-003** rejeitar → rejectionCount++ , mantém não verificada, log | integração | `@ac-017-3` | `moderation/__tests__/company-verify-hook.int.test.ts`, `moderation/__tests__/transition-content.int.test.ts` | #156 | green |
| **E-004** vaga subsequente sem painel + "verificada em DD/MM por X" | integração + unit/RTL | `@ac-017-4` | `moderation/components/__tests__/verification-panel.test.tsx`, `companies/__tests__/company-verification-views.int.test.ts` | #156 + #157 | green |
| **E-004** idempotência (não re-verifica) | integração | `@ac-017-4 @e-004` | `moderation/__tests__/company-verify-hook.int.test.ts` | #156 | green |
| **P-001** checklist apresentada e marcada antes de aprovar | unit/RTL (must-not) | `@ac-017-p001 @must-not` | `moderation/components/__tests__/verification-panel.test.tsx` | #157 | green |
| **P-002** verificação ≠ decisão única indistinguível | unit/RTL (must-not) | `@ac-017-p002 @must-not` | `moderation/components/__tests__/verification-panel.test.tsx` | #157 | green |
| **P-003/D-005** histórico de rejeições visível | unit/RTL + integração (query) | `@ac-017-p003 @d-005 @must-not` | `moderation/components/__tests__/verification-panel.test.tsx`, `companies/__tests__/company-verification-views.int.test.ts` | #157 | green |
| **P-004** dados vigentes no momento da moderação | integração (must-not) | `@ac-017-2 @p-004` | `moderation/__tests__/company-verify-hook.int.test.ts` | #156 | green |
| **P-005/D-004** rota única (sem bypass) | integração (must-not / negativo) | `@ac-017-p005 @d-004 @must-not` | `companies/__tests__/no-external-verify.test.ts` | #156 | green |
| **D-006** diff de campos editados desde verificação | unit/RTL + integração | `@ac-017-d006` | `moderation/components/__tests__/verification-panel.test.tsx`, `companies/__tests__/company-verification-views.int.test.ts` | #157 | green |
| **L-001** painel ≤ 3s p95 | E2E / observabilidade | `@ac-017-l001 @perf` | `e2e/` (ou métrica) — pós-merge | #157 | deferred |
| **L-002** snapshot retido (ADR-0008) | integração (assert persistência) | coberto por `@ac-017-2` | `moderation/__tests__/company-verify-hook.int.test.ts` | #156 | green |

## Cobertura

- ACs/proibições com fact: **14/14** (E-001..E-004, P-001..P-005, L-001, L-002, D-006).
- D-002/D-003/D-005 são UAT operacional (ensaios) — ancorados nos facts E-003/E-002/P-003 acima.

## Lacunas / decisões pendentes

- **D-001 (conteúdo da checklist):** entregável de Fase 0 (`seed-taxonomia-checklists`, AC-111-2).
  O **mecanismo** da checklist (itens marcáveis) é testável agora (P-001 RESOLVIDO); o **conteúdo**
  dos itens não. Os facts de P-001 testam o mecanismo, não os itens específicos. ⛔ Gate de produção.
- **L-001 (perf p95):** medição real fica em E2E/observabilidade pós-implementação; o fact é placeholder.
- **AD-5 (caminho de rejeição):** RESOLVIDO em #156 — o port `CompanyVerifyHook` ganhou
  `onContentRejected`, acionado por `transitionContent` no destino `REJECTED` dentro do mesmo
  `withAudit('CONTENT_REJECTED')`; incrementa `rejectionCount` só enquanto `isVerified=false`.
- **Extensão de escopo (#157):** a fila de moderação (`viewModerationQueue`) passou a unir as
  **vagas reais** (`jobs`) ao store `_moderation_fixture` — era pré-requisito para o painel aparecer
  numa vaga real (GAP-8 da USP-016). Demais tipos (CV/serviço/perfil) seguem no fixture até suas USPs.
