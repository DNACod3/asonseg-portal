# USP-025 — Candidatar-se a uma vaga (Tasks)

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `bravi-spec-driven` skill: **activate it by name and follow
its Execute flow and Critical Rules.** The skill is the source of truth for the per-task
cycle (implement → gate → atomic commit), sub-agent delegation, and the independent Verifier.
Tests are produced with **`skill-tdad`** from the spec's ACs/must-nots (Gherkin `@ac-*` +
Vitest red + E2E skeleton), BEFORE the feature code. **If the skill cannot be activated, STOP.**

**Design**: `.specs/features/candidaturas-busca-candidatos/usp-025-candidatar-se/design.md`
**Status**: Draft
**Entry Gate**: ABERTO (nenhum bloqueador de owner externo — ver spec Assumptions).

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes de Execute. Guidelines: `CLAUDE.md` (Testing Requirements), `vitest.config.ts` (unit; **exclui `src/**/*.int.test.ts`** e **exclui `src/modules/**/actions/**` da cobertura unit** → actions cobertas por integração; gate 65%), `vitest.integration.config.ts` (node; `fileParallelism:false`), `.github/workflows/ci.yml` (integração roda no job e2e, Node 22).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domínio (`application-rules.ts`) | unit | Todas as ramificações; 1:1 aos edge cases (E1) e AC-4 | `src/modules/jobs/__tests__/*.spec.ts` | `npm run test` |
| Server Action (`apply-to-job.ts`) | integration | Matriz completa: happy + Zod + unauth + consent-ausente + pré-condição (perfil/vaga) + duplicata + **concorrência/unicidade** + must-nots MN-01/02/03 | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test:integration` |
| Email renderer (`application-confirmation.ts`) | unit | Render feliz + campos interpolados (subject/html/text) | `src/shared/lib/email/__tests__/*.test.ts` | `npm run test` |
| Client component (`ApplyToJobButton`) | unit | Estados de render (candidatar / erro / já-candidatado) | `src/modules/jobs/__tests__/*.spec.tsx` | `npm run test` |
| Página/rota (`vagas/[id]` wiring) | e2e | Happy path: candidato ativo candidata → "já candidatado" | `e2e/**/*.spec.ts` | `npm run test:e2e` |
| Migração / schema | none | build gate + migração aplica limpa | — | `npm run db:migrate` + build |

## Parallelism Assessment

> Gerada de codebase — confirmar antes de Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit | Yes | jsdom + mocks; sem store compartilhado | `vitest.config.ts` |
| integration (`*.int.test.ts`) | **No** | DB Postgres único compartilhado; `cleanup()` por CNPJ | `vitest.integration.config.ts` `fileParallelism:false`; `applications.int.test.ts` |
| e2e | **No** | servidor + DB únicos; seed demo compartilhado | `.github/workflows/ci.yml` |

## Gate Check Commands

> Gerada de codebase — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit apenas | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks com integração | `npm run typecheck && npm run lint && npm run test && npm run test:integration` (requer `supabase start` + `.env.local`) |
| Build | Migração/schema, ou fechamento com E2E | `npm run typecheck && npm run lint && npm run build && npm run test:integration` (+ `npm run test:e2e` no fechamento) |

---

## Execution Plan

### Phase 1: Foundation (parcialmente paralela)

Migração + peças puras/isoladas, sem dependência entre si.

```
T1 (migração)
T2 (domínio)  [P]
T3 (e-mail)   [P]
```

### Phase 2: Core write path (Sequential)

```
T1, T2, T3 ──→ T4 (applyToJob)
```

### Phase 3: UI slice (Sequential)

```
T4 ──→ T5 (query + botão + página + E2E)
```

---

## Task Breakdown

### T1: Migração — coluna `viaEncaminhamento` + índice único parcial de unicidade

**What**: Adicionar `viaEncaminhamento Boolean @default(false)` ao model `Application` e criar o índice único parcial `uq_application_active`.
**Where**: `prisma/schema.prisma` (model `Application`) + nova pasta `prisma/migrations/<ts>_usp025_applications_write/migration.sql`.
**Depends on**: None
**Reuses**: padrão de índice parcial de `prisma/migrations/20260615114411_usp013_grant_status/migration.sql` e `20260602190000_consents_active_unique/migration.sql`.
**Requirement**: CAN-025-MN-01 (parte da constraint), suporte a CAN-025-01, CAN-025-E5/E6.

**Tools**: MCP: NONE · Skill: NONE (mudança de schema; Context7 para sintaxe Prisma/Postgres se necessário).

**Done when**:
- [ ] `viaEncaminhamento Boolean @default(false) @map("via_encaminhamento")` no model `Application` + comentário citando que o índice parcial é SQL bruto (Prisma não expressa `@@unique ... WHERE`).
- [ ] Migração gerada via `npm run db:migrate`; SQL do índice **hand-appended** com comentário de convenção (ADR-0021 / P-004; precedente `uq_person_company_active`): `CREATE UNIQUE INDEX "uq_application_active" ON "applications" ("candidate_person_id", "job_id") WHERE "cancelled_at" IS NULL;`.
- [ ] `npx prisma migrate reset` (ou `deploy`) aplica limpa; `npx prisma generate` OK; `npm run typecheck` verde.
- [ ] Índice de contagem `@@index([jobId, cancelledAt])` (USP-022) **preservado**.

**Tests**: none (schema — a **enforcement** do índice é exercitada em T4)
**Gate**: build
**Commit**: `feat(jobs): migração applications write-path (viaEncaminhamento + unicidade ativa) (USP-025)`

---

### T2: Regras de domínio de candidatura (puras) [P]

**What**: `isJobOpenForApplication(...)` e `isProfileApplicable(...)` + testes unit.
**Where**: `src/modules/jobs/domain/application-rules.ts` (+ `src/modules/jobs/__tests__/application-rules.spec.ts`).
**Depends on**: None
**Reuses**: semântica do `buildWhere` de `src/modules/jobs/queries/search-jobs.ts` (sem duplicar SQL); tipo `ContentStatus`.
**Requirement**: CAN-025-04, CAN-025-E1.

**Tools**: MCP: NONE · Skill: `skill-tdad` (derivar os casos de E1/AC-4).

**Done when**:
- [ ] `isJobOpenForApplication({status,validUntil,companyIsVerified}, today)` = `status==='ACTIVE' && validUntil>=today && companyIsVerified`.
- [ ] `isProfileApplicable(profile|null)` = `profile!=null && publicationStatus==='ACTIVE'`.
- [ ] Testes unit cobrem: vaga aberta true; não-ACTIVE false; expirada (`validUntil<today`) false; Empresa não verificada false; perfil null false; perfil DRAFT false; perfil ACTIVE true.
- [ ] Quick gate passa: `npm run typecheck && npm run lint && npm run test`.
- [ ] Test count: ≥7 casos passam (sem deleção silenciosa).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(jobs): regras puras de elegibilidade de candidatura (USP-025)`

