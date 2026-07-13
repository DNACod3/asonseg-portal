# USP-054 — Ciclo de vida da vaga no painel (Tasks)

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: **activate it by name** and follow its
Execute flow and Critical Rules. Do not search for skill files by filesystem path. The skill is the
source of truth for the full flow (per-task cycle, gate, atomic commit, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

**Design**: `.specs/features/ajustes-uat/usp-054-ciclo-vida-vaga/design.md`
**Spec**: `.specs/features/ajustes-uat/usp-054-ciclo-vida-vaga/spec.md`
**Status**: Draft

> **Premissas invioláveis (brief):** não alterar arquitetura (FSM via `transitionContent`, ADR-0013 ISR,
> View Models, adapters); NÃO burlar a máquina de estados (reenvio usa a transição declarada); PT-BR;
> **sem dep nova; sem migração**; respeitar a convenção de fuso (DATE date-only NÃO leva fuso). Preservar
> os testes de `company-job-row.view`, `next-cache-invalidation`, `editJob`/`submitJobForModeration`
> (estender/atualizar quando o comportamento muda de propósito — nunca deletar/enfraquecer).

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes de Execute. Guidelines encontradas:
> `CLAUDE.md` (Testing Requirements: Server Action cobre happy/Zod/permissão/consent/concorrência;
> domínio 90%; integração 80%), `vitest.config.ts` (unit exclui `*.int.test.ts`),
> `vitest.integration.config.ts` (só `*.int.test.ts`), lição **AD-021** (queries com `where` exigem
> int-test contra o DB real), lição **L-007** (E2E autenticado deferido; RTL/componente é autoritativo).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| View model / domain / util puro (`company-job-row.view.ts`, `formatDateOnly`, `updateJobDraftSchema`) | unit | Todos os ramos; 1:1 aos ACs; edge cases listados | `src/**/__tests__/*.spec.ts`, `src/**/*.test.ts` | `npm run test` |
| Server Action (`updateJobDraft`) | integration | happy + Zod-fail + permissão-negada + precondição + concorrência (CLAUDE.md); write-path real | `src/modules/**/__tests__/*.int.test.ts` | `npm run test:integration` |
| Query (`listLatestReturnReasons`) | integration | `where` real exercitado no DB (AD-021); mais-recente + owner-scope | `src/modules/**/__tests__/*.int.test.ts` | `npm run test:integration` |
| Adapter (`next-cache-invalidation`) | unit | Todos os ramos da guarda (entra/sai/nem-um de ACTIVE); mock de `revalidatePath` | `src/modules/moderation/adapters/__tests__/*.test.ts` | `npm run test` |
| Route / Component (edit page, `company-job-list`, `company-job-actions`, painel `page`, `job-edit-form`) | unit (RTL/jsdom) + e2e | RTL: render por status + gate 404 + fallback de motivo. E2E: gate de sessão (autenticado deferido, L-007) | `src/app/**/*.test.tsx`, `src/modules/**/*.test.tsx`, `e2e/**` | `npm run test` (+ `npm run test:e2e`) |
| Guarda estática (must-not) | unit | Varre a fonte; mutação restauradora morta | `src/modules/**/__tests__/*.test.ts` | `npm run test` |
| Config/entity (`export const revalidate = 600`) | none | build gate only | — | `npm run build` |

## Parallelism Assessment

> Gerada de codebase — confirmar antes de Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit / component (`.test.ts`/`.spec.ts`/`.tsx`) | **Yes** | jsdom por-arquivo, sem backing store; mocks | `vitest.config.ts` (jsdom, sem DB) |
| integration (`.int.test.ts`) | **No** | Postgres local compartilhado + cleanup/truncação por-suite | `vitest.integration.config.ts` (node, `.env.local`), padrão dos `*.int.test.ts` do repo |
| e2e (Playwright) | **No** | App + DB compartilhados | `test:e2e` |

## Gate Check Commands

> Gerada de codebase — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| **Quick** | Após tasks só com unit/component | `npm run typecheck && npm run lint && npm run test` |
| **Full** | Após tasks com `*.int.test.ts` | `npm run typecheck && npm run lint && npm run test && npm run test:integration` (Postgres local: `dotenv -e .env.local -- prisma migrate deploy`) |
| **Build** | Após task de config/entity ou fim de fase | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Correções independentes (paralelizáveis por dependência de código; int-tests sequenciais)

```
T1 [P]   T2 [P]   T3 [P]   T4 [P]   T5   T6
(cache)  (TTL)    (data)   (view)  (action)(query)
```

Sem dependência entre si. `[P]` = order-free. T5/T6 rodam `*.int.test.ts` (não parallel-safe) → **sem** `[P]`.

### Phase 2: Fiação da UI (Sequential)

```
T4, T5, T6 ──→ T7
```

T7 consome o view model (T4), a action (T5) e a query (T6).

---

## Task Breakdown

### T1: Revalidar cache público ao SAIR de ACTIVE (EMP-3) [P]

**What**: Adicionar `from` ao port de cache e destravar o early-return do adapter para revalidar
`/vagas` e `/vagas/[id]` quando `from === ACTIVE` (pausar/arquivar/editar→DRAFT/inativar/expirar).
**Where**:
- `src/modules/moderation/ports/cache-invalidation.port.ts` (add `from: ContentStatus` a `CacheInvalidationTarget`)
- `src/modules/moderation/actions/transition-content.ts:109` (passar `{ contentKind, contentId, from, to }`)
- `src/modules/moderation/adapters/next-cache-invalidation.ts` (guarda: `if (to!==ACTIVE && to!==INACTIVATED && from!==ACTIVE) return;`)
- `src/modules/moderation/adapters/__tests__/adapters.test.ts` (**atualizar**, ver Done when)
**Depends on**: None
**Reuses**: `revalidatePath` já no adapter; `from` já em escopo no call site (linha 58).
**Requirement**: USP054-11, USP054-12, USP054-E4, USP054-E5, **USP054-MN-04**

**Tools**: MCP: NONE · Skill: `bravi-spec-driven` (Execute)

**Done when**:
- [x] `CacheInvalidationTarget` tem `from`; call site passa `from`; guarda revalida quando `from===ACTIVE`.
- [x] `adapters.test.ts` **atualizado** (correção de teste que codificava o bug, não enfraquecimento):
      caso PAUSED passa `from:ACTIVE` e **assere revalidação** de `/vagas`+`/vagas/[id]`; caso ARCHIVED idem;
      casos ACTIVE/INACTIVATED existentes ganham `from`; **novo** caso de early-return real
      (`from:DRAFT,to:IN_MODERATION` → nenhum `revalidatePath`).
- [x] `to===ACTIVE` (entrar) continua revalidando (USP054-12, sem regressão).
- [x] Gate quick passa: `npm run typecheck && npm run lint && npm run test`.
- [x] Test count: adapters.test.ts verde (≥ casos atuais + 1 novo); nenhuma deleção silenciosa.

**Tests**: unit · **Gate**: quick
**Commit**: `fix(moderation): revalida cache público ao sair de ACTIVE (EMP-3)`

---

### T2: Alinhar ISR das páginas de vagas a 600s (EMP-3) [P]

**What**: Trocar `export const revalidate` de `1800` para `600` na listagem e no detalhe de vagas.
**Where**: `src/app/(public)/vagas/page.tsx:17`, `src/app/(public)/vagas/[id]/page.tsx:18`
**Depends on**: None
**Reuses**: —
**Requirement**: USP054-13

**Tools**: MCP: NONE · Skill: `bravi-spec-driven` (Execute)

**Done when**:
- [x] Ambas as páginas de vagas declaram `export const revalidate = 600;`.
- [x] `grep -rn "export const revalidate" src/app/(public)/vagas` mostra só `600`.
- [x] Serviços **intocados** (fora do escopo).
- [x] Gate build passa: `npm run typecheck && npm run lint && npm run test && npm run build`.

**Tests**: none (build gate) · **Gate**: build
**Commit**: `fix(jobs): alinha ISR das páginas de vagas a 600s (EMP-3/ADR-0013)`

---

### T3: Formatar validade date-only sem deslocar o dia (MOD-5) [P]

**What**: Criar `formatDateOnly` (UTC) e usá-lo nos 2 sites que exibem `validUntil`; `formatDate` global inalterado.
**Where**:
- `src/shared/lib/time.ts` (novo `formatDateOnly(d, fmt='dd/MM/yyyy') = formatInTimeZone(d, 'UTC', fmt)`)
- `src/shared/lib/__tests__/time.test.ts` (casos novos)
- `src/modules/jobs/components/company-job-list.tsx:49` e `src/modules/jobs/components/job-detail.tsx:133-139` (`formatDate`→`formatDateOnly`)
**Depends on**: None
**Reuses**: `formatInTimeZone` (padrão `formatSaoPaulo`); precedente `validade.ts` (lê `validUntil` em UTC).
**Requirement**: USP054-14, USP054-15, **USP054-MN-05**

**Tools**: MCP: `context7` (opcional, confirmar assinatura `date-fns-tz` `formatInTimeZone`) · Skill: `bravi-spec-driven` (Execute)

**Done when**:
- [x] `formatDateOnly(new Date('2026-08-01T00:00:00.000Z'))` === `'01/08/2026'` (não `31/07/2026`).
- [x] Teste cobre a janela 00:00–03:00 UTC que expõe o −1 dia; `formatDate` **inalterado** (specs existentes verdes).
- [x] Os 2 sites de exibição de `validUntil` usam `formatDateOnly`; nenhum caminho passa `validUntil` por `America/Sao_Paulo`.
- [x] Gate quick passa.
- [x] Test count: time.test.ts com casos novos verdes; nenhuma deleção.

**Tests**: unit · **Gate**: quick
**Commit**: `fix(jobs): formata validade date-only sem deslocar o dia (MOD-5)`

---

### T4: Ações de rascunho/aguardando ajustes + campo de motivo no view model (EMP-2/MOD-3) [P]

**What**: `actionsForStatus` habilita `canEdit`+`canSubmit` para `DRAFT` e `AWAITING_ADJUSTMENTS`; adicionar
`returnReason` (opcional) ao `CompanyJobRowView`.
**Where**:
- `src/modules/jobs/views/company-job-row.view.ts` (cases `DRAFT`/`AWAITING_ADJUSTMENTS`; 2º param `returnReason?`; campo `returnReason: string | null`)
- `src/modules/jobs/__tests__/company-job-row.view.spec.ts` (**estender**)
**Depends on**: None
**Reuses**: `switch` existente; `STATUS_LABEL`/`STATUS_BADGE_VARIANT` já cobrem `AWAITING_ADJUSTMENTS`.
**Requirement**: USP054-01, USP054-02, USP054-06

**Tools**: MCP: NONE · Skill: `bravi-spec-driven` (Execute)

**Done when**:
- [x] `actionsForStatus('DRAFT')` e `('AWAITING_ADJUSTMENTS')` → `canEdit:true, canSubmit:true`, resto `false`.
- [x] Terminais (`ARCHIVED`/`EXPIRED`/`INACTIVATED`/`REJECTED`/`IN_MODERATION`) permanecem all-false (USP054-06).
- [x] `viewCompanyJobRow(row, reason?)` expõe `returnReason` (default `null`); **assinatura retrocompatível** (param opcional) → specs existentes intactas.
- [x] `company-job-row.view.spec.ts` estendido com asserções de `actions` por status + `returnReason`.
- [x] Gate quick passa. Test count: specs anteriores verdes + novas.

**Tests**: unit · **Gate**: quick
**Commit**: `feat(jobs): habilita ações de rascunho/aguardando ajustes no painel + campo de motivo (EMP-2/MOD-3)`

---

### T5: Action `updateJobDraft` — editar rascunho sem transicionar (EMP-2)

**What**: Nova Server Action que atualiza os campos informativos de uma vaga `DRAFT`/`AWAITING_ADJUSTMENTS`
**sem** mudar o status, owner-scoped e auditada.
**Where**:
- `src/modules/jobs/actions/update-job-draft.ts` (novo) + `src/modules/jobs/schemas/publish-job.schema.ts` (`updateJobDraftSchema`) + barrel `src/modules/jobs/index.ts`
- `src/modules/jobs/__tests__/update-job-draft.int.test.ts` (novo)
**Depends on**: None
**Reuses**: `withAudit`+`JOB_DRAFT_SAVED`, `requireActiveResponsible`, shape de `editJobSchema`/`publishJobSchema`.
**Requirement**: USP054-03, USP054-E3, **USP054-MN-01**, **USP054-MN-02**, **USP054-MN-03** (gate)

**Tools**: MCP: NONE · Skill: `bravi-spec-driven` (Execute)

**Done when**:
- [x] `updateJobDraft` valida (Zod), gate `requireActiveResponsible`, precondição `status∈{DRAFT,AWAITING_ADJUSTMENTS}`, `updateMany({where:{id,status:{in:[...]}}, data:{...campos SEM status}})` com before/after em `withAudit`.
- [x] Int-test cobre (CLAUDE.md): happy (campos persistem, **`status` inalterado** — MN-02); Zod-fail→`VALIDATION`; não-responsável→`FORBIDDEN` **sem escrita** (MN-03); vaga `ACTIVE`/terminal→`CONFLICT` sem escrita; concorrência `count!==1`→`CONFLICT` (E3).
- [x] **MN-01**: `no-out-of-band-status-write.test.ts` permanece **verde** (a varredura agora inclui `update-job-draft.ts`, que não grava `status` no `data`).
- [x] `updateJobDraftSchema` inclui `validUntil` (evita beco de validade — D-1).
- [x] Gate full passa: `... && npm run test:integration`.
- [x] Test count: int-test novo verde; `no-out-of-band-status-write.test.ts` verde; nenhuma deleção.

**Tests**: integration · **Gate**: full
**Commit**: `feat(jobs): action updateJobDraft (editar rascunho sem transicionar) (EMP-2)`

---

### T6: Query do motivo da última devolução (MOD-3)

**What**: Query owner-scoped que lê, do `AuditLog`, o motivo da **última** devolução por vaga.
**Where**:
- `src/modules/jobs/queries/list-latest-return-reasons.ts` (novo) + barrel `src/modules/jobs/index.ts`
- `src/modules/jobs/__tests__/list-latest-return-reasons.int.test.ts` (novo)
**Depends on**: None
**Reuses**: molde `companies/queries/list-company-rejections.ts` (troca `CONTENT_REJECTED`→`CONTENT_RETURNED_FOR_ADJUSTMENTS`).
**Requirement**: USP054-07, USP054-08, USP054-E2, **USP054-MN-03** (leitura)

**Tools**: MCP: NONE · Skill: `bravi-spec-driven` (Execute)

**Done when**:
- [x] `listLatestReturnReasons(jobIds)` → `Map<jobId,{reason,returnedAt}>`; `where{action:'CONTENT_RETURNED_FOR_ADJUSTMENTS',entityType:'JOB',entityId:{in}}`, `orderBy occurredAt desc`, `take` obrigatório, reduz ao mais recente por vaga.
- [x] Int-test (AD-021 — exercita o `where` real no DB): devolvida com 2 registros → devolve o **mais recente** (USP054-08); vaga nunca devolvida → ausente do map (USP054-E2); **MN-03**: `jobId` de outra Empresa não é consultado (só os `jobIds` passados) — teste com 2 empresas confirma isolamento.
- [x] Gate full passa.
- [x] Test count: int-test novo verde; nenhuma deleção.

**Tests**: integration · **Gate**: full
**Commit**: `feat(jobs): query do motivo da última devolução de vaga (MOD-3)`

---

### T7: Fiação do painel — editar/submeter/reenviar + motivo visível (EMP-2/MOD-3)

**What**: Ligar view model + action + query na UI: botão Submeter/Reenviar direto, bloco de motivo,
roteamento do form de edição por status, e o modo draft do `JobEditForm`.
**Where**:
- `src/modules/jobs/components/company-job-actions.tsx` (add `canSubmit`→`submitJobForModeration({jobId})`; prop `status` p/ rótulo)
- `src/modules/jobs/components/company-job-list.tsx` (remove `Link` de `canSubmit`; add bloco de motivo `AWAITING_ADJUSTMENTS` com fallback; `formatDate`→`formatDateOnly`; passa `status` ao `CompanyJobActions`)
- `src/modules/jobs/components/job-edit-form.tsx` (prop `mode`: `draft-edit`→`updateJobDraft` sem chain, renderiza `validUntil`)
- `src/app/(app)/empresa/[empresaId]/vagas/[jobId]/editar/page.tsx` (roteia `ACTIVE`/`DRAFT`/`AWAITING`→form; demais→Card)
- `src/app/(app)/empresa/[empresaId]/vagas/page.tsx` (chama `listLatestReturnReasons`; mapeia `viewCompanyJobRow(row, reason)`)
- Testes de componente/página: `company-job-list`/`company-job-actions`/`job-edit-form` (`.test.tsx`), `editar/page.test.tsx` (**atualizar**: `DRAFT`/`AWAITING`→form), `vagas/page.test.tsx` (**preservar** gate 404; add render do motivo)
**Depends on**: **T4, T5, T6**
**Reuses**: `submitJobForModeration` (sem mudança), `Button`/`Card`/`Badge` (`@/shared/ui`), padrão de erro inline dos botões existentes.
**Requirement**: USP054-04, USP054-05, USP054-09, USP054-10, USP054-06, USP054-E1, USP054-E2, **USP054-MN-03** (rota)

**Tools**: MCP: NONE · Skill: `bravi-spec-driven` (Execute)

**Done when**:
- [x] `DRAFT` mostra **Editar** + **Enviar para moderação**; `AWAITING_ADJUSTMENTS` mostra **Editar** + **Reenviar para moderação** + o **motivo** (fallback "Sem motivo registrado", E2).
- [x] Submeter/Reenviar chama `submitJobForModeration({jobId})` → `IN_MODERATION`; após sucesso, as ações do autor somem (`router.refresh()`), USP054-04/09.
- [x] Editar em modo draft salva via `updateJobDraft` **sem** submeter (USP054-03/USP054-MN-02 na borda) e permite editar `validUntil`.
- [x] Rota `editar` renderiza o form para `DRAFT`/`AWAITING`; `editar/page.test.tsx` atualizado.
- [x] Não-responsável → `notFound()` na rota do painel (preservado por `vagas/page.test.tsx`); nada vaza (MN-03).
- [x] Terminais sem botão de reenvio (USP054-06).
- [x] Gate build passa: `... && npm run build`. E2E autenticado deferido (L-007); cobertura autoritativa em RTL.
- [x] Test count: `.test.tsx` novos/atualizados verdes; `vagas/page.test.tsx` gate 404 preservado; nenhuma deleção.

**Tests**: unit (component/RTL) · **Gate**: build
**Commit**: `feat(jobs): fiação do painel — editar/submeter/reenviar de rascunho + motivo visível (EMP-2/MOD-3)`

---

## Parallel Execution Map

```
Phase 1 (order-free por código; int-tests T5/T6 sequenciais entre si):
  ├── T1 [P]  (unit)
  ├── T2 [P]  (build)
  ├── T3 [P]  (unit)
  ├── T4 [P]  (unit)
  ├── T5      (integration — sem [P])
  └── T6      (integration — sem [P])

Phase 2 (Sequential):
  T4, T5, T6 ──→ T7
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: cache adapter+port+call site+test | 1 correção coesa (3 arquivos + teste do mesmo comportamento) | ✅ Granular |
| T2: revalidate 600 (2 páginas) | 1 mudança de config | ✅ Granular |
| T3: formatDateOnly + 2 sites + teste | 1 util + seus 2 consumidores | ✅ Granular |
| T4: view model (actions + returnReason) | 1 arquivo de view + spec | ✅ Granular |
| T5: updateJobDraft (action+schema+int) | 1 Server Action | ✅ Granular |
| T6: listLatestReturnReasons (query+int) | 1 query | ✅ Granular |
| T7: fiação da UI | Coeso (uma feature de UI: liga T4/T5/T6) — múltiplos componentes mas 1 entregável de fiação | ⚠️→✅ Coeso (aceitável: é a integração final; dividir criaria UI meio-ligada não-testável) |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram mostra | Status |
| --- | --- | --- | --- |
| T1 | None | — (Phase 1) | ✅ Match |
| T2 | None | — (Phase 1) | ✅ Match |
| T3 | None | — (Phase 1) | ✅ Match |
| T4 | None | — (Phase 1) | ✅ Match |
| T5 | None | — (Phase 1) | ✅ Match |
| T6 | None | — (Phase 1) | ✅ Match |
| T7 | T4, T5, T6 | `T4,T5,T6 ──→ T7` | ✅ Match |

`[P]` de T1–T4 = order-free e parallel-safe (unit). T5/T6 sem `[P]` (int-tests não parallel-safe). Nenhum `[P]` depende de outro `[P]`.

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Adapter (`next-cache-invalidation`) | unit | unit | ✅ OK |
| T2 | Config (`export const revalidate`) | none (build) | none | ✅ OK |
| T3 | Util puro (`formatDateOnly`) | unit | unit | ✅ OK |
| T4 | View model (`company-job-row.view`) | unit | unit | ✅ OK |
| T5 | Server Action (`updateJobDraft`) | integration | integration | ✅ OK |
| T6 | Query (`listLatestReturnReasons`) | integration | integration | ✅ OK |
| T7 | Route/Component (form, list, actions, page) | unit (RTL) + e2e | unit (RTL); e2e deferido L-007 | ✅ OK |

## 💠 Must-Not Ownership (Check 4)

| Must-Not | Owning task(s) | Negative test (na task) |
| --- | --- | --- |
| `USP054-MN-01` (submit/reenvio não escreve status fora de `transitionContent`) | **T5** (updateJobDraft não grava status) + T7 (usa `submitJobForModeration` sem mudança) | T5: `no-out-of-band-status-write.test.ts` verde (varre `update-job-draft.ts`) |
| `USP054-MN-02` (editar rascunho não transiciona) | **T5** | T5 int: após `updateJobDraft`, `status` inalterado |
| `USP054-MN-03` (não-responsável / cross-tenant) | **T5** (gate action) + **T6** (query owner-scope) + T7 (rota) | T5: não-responsável→`FORBIDDEN` sem escrita; T6: 2 empresas, isolamento; T7: rota→404 |
| `USP054-MN-04` (cache não fica stale ao sair de ACTIVE) | **T1** | T1 unit: `from:ACTIVE→PAUSED/ARCHIVED` revalida; mutação restaurando o early-return é morta |
| `USP054-MN-05` (date-only não desloca ±1 dia) | **T3** | T3 unit: `@db.Date` meia-noite UTC → mesma data-calendário |

**Resultado:** todos os 5 must-nots têm task dona **e** teste negativo. Nenhum gap de decomposição.

---

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. `Done when` é binário e referencia o comando de gate.
Contagem de testes explícita evita deleção silenciosa. Após a última task (T7), o **Verifier independente
sempre roda** (author ≠ verifier): checagem spec-anchored por AC + sensor de discriminação (mutação ao
vivo) + verificação dos 5 must-nots (evidência-ou-zero). Loop fix→re-verify limitado a 3 iterações.
