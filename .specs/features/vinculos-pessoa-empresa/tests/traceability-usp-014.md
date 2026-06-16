# Rastreabilidade AC → Fact — USP-014 Remover responsável de uma Empresa

Fonte: `spec.md` (AC-014-1..3 + Edge Cases) + `design-usp-014.md` (D-014-A..E).
Modelo: **remoção append-only** via `revokedAt`/`revokedBy` + nova coluna `revokeReason` (D-014-A/B).
Gerado por skill-tdad (T1). Cobertura: **3/3** AC + edges com fact. Facts identificados pela tag
`@ac-014-N` nos `*.int.test.ts` (não por sufixo `::nome`).

| Req (VPE) | AC | Texto (resumo) | Tipo de fact | Cenário BDD | Path-alvo (Execute) | Status |
|---|---|---|---|---|---|---|
| VPE-04 | AC-014-1 | remoção persiste (`revokedAt`/`revokedBy`/`revokeReason`) + e-mail à Pessoa removida | integração | `@ac-014-1` | `companies/__tests__/remove-responsible.int.test.ts` (happy + outbox) | Red |
| VPE-05 | AC-014-2 | bloquear quando seria o último responsável ativo | unit + integração | `@ac-014-2` | `companies/__tests__/grants.test.ts` · `remove-responsible.int.test.ts` (último ativo) | Red |
| VPE-06 | AC-014-3 | histórico preservado (append-only, nunca delete) + audit | integração | `@ac-014-3` | `remove-responsible.int.test.ts` (histórico preservado) | Red |

### Casos obrigatórios de Server Action cobertos (`removerResponsavel`)
- **happy** (AC-014-1, 2→1) · **Zod** (`grantId` não-UUID) · **permissão** (não-responsável → `FORBIDDEN`) ·
  **pré-condição/invariante** (último ativo → `PRECONDITION_FAILED`) · **auto-remoção** com outro ativo ·
  **falha de e-mail não reverte** (outbox desacoplado) · **idempotência** (grant inexistente/já revogado → `NOT_FOUND`).
- Consent LGPD: **não se aplica** à remoção (o gate jurídico D-001 da USP-013 cobre só o aceite).

## Facts (bloco para o corpo do issue — Kickoff Gate)

- AC-014-1 (happy 2→1, revokedAt + audit) → `companies/__tests__/remove-responsible.int.test.ts` `@ac-014-1`
- AC-014-1 (outbox "responsible-removed") → `remove-responsible.int.test.ts` `@ac-014-1` (outbox)
- AC-014-1 (motivo → revokeReason) → `remove-responsible.int.test.ts` `@ac-014-1` (motivo)
- AC-014-1 (auto-remoção com outro ativo) → `remove-responsible.int.test.ts` `@ac-014-1` (auto-remoção)
- AC-014-2 (regra pura único→true / ≥2→false) → `companies/__tests__/grants.test.ts`
- AC-014-2 (bloqueio do último ativo) → `remove-responsible.int.test.ts` `@ac-014-2`
- AC-014-3 (histórico preservado, sem delete) → `remove-responsible.int.test.ts` `@ac-014-3`
- Permissão (não-responsável → FORBIDDEN) → `remove-responsible.int.test.ts` `@permissao`
- Idempotência (NOT_FOUND) → `remove-responsible.int.test.ts` `@idempotencia`
- Falha de e-mail não reverte → `remove-responsible.int.test.ts` `@borda` (e-mail)
- Schema Zod → `companies/__tests__/remove-responsible.schema.test.ts`
- Migração `revokeReason` (coluna nullable) → `companies/__tests__/grant-revoke-reason-migration.int.test.ts`
- Template e-mail → `shared/lib/email/__tests__/responsible-removed.test.ts`
- Query lista ativos → `companies/queries/__tests__/list-active-responsibles.test.ts`
- Dialog UI → `companies/__tests__/remove-responsible-dialog.test.tsx`
- E2E (operação de Empresa) → `e2e/companies/remove-responsible.spec.ts`

BDD (PT-BR): `tests/bdd/usp-014-remover-responsavel.feature` · Vitest red: `tests/unit/usp-014-remover-responsavel.spec.ts`
· E2E red: `tests/e2e/usp-014-remover-responsavel.e2e.ts`

## Lacunas / decisões pendentes
- Nenhum AC sem fact. Sem gate jurídico (a remoção não captura consent). Cobertura completa para o Kickoff Gate.
