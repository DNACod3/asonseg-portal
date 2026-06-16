# Rastreabilidade AC → teste — USP-015 (Editar dados da Empresa)

> Fonte: `spec.md` (AC-015-1..2 + Edge Cases), `design-usp-015.md` (D-015-A..F),
> `expectations/expectations-USP-015.md` (E-001..003 / P-001/P-004/P-005).
> Princípio P1: todo critério em prosa tem ≥1 teste máquina-verificável.

| AC / Expectation | Cenário BDD (tag) | Teste máquina-verificável |
|---|---|---|
| AC-015-1 / E-001 — edição não-identitária persiste, mantém `isVerified` | `@ac-015-1 @e-001` | `edit-company.int.test.ts` › happy não-identitário; E2E "editar descrição mantém verificada" |
| AC-015-2 / E-002 / P-001 — campo identitário rebaixa `isVerified=false` na mesma transação | `@ac-015-2 @e-002 @p-001` | `edit-company.int.test.ts` › identitário rebaixa (mesma tx); `company-edit.test.ts` › `identityFieldsChanged` |
| E-002 — razão social / CNPJ também rebaixam | `@ac-015-2 @e-002` | `company-edit.test.ts` (3 identitários); `edit-company.int.test.ts` |
| E-001 (edge) — só endereço/setor/type/descricao não rebaixa | `@ac-015-1 @e-001 @edge` | `company-edit.test.ts` › não-identitários = false |
| P-004 — só responsável ATIVO edita | `@p-004 @permissao` | `edit-company.int.test.ts` › permissão negada (FORBIDDEN); guard de rota (E2E) |
| P-005 / ADR-0021 — CNPJ único preservado no UPDATE | `@p-005 @cnpj` | `edit-company.int.test.ts` › CNPJ duplicado (CONFLICT) |
| D-003 — bypass via action direta rejeitado | (cobre @p-004) | `edit-company.int.test.ts` › chamada direta sem permissão |
| Zod — payload válido / CNPJ inválido / uuid inválido | — | `edit-company.schema.test.ts` |
| D-015-E — aviso de re-verificação antes do submit | `@d-015-e @ui` | `edit-company-form.test.tsx` |
| E-001 (UI) — não-identitário submete direto | `@d-015-e @ui` | `edit-company-form.test.tsx` |

## Estado dos testes

- RED (antes da implementação): specs Vitest de schema/domain/action falham; E2E `test.fixme`.
- GREEN (após Execute): schema/domain/action verdes; E2E materializado e passa local.
