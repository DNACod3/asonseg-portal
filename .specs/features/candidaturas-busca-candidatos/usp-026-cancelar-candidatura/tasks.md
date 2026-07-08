# USP-026 — Cancelar candidatura (Tasks)

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `bravi-spec-driven` skill: **activate it by name and follow
its Execute flow and Critical Rules** (per-task: implement → gate → atomic commit; independent
Verifier at the end). Tests via **`skill-tdad`** from the spec's ACs/must-nots BEFORE the code.
**If the skill cannot be activated, STOP.**

**Design**: `.specs/features/candidaturas-busca-candidatos/usp-026-cancelar-candidatura/design.md`
**Status**: Draft
**Depends on USP-025** (mesma unidade): a migração (`viaEncaminhamento` + `uq_application_active`),
`applyToJob` (prova de recandidatura), e os arquivos `application-rules.ts` / `application.schema.ts` /
`get-my-application.ts` / página de detalhe já existem quando esta USP roda. **Não migra schema.**
**Entry Gate**: ABERTO.

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes de Execute. Guidelines: `CLAUDE.md`, `vitest.config.ts` (actions excluídas da cobertura unit → integração), `vitest.integration.config.ts` (`fileParallelism:false`), `.github/workflows/ci.yml` (integração no job e2e, Node 22).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domínio (`canCancelApplication`) | unit | Todas as ramificações (ativa vs já-cancelada) | `src/modules/jobs/__tests__/*.spec.ts` | `npm run test` |
| Server Action (`cancel-application.ts`) | integration | Matriz: happy + Zod + unauth + not-found/terceiro + já-cancelada + **concorrência** + recandidatura + must-nots MN-01/02 | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test:integration` |
| Client component (`CancelApplicationButton`) | unit | Estados de render (cancelar / erro) | `src/modules/jobs/__tests__/*.spec.tsx` | `npm run test` |
| Página/rota (`vagas/[id]` wiring) | e2e | Happy: cancelar → CTA volta a "Candidatar-se" | `e2e/**/*.spec.ts` | `npm run test:e2e` |

## Parallelism Assessment

> Gerada de codebase — confirmar antes de Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit | Yes | jsdom + mocks | `vitest.config.ts` |
| integration (`*.int.test.ts`) | **No** | DB único; `cleanup()` por CNPJ | `vitest.integration.config.ts` `fileParallelism:false` |
| e2e | **No** | servidor + DB únicos | `.github/workflows/ci.yml` |

## Gate Check Commands

> Gerada de codebase — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks unit apenas | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks com integração | `npm run typecheck && npm run lint && npm run test && npm run test:integration` (requer `supabase start` + `.env.local`) |
| Build | Fechamento com E2E | `npm run typecheck && npm run lint && npm run build && npm run test:integration` (+ `npm run test:e2e`) |

---

## Execution Plan

### Phase 1: Domínio (Sequential)

```
T1 (canCancelApplication + unit)
```

### Phase 2: Core write path (Sequential)

```
T1 ──→ T2 (cancelApplication action + integração)
```

### Phase 3: UI slice (Sequential)

```
T2 ──→ T3 (botão + página + E2E)
```

---

## Task Breakdown

### T1: Regra pura `canCancelApplication` (extensão de `application-rules.ts`)

**What**: Adicionar `canCancelApplication(app)` ao arquivo de regras + testes unit.
**Where**: `src/modules/jobs/domain/application-rules.ts` (modify — criado pela USP-025) + `src/modules/jobs/index.ts` (barrel) (+ `src/modules/jobs/__tests__/application-rules.spec.ts` — modify/extend).
**Depends on**: USP-025 T2 (arquivo `application-rules.ts` existe).
**Reuses**: convenção de resultado discriminado do arquivo.
**Requirement**: CAN-026-E1, suporte a CAN-026-MN-02.

**Tools**: MCP: NONE · Skill: `skill-tdad` (derivar os casos de E1).

**Done when**:
- [ ] `canCancelApplication({cancelledAt})` = `cancelledAt==null ? {ok:true} : {ok:false, reason:'ALREADY_CANCELLED'}`.
- [ ] Exportada no barrel `@/modules/jobs`.
- [ ] Testes unit: candidatura ativa → `{ok:true}`; já cancelada → `{ok:false, reason:'ALREADY_CANCELLED'}`.
- [ ] Quick gate passa; Test count: ≥2 casos novos passam (sem deleção dos da USP-025).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(jobs): regra pura canCancelApplication (USP-026)`

