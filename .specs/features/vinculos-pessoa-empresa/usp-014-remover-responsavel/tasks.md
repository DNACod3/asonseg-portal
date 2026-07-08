# USP-014 — Remover responsável — Refactor (Fase 2) Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill files
by filesystem path. The skill is the source of truth for the per-task cycle (implement → gate → atomic
commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator — do not proceed without it.**

**Refactor discipline (every restyle task):** change **only markup/classes**. Do not touch `removerResponsavel`,
`wouldLeaveCompanyWithoutResponsible`, `revokeReason`, outbox, audit, or the route gate. Existing tests MUST
stay green. Preserve: invariante ≥1 ATIVO, append-only (`revokedAt`, nunca `delete`), permissão ATIVO, auto-remoção
→ redireciona. **Coordenação:** T2 restila só a seção "Responsáveis ativos" de `responsaveis/page.tsx`; o shell +
adição é da USP-013.

---

**Design**: `.specs/features/vinculos-pessoa-empresa/usp-014-remover-responsavel/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found:
> `CLAUDE.md`, `docs/arch/project-guideline.md`, `vitest.config.ts`, `vitest.integration.config.ts`.
> DS `.tsx` fora do gate de cobertura (AD-014/AD-015); Client Components tocados têm `.test.tsx` co-localizado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (`RemoveResponsibleDialog`) | unit (RTL) | Abrir/confirmar + motivo opcional + `removerResponsavel` + render do erro "último responsável" | `src/modules/companies/__tests__/*.test.tsx` | `npm run test` |
| Guarda estática de paridade DS | unit | Arquivos da USP-014 sem paleta crua/hex (U14-MN-04) | `src/modules/companies/__tests__/ds-empresa-remover-parity.test.ts` | `npm run test` |
| Server Action (`removerResponsavel`) | integration | **Preservada** — último ativo → `PRECONDITION_FAILED` (U14-MN-01), append-only (U14-MN-02), `FORBIDDEN` (U14-MN-03) | `src/modules/companies/__tests__/remove-responsible.int.test.ts` | `npm run test:integration` |
| Server Component (`responsaveis/page.tsx`) | none | Gate de build | `src/app/(app)/empresa/**` | build gate |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; `vi.mock` | `remove-responsible-dialog.test.tsx` (existente) |
| unit (guarda estática) | Yes | Lê fonte do disco | `no-external-verify.test.ts` |
| integration (Postgres) | No | Postgres compartilhado + cleanup | `remove-responsible.int.test.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks unit (RTL/guarda) | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks que exercitam a Server Action (preservação) | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Restyle de Server Component (página) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Restyle + verificação (Parallel OK)

```
T1 [P]  (RemoveResponsibleDialog)
T3 [P]  (verificação da action preservada)
```

### Phase 2: Página + guarda (Sequential)

```
T1 → T2 (seção de ativos) → T4 (guarda de paridade DS)
```

2 fases → execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `RemoveResponsibleDialog` (só estilo) + RTL [P]

**What**: Trocar botões crus por `Button` (`danger`/`outline`), motivo por `Label`+`Textarea`, superfície do
modal por tokens; overlay tokenizado. Estender/atualizar o RTL existente para travar a chamada a
`removerResponsavel` e o render do erro de "último responsável".
**Where**: `src/modules/companies/components/remove-responsible-dialog.tsx` (modify) + `__tests__/remove-responsible-dialog.test.tsx` (atualizar)
**Depends on**: None
**Reuses**: `@/shared/ui` (`Button`/`Label`/`Textarea`), `LoginForm.tsx` (danger-token)
**Requirement**: U14-STYLE-01, U14-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Confirmar = `Button variant="danger"`; Cancelar = `Button variant="outline"`; gatilho "Remover" destrutivo tokenizado; motivo com `Label`/`Textarea`; superfície `bg-surface`/`text-fg`/`border-border`.
- [ ] Sem `bg-red-*`/`text-gray-*`/`border-gray-300`.
- [ ] Comportamento preservado: RHF+Zod (`removeResponsibleSchema`), `open`/Esc, `removerResponsavel`, `selfRemoved` → redireciona, tratamento de erros.
- [ ] **RTL:** abrir → digitar motivo → confirmar chama `removerResponsavel({grantId, motivo})`; quando a action retorna `PRECONDITION_FAILED`, a mensagem de "último responsável" é exibida.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `remove-responsible-dialog.test.tsx` ≥3 casos verdes (sem deleções).

**Tests**: unit · **Gate**: quick
**Commit**: `refactor(companies): restyle RemoveResponsibleDialog com Design System (AD-014) — só estilo`

---

### T2: Restyle da seção "Responsáveis ativos" na página (só estilo)

**What**: Tokenizar a lista de ativos (`divide-border`/`border-border`/`text-fg`/`text-fg-muted`).
**Where**: `src/app/(app)/empresa/[empresaId]/responsaveis/page.tsx` (modify — seção USP-014)
**Depends on**: T1
**Reuses**: tokens do DS
**Requirement**: U14-STYLE-01, U14-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Lista com tokens; sem `divide-gray-*`/`border-gray-*`/`text-gray-*`.
- [ ] Preservados: `listActiveResponsibles`, `RemoveResponsibleDialog`, gate de rota, `force-dynamic`.
- [ ] Renderiza em light/dark.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component — gate de build) · **Gate**: build
**Commit**: `refactor(companies): restyle seção de responsáveis ativos com Design System (AD-014)`

---

### T3: Verificar preservação de `removerResponsavel` (must-nots de negócio) [P]

**What**: Confirmar que os testes de integração cobrem: último ativo → `PRECONDITION_FAILED` (U14-MN-01),
append-only — linha persiste com `revokedAt` (U14-MN-02), não-responsável → `FORBIDDEN` (U14-MN-03). Estender
se algum faltar. **Sem alterar produção.**
**Where**: `src/modules/companies/__tests__/remove-responsible.int.test.ts` (verificar/estender)
**Depends on**: None
**Reuses**: suíte existente
**Requirement**: U14-MN-01, U14-MN-02, U14-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Caso: remover o único ativo → `PRECONDITION_FAILED`, grant não revogado.
- [ ] Caso: após remoção válida, a linha existe com `revokedAt`/`revokedBy` (nenhum `delete`).
- [ ] Caso: não-responsável → `FORBIDDEN`, grant intacto.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- [ ] Test count: nenhum caso deletado.

**Tests**: integration · **Gate**: full
**Commit**: `test(companies): fixar must-nots de negócio da remoção (invariante/append-only/FORBIDDEN)`

---

### T4: Guarda estática de paridade DS (must-not de estilo)

**What**: Teste estático que lê os arquivos restilizados da USP-014 e falha com paleta crua/hex.
**Where**: `src/modules/companies/__tests__/ds-empresa-remover-parity.test.ts` (novo)
**Depends on**: T1, T2
**Reuses**: `no-external-verify.test.ts`
**Requirement**: U14-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cobre `remove-responsible-dialog.tsx` e a seção de ativos de `responsaveis/page.tsx`.
- [ ] Falha para `bg-red-`, `text-gray-`, `border-gray-`, hex `#RRGGBB` em superfície temática.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`

**Tests**: unit · **Gate**: quick
**Commit**: `test(companies): guarda de paridade DS da remoção de responsável (U14-MN-04)`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]  (RemoveResponsibleDialog + RTL)
  └── T3 [P]  (verificação da action)

Phase 2 (Sequential):
  T1 → T2 (seção de ativos) → T4 (guarda de paridade)
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | 1 componente + teste | Granular |
| T2 | 1 seção de página | Granular |
| T3 | verificação de testes existentes | Granular |
| T4 | 1 arquivo de teste | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | [P] Phase 1 | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | None | [P] Phase 1 | Match |
| T4 | T1, T2 | T2 → T4 | Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Client Component | unit (RTL) | unit | OK |
| T2 | Server Component (página) | none (build) | none | OK |
| T3 | Server Action (preservada) | integration | integration | OK |
| T4 | Guarda estática | unit | unit | OK |

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U14-MN-01 (invariante ≥1 ativo) | T3 | `remove-responsible.int.test.ts` — último ativo → `PRECONDITION_FAILED` |
| U14-MN-02 (append-only, sem delete) | T3 | `remove-responsible.int.test.ts` — linha persiste com `revokedAt` |
| U14-MN-03 (só responsável ATIVO remove) | T3 | `remove-responsible.int.test.ts` — não-responsável → `FORBIDDEN` |
| U14-MN-04 (sem paleta crua) | T1, T2 (+ T4 guarda) | `ds-empresa-remover-parity.test.ts` |

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate. Restyle tasks mantêm verdes todos os testes
existentes da USP-014 (regra de refactor: só estilo).