---

### T3: Template de e-mail `application-confirmation` [P]

**What**: Estender o port `EmailMessage` + renderer + wire no adapter Resend; testes unit do renderer.
**Where**: `src/shared/lib/email/email-sender.port.ts`, `src/shared/lib/email/templates/application-confirmation.ts`, `src/shared/lib/email/resend-email-sender.ts` (+ `src/shared/lib/email/__tests__/application-confirmation.test.ts`).
**Depends on**: None
**Reuses**: `templates/responsible-link-pending.ts`, `templates/layout.ts`, padrão de switch de `resend-email-sender.ts`.
**Requirement**: CAN-025-02 (payload do e-mail enfileirado).

**Tools**: MCP: NONE · Skill: NONE.

**Done when**:
- [ ] Interface `ApplicationConfirmationEmailData { candidatoNome; vagaTitulo; empresaNome }` + variante `{ to; template:'application-confirmation'; data }` na união `EmailMessage`.
- [ ] Renderer `(data) => RenderedEmail` com subject/html/text em PT-BR (usa `layout.ts`).
- [ ] `case 'application-confirmation'` adicionado ao switch de `resend-email-sender.ts`.
- [ ] Teste unit do renderer: subject não-vazio, `data.vagaTitulo`/`empresaNome`/`candidatoNome` presentes no corpo.
- [ ] Quick gate passa; Test count: ≥1 teste do renderer passa.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(jobs): template de e-mail de confirmação de candidatura (USP-025)`

---

### T4: Server Action `applyToJob` + schema + barrel (caminho de escrita)

**What**: A action de candidatar-se, com a sequência de 6 passos, e a matriz de integração.
**Where**: `src/modules/jobs/actions/apply-to-job.ts`, `src/modules/jobs/schemas/application.schema.ts`, `src/modules/jobs/index.ts` (barrel) (+ `src/modules/jobs/__tests__/apply-to-job.int.test.ts`).
**Depends on**: T1, T2, T3
**Reuses**: `src/modules/jobs/actions/edit-job.ts` (shape try/catch + classe de erro), `src/modules/companies/actions/add-responsible.ts` (outbox + P2002), `activate-candidate-role.ts` (sessão+consent), `applications.int.test.ts` + `add-responsible.int.test.ts` (fixture + corrida).
**Requirement**: CAN-025-01, -02, -03, -05, CAN-025-E2/E3/E4/E5, **CAN-025-MN-01/02/03**.

**Tools**: MCP: NONE · Skill: `skill-tdad` (derivar `.feature` `@ac-*` + specs red da matriz e dos must-nots).

**Done when**:
- [ ] `applyToJobSchema` (`{ jobId: uuid }`) em `schemas/application.schema.ts`; **sem `personId`** no input (P-002).
- [ ] `applyToJob(input): Promise<ActionResult<{ applicationId }>>` seguindo a sequência do design (Zod → `getCurrentPerson` → `requireActiveConsent(JOB_APPLICATION)` → pré-condições perfil/vaga/duplicata → `withAudit(APPLICATION_CREATED, tx→ create + outbox + audit)` → try/catch P2002→CONFLICT). **Nunca throw.**
- [ ] `viaEncaminhamento:false` no `create`; linha `outbox` `topic='email'` template `application-confirmation` criada **na mesma tx** (guardada por `emailLogin` presente).
- [ ] Exports adicionados ao barrel `@/modules/jobs`: `applyToJob`, `type ApplyToJobResult`, `applyToJobSchema`, `type ApplyToJobInput`.
- [ ] Testes de integração (`@ac-` por caso):
  - `@ac-can-025-01` happy: `Application` criada (`viaEncaminhamento=false`), `audit_log` `APPLICATION_CREATED`, retorno `{ ok:true, data:{ applicationId } }`.
  - `@ac-can-025-02` outbox: 1 linha `topic='email'`, `payload.template==='application-confirmation'`, `payload.to` = e-mail do candidato.
  - `@ac-can-025-e3` Zod: jobId inválido → `VALIDATION`, 0 escrita.
  - `@ac-can-025-e4` unauth: sessão null → `UNAUTHENTICATED`.
  - `@ac-can-025-mn-02` sem consent → `CONSENT_REQUIRED`, `applications` count=0, `outbox` count=0.
  - `@ac-can-025-mn-03a` perfil `DRAFT` → `PRECONDITION_FAILED`, count=0.
  - `@ac-can-025-mn-03b` vaga expirada/não-ACTIVE → `PRECONDITION_FAILED`, count=0.
  - `@ac-can-025-03` duplicata sequencial → `CONFLICT`, 1 linha ativa.
  - `@ac-can-025-mn-01` **corrida**: `Promise.all([applyToJob, applyToJob])` → 1 `ok`, 1 `CONFLICT`; `application.count({ jobId, candidatePersonId, cancelledAt:null })` = 1.
- [ ] Full gate passa: `npm run typecheck && npm run lint && npm run test && npm run test:integration`.
- [ ] Test count: ≥9 casos de integração passam (sem deleção silenciosa).

**Tests**: integration
**Gate**: full
**Commit**: `feat(jobs): applyToJob — candidatar-se a uma vaga (USP-025)`

---

### T5: Query de estado + `ApplyToJobButton` + wiring na página + E2E

**What**: `getMyActiveApplication` + botão client + CTA condicional na página de detalhe + E2E happy path.
**Where**: `src/modules/jobs/queries/get-my-application.ts`, `src/modules/jobs/components/apply-to-job-button.tsx`, `src/app/(public)/vagas/[id]/page.tsx` (modify), `src/modules/jobs/index.ts` (barrel) (+ `src/modules/jobs/__tests__/apply-to-job-button.spec.tsx` + `e2e/candidaturas/candidatar-se.spec.ts`).
**Depends on**: T4
**Reuses**: `company-job-actions.tsx` (client→action→`router.refresh`), `CANDIDATE_ROLE` (export de `views/job-detail.view`), padrão E2E de `e2e/jobs/`.
**Requirement**: CAN-025-06.

**Tools**: MCP: NONE · Skill: `skill-tdad` (E2E skeleton do CTA — **promover ao diretório real `e2e/`**, L-007).

**Done when**:
- [ ] `getMyActiveApplication(jobId, candidatePersonId)` → `{ id } | null` (`findFirst cancelledAt:null`) exportada no barrel.
- [ ] `ApplyToJobButton({ jobId })` `'use client'`: `useTransition` + `applyToJob` (import relativo) → erro mostra `error.message`; sucesso `router.refresh()`.
- [ ] Página `vagas/[id]`: para candidato ativo (`viewer.roles.includes(CANDIDATE_ROLE)`) com vaga aberta → se `getMyActiveApplication` null renderiza `<ApplyToJobButton>`, senão exibe "Você já se candidatou". Anônimo/não-candidato: **sem CTA** (P-003/P-005 preservado).
- [ ] Teste unit do componente: estados candidatar / erro.
- [ ] E2E **em `e2e/candidaturas/candidatar-se.spec.ts`** (arquivo real, asserções vivas — não `.fixme` sob `.specs/`): candidato ativo com consentimento candidata-se a uma vaga ativa → vê confirmação e o estado "já candidatado". Se o seed demo não tiver candidato-ativo + vaga-ativa aplicáveis, estender `prisma/seeds/demo.ts` (fixtures d0xx) no mesmo commit.
- [ ] Build gate passa: `npm run typecheck && npm run lint && npm run build && npm run test:integration` (+ `npm run test:e2e` para o novo spec).

**Tests**: e2e (+ unit do componente)
**Gate**: build
**Commit**: `feat(jobs): CTA candidatar-se na página de detalhe + E2E (USP-025)`

---

## Pre-Approval Validation

### Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Migração + índice | 1 schema change + 1 migração | ✅ Granular |
| T2: Regras puras | 1 arquivo domínio (2 fns coesas) | ✅ Granular |
| T3: E-mail template | 1 template + wiring do port (coeso) | ✅ Granular |
| T4: `applyToJob` + schema | 1 action + 1 schema + barrel (coeso) | ✅ Granular |
| T5: Query + botão + página + E2E | 1 query + 1 componente + 1 wiring + E2E (vertical slice coeso) | ⚠️ OK (fatia vertical mínima; sub-partes acopladas) |

### Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1 raiz | ✅ Match |
| T2 | None `[P]` | Phase 1 `[P]` | ✅ Match |
| T3 | None `[P]` | Phase 1 `[P]` | ✅ Match |
| T4 | T1, T2, T3 | `T1,T2,T3 → T4` | ✅ Match |
| T5 | T4 | `T4 → T5` | ✅ Match |

### Test Co-location Validation

| Task | Layer criado/modificado | Matrix exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | Migração/schema | none (build gate) | none | ✅ OK |
| T2 | Domínio | unit | unit | ✅ OK |
| T3 | Email renderer | unit | unit | ✅ OK |
| T4 | Server Action | integration | integration | ✅ OK |
| T5 | Client component + página/rota | unit + e2e | e2e (+unit componente) | ✅ OK |

### 💠 Must-Not Ownership

| Must-Not | Owning task(s) | Negative test (task) |
| --- | --- | --- |
| CAN-025-MN-01 (unicidade ativa) | T1 (índice) + T4 (catch P2002 + corrida) | `@ac-can-025-mn-01` em T4 |
| CAN-025-MN-02 (sem consent → sem escrita) | T4 | `@ac-can-025-mn-02` em T4 |
| CAN-025-MN-03 (vaga/perfil não-elegível → sem escrita) | T4 | `@ac-can-025-mn-03a/b` em T4 |

Todos os must-nots têm task dona + teste negativo. ✅

---

## Tools per task (autonomous mode)

`skill-tdad` produz os facts (Gherkin `@ac-*` + Vitest red + E2E skeleton) para T2, T4 e T5
antes do código. Demais tasks: sem MCP/skill além do stack padrão (Prisma/Vitest/Playwright).
Context7 disponível para sintaxe de índice parcial Postgres/Prisma em T1 se necessário.
