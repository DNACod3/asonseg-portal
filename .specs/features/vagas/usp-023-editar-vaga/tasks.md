# USP-023 — Editar vaga (pausar, arquivar, renovar) — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill **`bravi-spec-driven`**: **ative-a pelo nome** e siga o fluxo Execute + as
Critical Rules (teste deriva do AC; gate verde antes de "done"; 1 commit atômico por task; nunca enfraquecer/
apagar teste; todo must-not com teste negativo verde). Não busque arquivos da skill por caminho de filesystem.
**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

**Design**: `.specs/features/vagas/usp-023-editar-vaga/design.md`
**Spec**: `.specs/features/vagas/usp-023-editar-vaga/spec.md`
**Status**: Draft

> **Sizing:** Large (múltiplos must-nots + operação terminal irreversível `ARCHIVED` + correção de infra
> compartilhada). Risk sizing floor ⇒ spec completa + Tasks formal. **Entry gate:** limpo (nenhum item de owner
> externo em Assumptions). PRs por sub-frente: **PR-A** (backend, ciclo de vida) · **PR-B** (UI de gestão).
> Board (sub-issues + estimates) fica a cargo do protocolo OpenWolf no kickoff — não criado aqui.

---

## Test Coverage Matrix

> Gerada de codebase + spec. **Guidelines encontradas:** `CLAUDE.md` (§Testing Requirements: happy/validation/
> permission/consent/concurrency por Server Action; domínio 90%; integração 80%; E2E top flows), padrão
> `.specs/features/vagas/usp-022-detalhe-vaga/tasks.md` (sem `TESTING.md` formal — gates inline). Sem `TESTING.md`
> ⇒ default forte aplicado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Server Actions (`jobs/actions/*`) | integração (`*.int.test.ts`) | Por action: happy + Zod inválido + `FORBIDDEN` (não-responsável) + transição/precondição inválida + concorrência + must-not | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test` (vitest, Postgres local) |
| Adapter status (`prisma-job-status.ts`) | integração | 1ª ativação grava `published_at`; re-ativação preserva; concorrência `count===1` | `src/modules/jobs/__tests__/published-at.int.test.ts` | `npm run test` |
| Moderation `eventTypeFor`/`transition-content` | unit + integração | Ramo JOB mapeia PAUSED/ARCHIVED/UNPAUSED/EXPIRED; CV/SERVICE sem regressão | `src/modules/moderation/__tests__/*.spec.ts` / `*.int.test.ts` | `npm run test` |
| Queries (`get-paused-job-notice`, `list-company-jobs`) | integração | PAUSED+verificada ⇒ `{paused}`; lista owner-scoped por status | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test` |
| Schemas Zod (`jobs/schemas`) | unit | Bounds + `validadeStatus` (futura ≤180d) por schema | `src/modules/jobs/__tests__/*.spec.ts` | `npm run test` |
| Guarda estática U23-MN-07 | unit (`node:fs`) | Nenhuma escrita de `Job.status` fora de adapter/`editJob`; `editJob` só `where status=ACTIVE` | `src/modules/jobs/__tests__/no-out-of-band-status-write.test.ts` | `npm run test` |
| Rota/UI (`(app)/empresa/[empresaId]/vagas*`, detalhe pausado) | e2e (Playwright) | Lista+ações por status; 404 não-responsável; editar→rascunho→moderação; pausar some/volta; detalhe pausado | `e2e/**/*.spec.ts` | `npm run test:e2e` |
| Entity/config (schema, `vercel.json`) | none | — (sem migração; build gate) | — | build gate |

## Parallelism Assessment

> Gerada de codebase. Testes de integração compartilham o Postgres local e fazem cleanup por tabela
> (memory: cleanup de jobs pode apagar seed) ⇒ **não paralelizáveis**. Unit/guardas são isolados.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit / guarda estática | Yes | Puro / `node:fs`, sem IO compartilhado | specs de domínio da USP-020/021 |
| integração (`*.int.test.ts`) | No | Postgres local compartilhado + cleanup por tabela | `applications.int.test.ts` (USP-022), memory "seed-cnpj-exclusivo" |
| e2e (Playwright) | No | App + DB provisionados (CI job e2e, Node 22) | pipeline CI |

## Gate Check Commands

> Gerada de codebase (sem `TESTING.md`; gates inline, padrão USP-021/022).

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks só com unit/guarda | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks com integração (actions/adapter/queries) | `npm run typecheck && npm run lint && npm run test` (com Postgres local: `supabase start` / `supabase db reset`) |
| Build | Fim de fase / tasks de UI/rota | `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e` |

---

## Execution Plan

### Phase 1: Fundação (Sequential)

```
T0 (facts) → T1 (infra: eventTypeFor kind-aware + eventos + published_at + justif.) → T2 (gate compartilhado)
```

### Phase 2: Server Actions (Parallel após T1,T2)

```
        ┌→ T3 (pause/unpause) [P]