---

### T2: Server Action `cancelApplication` + schema + barrel (caminho de escrita)

**What**: A action de cancelar, escopo por dono + idempotência, e a matriz de integração (incl. recandidatura).
**Where**: `src/modules/jobs/actions/cancel-application.ts`, `src/modules/jobs/schemas/application.schema.ts` (modify — add `cancelApplicationSchema`), `src/modules/jobs/index.ts` (barrel) (+ `src/modules/jobs/__tests__/cancel-application.int.test.ts`).
**Depends on**: T1, USP-025 T1 (migração/`uq_application_active`), USP-025 T4 (`applyToJob`, usado no teste de recandidatura).
**Reuses**: `src/modules/jobs/actions/edit-job.ts` (optimistic updateMany + classe de erro + try/catch), `applications.int.test.ts` + `add-responsible.int.test.ts` (fixture + corrida), `applyToJob` (recandidatura).
**Requirement**: CAN-026-01, CAN-026-02, CAN-026-E2/E3/E4/E5, **CAN-026-MN-01/02**.

**Tools**: MCP: NONE · Skill: `skill-tdad` (derivar `.feature` `@ac-*` + specs red da matriz e dos must-nots).

**Done when**:
- [ ] `cancelApplicationSchema` (`{ applicationId: uuid }`) adicionado a `schemas/application.schema.ts`; sem `personId` (P-002).
- [ ] `cancelApplication(input): Promise<ActionResult<{ applicationId }>>` seguindo a sequência do design (Zod → `getCurrentPerson` → `findFirst` escopada a `candidatePersonId=person.id` → `NOT_FOUND` → `canCancelApplication` → `PRECONDITION_FAILED` → `withAudit(APPLICATION_CANCELLED, tx→ updateMany where cancelledAt:null; count!==1→throw)` → try/catch). **Nunca throw.**
- [ ] Exports no barrel: `cancelApplication`, `type CancelApplicationResult`, `cancelApplicationSchema`, `type CancelApplicationInput`.
- [ ] Testes de integração (`@ac-` por caso):
  - `@ac-can-026-01` happy: `cancelledAt` preenchido; `audit_log` `APPLICATION_CANCELLED`; contagem ativa (`cancelledAt:null`) cai; retorno `{ok:true}`.
  - `@ac-can-026-02` recandidatura: cancelar → `applyToJob` à mesma vaga → `ok`; `count({cancelledAt:null})` = 1 (a nova).
  - `@ac-can-026-e3` Zod: applicationId inválido → `VALIDATION`.
  - `@ac-can-026-e4` unauth: sessão null → `UNAUTHENTICATED`.
  - `@ac-can-026-mn-01` PessoaB cancela candidatura da PessoaA → `NOT_FOUND`; linha da A com `cancelledAt` intacto; **0** eventos `APPLICATION_CANCELLED` para essa linha.
  - `@ac-can-026-mn-02` cancelar 2x → 2º retorna `PRECONDITION_FAILED`; `cancelledAt` inalterado (mesmo timestamp); exatamente **1** `APPLICATION_CANCELLED` no `audit_log`.
  - `@ac-can-026-e5` corrida: `Promise.all([cancel, cancel])` → 1 `ok`, 1 erro; 1 evento de auditoria.
- [ ] Full gate passa: `npm run typecheck && npm run lint && npm run test && npm run test:integration`.
- [ ] Test count: ≥7 casos de integração passam (sem deleção silenciosa).

**Tests**: integration
**Gate**: full
**Commit**: `feat(jobs): cancelApplication — cancelar candidatura (USP-026)`

