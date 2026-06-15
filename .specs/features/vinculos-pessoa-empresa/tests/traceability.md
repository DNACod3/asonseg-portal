# Rastreabilidade EARS → Fact — USP-013 Adicionar responsável a uma Empresa

Fonte: `expectations-USP-013.md` (E-001..E-003, P-001..P-005, L-002) + `intent-USP-013.md` (F1..F4).
Modelo: **PENDENTE+ACEITE** (decisão de kickoff AD-006). Gerado por skill-tdad. Cobertura: **9/9** itens ICE com fact.
Status: todos `Red` (falham por ausência de implementação).

| ID ICE | Tipo EARS | Texto (resumo verbatim) | Tipo de fact | Cenário BDD | Path-alvo (Execute) | Status |
|---|---|---|---|---|---|---|
| E-001 | WHEN…SHALL | busca + adiciona → cria vínculo "responsável" **e ativa papel** (no aceite) + consent fin.5 | integração | `@ac-e-001` (add) + `@ac-p-003` (accept) | `companies/__tests__/add-responsible.int.test.ts::happy` · `accept-responsible-link.int.test.ts::papel-consent` | Red |
| E-002 | IF…THEN | Pessoa não cadastrada → bloquear + orientar auto-cadastro (sem convite) | integração | `@ac-e-002` | `companies/__tests__/add-responsible.int.test.ts::nao-cadastrada` | Red |
| E-003 | WHEN…SHALL | vínculo criado → e-mail com link de aceite; ativo só após aceite | integração | `@ac-e-003` + `@ac-p-002` | `add-responsible.int.test.ts::outbox` · `accept-responsible-link.int.test.ts::happy` | Red |
| P-001 | must-not | NÃO retornar PII na busca antes da confirmação (resposta binária) | integração | `@ac-p-001` | `add-responsible.int.test.ts::busca-sem-pii` | Red |
| P-002 | must-not | NÃO vincular sem aceite explícito (nasce pendente) | integração | `@ac-p-002` (add+accept) | `add-responsible.int.test.ts::status-pending` · `accept-responsible-link.int.test.ts::idempotencia` | Red |
| P-003 | must-not | NÃO criar vínculo sem papel correspondente (atômico) | integração | `@ac-p-003` | `accept-responsible-link.int.test.ts::papel-consent` | Red |
| P-004 | must-not | NÃO criar 2 vínculos (UNIQUE parcial + 409, mesmo concorrente) | integração + migration | `@ac-p-004` | `add-responsible.int.test.ts::duplicidade-409` · `grant-status-migration.int.test.ts::unique-parcial` | Red |
| P-005 | must-not | NÃO permitir busca por quem não é responsável ativo | integração | `@ac-p-005` | `add-responsible.int.test.ts::permissao` | Red |
| L-002 | limite | rate limit anti-enumeração de CPF/e-mail | integração | `@ac-l-002` | `add-responsible.int.test.ts::rate-limit` | Red |

### Casos obrigatórios de Server Action cobertos
- **adicionarResponsavel:** happy (E-001) · Zod (`::validacao`) · permissão (P-005) · concorrência (P-004). Consent fin.5 não exigido do ator (capturado no aceite — justificado).
- **aceitarVinculoResponsavel:** happy (P-002) · Zod (`::validacao`) · permissão (só a própria Pessoa) · pré-condição/idempotência (não-PENDING) · consent fin.5 capturado (P-003).

## Facts (bloco para o corpo do issue — Kickoff Gate)

- E-001 (add happy, PENDING) → `companies/__tests__/add-responsible.int.test.ts::happy`
- E-001/P-003 (accept: papel + consent) → `companies/__tests__/accept-responsible-link.int.test.ts::papel-consent`
- E-002 → `add-responsible.int.test.ts::nao-cadastrada`
- E-003 (outbox) → `add-responsible.int.test.ts::outbox`
- E-003/P-002 (accept happy) → `accept-responsible-link.int.test.ts::happy`
- P-001 (busca sem PII) → `add-responsible.int.test.ts::busca-sem-pii`
- P-002 (idempotência) → `accept-responsible-link.int.test.ts::idempotencia`
- P-004 (409 + concorrência) → `add-responsible.int.test.ts::duplicidade-409`
- P-004 (UNIQUE parcial) → `grant-status-migration.int.test.ts::unique-parcial`
- P-005 (permissão) → `add-responsible.int.test.ts::permissao`
- L-002 (rate limit) → `add-responsible.int.test.ts::rate-limit`
- Template e-mail → `shared/lib/email/__tests__/responsible-link-pending.test.ts`
- E2E (operação de Empresa) → `e2e/companies/add-responsible.spec.ts` · `e2e/companies/accept-responsible-link.spec.ts`

BDD (PT-BR): `tests/bdd/usp-013-adicionar-responsavel.feature` · Vitest red: `tests/unit/usp-013-adicionar-responsavel.spec.ts` · E2E red: `tests/e2e/usp-013-adicionar-responsavel.e2e.ts`

## Lacunas / decisões pendentes

- **D-001 (gate jurídico):** decisão escrita diretoria+jurídico do modelo de aceite é pré-condição de **deploy**, não de fact. Rastreado em STATE.md (B-003). Não bloqueia o Kickoff Gate.
- **L-002 (valor de N):** o limite concreto de buscas/janela é parâmetro tunável (ADR-0029) — o fact verifica o comportamento (recusa após exceder), não o número.
- Nenhum AC sem fact. Cobertura completa para o Kickoff Gate.
