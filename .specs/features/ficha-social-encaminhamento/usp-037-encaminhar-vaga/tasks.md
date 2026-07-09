# USP-037 — Encaminhar Pessoa para vaga — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: **activate it by name** and
follow its Execute flow and Critical Rules (per-task cycle: implement → gate → 1 atomic
commit; author ≠ verifier; must-nots need green negative tests). Do not search for skill
files by filesystem path. **If the skill cannot be activated, STOP and report — do not
proceed without it.**

**Design**: `./design.md` (agregado `Referral` completo) · **Spec**: `./spec.md`
**Status**: Draft

---

## Entry Gate (§0) — PASSED

Re-lido `spec.md` → Assumptions & Open Questions. Todos os itens têm **owner `agent`** e
`Confirmed? = y` (defaults documentados). **Nenhum item com owner externo bloqueando.**
Deps do ROADMAP (USP-036, USP-020) satisfeitas de fato nesta branch. **Entra em breakdown.**
⚠️ Uma divergência LGPD (ativar papel sem `PORTAL_ACCESS`) é decisão `agent` documentada —
sinalizada ao orquestrador, não bloqueia.

---

## Test Coverage Matrix

> Gerado de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas:
> `CLAUDE.md` (Testing Requirements: Server Action tests cobrem happy/Zod/permission/consent/
> concorrência; unit domínio 90%; integração 80% em Server Actions sensíveis), `package.json`
> (scripts vitest), `vitest.integration.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Domínio / regra pura (`referrals/domain`) | unit | Todos os ramos; 1:1 com ACs/edges | `src/modules/referrals/domain/__tests__/*.spec.ts` | `npm run test` |
| Zod schemas (`referrals/schemas`) | unit | Aceita válidos / rejeita inválidos (uuid, min/max, opcionais) | `src/modules/referrals/__tests__/*.spec.ts` | `npm run test` |
| Server Action + tx-participant helpers (`referrals/actions`, `jobs/actions/create-referral-application`, `persons/actions/ensure-candidate-role`) | integration | Matriz sensível: happy + Zod + permission + pré-condições + concorrência + **negative tests dos must-nots** | `src/modules/**/__tests__/*.int.test.ts` | `npm run test:integration` |
| E-mail template (`shared/lib/email`) | unit | Renderiza template `referral-notification` com os dados | `src/shared/lib/email/**/__tests__/*.spec.ts` (ou co-locado) | `npm run test` |
| Componente/Página UI (`referrals/components`, `app/(app)/encaminhamentos`) | e2e (+ component) | Render + campo condicional + submit; E2E cobre gate de sessão/permissão (padrão L-007, E2E autenticado deferido) | `src/modules/referrals/components/__tests__/*.spec.tsx` + `e2e/**/*.spec.ts` | `npm run test` + `npm run test:e2e` |
| Prisma schema / migração / enum | none | — (build gate + migração aplica limpa) | `prisma/migrations/*` | build gate |

## Parallelism Assessment

> Gerado de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (`*.spec.ts`/`*.spec.tsx`) | **Yes** | Puro/mocked, sem estado compartilhado | `application-rules.spec.ts`, `client-for-provider.view.test.ts` |
| integration (`*.int.test.ts`) | **No** | Postgres compartilhado + cleanup/truncate no setup/teardown | `apply-to-job.int.test.ts`, `manifest-interest.int.test.ts` (config `vitest.integration.config.ts`) |
| e2e (playwright) | **No** | App + DB compartilhados (seed demo) | `e2e/jobs/*.spec.ts` |

## Gate Check Commands

> Gerado de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com unit tests | `npm run test` |
| Full | Após tasks com integração/e2e | `npm run test && npm run test:integration` |
| Build | Fim de fase / tasks schema-only | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (migração: `npm run db:migrate`) |

---

## Execution Plan

### Phase 1: Fundação de schema (Sequential)
```
T1 → T2
```

### Phase 2: Blocos independentes (após T1/T2)
```
        ┌→ T3 [P] (unit)
T2 ─────┘
T1 ─────┬→ T4 (integração — sequencial)
        └→ T5 (integração — sequencial)
(root) ── T7 [P] (unit)
```

### Phase 3: Orquestração (Sequential)
```
T3, T4, T5, T7 → T6
```

### Phase 4: UI (Sequential)
```
T6 → T8
```

---

## Task Breakdown

### T1: Schema + migração do agregado `Referral`
**What**: Adicionar model `Referral` + enum `ReferralResult` (colunas de resultado **nullable** já aqui) + FK `Application.viaReferralId @unique` (mantendo `viaEncaminhamento`) + back-relations `Person`/`Job`, numa migração `usp037_referral`.
**Where**: `prisma/schema.prisma`; `prisma/migrations/<ts>_usp037_referral/migration.sql`
**Depends on**: None
**Reuses**: convenções do schema real (`@db.Timestamptz(6)`, `@map`, índice parcial existente `uq_application_active` — **não** re-migrar)
**Requirement**: SOC-03, SOC-04 (habilita todo o agregado; colunas de resultado servem USP-038)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `Referral` + `ReferralResult` conforme `design.md`; colunas `result/resultObservation/resultRegisteredBy/resultRegisteredAt` nullable presentes.
- [ ] `Application.viaReferralId String? @unique @db.Uuid` + relação `referral Referral?`; `viaEncaminhamento` **mantido**.
- [ ] Back-relations `Person.referralsReceived/referralsCreated`, `Job.referrals`.
- [ ] `npm run db:migrate` aplica limpo; `prisma generate` OK; migração **não** arrasta drift de `viaEncaminhamento`/`uq_application_active`.
- [ ] Gate check passa: build.

**Tests**: none · **Gate**: build

---

### T2: Scaffolding do módulo `referrals` + Zod schemas + barrel
**What**: Criar `src/modules/referrals/` (template canônico) com `schemas/referral.schema.ts` (`createReferralSchema`) e `index.ts`.
**Where**: `src/modules/referrals/{schemas/referral.schema.ts,index.ts}`; `src/modules/referrals/__tests__/referral-schema.spec.ts`
**Depends on**: T1
**Reuses**: template de módulo (`src/modules/services`), padrão de schema Zod do repo
**Requirement**: SOC-03
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `createReferralSchema` (personId uuid, jobId uuid, professionalSummary trim min1 max2000 optional, justification trim max1000 optional) exportado via barrel `@/modules/referrals`.
- [ ] Unit tests: aceita input válido; rejeita uuid inválido, resumo vazio-quando-informado, motivo > max.
- [ ] `npm run lint` sem violação de `no-restricted-imports` (só barrel).
- [ ] Gate check passa: `npm run test`. Test count: ≥4 tests pass (no silent deletions).

**Tests**: unit · **Gate**: quick

---

### T3: Regra pura `isProfessionalSummaryRequired` [P]
**What**: Regra pura de REF-MN-03 no domínio de `referrals`.
**Where**: `src/modules/referrals/domain/referral-rules.ts`; `src/modules/referrals/domain/__tests__/referral-rules.spec.ts`
**Depends on**: T2
**Reuses**: padrão de `jobs/domain/application-rules.ts`
**Requirement**: SOC-04, **REF-MN-03**
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `isProfessionalSummaryRequired(hasCvAttachment, professionalSummary)` exportado via barrel.
- [ ] Unit tests 1:1: sem CV + resumo vazio → true; sem CV + resumo preenchido → false; com CV → false (com/sem resumo); resumo só-espaços tratado como vazio.
- [ ] Gate check passa: `npm run test`. Test count: ≥4 tests pass.

**Tests**: unit · **Gate**: quick

---

### T4: Helper `createReferralApplication` em `jobs`
**What**: tx-participant que cria a `Application` vinculada (`viaReferralId` + `viaEncaminhamento=true`), mapeando P2002 → `ApplyConflictError`.
**Where**: `src/modules/jobs/actions/create-referral-application.ts` (export no barrel `src/modules/jobs/index.ts`); `src/modules/jobs/__tests__/create-referral-application.int.test.ts`
**Depends on**: T1
**Reuses**: `apply-to-job.ts` (`tx.application.create` + `ApplyConflictError`)
**Requirement**: SOC-03 (candidatura vinculada, AC-037-5)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `createReferralApplication(tx, {jobId, candidatePersonId, referralId})` cria a Application com `viaReferralId=referralId`, `viaEncaminhamento=true`; sem gates de sessão/consent/profile.
- [ ] Integração: cria Application vinculada (assert `viaReferralId`/`viaEncaminhamento`); 2ª chamada com candidatura ativa existente → `ApplyConflictError` (via `uq_application_active`/P2002).
- [ ] Exportado via barrel `@/modules/jobs`.
- [ ] Gate check passa: `npm run test && npm run test:integration`. Test count: ≥3 int tests pass.

**Tests**: integration · **Gate**: full

---

### T5: Helper `ensureCandidateRole` em `persons` (aceite tácito)
**What**: tx-participant que ativa o papel CANDIDATE com consent tácito `SOCIAL_REFERRAL_TO_JOB`, idempotente, **sem** gate `PORTAL_ACCESS`.
**Where**: `src/modules/persons/actions/ensure-candidate-role.ts` (export no barrel `src/modules/persons/index.ts`); `src/modules/persons/__tests__/ensure-candidate-role.int.test.ts`
**Depends on**: T1
**Reuses**: `ensure-client-role.ts` (grant lifecycle + consent + audit), `loadTerm`
**Requirement**: SOC-03 (AC-037-2)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `ensureCandidateRole(tx, {personId, term, ip, userAgent})`: grava consent `SOCIAL_REFERRAL_TO_JOB` (se ausente) na tx antes de ACTIVE; grant `AWAITING_CONSENT→ACTIVE`; emite `CONSENT_GRANTED` (`via:'referral'`) + `CANDIDATE_ROLE_ACTIVATED`; upsert leve de `CandidateProfile` DRAFT se ausente.
- [ ] Idempotência: papel já ATIVO → `{activated:false}`, no-op (nenhum evento/consent duplicado).
- [ ] **Sem** gate `PORTAL_ACCESS` — Pessoa sem credencial ativa o papel (EC-2).
- [ ] Integração: ativa papel+consent; idempotente; Pessoa sem `emailLogin`/sem PORTAL_ACCESS funciona; consent gravado com `termVersion/termContentHash` corretos.
- [ ] Exportado via barrel `@/modules/persons`.
- [ ] Gate check passa: `npm run test && npm run test:integration`. Test count: ≥4 int tests pass.

**Tests**: integration · **Gate**: full

---

### T7: E-mail template `referral-notification` [P]
**What**: Adicionar arm ao `EmailMessage` union + renderer + tipo de dados.
**Where**: `src/shared/lib/email/email-sender.port.ts` (union), `src/shared/lib/email/resend-email-sender.ts` (switch), `src/shared/lib/email/templates/referral-notification.ts`; teste co-locado
**Depends on**: None
**Reuses**: arms `application-confirmation` / `service-interest-notification`
**Requirement**: SOC-03 (AC-037-5, e-mail informativo)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `{ to, template:'referral-notification', data:{ pessoaNome, vagaTitulo, empresaNome } }` no union; renderer produz assunto/corpo PT-BR.
- [ ] Unit test: renderiza com os dados sem lançar.
- [ ] Gate check passa: `npm run test`. Test count: ≥1 test pass.

**Tests**: unit · **Gate**: quick

---

### T6: Server Action `createReferral` (orquestração + must-nots)
**What**: A ação sensível que orquestra o encaminhamento numa tx auditada.
**Where**: `src/modules/referrals/actions/create-referral.ts` (`'use server'`, export no barrel); `src/modules/referrals/__tests__/create-referral.int.test.ts`
**Depends on**: T3, T4, T5, T7
**Reuses**: `requirePermission`, `ensureCandidateRole`, `createReferralApplication`, `isJobOpenForApplication`, `loadTerm`, `withAudit`/`recordAuditEvent`, Outbox pattern, `isProfessionalSummaryRequired`
**Requirement**: SOC-03, SOC-04, **REF-MN-01, REF-MN-02, REF-MN-03, REF-MN-04**
**Tools**: MCP: NONE · Skill: NONE
**Done when** (sequência sensível — CLAUDE.md):
- [ ] Zod → `requirePermission('REFER_PERSON_TO_JOB')` → pré-condições (CV/resumo; vaga ACTIVE; pré-check duplicata) → `loadTerm` → `withAudit(REFERRAL_CREATED)` tx { `ensureCandidateRole`; **revalida** vaga ACTIVE @persist; INSERT referral; `createReferralApplication`; `recordAuditEvent(APPLICATION_CREATED)`; enqueue `referral-notification` guard `emailLogin` }.
- [ ] Retorna `{ referralId, applicationId }`; **nunca `throw`**; mapeia `ApplyConflictError`/P2002→`CONFLICT`, precondição→`PRECONDITION_FAILED`.
- [ ] **Negative tests (must-nots) — todos verdes:**
  - REF-MN-01: 2º encaminhamento com candidatura ativa → `CONFLICT`, **1** candidatura ativa, `Referral` do 2º attempt não persistido; sensor **exercita `uq_application_active`** (índice removido → red; restaurado → green) — lição L-010.
  - REF-MN-02: vaga PAUSED/EXPIRED e flip ACTIVE→não-ACTIVE @persist → bloqueado, **zero** linhas (`referrals`/`applications`).
  - REF-MN-03: sem CV + resumo vazio → `VALIDATION`, zero linhas.
  - REF-MN-04: ator sem `REFER_PERSON_TO_JOB` → `FORBIDDEN`, zero linhas.
- [ ] Happy path: cria `Referral`+`Application` vinculada (`viaReferralId`/`viaEncaminhamento=true`), ativa papel (consent tácito), 4 eventos de auditoria na tx, e-mail enfileirado; múltiplos encaminhamentos p/ vagas diferentes OK (AC-037-6); Pessoa sem e-mail → OK sem linha no Outbox (EC-2).
- [ ] Gate check passa: `npm run test && npm run test:integration`. Test count: ≥10 int tests pass (no silent deletions).

**Tests**: integration · **Gate**: full
**Commit**: `feat(referrals): createReferral — encaminhamento institucional (USP-037)`

---

### T8: UI — `ReferralForm` + página `(app)/encaminhamentos/novo`
**What**: Formulário de encaminhamento (resumo condicional a "sem CV") + página guardada + wiring a `createReferral`.
**Where**: `src/modules/referrals/components/referral-form.tsx` + `src/app/(app)/encaminhamentos/novo/page.tsx`; `src/modules/referrals/components/__tests__/referral-form.spec.tsx`; `e2e/referrals/encaminhar.spec.ts`
**Depends on**: T6
**Reuses**: `@/shared/ui` (Design System AD-014), RHF+Zod adapter, guarda de sessão server-side + `REFER_PERSON_TO_JOB`
**Requirement**: SOC-03 (AC-037-1..5, fatia vertical), **REF-MN-04** (gate de página)
**Tools**: MCP: NONE · Skill: NONE
**Done when**:
- [ ] `ReferralForm` renderiza; campo **resumo profissional** exibido/obrigatório quando "sem CV"; motivo opcional; erros PT-BR; submit chama `createReferral`.
- [ ] Página em `(app)` guardada por sessão + `requirePermission('REFER_PERSON_TO_JOB')` server-side (não-autorizado não vê o form).
- [ ] Component test: render + toggle do campo condicional + submit. E2E: gate de sessão/permissão (spec real, não `.fixme` — L-007).
- [ ] Gate check passa: `npm run test && npm run test:integration` (+ `npm run test:e2e` no gate de fase). Test count: ≥2 component tests pass.

**Tests**: e2e (+ component) · **Gate**: full
**Commit**: `feat(referrals): tela de encaminhamento (USP-037)`

---

## Parallel Execution Map
```
Phase 1 (Sequential): T1 ──→ T2
Phase 2:
  T2 ──→ T3 [P]        } unit — order-free
  (root) T7 [P]        }
  T1 ──→ T4            } integração — sequenciais entre si
  T1 ──→ T5            }
Phase 3 (Sequential): T3,T4,T5,T7 ──→ T6
Phase 4 (Sequential): T6 ──→ T8
```
`[P]` só em T3/T7 (unit, parallel-safe). T4/T5/T6/T8 tocam integração/e2e → **sequenciais** (Postgres compartilhado).

---

## Validation (pre-approval checks)

### Check 1 — Task Granularity
| Task | Scope | Status |
|---|---|---|
| T1 schema+migração | 1 migração coesa | ✅ |
| T2 módulo+schemas | scaffold + 1 arquivo de schema | ✅ |
| T3 regra pura | 1 função | ✅ |
| T4 helper jobs | 1 função tx | ✅ |
| T5 helper persons | 1 função tx | ✅ |
| T6 Server Action | 1 ação (orquestração) | ✅ |
| T7 e-mail arm | 1 template | ✅ |
| T8 UI | 1 form + 1 página | ✅ (coeso) |

### Check 2 — Diagram-Definition Cross-Check
| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | root | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T1 | T1→T4 | ✅ |
| T5 | T1 | T1→T5 | ✅ |
| T7 | None | root→T6 | ✅ |
| T6 | T3,T4,T5,T7 | T3,T4,T5,T7→T6 | ✅ |
| T8 | T6 | T6→T8 | ✅ |

### Check 3 — Test Co-location Validation
| Task | Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | schema/migração | none | none | ✅ |
| T2 | Zod schema | unit | unit | ✅ |
| T3 | domínio puro | unit | unit | ✅ |
| T4 | tx write (data-access) | integration | integration | ✅ |
| T5 | tx write (role/consent) | integration | integration | ✅ |
| T6 | Server Action | integration | integration | ✅ |
| T7 | e-mail template | unit | unit | ✅ |
| T8 | UI/página | e2e (+component) | e2e | ✅ |

### Check 4 — Must-Not Ownership
| Must-Not | Owning task(s) | Negative test presente |
|---|---|---|
| REF-MN-01 (duplicata candidatura ativa) | T6 (garantia via T1 índice + T4 P2002) | ✅ `create-referral.int.test.ts` exercita `uq_application_active` |
| REF-MN-02 (vaga ativa @persist) | T6 | ✅ flip ACTIVE→não-ACTIVE, zero linhas |
| REF-MN-03 (resumo quando sem CV) | T3 (pura) + T6 (enforcement) | ✅ regra + int |
| REF-MN-04 (RBAC) | T6 | ✅ ator sem permissão → FORBIDDEN |

Todos os checks ✅ — pronto para Execute.
