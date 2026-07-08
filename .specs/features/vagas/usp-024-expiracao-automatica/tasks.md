# USP-024 — Expiração automática de vaga — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a skill **`bravi-spec-driven`**: **ative-a pelo nome** e siga o fluxo Execute + as
Critical Rules (teste deriva do AC; gate verde antes de "done"; 1 commit atômico por task; nunca enfraquecer/
apagar teste; todo must-not com teste negativo verde). Não busque arquivos da skill por caminho de filesystem.
**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

**Design**: `.specs/features/vagas/usp-024-expiracao-automatica/design.md`
**Spec**: `.specs/features/vagas/usp-024-expiracao-automatica/spec.md`
**Status**: Draft

> **Sizing:** Large (must-nots + operação de sistema irreversível + timezone/idempotência sensíveis). Entry gate
> limpo (nenhum owner externo). **Dependência de infra:** o `eventTypeFor` kind-aware p/ `EXPIRED` é
> compartilhado com a **USP-023/T1**; T1 aqui é auto-suficiente (verifica ou adiciona). Recomendação ao
> orquestrador: rodar **USP-023 antes** — mas não é bloqueio. Board a cargo do OpenWolf no kickoff.

---

## Test Coverage Matrix

> Gerada de codebase + spec. **Guidelines:** `CLAUDE.md` (Server Action tests: happy/validation/permission/
> concurrency; integração 80%; E2E top flows), padrão `.specs/features/vagas/usp-022-detalhe-vaga/tasks.md`
> (sem `TESTING.md`; gates inline). Cron de referência: `auth-attempts-retention/route.int.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Rota de cron (`app/api/cron/expire-jobs`) | integração | 401 sem segredo / 503 sem `CRON_SECRET` / 200 resumo / 500 erro | `src/app/api/cron/expire-jobs/route.int.test.ts` | `npm run test` |
| Caso de uso (`run-job-expiration.ts`) | integração | expira vencida; ignora vigente/`PAUSED`/`DRAFT`; idempotência; sem delete físico; fuso | `src/modules/jobs/__tests__/run-job-expiration.int.test.ts` | `npm run test` |
| Defesa on-read (P-001) | integração | vaga `ACTIVE` vencida (job não rodou) excluída de `search-jobs`/`get-job-detail` | `src/modules/jobs/__tests__/expired-on-read.int.test.ts` | `npm run test` |
| Domínio (`diasAteExpiracao`) | unit | dias corretos por fuso (America/Sao_Paulo), fronteira de meia-noite | `src/modules/jobs/__tests__/validade.spec.ts` | `npm run test` |
| Moderation `eventTypeFor(EXPIRED)` | unit + integração | `EXPIRED (SYSTEM_JOB) → JOB_EXPIRED`; CV/SERVICE sem regressão | `src/modules/moderation/__tests__/*` | `npm run test` |
| Reminder seam (`enqueueExpiryReminder`) | integração | D-3 sem `expiryReminderSentAt` ⇒ 1 linha Outbox + coluna marcada; 2ª execução não reenfileira | `src/modules/jobs/__tests__/expiry-reminder.int.test.ts` | `npm run test` |
| Badge (E-004) | unit + e2e | `diasAteExpiracao` unit; render "expira em N dias" no painel (USP-023) | unit + `e2e/**` | `npm run test` / `npm run test:e2e` |
| Migração/`vercel.json` | none | — (build gate; migração aplica em DB limpo) | — | build gate |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (domínio/`eventTypeFor`) | Yes | Puro, sem IO | specs de domínio USP-020/021 |
| integração (`*.int.test.ts`) | No | Postgres local compartilhado + cleanup | `route.int.test.ts` (auth-attempts), memory "seed-cnpj-exclusivo" |
| e2e | No | App + DB provisionados | pipeline CI (job e2e) |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks só com unit | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks com integração (cron/use-case/queries) | `npm run typecheck && npm run lint && npm run test` (Postgres local: `supabase start` / `supabase db reset`) |
| Build | Migração / UI / rota | `npm run typecheck && npm run lint && npm run test && npm run build && npm run test:e2e` |

---

## Execution Plan

### Phase 1: Fundação (Sequential)

```
T0 (facts) → T1 (eventTypeFor EXPIRED) ‖ T2 (migração + diasAteExpiracao)
```

### Phase 2: Núcleo do job (Sequential)

```
T1 → T3 (rota de cron + runJobExpiration + SYSTEM_ACTOR seed + defesa on-read)
```

### Phase 3: Aviso + badge (P2)

```
T3, T2 → T4 (reminder seam) ; T2 (+ USP-023 T8) → T5 (badge no painel)
```

---

## Task Breakdown

### T0 — Gerar facts da USP-024 (skill-tdad)

**What**: Rodar `skill-tdad` sobre `expectations-USP-024.md` (E-001..E-004, P-001..P-005, L-001..L-003, D-001..D-005).
**Where**: `.specs/features/vagas/usp-024-expiracao-automatica/tests/`.
**Depends on**: None · **Reuses**: `expectations-USP-024.md`, `spec.md` (must-nots).
**Tools**: Skill: `skill-tdad`.
**Done when**:
- [ ] `.feature` PT-BR com tags `@ac-024-1..3`, `@e-002/003/004`, `@p-001..005`, `@u24-mn-06/07`.
- [ ] Vitest RED (unit + `*.int.test.ts`) + esqueleto Playwright + matriz AC→teste, commitados.
- [ ] Toda E-NNN/P-NNN ativa tem ≥1 cenário.

**Tests**: n/a (produz) · **Gate**: quick.

---

### T1 — Garantir `eventTypeFor(EXPIRED)` kind-aware

**What**: Verificar que `eventTypeFor(contentKind, from, to, trigger)` mapeia `(JOB, ACTIVE, EXPIRED, SYSTEM_JOB) → JOB_EXPIRED`.
Se a USP-023/T1 já entregou, apenas cobrir com teste; senão, adicionar o ramo (idempotente) + atualizar o call site.
**Where**: `src/modules/moderation/actions/transition-content.ts` (+ `src/modules/moderation/__tests__/*`).
**Depends on**: T0 · **Reuses**: `AuditEvent.JOB_EXPIRED` (já existe), `TRANSITIONS[JOB]`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] `transitionContent(JOB, ACTIVE→EXPIRED, SYSTEM_JOB)` NÃO retorna `INTERNAL`; grava `JOB_EXPIRED`.
- [ ] CV/SERVICE/CANDIDATE_PROFILE sem regressão (specs existentes verdes).
- [ ] Gate Full verde. Test count declarado.

**Tests**: unit + integração (transição JOB→EXPIRED) · **Gate**: full.
**Commit**: `feat(moderation): mapeia EXPIRED→JOB_EXPIRED no eventTypeFor (USP-024)`

---

### T2 — Migração `expiryReminderSentAt` + `diasAteExpiracao`

**What**: (a) Migração Prisma `Job.expiryReminderSentAt DateTime?` (nullable, sem backfill). (b) Função pura
`diasAteExpiracao(validUntil, hojeSP)` em `domain/validade.ts` (dias de calendário em America/Sao_Paulo).
**Where**: `prisma/schema.prisma` + `prisma/migrations/…_usp024_expiry_reminder/`, `src/modules/jobs/domain/validade.ts`,
barrel, `src/modules/jobs/__tests__/validade.spec.ts`.
**Depends on**: T0 · **Reuses**: `validadeStatus` (espelho), `hojeSaoPaulo()`, padrão de migração USP-020/021.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] Migração aplica em DB limpo (`supabase db reset`); `prisma generate` + `typecheck` ✓.
- [ ] `diasAteExpiracao` retorna N correto por fuso (unit, incl. fronteira de meia-noite BRT — P-002).
- [ ] Gate Build verde. Test count declarado.

**Tests**: unit (`validade.spec.ts`) · **Gate**: build.
**Commit**: `feat(jobs): coluna expiryReminderSentAt + diasAteExpiracao (USP-024)`

---

### T3 — Rota de cron + `runJobExpiration` + defesa on-read (E-001/E-002/P-001/P-002/P-005)

**What**: (a) `runJobExpiration()` (`jobs/actions/run-job-expiration.ts`): pagina vagas `ACTIVE` com
`validUntil < hojeSaoPaulo()` e transiciona cada uma via `transitionContent(JOB, EXPIRED, SYSTEM_JOB, SYSTEM_ACTOR_ID)`;
idempotente; retorna `{expired, scanned}`. (b) Rota `app/api/cron/expire-jobs/route.ts` (`GET`, `force-dynamic`,
auth `CRON_SECRET` clonando `auth-attempts-retention`, JSON, `childLogger`). (c) `SYSTEM_ACTOR_ID` + seed de Person
de sistema em `seeds/reference.ts` (verificar FK `audit_log.actor_person_id`). (d) `vercel.json`: entrada de cron
`{path:'/api/cron/expire-jobs', schedule:'0 * * * *'}`. (e) helper `verifyCronSecret` em `shared/lib/cron-secret.ts`.
**Where**: `src/modules/jobs/actions/run-job-expiration.ts`, `src/app/api/cron/expire-jobs/route.ts`,
`src/shared/lib/cron-secret.ts`, `prisma/seeds/reference.ts`, `vercel.json`, barrel,
`src/modules/jobs/__tests__/run-job-expiration.int.test.ts`, `src/modules/jobs/__tests__/expired-on-read.int.test.ts`,
`src/app/api/cron/expire-jobs/route.int.test.ts`.
**Depends on**: T1 · **Reuses**: `transitionContent`, `hojeSaoPaulo()`, cron `auth-attempts-retention`, `env.CRON_SECRET`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] vaga `ACTIVE` vencida → `EXPIRED` + `JOB_EXPIRED` (E-001); vigente/`PAUSED`/`DRAFT` inalteradas.
- [ ] 2ª execução é no-op (idempotência — U24-MN-07); nenhuma exclusão física (P-005, vaga+candidaturas intactas).
- [ ] rota: sem `CRON_SECRET` → 503; segredo inválido → **401** e zero transições (U24-MN-06); sucesso → 200 `{expired,scanned}`; erro → 500 + `log.error`.
- [ ] **Defesa on-read (P-001)**: vaga `ACTIVE` porém vencida (job NÃO rodou) é excluída de `search-jobs`/`get-job-detail` (negative test).
- [ ] **Fuso (P-002)**: `hoje` do job === `hoje` da query; vaga expira à meia-noite BRT, não em UTC (negative test com relógio fixo).
- [ ] `vercel.json` válido (2 crons); Gate Build verde. Test count declarado.

**Tests**: integração (`run-job-expiration.int`, `route.int`, `expired-on-read.int`) · **Gate**: build.
**Commit**: `feat(jobs): job de expiração de vagas (cron + transitionContent EXPIRED) (USP-024)`

---

### T4 — Seam de aviso D-3 (enqueue Outbox) (E-003 / P2)

**What**: `enqueueExpiryReminder(job)` — grava `Outbox` `topic='email'` (payload `{kind:'JOB_EXPIRY_D3', jobId}`)
+ `expiryReminderSentAt=now()` numa tx; chamada por `runJobExpiration` para vagas a D-3 sem lembrete. Entrega = USP-044.
**Where**: `src/modules/jobs/actions/run-job-expiration.ts` (passo de reminder), helper `enqueue-expiry-reminder.ts`,
`src/modules/jobs/__tests__/expiry-reminder.int.test.ts`.
**Depends on**: T2 (coluna), T3 (job) · **Reuses**: `Outbox` (AD-007), `diasAteExpiracao`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] vaga a D-3 sem `expiryReminderSentAt` ⇒ 1 linha `Outbox` `topic='email'` + coluna marcada.
- [ ] 2ª execução horária NÃO reenfileira (U24-MN-07); entrega fica p/ USP-044 (não implementada aqui).
- [ ] Gate Full verde. Test count declarado.

**Tests**: integração (`expiry-reminder.int.test.ts`) · **Gate**: full.
**Commit**: `feat(jobs): enfileira aviso D-3 de expiração na Outbox (USP-024)`

---

### T5 — Badge "expira em N dias" no painel (E-004 / P-003 / P2)

**What**: Renderizar `diasAteExpiracao` como `Badge` "expira em N dias" na lista de gestão de vagas da Empresa
(componente da USP-023/T8), para vagas `ACTIVE` próximas da validade.
**Where**: `src/modules/jobs/components/company-job-list.tsx` (da USP-023) + e2e.
**Depends on**: T2 (`diasAteExpiracao`), USP-023/T8 (painel) · **Reuses**: `Badge` de `@/shared/ui`.
**Tools**: MCP: NONE · Skill: NONE.
**Done when**:
- [ ] vaga `ACTIVE` a N dias da validade mostra badge "expira em N dias" no painel (sinal in-portal, P-003).
- [ ] se o painel da USP-023 ainda não existe, a task fica **bloqueada** (dep explícita) — o cálculo puro (T2) segue testado.
- [ ] Gate Build verde. Test count declarado.

**Tests**: e2e (badge no painel) + unit (`diasAteExpiracao`, já em T2) · **Gate**: build.
**Commit**: `feat(jobs): badge expira-em-N-dias no painel da empresa (USP-024)`

---

## Validação pré-aprovação (checks obrigatórios)

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T0 | facts | ✅ |
| T1 | 1 função (`eventTypeFor`) | ✅ |
| T2 | 1 migração + 1 função pura | ✅ (coeso) |
| T3 | 1 use-case + 1 rota + seed + config (coeso: "o job") | ✅ |
| T4 | 1 helper de enqueue + passo | ✅ |
| T5 | 1 render de badge | ✅ |

### Check 2 — Cross-check diagrama × `Depends on`

| Task | Depends on | Diagrama | Status |
| --- | --- | --- | --- |
| T0 | — | raiz | ✅ |
| T1 | T0 | T0→T1 | ✅ |
| T2 | T0 | T0→T2 (∥ T1) | ✅ |
| T3 | T1 | T1→T3 | ✅ |
| T4 | T2, T3 | T2,T3→T4 | ✅ |
| T5 | T2, USP-023/T8 | T2→T5 (+ dep externa USP-023) | ✅ |

### Check 3 — Co-locação de testes

| Task | Camada | Matriz exige | Task declara | Status |
| --- | --- | --- | --- | --- |
| T1 | resolvedor de evento | unit+integração | unit+integração | ✅ |
| T2 | migração + domínio | unit (+build p/ migração) | unit | ✅ |
| T3 | use-case + rota | integração | integração | ✅ |
| T4 | helper enqueue | integração | integração | ✅ |
| T5 | UI badge | e2e | e2e | ✅ |

### Check 4 — Must-Not Ownership

| Must-Not | Owning task(s) | Teste negativo |
| --- | --- | --- |
| P-001 (on-read com job parado) | T3 | `expired-on-read.int` — `ACTIVE` vencida excluída da busca/detalhe (`@p-001`) |
| P-002 (timezone) | T3 (+ T2) | teste de fuso: expira à meia-noite BRT; `hoje(job)===hoje(query)` (`@p-002`) |
| P-004 (candidatura a expirada) | T3 (detalhe "encerrada") + herdado USP-025 | detalhe de vaga `EXPIRED` → "encerrada", sem botão (`@p-004`) |
| P-005 (sem delete físico) | T3 | após expirar, vaga+candidaturas ainda existem (`@p-005`) |
| U24-MN-06 (auth do cron) | T3 | `route.int`: sem/`Bearer` inválido → 401, zero transições (`@u24-mn-06`) |
| U24-MN-07 (idempotência) | T3 (expiração) + T4 (reminder) | 2 execuções ⇒ 1 `JOB_EXPIRED`/vaga e ≤1 Outbox/vaga (`@u24-mn-07`) |

Todo must-not ativo tem task dona + teste negativo.

---

## Rastreabilidade

| Req | Tasks |
| --- | --- |
| E-001 / AC-024-1 | T1, T3 |
| E-002 / AC-024-2 (on-read) | T3 |
| E-003 / AC-024-3 (enqueue) | T4 |
| E-004 (badge) | T2, T5 |
| P-001 | T3 |
| P-002 | T2, T3 |
| P-004 | T3 (+ herdado USP-025) |
| P-005 | T3 |
| L-001 (cadência ≤1h) | T3 (`vercel.json`) |
| L-003 (observabilidade) | T3 (logs) |
| U24-MN-06 | T3 |
| U24-MN-07 | T3, T4 |

## Ordem sugerida

`T0 → (T1 ‖ T2) → T3 → T4` · `T5` acompanha a USP-023 (painel). **Rodar USP-023 antes** simplifica T1 (só verifica).

## Facts (skill-tdad) — gerados em T0

Rodar `skill-tdad` sobre `expectations-USP-024.md` produz `.feature` (tags `@ac-024-*`, `@e-00N`, `@p-00N`,
`@u24-mn-06/07`), Vitest RED (unit + `*.int.test.ts`), esqueleto Playwright e matriz AC→fact. Fora desta US
(UAT pós-merge): D-005 (dashboard, USP-042), L-002 (SLA de entrega do e-mail, USP-044).
</content>
