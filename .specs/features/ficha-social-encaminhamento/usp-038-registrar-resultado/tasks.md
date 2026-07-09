# USP-038 — Registrar resultado do encaminhamento — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: **activate it by name** and
follow its Execute flow and Critical Rules (per-task cycle: implement → gate → 1 atomic
commit; author ≠ verifier; must-nots need green negative tests). **If the skill cannot be
activated, STOP and report.**

**Design**: `./design.md` (referencia o agregado em `../usp-037-encaminhar-vaga/design.md`)
**Spec**: `./spec.md` · **Status**: Draft

---

## Entry Gate (§0) — PASSED (com pré-requisito de sequência)

`spec.md` → Assumptions: todos owner `agent`, `Confirmed? = y`. **Nenhum item externo bloqueando.**
**Pré-requisito de sequência (hard):** a **USP-037 deve estar implementada primeiro** — esta USP
escreve nas colunas `result/…` e usa o enum `ReferralResult`, o model `Referral` e o módulo
`referrals`, **todos criados pela migração/scaffold da USP-037**. O orquestrador sequencia
USP-037 → USP-038. **Sem migração nova aqui.**

---

## Test Coverage Matrix

> Gerado de codebase + guidelines + spec. Guidelines: `CLAUDE.md` (Server Action tests: happy/Zod/
> permission/precondição), `package.json`, `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Zod schema (`referrals/schemas`) | unit | Aceita válidos; rejeita enum inválido / uuid inválido / observação > max | `src/modules/referrals/__tests__/*.spec.ts` | `npm run test` |
| Server Action (`referrals/actions/register-referral-result`) | integration | Matriz sensível: happy + Zod(enum) + permission + NOT_FOUND + re-registro + **negative tests dos must-nots** | `src/modules/referrals/__tests__/*.int.test.ts` | `npm run test:integration` |
| Componente/Página UI (`referrals/components/result-form`) | e2e (+ component) | Render + seleção + submit; E2E cobre gate de sessão/permissão (padrão L-007) | `src/modules/referrals/components/__tests__/*.spec.tsx` + `e2e/**/*.spec.ts` | `npm run test` + `npm run test:e2e` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (`*.spec.ts`/`*.spec.tsx`) | **Yes** | Puro/mocked | `application-rules.spec.ts` |
| integration (`*.int.test.ts`) | **No** | Postgres compartilhado + cleanup | `apply-to-job.int.test.ts` |
| e2e (playwright) | **No** | App + DB compartilhados | `e2e/jobs/*.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Tasks só com unit | `npm run test` |
| Full | Tasks com integração/e2e | `npm run test && npm run test:integration` |
| Build | Fim de fase | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Phase 1: Schema Zod (Sequential)
```
T1
```
### Phase 2: Server Action (Sequential)
```
T1 → T2
```
### Phase 3: UI (Sequential)
```
T2 → T3
```

Cadeia estritamente sequencial (3 tasks, ≤3 fases → execução inline, sem sub-agentes). Nenhum `[P]`
(integração/e2e não são parallel-safe; T1 é a única unit mas está na cadeia).

---

## Task Breakdown

### T1: Zod `registerReferralResultSchema`
**What**: Schema Zod do registro de resultado (enum `ReferralResult` restrito), co-existindo com `createReferralSchema` da USP-037.
**Where**: `src/modules/referrals/schemas/referral.schema.ts` (adicionar); export no barrel `@/modules/referrals`; `src/modules/referrals/__tests__/register-result-schema.spec.ts`
**Depends on**: USP-037 (módulo `referrals` + enum `ReferralResult` migrado)
**Reuses**: `z.nativeEnum(ReferralResult)`, padrão de schema do repo
**Requirement**: SOC-05 (AC-038-2), **REF38-MN-01**
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `registerReferralResultSchema` (`referralId` uuid, `result` nativeEnum `ReferralResult`, `observation` trim max2000 optional) exportado via barrel.
- [ ] Unit tests: aceita os 4 valores válidos; rejeita valor fora do enum, uuid inválido, observação > max.
- [ ] `npm run lint` sem violação de import.
- [ ] Gate check passa: `npm run test`. Test count: ≥5 tests pass (no silent deletions).

**Tests**: unit · **Gate**: quick

---

### T2: Server Action `registerReferralResult` (+ must-nots)
**What**: Ação sensível que persiste/atualiza o resultado num `Referral` existente, com proveniência, numa tx auditada.
**Where**: `src/modules/referrals/actions/register-referral-result.ts` (`'use server'`, export no barrel); `src/modules/referrals/__tests__/register-referral-result.int.test.ts`
**Depends on**: T1
**Reuses**: `requirePermission`, `withAudit(REFERRAL_RESULT_REGISTERED)`, padrão de action sensível (`inactivate.ts`)
**Requirement**: SOC-05 (AC-038-1, AC-038-3), **REF38-MN-01, REF38-MN-02, REF38-MN-03**
**Tools**: MCP: NONE · Skill: NONE
**Done when** (sequência sensível — CLAUDE.md):
- [ ] Zod → `requirePermission('REGISTER_REFERRAL_RESULT')` → `findUnique(referral)` (NOT_FOUND) → `withAudit(REFERRAL_RESULT_REGISTERED)` tx { `update` set `result`, `resultObservation`, `resultRegisteredBy=actor.id`, `resultRegisteredAt=now()`; `audit.before/after` }.
- [ ] Retorna `{ referralId }`; **nunca `throw`**.
- [ ] Happy (AC-038-1/3): persiste result + observação + autor + data; reabrir confirma os 4; evento `REFERRAL_RESULT_REGISTERED` na tx.
- [ ] Re-registro (EC-4): sobrescreve e atualiza `resultRegisteredBy`/`resultRegisteredAt`; audit registra `before`→`after`.
- [ ] **Negative tests (must-nots) — todos verdes:**
  - REF38-MN-01: valor fora do enum → `VALIDATION`, `result` inalterado (defesa dupla Zod + coluna enum PG).
  - REF38-MN-02: ator sem `REGISTER_REFERRAL_RESULT` → `FORBIDDEN`, nenhuma coluna de resultado escrita.
  - REF38-MN-03: após registro, `resultRegisteredBy`=ator e `resultRegisteredAt`≠null sempre.
- [ ] EC-1: `referralId` inexistente → `NOT_FOUND`, sem escrita.
- [ ] Gate check passa: `npm run test && npm run test:integration`. Test count: ≥7 int tests pass (no silent deletions).

**Tests**: integration · **Gate**: full
**Commit**: `feat(referrals): registerReferralResult — resultado do encaminhamento (USP-038)`

---

### T3: UI — `ResultForm` (registro de resultado)
**What**: Seletor de resultado (4 rótulos PT-BR) + observação, na tela do encaminhamento, guardado por permissão; wiring a `registerReferralResult`.
**Where**: `src/modules/referrals/components/result-form.tsx` (embutido na página de encaminhamentos da USP-037); `src/modules/referrals/components/__tests__/result-form.spec.tsx`; `e2e/referrals/registrar-resultado.spec.ts`
**Depends on**: T2
**Reuses**: `@/shared/ui` (Select/Textarea/Button), RHF+Zod adapter, guarda server-side `REGISTER_REFERRAL_RESULT`
**Requirement**: SOC-05 (AC-038-1..3, fatia vertical), **REF38-MN-02** (gate de página)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `ResultForm` renderiza os 4 valores (Contratado/Não selecionado/Em análise/Sem resposta) + observação; submit chama `registerReferralResult`; erros PT-BR.
- [ ] Controle guardado por `requirePermission('REGISTER_REFERRAL_RESULT')` server-side (não-autorizado não vê o controle).
- [ ] Component test: render + seleção + submit. E2E: gate de sessão/permissão (spec real, não `.fixme` — L-007).
- [ ] Gate check passa: `npm run test && npm run test:integration` (+ `npm run test:e2e` no gate de fase). Test count: ≥2 component tests pass.

**Tests**: e2e (+ component) · **Gate**: full
**Commit**: `feat(referrals): tela de registro de resultado (USP-038)`

---

## Parallel Execution Map
```
Phase 1: T1 (unit)
Phase 2: T1 ──→ T2 (integração)
Phase 3: T2 ──→ T3 (component + e2e)
```
Sem `[P]` — cadeia sequencial.

---

## Validation (pre-approval checks)

### Check 1 — Task Granularity
| Task | Scope | Status |
|---|---|---|
| T1 schema Zod | 1 schema | ✅ |
| T2 Server Action | 1 ação | ✅ |
| T3 UI | 1 form (embutido) | ✅ |

### Check 2 — Diagram-Definition Cross-Check
| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | USP-037 (externo à unidade) | root | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T2 | T2→T3 | ✅ |

### Check 3 — Test Co-location Validation
| Task | Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Zod schema | unit | unit | ✅ |
| T2 | Server Action | integration | integration | ✅ |
| T3 | UI/página | e2e (+component) | e2e | ✅ |

### Check 4 — Must-Not Ownership
| Must-Not | Owning task | Negative test presente |
|---|---|---|
| REF38-MN-01 (enum restrito) | T2 (Zod em T1 reforça) | ✅ valor inválido → VALIDATION, coluna inalterada |
| REF38-MN-02 (RBAC) | T2 | ✅ ator sem permissão → FORBIDDEN, sem escrita |
| REF38-MN-03 (proveniência) | T2 | ✅ resultRegisteredBy/At sempre setados |

Todos os checks ✅ — pronto para Execute (após USP-037 landed).