T2 ─────┼→ T4 (archive)        [P]
T1 ─────┼→ T5 (extend)         [P]
        └→ T6 (editJob)        [P]
```

> `[P]` = sem dependência inter-task. **Mas** os testes de integração NÃO são paralelos (Postgres compartilhado):
> executar as tasks em qualquer ordem, porém os gates rodam sequencialmente. Fecha **PR-A (#175)**.

### Phase 3: UI de gestão (Sequential)

```
T7 (detalhe pausado) → T8 (lista de gestão) → T9 (editar UI + ações leves)
```

> Fecha **PR-B (#176)**. `T9` depende de T3–T6 (actions) + T8 (lista).

---

## Task Breakdown

### T0 — Gerar facts da USP-023 (skill-tdad)

**What**: Rodar `skill-tdad` sobre `expectations-USP-023.md` (E-001..E-005, P-001/003/005/006, L-003, D-001..D-006).
**Where**: `.specs/features/vagas/usp-023-editar-vaga/tests/` (**sobrescreve os facts stale existentes**).
**Depends on**: None · **Reuses**: `expectations-USP-023.md`, `spec.md` (must-nots).
**Tools**: Skill: `skill-tdad`.
**Done when**:
- [ ] `.feature` PT-BR com tags `@ac-023-1..4`, `@e-005`, `@p-001/003/005/006`, `@u23-mn-07`.
- [ ] Vitest RED (unit + `*.int.test.ts`) + esqueleto Playwright + matriz AC→teste, commitados.
- [ ] Toda E-NNN/P-NNN **ativa** tem ≥1 cenário; os facts stale antigos foram substituídos.

**Tests**: n/a (produz os testes) · **Gate**: quick (compila RED).

---

### T1 — Infra de transição: `eventTypeFor` kind-aware + eventos + `published_at` + justificativa

**What**: (a) `audit/events.ts`: adicionar `JOB_UNPAUSED`, `JOB_VALIDITY_EXTENDED`; remover `JOB_EDITED_AFTER_APPROVAL`
de `JUSTIFICATION_REQUIRED_EVENTS` (D2). (b) Tornar `eventTypeFor(contentKind, from, to, trigger)` e mapear, p/ JOB:
`PAUSED→JOB_PAUSED`, `ARCHIVED→JOB_ARCHIVED`, `(from=PAUSED)ACTIVE→JOB_UNPAUSED`, `(SYSTEM_JOB)EXPIRED→JOB_EXPIRED`;
atualizar o call site em `transition-content.ts`. (c) `PrismaJobStatusRepository.updateStatus`: em `to=ACTIVE`,
`published_at = COALESCE(published_at, now())` (raw SQL, mesma concorrência otimista).
**Where**: `src/modules/audit/events.ts`, `src/modules/moderation/actions/transition-content.ts`,
`src/modules/jobs/adapters/prisma-job-status.ts`.
**Depends on**: T0 · **Reuses**: `AuditEvent`, `TRANSITIONS[JOB]`, padrão `updateMany`/`$executeRaw`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] `eventTypeFor` mapeia os 4 eventos JOB e preserva o mapa compartilhado (CV/SERVICE/CANDIDATE_PROFILE sem regressão).
- [ ] Ativar 1ª vez grava `published_at`; re-ativar preserva (COALESCE); `count/affected===1`.
- [ ] `JOB_EDITED_AFTER_APPROVAL` não está mais em `JUSTIFICATION_REQUIRED_EVENTS`.
- [ ] Gate Full verde; specs existentes de `transition-content` continuam verdes; `@e-005` verde.
- [ ] Test count: novos `eventTypeFor`/`published-at.int` passam; suíte moderation sem regressão.

**Tests**: unit (`eventTypeFor`) + integração (`published-at.int.test.ts`, transição JOB) · **Gate**: full.
**Commit**: `feat(jobs): eventTypeFor kind-aware + published_at na ativação + eventos de ciclo de vida (USP-023)`

---

### T2 — Gate compartilhado de responsável (P-005/D-005)

**What**: Extrair `requireActiveResponsible(personId, companyId)` para `jobs/server/require-active-responsible.ts`,
exportar via barrel; refatorar `submit-job-for-moderation.ts` para consumi-lo.
**Where**: `src/modules/jobs/server/require-active-responsible.ts`, `src/modules/jobs/index.ts`,
`src/modules/jobs/actions/submit-job-for-moderation.ts` (refactor).
**Depends on**: None *(pode iniciar em paralelo a T1; gate roda após)* · **Reuses**: `isActiveResponsible` local existente.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] Gate único exportado; `submitJobForModeration` usa o extraído (sem mudança de comportamento).
- [ ] Specs existentes de submit (USP-020) continuam verdes (preservação).
- [ ] Gate Full verde. Test count: suíte USP-020 sem regressão.

**Tests**: integração (preservação submit) · **Gate**: full.
**Commit**: `refactor(jobs): extrai requireActiveResponsible para gate compartilhado (USP-023)`

---

### T3 — `pauseJob` / `unpauseJob` (E-002) [P]

**What**: Actions `pauseJob` (`ACTIVE→PAUSED`) e `unpauseJob` (`PAUSED→ACTIVE`) via `transitionContent`
(`AUTHOR_ACTION`), gate compartilhado, schema `{jobId}`.
**Where**: `src/modules/jobs/actions/pause-job.ts`, `unpause-job.ts`, `schemas/*`, barrel + `__tests__/*.int.test.ts`.
**Depends on**: T1, T2 · **Reuses**: `transitionContent`, gate T2, padrão `createJobDraft`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] pausar `ACTIVE` → `PAUSED` + `JOB_PAUSED`; some de `searchJobs`.
- [ ] despausar `PAUSED` → `ACTIVE` + `JOB_UNPAUSED`, sem re-moderação.
- [ ] não-responsável → `FORBIDDEN` (P-005); pausar vaga não-`ACTIVE` → `INVALID_TRANSITION`; concorrência tratada.
- [ ] Gate Full verde; `@ac-023-2` + `@p-005` verdes. Test count declarado.

**Tests**: integração (`pause-job.int.test.ts`) · **Gate**: full.
**Commit**: `feat(jobs): pauseJob/unpauseJob via transitionContent (USP-023)`

---

### T4 — `archiveJob` (E-003 / P-006) [P]

**What**: Action `archiveJob` (`ACTIVE→ARCHIVED`) via `transitionContent`; terminalidade garantida pela FSM.
**Where**: `src/modules/jobs/actions/archive-job.ts`, schema, barrel + `__tests__/archive-job.int.test.ts`.
**Depends on**: T1, T2 · **Reuses**: `transitionContent`, gate T2.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] arquiva `ACTIVE` → `ARCHIVED` + `JOB_ARCHIVED`; sai de `searchJobs`.
- [ ] tentativa `transitionContent(ARCHIVED→ACTIVE)` → `INVALID_TRANSITION` (P-006, negative test).
- [ ] candidaturas preservadas; não-responsável → `FORBIDDEN`.
- [ ] Gate Full verde; `@ac-023-3` + `@p-006` verdes. Test count declarado.

**Tests**: integração (`archive-job.int.test.ts`) · **Gate**: full.
**Commit**: `feat(jobs): archiveJob terminal via transitionContent (USP-023)`

---

### T5 — `extendJobValidity` (E-004) [P]

**What**: Action que atualiza só `validUntil` (vaga segue `ACTIVE`, sem transição) dentro de
`withAudit(JOB_VALIDITY_EXTENDED)`; valida data futura ≤ `MAX_VALIDADE_DIAS` via `validadeStatus`.
**Where**: `src/modules/jobs/actions/extend-job-validity.ts`, `extendJobValiditySchema`, barrel + `__tests__/*.int.test.ts`.
**Depends on**: T1, T2 · **Reuses**: `validadeStatus`, `MAX_VALIDADE_DIAS`, `hojeSaoPaulo()`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] prorroga `ACTIVE` com data futura ≤180d → `validUntil` novo, `status=ACTIVE`, `JOB_VALIDITY_EXTENDED` (before/after).
- [ ] data passada/>180d → `VALIDATION`; 3 prorrogações seguidas OK (P-002 N/A).
- [ ] não-responsável → `FORBIDDEN`; prorrogar vaga não-`ACTIVE` → `CONFLICT` (`count!==1`).
- [ ] Gate Full verde; `@ac-023-4` + `@p-005` verdes. Test count declarado.

**Tests**: integração (`extend-job-validity.int.test.ts`) + unit (schema) · **Gate**: full.
**Commit**: `feat(jobs): extendJobValidity sem re-moderação (USP-023)`

---

### T6 — `editJob` (E-001 / E-005 / P-001) — campos + status atômico [P]

**What**: Action `editJob` (§3.5 do design): gate; precondição `status=ACTIVE`; dentro de UM
`withAudit(JOB_EDITED_AFTER_APPROVAL, before/after)` faz `tx.job.updateMany({where:{id,status:ACTIVE},
data:{...campos,status:DRAFT,lastStatusChangeAt}})`. **+ guarda estática U23-MN-07.**
**Where**: `src/modules/jobs/actions/edit-job.ts`, `editJobSchema`, barrel,
`src/modules/jobs/__tests__/edit-job.int.test.ts`, `src/modules/jobs/__tests__/no-out-of-band-status-write.test.ts`.
**Depends on**: T1 (evento sem justificativa + published_at), T2 · **Reuses**: `publishJobSchema` (subset), padrão `withAudit`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] vaga `ACTIVE` → `DRAFT` com campos novos + audit before/after; retorno `{jobId,status:'DRAFT'}`.
- [ ] fluxo completo edit→`submitJobForModeration`→aprovar preserva `published_at` (E-005/D-006, via T1).
- [ ] não-responsável → `FORBIDDEN`; vaga não-`ACTIVE` → `CONFLICT`; concorrência `count===1`.
- [ ] **Guarda U23-MN-07 verde**: nenhuma escrita de `Job.status` fora de adapter/`editJob`; `editJob` só `where status=ACTIVE`.
- [ ] Gate Full verde; `@ac-023-1` + `@e-005` + `@u23-mn-07` verdes. Test count declarado.

**Tests**: integração (`edit-job.int.test.ts`) + unit (guarda U23-MN-07, schema) · **Gate**: full.
**Commit**: `feat(jobs): editJob (rascunho + re-moderação) preservando published_at (USP-023)`

---

### T7 — Detalhe de vaga pausada (P-003)

**What**: `getPausedJobNotice(id)` + branch na página do detalhe: `null` de `getActiveJobDetail` ⇒ consulta pausa
⇒ "vaga temporariamente pausada" (sem botão candidatar) senão "vaga encerrada".
**Where**: `src/modules/jobs/queries/get-paused-job-notice.ts`, barrel, `app/(public)/vagas/[id]/page.tsx`,
`src/modules/jobs/__tests__/get-paused-job-notice.int.test.ts`, E2E.
**Depends on**: T3 (existe caminho para `PAUSED`) · **Reuses**: view model USP-022, componentes de estado do detalhe.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] `getPausedJobNotice`: `PAUSED` + empresa verificada ⇒ `{paused:true}`; demais ⇒ `null` (sem PII).
- [ ] URL direta de vaga `PAUSED` mostra "temporariamente pausada", **sem** botão candidatar (P-003, negative test).
- [ ] `getActiveJobDetail` inalterado (U22-MN-03 preservado); `ARCHIVED`/`DRAFT` seguem "encerrada".
- [ ] Gate Build verde; `@p-003` verde. Test count declarado.

**Tests**: integração (`get-paused-job-notice.int.test.ts`) + e2e (`detalhe-vaga-pausada.spec.ts`) · **Gate**: build.
**Commit**: `feat(jobs): detalhe de vaga pausada com mensagem (USP-023)`

---

### T8 — Página de gestão: lista de vagas da Empresa

**What**: `listCompanyJobs(companyId)` + view `viewCompanyJobRow`; rota `(app)/empresa/[empresaId]/vagas/page.tsx`
com guarda `requireActivePerson()` + P-006 inline (`notFound()`), lista por status com `Card`/`Badge`.
**Where**: `src/modules/jobs/queries/list-company-jobs.ts`, `src/modules/jobs/views/company-job-row.view.ts`,
barrel, `app/(app)/empresa/[empresaId]/vagas/page.tsx`, `src/modules/jobs/components/company-job-list.tsx`, E2E.
**Depends on**: None (query owner-scoped) *(UI de ações vem em T9)* · **Reuses**: padrão `/vagas/nova/page.tsx`, `@/shared/ui`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] `listCompanyJobs` retorna vagas da Empresa (todos status) com `take`; dado próprio (sem anonimização).
- [ ] rota lista as vagas; **não-responsável → 404** (`notFound`, sem revelar a Empresa — P-005 na borda).
- [ ] cada vaga mostra status (`Badge`) e ações contextuais coerentes (placeholders até T9 cabear).
- [ ] Gate Build verde; E2E de confinamento (não-responsável 404) verde. Test count declarado.

**Tests**: integração (`list-company-jobs.int.test.ts`) + e2e (`gestao-vagas-confinamento.spec.ts`) · **Gate**: build.
**Commit**: `feat(jobs): página de gestão de vagas da empresa (lista + guarda) (USP-023)`

---

### T9 — Fluxo editar (UI) + ações leves

**What**: `/vagas/[jobId]/editar` reusando `JobForm` (prefill + action `editJob`) → em sucesso encadeia
`submitJobForModeration`; ações leves na lista (pausar/despausar/prorrogar via `Button`; arquivar via
`Button variant="danger"` + confirmação hand-rolled padrão `EditCompanyForm`).
**Where**: `app/(app)/empresa/[empresaId]/vagas/[jobId]/editar/page.tsx`,
`src/modules/jobs/components/*` (form de edição + controles de ação), E2E.
**Depends on**: T3, T4, T5, T6, T8 · **Reuses**: `JobForm`, `Button`/`Card`/`Badge`, padrão de confirmação de `EditCompanyForm`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] editar → `editJob` → `submitJobForModeration` (rascunho → moderação); prefill correto dos campos.
- [ ] ações leves disparam as actions certas; arquivar exige confirmação; `router.refresh()` no sucesso.
- [ ] ensaios D-001 (editar) e D-002 (pausar some/volta) verdes na UI.
- [ ] Gate Build verde; E2E dos fluxos top verdes. Test count declarado.

**Tests**: e2e (`editar-vaga.spec.ts`, `pausar-arquivar-prorrogar.spec.ts`) · **Gate**: build.
**Commit**: `feat(jobs): UI de edição e ações de ciclo de vida da vaga (USP-023)`

---

## Validação pré-aprovação (checks obrigatórios)

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T0 | facts (skill-tdad) | ✅ |
| T1 | 3 arquivos de infra coesos (evento+resolvedor+adapter) | ✅ (coeso: "infra de transição") |
| T2 | 1 extração + 1 refactor consumidor | ✅ |
| T3 | 2 actions simétricas (pause/unpause) mesmo arquivo-conceito | ✅ (coeso) |
| T4 | 1 action | ✅ |
| T5 | 1 action + 1 schema | ✅ |
| T6 | 1 action + 1 guarda | ✅ (coeso) |
| T7 | 1 query + 1 branch de página | ✅ |
| T8 | 1 query + 1 view + 1 rota | ✅ (coeso: "lista de gestão") |
| T9 | 1 rota de edição + controles de ação | ✅ (coeso: "UI de ciclo de vida") |

### Check 2 — Cross-check diagrama × `Depends on`

| Task | Depends on (corpo) | Diagrama | Status |
| --- | --- | --- | --- |
| T0 | — | raiz | ✅ |
| T1 | T0 | T0→T1 | ✅ |
| T2 | — (inicia ∥ a T1) | T2 na fundação (gate após) | ✅ |
| T3 | T1, T2 | T1,T2→T3 | ✅ |
| T4 | T1, T2 | T1,T2→T4 | ✅ |
| T5 | T1, T2 | T1,T2→T5 | ✅ |
| T6 | T1, T2 | T1,T2→T6 | ✅ |
| T7 | T3 | T3→T7 | ✅ |
| T8 | — | Phase 3 início | ✅ |
| T9 | T3,T4,T5,T6,T8 | →T9 | ✅ |

`[P]` em T3–T6: sem dependência inter-task; testes de integração rodam sequencialmente (Postgres compartilhado) — coerente com a Parallelism Assessment.

### Check 3 — Co-locação de testes

| Task | Camada criada | Matriz exige | Task declara | Status |
| --- | --- | --- | --- | --- |
| T1 | adapter + resolvedor de evento | integração + unit | integração + unit | ✅ |
| T2 | server helper + refactor | integração (preservação) | integração | ✅ |
| T3–T6 | Server Actions | integração (+unit schema/guarda) | integração/unit | ✅ |
| T7 | query + página | integração + e2e | integração + e2e | ✅ |
| T8 | query + view + rota | integração + e2e | integração + e2e | ✅ |
| T9 | rota/UI | e2e | e2e | ✅ |

Nenhuma task difere testes para outra ⇒ sem violação de co-locação.

### Check 4 — Must-Not Ownership

| Must-Not | Owning task(s) | Teste negativo |
| --- | --- | --- |
| P-001 (published_at preservado) | T1 (adapter) + T6 (fluxo) | `published-at.int` / `edit-job.int` (`@e-005`/`@p-001`/`@d-006`) |
| P-003 (detalhe pausado) | T7 (+ herdado USP-025) | `get-paused-job-notice.int` / `detalhe-vaga-pausada` (`@p-003`) |
| P-005 (autorização) | T2 + T3..T6 | cada `*-job.int` não-responsável → `FORBIDDEN` (`@p-005`/`@d-005`) |
| P-006 (arquivar terminal) | T4 | `archive-job.int` `ARCHIVED→ACTIVE` → `INVALID_TRANSITION` (`@p-006`) |
| U23-MN-07 (sem escrita de status out-of-band) | T6 | `no-out-of-band-status-write.test` (`@u23-mn-07`) |

Todo must-not ativo tem task dona + teste negativo. P-002/P-004 upstream = N/A (dono).

---

## Rastreabilidade

| Req | Tasks |
| --- | --- |
| E-001 / AC-023-1 | T6 |
| E-002 / AC-023-2 | T3, T7 |
| E-003 / AC-023-3 | T4 |
| E-004 / AC-023-4 | T5 |
| E-005 (anti-ranking) | T1, T6 |
| P-001 | T1, T6 |
| P-003 | T7 |
| P-005 / D-005 | T2, T3, T4, T5, T6 |
| P-006 | T4 |
| L-003 | T1, T3–T6 |
| U23-MN-07 | T6 |
| UI (painel/edição) | T8, T9 |

## Ordem sugerida

`T0 → T1 → T2 → (T3‖T4‖T5‖T6) → PR-A` · depois `T7 → T8 → T9 → PR-B`.

## Facts (skill-tdad) — gerados em T0

Rodar `skill-tdad` sobre `expectations-USP-023.md` produz `.feature` (tags `@ac-023-*`, `@e-005`, `@p-00N`,
`@u23-mn-07`), Vitest RED (unit + `*.int.test.ts`), esqueleto Playwright e matriz AC→fact. Os paths retornados
populam o campo **Tests** de cada task. Fora desta US (UAT pós-merge): L-001 (p95 ≤2s).
</content>
