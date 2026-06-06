# RESUMO — Facts de teste da USP-004 (Login com e-mail e senha)

Geração dos facts (BDD + TDD) a partir dos 4 critérios de aceitação EARS da USP-004,
para levar ao Kickoff Gate. Fonte da verdade: PRD (linhas 272-283), ADR-0003/0014/0015,
technical-design e project-guideline (§20-23, princípios Fact-Driven).

## Critérios cobertos

- **AC-004-1** — login válido autentica + redireciona à tela inicial.
- **AC-004-2** — credenciais inválidas → mensagem genérica "Credenciais inválidas" (e-mail inexistente e senha errada são indistinguíveis).
- **AC-004-3** — bloqueio 5 falhas / 15 min (com boundary 5ª-vs-6ª e recovery fora da janela).
- **AC-004-4** — sessão encerra após 12h de inatividade (com boundary 11h59 vs 12h01).

## Artefatos entregues (nesta pasta `outputs/`)

| Arquivo | O que é | Destino real no projeto |
|---|---|---|
| `login.feature` | Cenários Gherkin (PT) — 1 por AC + boundaries/recovery | (BDD de referência do módulo identity) |
| `signInInput.schema.ts` | Schema Zod de input + catálogo de códigos de erro | `src/modules/identity/schemas/signInInput.ts` |
| `signIn.integration.test.ts` | Testes RED (Vitest) — happy, validação, erro, rate-limit, sessão | `src/modules/identity/__tests__/signIn.integration.test.ts` |
| `login.e2e.spec.ts` | Esqueleto E2E Playwright (`test.fixme`) dos 4 fluxos | `e2e/login.spec.ts` |
| `EARS-to-Fact.md` | Matriz de rastreabilidade AC→fact + checklist do gate | seção `## Facts` do issue da USP-004 |

## Decisões e conformidade com as convenções

- Login tratado como **ação pública** (pré-autenticação): justificada a ausência de `requirePermission`.
- Retorno padronizado `ActionResult` (`{ ok }`), nunca `throw`; escrita auditável via `withAudit`.
- Rate-limit modelado como wrapper aplicacional sobre `auth_attempts` (ADR-0003), não no provedor.
- AC-004-4 testado como helper puro `isSessionExpired` (unit) + fluxo no E2E; cookie 12h conforme ADR-0015.

## Pendências sinalizadas para o Kickoff Gate

1. Adicionar `LOGIN_SUCCEEDED` e `LOGIN_FAILED` ao catálogo `@/modules/audit/events.ts` (ainda não constam no technical-design).
2. Prover helpers de teste do módulo identity (`seedActiveCredential`, `seedFailedAttempts`, `getAuthAttempts`, `getAuditEvents`).
3. CAPTCHA pós-3-falhas (ADR-0014) previsto no contrato (`captchaToken` opcional + `CAPTCHA_REQUIRED`), mas não é AC formal da USP-004.

Estado: todos os ACs têm ≥1 fact identificado por path/test name. Pronto para o gate, condicionado às 3 pendências de infra acima.