---

### T3: `CancelApplicationButton` + wiring na página + E2E

**What**: Botão client de cancelar + ramo "candidatura ativa" da página + E2E happy path.
**Where**: `src/modules/jobs/components/cancel-application-button.tsx`, `src/app/(public)/vagas/[id]/page.tsx` (modify — ramo activeApp), `src/modules/jobs/index.ts` (barrel) (+ `src/modules/jobs/__tests__/cancel-application-button.spec.tsx` + `e2e/candidaturas/cancelar-candidatura.spec.ts`).
**Depends on**: T2, USP-025 T5 (página já resolve `getMyActiveApplication` + `ApplyToJobButton`).
**Reuses**: `apply-to-job-button.tsx` (padrão client→action→refresh), padrão E2E de `e2e/jobs/` / `e2e/candidaturas/`.
**Requirement**: CAN-026-03.

**Tools**: MCP: NONE · Skill: `skill-tdad` (E2E skeleton — **promover ao diretório real `e2e/`**, L-007).

**Done when**:
- [ ] `CancelApplicationButton({ applicationId })` `'use client'`: `useTransition` + `cancelApplication` → erro mostra `error.message`; sucesso `router.refresh()`.
- [ ] Página `vagas/[id]`: o ramo "candidatura ativa" (que a USP-025 mostrava como texto) passa a renderizar `<CancelApplicationButton applicationId={activeApp.id} />`; após cancelar + `router.refresh()`, o CTA "Candidatar-se" (USP-025) reaparece.
- [ ] Teste unit do componente: estados cancelar / erro.
- [ ] E2E **em `e2e/candidaturas/cancelar-candidatura.spec.ts`** (arquivo real, asserções vivas — não `.fixme`): candidato com candidatura ativa cancela → CTA volta a "Candidatar-se". Reusar/estender fixtures da USP-025.
- [ ] Build gate passa: `npm run typecheck && npm run lint && npm run build && npm run test:integration` (+ `npm run test:e2e`).

**Tests**: e2e (+ unit do componente)
**Gate**: build
**Commit**: `feat(jobs): CTA cancelar candidatura na página de detalhe + E2E (USP-026)`

---

## Pre-Approval Validation

### Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: `canCancelApplication` | 1 fn pura + unit | ✅ Granular |
| T2: `cancelApplication` + schema | 1 action + 1 schema (extensão) + barrel | ✅ Granular |
| T3: botão + página + E2E | 1 componente + 1 wiring + E2E (fatia vertical coesa) | ⚠️ OK (fatia vertical mínima) |

### Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
| --- | --- | --- | --- |
| T1 | USP-025 T2 (cross-USP) | Phase 1 raiz | ✅ Match |
| T2 | T1, USP-025 T1/T4 | `T1 → T2` | ✅ Match |
| T3 | T2, USP-025 T5 | `T2 → T3` | ✅ Match |

### Test Co-location Validation

| Task | Layer criado/modificado | Matrix exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Domínio | unit | unit | ✅ OK |
| T2 | Server Action | integration | integration | ✅ OK |
| T3 | Client component + página/rota | unit + e2e | e2e (+unit componente) | ✅ OK |

### 💠 Must-Not Ownership

| Must-Not | Owning task(s) | Negative test (task) |
| --- | --- | --- |
| CAN-026-MN-01 (cancelar de terceiro) | T2 (query escopada) | `@ac-can-026-mn-01` em T2 |
| CAN-026-MN-02 (idempotência / duplo-cancelamento) | T2 (pré-check + optimistic guard); T1 (regra pura) | `@ac-can-026-mn-02` (+ `@ac-can-026-e5`) em T2 |

Todos os must-nots têm task dona + teste negativo. ✅

---

## Tools per task (autonomous mode)

`skill-tdad` produz os facts (Gherkin `@ac-*` + Vitest red + E2E skeleton) para T1, T2 e T3.
Demais: stack padrão (Prisma/Vitest/Playwright). Sem MCP adicional.
