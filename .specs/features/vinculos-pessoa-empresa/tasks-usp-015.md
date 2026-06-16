# Tasks — USP-015: Editar dados da Empresa

> ICE mode. Card único: `docs/IDSD/ice-portal-asonseg/matriz-conexoes.md` → USP-015.
> Design-adapter: `design-usp-015.md`. Spec: `spec.md` (AC-015-1..2 + edges, Épico 3).
> Expectations: E-001..003 / P-001..005 (`expectations/expectations-USP-015.md`).
> **Entrega: PR único** cobrindo toda a US (backend + UI), fechando as sub-issues **#141** e **#142**.

## Entry Gate (kickoff) — ✅ LIBERADO

- USP #139 **In progress**, **sem flag `Blocked`**. Subs #141 (6h) / #142 (4h) em Backlog (movem p/ In Progress no dev).
- Upstream **USP-012** (`createCompany`, schema `Company`/`isVerified`, padrão `withAudit`) **mergeado** (PR #261).
  Downstream USP-017 (re-verificação) consome, **não** bloqueia. Sem dependência ativa.
- Estimate pai = 10h = #141 (6h) + #142 (4h) ✓.
- Sem coluna nova (D-015-A) → sem migração. Evento `COMPANY_UPDATED` já catalogado.

## Estratégia de entrega (1 PR)

Branch único `feat/usp-015-editar-empresa`; PR `feat(companies): USP-015 — editar dados da Empresa`
fechando **#141 e #142** (`Closes #141`, `Closes #142`). Commits atômicos por task (T1…T8).

## Rastreabilidade (VPE → tasks)

| Req | Origem | Onde | Tasks |
|-----|--------|------|-------|
| VPE-07 | AC-015-1 / E-001 | Edição persistida + audit before/after | T2, T4, T5 |
| VPE-08 | AC-015-2 / E-002 / P-001 | Rebaixa `isVerified=false` (campos identitários) na mesma transação + aviso | T3, T4, T6 |
| — (P-004) | edge permissão | Só responsável ATIVO edita | T4, T7 |
| — (P-005) | edge CNPJ | CNPJ único preservado no UPDATE | T2, T4 |

---

## Tasks

### T1 — Facts (skill-tdad) — testes RED da USP-015
- **What:** gerar testes-fonte de E-001..003 / P-001..005 + edges: `.feature` (PT-BR, tag `@ac-015-N`),
  specs Vitest RED (action + regra de domínio), esqueleto E2E do fluxo de edição, matriz de rastreabilidade AC→teste.
- **Where:** `.specs/features/vinculos-pessoa-empresa/tests/bdd/usp-015-editar-empresa.feature`,
  `tests/unit/usp-015-editar-empresa.spec.ts`, `tests/e2e/usp-015-editar-empresa.e2e.ts`,
  novo `tests/traceability-usp-015.md`.
- **Depends on:** —
- **Reuses:** facts da USP-012/014 (`tests/*/usp-01{2,4}-*`).
- **Done when:** `.feature` cobre: edição não-identitária mantém `isVerified` (E-001), edição identitária
  rebaixa (E-002/P-001), bypass via action direta é rejeitado (D-003), permissão negada (P-004),
  CNPJ duplicado bloqueia (P-005); specs Vitest existem e **falham** (RED).
- **Tests:** (produtor de testes — via **skill-tdad**)
- **Gate:** specs RED commitados antes da implementação.

### T2 — `editCompanySchema` (Zod) — sub-issue #141
- **What:** schema de edição reusando os validadores de campo de `createCompanySchema` (CNPJ normalizado/dígitos,
  trims, `type`) + `empresaId: uuid`. `isVerified` **não** entra (controlado pelo sistema).
- **Where:** `src/modules/companies/schemas/edit-company.schema.ts` + `__tests__/edit-company.schema.test.ts`.
- **Depends on:** —
- **Reuses:** `schemas/create-company.schema.ts` (extrair/reusar field validators sem duplicar regra de CNPJ).
- **Done when:** parse aceita payload válido; rejeita CNPJ inválido / `empresaId` não-uuid; typecheck verde.
- **Tests:** `__tests__/edit-company.schema.test.ts` (válido, CNPJ inválido, uuid inválido).
- **Gate:** sem duplicação da regra de dígitos do CNPJ (reuso de `domain/cnpj.ts`).

### T3 — Regra pura `identityFieldsChanged` + unit — #141
- **What:** `identityFieldsChanged(before, after): boolean` — verdadeiro sse `cnpj`, `razaoSocial` **ou**
  `nomeFantasia` mudou (sem IO). Base do rebaixamento (D-015-B).
- **Where:** `src/modules/companies/domain/company-edit.ts` (novo) + `__tests__/company-edit.test.ts`.
- **Depends on:** —
- **Reuses:** molde de `domain/grants.ts` (regra pura testável).
- **Done when:** true p/ mudança em cada um dos 3 identitários; false p/ mudança só em `type`/`setor`/`descricao`/`endereco`; unit verde.
- **Tests:** `__tests__/company-edit.test.ts` (3 identitários × muda/não-muda; não-identitários).
- **Gate:** função pura, sem dependência de Prisma/IO.

### T4 — Action `editarEmpresa` + rebaixamento atômico + audit — #141
- **What:** Server Action seguindo a sequência canônica (design §2): Zod → `getCurrentPerson` → carregar
  `before` (`NOT_FOUND`) → permissão P-004 (`FORBIDDEN`) → CNPJ único P-005 (`CONFLICT`) →
  `withAudit(COMPANY_UPDATED)` com `update` aplicando `isVerified:false` **sse** `identityFieldsChanged`
  (mesma transação, P-001) e `before`/`after` na auditoria; guarda P2002 `companies_cnpj_key` → `CONFLICT`.
- **Where:** `src/modules/companies/actions/edit-company.ts`.
- **Depends on:** T2, T3.
- **Reuses:** `create-company.ts` (sequência+`withAudit`+catch P2002), `add-responsible.ts:60-72` (permissão ATIVO).
- **Done when:** retorna `ActionResult<{ companyId, isVerified, downgraded }>`; nunca `throw`; specs RED de T1 (action) passam (GREEN).
- **Tests:** `__tests__/edit-company.int.test.ts` — happy não-identitário (isVerified inalterado), identitário
  (rebaixa), permissão negada, CNPJ duplicado, bypass direto rejeitado (cobre D-003).
- **Gate:** rebaixamento e edição numa só transação; sem evento de e-mail (não fabricar).

### T5 — Barrel export `index.ts` — #141
- **What:** exportar `editarEmpresa`, `editCompanySchema`/tipos e `EditCompanyForm` via barrel do módulo.
- **Where:** `src/modules/companies/index.ts`.
- **Depends on:** T4, T6.
- **Reuses:** estrutura de export existente do barrel.
- **Done when:** imports via `@/modules/companies` resolvem; nenhum import por deep path no app.
- **Tests:** typecheck verde; lint sem deep-import.
- **Gate:** regra de barrel (CLAUDE.md) respeitada.

### T6 — `EditCompanyForm` + diálogo de aviso de re-verificação — sub-issue #142
- **What:** form client (RHF+Zod) pré-preenchido; detecta mudança em campo identitário e, no submit, abre
  diálogo de confirmação com aviso *"Esta alteração exigirá nova verificação manual na próxima vaga"* (E-002/D-015-E)
  antes de chamar `editarEmpresa`. Toast sucesso/erro; trata `FORBIDDEN`/`CONFLICT`.
- **Where:** `src/modules/companies/components/edit-company-form.tsx` + `__tests__/edit-company-form.test.tsx`.
- **Depends on:** T4.
- **Reuses:** `components/create-company-form.tsx` (form+action+toast), `remove-responsible-dialog.tsx` (AlertDialog shadcn).
- **Done when:** muda só descrição → submete direto; muda razão social → exige confirmação no diálogo; testes de componente verdes.
- **Tests:** `__tests__/edit-company-form.test.tsx` (aviso aparece p/ identitário; ausente p/ não-identitário).
- **Gate:** aviso renderizado antes do submit; servidor continua fonte da verdade do rebaixamento.

### T7 — Rota `(app)/empresa/[empresaId]/editar` + guard — #142
- **What:** page `force-dynamic` que faz 404 p/ não-responsável-ativo (defesa em profundidade, P-004),
  carrega dados atuais da Empresa e renderiza o `EditCompanyForm` pré-preenchido.
- **Where:** `src/app/(app)/empresa/[empresaId]/editar/page.tsx`.
- **Depends on:** T6.
- **Reuses:** `(app)/empresa/[empresaId]/responsaveis/page.tsx` (gate de rota + `requireActivePerson`).
- **Done when:** responsável ativo acessa e vê form preenchido; não-responsável → 404; typecheck verde.
- **Tests:** coberto pelo E2E (T8); guard espelha o de `responsaveis`.
- **Gate:** sem cache (`force-dynamic`); rota não revela existência da Empresa a estranhos.

### T8 — E2E + traceability + fechamento do spec — #142
- **What:** materializar o E2E do fluxo de edição (editar descrição → mantém verificada; editar razão social →
  confirma aviso → rebaixa) e atualizar rastreabilidade/spec.
- **Where:** `tests/e2e/usp-015-editar-empresa.e2e.ts`, `tests/traceability-usp-015.md`,
  `spec.md` (VPE-07/VPE-08 → status `Done`).
- **Depends on:** T4, T7.
- **Reuses:** padrão E2E de `tests/e2e/usp-014-*`.
- **Done when:** E2E passa local; matriz AC→teste completa; VPE-07/08 marcados `Done`; typecheck/lint/testes sem regressão.
- **Gate:** todos os AC com ao menos um teste máquina-verificável (P1).

---

## Ordem de execução

```
T1 (facts RED) ──▶ T2, T3 (paralelos) ──▶ T4 (action) ──▶ T5 (barrel)
                                              │
                                              ▼
                                   T6 (form) ──▶ T7 (rota) ──▶ T8 (E2E + spec)
```
Backend (#141): T2→T3→T4→T5. UI (#142): T6→T7→T8. Commit atômico por task; PR único fecha #141 e #142.
