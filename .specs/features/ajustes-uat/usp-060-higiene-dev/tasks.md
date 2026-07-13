# USP-060 — Higiene de dev/seed Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com a skill spec-driven do pipeline (`idsd-spec-driven` / `bravi-spec-driven`):
**ative-a pelo nome e siga o fluxo Execute e as Critical Rules.** Não busque arquivos de skill por path.
A skill é a fonte da verdade do fluxo (ciclo por-task, delegação por sub-agente, Verifier, sensor de discriminação).

**Se a skill não ativar, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/ajustes-uat/usp-060-higiene-dev/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada do codebase, das guidelines do projeto e da spec — confirmar antes do Execute.
> Guidelines encontradas: `CLAUDE.md` (Testing Requirements: matriz da Server Action, unit 90% em domínio, integração 80% em ações sensíveis), `vitest.config.ts`, `vitest.integration.config.ts`, `package.json` scripts.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Int-test de fixture (jobs/services/identity) — o próprio arquivo é o teste sendo corrigido | integration | O arquivo roda verde sob volume; cada cleanup adicionado tem asserção de remoção (contagem por nome/id == 0); asserções de remoção/segurança preservadas | `src/**/*.int.test.ts` | `npm run test:integration` |
| Guard de política da senha do seed | unit | `FIXED_PASSWORD` passa `changePassword` + `password-reset` schema (letra + número + tamanho) | `src/**/__tests__/*.test.ts` ou `prisma/__tests__/*.test.ts` | `npm run test` |
| Config/schema de env (`shared/env.ts`) | unit | Flag `EMAIL_DEV_SMTP` default false; `superRefine` LANÇA quando `VERCEL_ENV∈{production,preview}` && flag true | `src/shared/__tests__/*.test.ts` | `npm run test` |
| DI binding (`shared/container.ts`) | unit | flag off ⇒ `ResendEmailSender`; flag on ⇒ `DevSmtpEmailSender` | `src/shared/__tests__/*.test.ts` | `npm run test` |
| Adapter (`DevSmtpEmailSender`) | unit | `send` com transport injetado: `{ok:true}` no sucesso, `{ok:false}` na falha (nunca lança); nenhum corpo/PII em log | `src/shared/lib/email/__tests__/*.test.ts` | `npm run test` |
| Config/infra (`supabase/config.toml`, `.env.*`) + docs | none | — (build gate + verificação manual do harness) | — | build gate |

**Provenance:** amostrados `src/modules/services/__tests__/submit-service.int.test.ts`, `src/modules/jobs/__tests__/{archive-job,pause-job,search-jobs,submit-job-for-moderation}.int.test.ts`, `src/modules/identity/__tests__/{credential-claim,delegated-permissions}.int.test.ts`, `src/shared/lib/email/__tests__/resend-email-sender.test.ts`, `src/shared/container.ts`, `src/shared/env.ts`, `prisma/__tests__/seed.integration.test.ts`.

## Parallelism Assessment

> Gerada do codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| integration | **No** | DB Postgres compartilhado; `fileParallelism: false` no `vitest.integration.config.ts:32`; sem per-test schema/namespace | `vitest.integration.config.ts:32`; cleanup per-file por id/nome |
| unit | **Yes** | Deps mockadas/injetadas; sem backing store compartilhado; env dummy em `vitest.setup.ts` | `vitest.config.ts`, `resend-email-sender.test.ts` (client injetado) |

## Gate Check Commands

> Gerada do codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks com testes unit apenas | `npm run test` |
| Full | Após tasks que tocam int-tests | `npm run test && npm run test:integration` |
| Build | Ao fim de fase / tasks de config/docs / task com dep nova | `npm run typecheck && npm run lint && npm run test && NODE_ENV=production npm run build` |

---

## Execution Plan

As quatro fases são independentes entre si (frentes distintas); dentro de cada fase as tasks são order-free.
Testes de integração **não são parallel-safe** (DB compartilhado) ⇒ tasks das Fases A e B **não** levam `[P]`
(execução serial), embora possam ser feitas em qualquer ordem. Tasks unit da Fase D podem ser `[P]` onde não há dependência.

### Phase A: Determinismo (test-only)

```
T1
T2
```

### Phase B: Cleanup de fixtures

```
T3
T4
T5
T6
T7
```

### Phase C: Senha do seed

```
T8
```

### Phase D: Harness de e-mail dev (Sequential)

```
T9 → T10 → T11 → T12
```

---

## Task Breakdown

### T1: publishedAt nas fixtures ACTIVE de archive-job + pause-job

**What**: Nas fixtures que criam vaga ACTIVE (incl. o ramo despausa→ACTIVE), setar `publishedAt: new Date()` para espelhar a invariante de produção e tornar a asserção de página 1 determinística sob volume. **NÃO** alterar `search-jobs.ts`.
**Where**: `src/modules/jobs/__tests__/archive-job.int.test.ts` (createJob ~104-115; asserção ~119), `src/modules/jobs/__tests__/pause-job.int.test.ts` (createJob ~101-112; asserções ~116, ~148)
**Depends on**: None
**Reuses**: invariante `schema.prisma:501` (`publishedAt` na 1ª ativação); ordenação `search-jobs.ts:130`
**Requirement**: HYG-01, HYG-03 · **Must-Not**: HYG-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Fixtures ACTIVE setam `publishedAt`; asserção `toContain(job.id)` na página 1 é determinística
- [x] Asserção de remoção pós-pausa/arquivamento (`not.toContain`) preservada e real
- [x] `search-jobs.ts`/`search-services.ts` intocados
- [x] Gate full passa: `npm run test && npm run test:integration`
- [x] Test count: os testes desses 2 arquivos passam (sem deleções)

**Tests**: integration
**Gate**: full
**Commit**: `test(jobs): fixtures ACTIVE de archive/pause setam publishedAt (determinismo sob volume) (HYG-01)`

---

### T2: Escopar a contagem anti-enumeração de credential-claim

**What**: Trocar a contagem global `prisma.credentialClaim.count()` (linha 189) por contagem **escopada às fixtures do teste** (ex.: `where: { requestedEmail }` ou por `personId`), preservando a propriedade de segurança (resposta genérica + zero claim p/ CPF não elegível).
**Where**: `src/modules/identity/__tests__/credential-claim.int.test.ts:189`
**Depends on**: None
**Reuses**: padrão escopado já presente no mesmo arquivo (`:207` `count({ where: { personId } })`)
**Requirement**: HYG-02, HYG-03 · **Must-Not**: HYG-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Contagem escopada às fixtures do teste; não depende de volume global do DB
- [x] Asserção de segurança anti-enumeração inalterada (resposta genérica; zero claim p/ CPF não elegível)
- [x] Gate full passa
- [x] Test count: os testes do arquivo passam (sem deleções)

**Tests**: integration
**Gate**: full
**Commit**: `test(identity): escopa contagem de credential-claim às fixtures (anti-enum estável) (HYG-02)`

---

### T3: Cleanup de taxonomia em search-jobs.int.test.ts

**What**: No `afterAll`, deletar a JobArea `"Busca Int Área"` e as Regions `"Busca Int Região A"`/`"Busca Int Região B"` criadas, na ordem correta (após jobs/companies/persons), com asserção de remoção (contagem por nome == 0).
**Where**: `src/modules/jobs/__tests__/search-jobs.int.test.ts` (afterAll ~227-230; fixtures ~69-90)
**Depends on**: None
**Reuses**: padrão `submit-service.int.test.ts:166-180`
**Requirement**: HYG-09, HYG-11 · **Must-Not**: HYG-MN-01, HYG-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `afterAll` deleta JobArea + 2 Regions criadas por este arquivo (keyed por nome), nunca canônicas
- [x] Asserção de remoção co-locada (contagem por nome == 0)
- [x] Nenhum DELETE/UPDATE em `audit_log`
- [x] Gate full passa; `seed.integration.test.ts` verde
- [x] Test count: testes do arquivo passam (sem deleções)

**Tests**: integration
**Gate**: full
**Commit**: `test(jobs): search-jobs.int limpa JobArea/Regions próprias (PUB-6) (HYG-09)`

---

### T4: Cleanup de Regions em search-services.int.test.ts

**What**: No `afterAll`, deletar as Regions `"Busca Int Serviço Região A"`/`"Busca Int Serviço Região B"` (a categoria já é limpa hoje), com asserção de remoção.
**Where**: `src/modules/services/__tests__/search-services.int.test.ts` (afterAll ~172-176; fixtures ~57-68)
**Depends on**: None
**Reuses**: padrão `submit-service.int.test.ts:166-180`
**Requirement**: HYG-09, HYG-11 · **Must-Not**: HYG-MN-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `afterAll` deleta as 2 Regions criadas por este arquivo (keyed por nome), nunca canônicas
- [x] Asserção de remoção co-locada
- [x] Gate full passa; `seed.integration.test.ts` verde
- [x] Test count: testes do arquivo passam (sem deleções)

**Tests**: integration
**Gate**: full
**Commit**: `test(services): search-services.int limpa Regions próprias (SVC-3) (HYG-09)`

---

### T5: Cleanup de Region em submit-job-for-moderation.int.test.ts

**What**: No `afterAll`, deletar a Region `"Centro Int Submit"` (a jobArea já é limpa hoje), com asserção de remoção.
**Where**: `src/modules/jobs/__tests__/submit-job-for-moderation.int.test.ts` (afterAll ~160-163; fixtures ~90-103)
**Depends on**: None
**Reuses**: padrão `submit-service.int.test.ts:166-180`
**Requirement**: HYG-09, HYG-11 · **Must-Not**: HYG-MN-01, HYG-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `afterAll` deleta a Region criada por este arquivo (keyed por nome), nunca canônicas
- [x] Asserção de remoção co-locada; nenhum toque em `audit_log`
- [x] Gate full passa; `seed.integration.test.ts` verde
- [x] Test count: testes do arquivo passam (sem deleções)

**Tests**: integration
**Gate**: full
**Commit**: `test(jobs): submit-job.int limpa Region própria (PUB-6) (HYG-09)`

---

### T6: Cleanup de Region em submit-service.int.test.ts

**What**: No `afterAll`, deletar a Region `"Centro Int Submit Service"` (a categoria já é limpa hoje), com asserção de remoção.
**Where**: `src/modules/services/__tests__/submit-service.int.test.ts` (afterAll ~166-179; fixtures ~96-101)
**Depends on**: None
**Reuses**: o próprio padrão canônico do arquivo (estender)
**Requirement**: HYG-09, HYG-11 · **Must-Not**: HYG-MN-01, HYG-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `afterAll` deleta a Region criada por este arquivo (keyed por nome), nunca canônicas
- [x] Asserção de remoção co-locada; nenhum toque em `audit_log`
- [x] Gate full passa; `seed.integration.test.ts` verde
- [x] Test count: testes do arquivo passam (sem deleções)

**Tests**: integration
**Gate**: full
**Commit**: `test(services): submit-service.int limpa Region própria (SVC-3) (HYG-09)`

---

### T7: Teardown de Pessoas em delegated-permissions.int.test.ts

**What**: Adicionar teardown (hoje inexistente) que deleta as Pessoas `Pessoa-XXXX` criadas por `seedPerson` (rastrear ids criados; cascatear roleGrants/consents), com asserção de remoção — para que `listEligibleVolunteers()` não retorne fixtures. **Não** tocar `audit_log`.
**Where**: `src/modules/identity/__tests__/delegated-permissions.int.test.ts` (seedPerson ~33-49; beforeEach ~68-71, ~168-171; sem afterEach/afterAll hoje)
**Depends on**: None
**Reuses**: rastreio de ids + `deleteMany({ where: { id: { in: [...] } } })` (padrão submit-service)
**Requirement**: HYG-10, HYG-11 · **Must-Not**: HYG-MN-01, HYG-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `afterAll`/`afterEach` deleta todas as Pessoas criadas por este arquivo (rastreadas por id)
- [x] Asserção de remoção co-locada; nenhum DELETE/UPDATE em `audit_log`
- [x] `listEligibleVolunteers()` não retorna `Pessoa-XXXX` de teste após a suíte
- [x] Gate full passa
- [x] Test count: testes do arquivo passam (sem deleções)

**Tests**: integration
**Gate**: full
**Commit**: `test(identity): delegated-permissions.int limpa Pessoas próprias (PUB-6) (HYG-10)`

---

### T8: Senha do seed válida + docs + guard

**What**: Trocar `FIXED_PASSWORD` para `asonseg2026` (≥8, ≤72, ≥1 letra, ≥1 número); corrigir o comentário stale; atualizar o log do seed e a doc de credenciais; adicionar um teste-guarda unit que valida `FIXED_PASSWORD` contra os schemas de trocar/recuperar senha.
**Where**: `prisma/seeds/bulk.ts:33-34` (comentário + constante; exportar o valor), `prisma/seed.ts:59` (log — derivar do valor exportado quando viável), `docs/operacao/contas-de-teste-seed.md:9,13` (+ nota de re-seed), novo guard test `prisma/__tests__/seed-password.test.ts` (ou co-locado)
**Depends on**: None
**Reuses**: `changePassword.ts:12-17`, `password-reset.schema.ts:39-44`
**Requirement**: HYG-12, HYG-13 · **Must-Not**: HYG-MN-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `FIXED_PASSWORD = 'asonseg2026'`; comentário corrigido; nenhuma referência a `12345678` no código/docs de seed
- [x] Log do seed e `docs/operacao/contas-de-teste-seed.md` citam a nova senha; nota de re-seed presente
- [x] Guard unit-test: a senha do seed passa `changePassword` + `password-reset` schema
- [x] Gate quick passa: `npm run test`
- [x] Test count: guard test verde (1+ asserções)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): senha de seed válida pela política + guard + docs (AUTH-8) (HYG-12)`

---

### T9: Flag EMAIL_DEV_SMTP em env.ts (fenced) + doc CRON_SECRET

**What**: Adicionar `EMAIL_DEV_SMTP` (`z.preprocess(parseBooleanFlag, z.boolean()).default(false)`) e, opcionalmente, `EMAIL_DEV_SMTP_HOST`/`PORT` com defaults 127.0.0.1/55325; adicionar cláusula `superRefine` que LANÇA quando `VERCEL_ENV∈{production,preview}` && `EMAIL_DEV_SMTP`. Comentar `CRON_SECRET` (já opcional) para uso local. Testes unit da parse.
**Where**: `src/shared/env.ts` (flag ~88; superRefine ~96-124), teste em `src/shared/__tests__/env*.test.ts` (co-locado)
**Depends on**: None
**Reuses**: molde de `CV_EXTRACTOR_FAKE` (`env.ts:88`) e do fence `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE` (`env.ts:96-124`)
**Requirement**: HYG-04 (parcial), HYG-06 (parcial) · **Must-Not**: HYG-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `EMAIL_DEV_SMTP` default false; parse OK em dev/CI
- [x] `superRefine` LANÇA quando `VERCEL_ENV=production|preview` && `EMAIL_DEV_SMTP=true`
- [x] `RESEND_API_KEY`/`EMAIL_FROM` seguem required (prod build intocado)
- [x] Gate quick passa
- [x] Test count: testes de parse verdes (default-false + fence-trip)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): env EMAIL_DEV_SMTP dev-only fenced por VERCEL_ENV (AUTH-9) (HYG-04)`

---

### T10: DevSmtpEmailSender (adapter dev, nodemailer devDep)

**What**: Criar `DevSmtpEmailSender implements EmailSender` que renderiza o `EmailMessage`, faz `await import('nodemailer')` **dinâmico**, envia p/ o Mailpit (host/port de env, default 127.0.0.1:55325), retorna `{ok:true,id}`/`{ok:false}` (nunca lança) e **não** loga corpo/PII. Adicionar `nodemailer` + `@types/nodemailer` como **devDependencies**. Teste unit com transport injetado (sem SMTP real).
**Where**: `src/shared/lib/email/dev-smtp-email-sender.ts` (novo), teste `src/shared/lib/email/__tests__/dev-smtp-email-sender.test.ts` (novo), `package.json` (devDependencies)
**Depends on**: T9
**Reuses**: `email-sender.port.ts:159-163`, renderizadores de template, `childLogger`; estrutura injetável de `resend-email-sender.ts:74-97`
**Requirement**: HYG-04, HYG-07, HYG-08 · **Must-Not**: HYG-MN-04

**Tools**: MCP: `context7` (docs do `nodemailer`, se necessário) · Skill: NONE

**Done when**:
- [x] Implementa `EmailSender`; `import('nodemailer')` dinâmico dentro de `send()`; nunca lança
- [x] `send` retorna `{ok:true}` no sucesso e `{ok:false}` na falha (transport injetado no teste)
- [x] Não loga corpo do e-mail nem PII de terceiros (só metadados) — HYG-MN-04/U44-MN-04
- [x] `nodemailer` + `@types/nodemailer` em **devDependencies** (dev-only)
- [x] Gate build passa (prova que `nodemailer` não quebra o `NODE_ENV=production build`)
- [x] Test count: testes do adapter verdes (sucesso + falha + sem-PII-no-log)

**Tests**: unit
**Gate**: build
**Commit**: `feat(infra): DevSmtpEmailSender dev-only p/ Mailpit (import dinâmico) (AUTH-9) (HYG-04)`

---

### T11: Binding condicional do EmailSender no container

**What**: Trocar a binding incondicional (`container.ts:83`) por `env.EMAIL_DEV_SMTP ? new DevSmtpEmailSender() : new ResendEmailSender()`, espelhando o seam do CV extractor. Teste unit: flag off ⇒ Resend; flag on ⇒ DevSmtp.
**Where**: `src/shared/container.ts:80-83`, teste `src/shared/__tests__/container*.test.ts`
**Depends on**: T9, T10
**Reuses**: seam do CV extractor `container.ts:143-155`
**Requirement**: HYG-05 · **Must-Not**: HYG-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] flag off (default) ⇒ container resolve `ResendEmailSender` (prod idêntico)
- [x] flag on ⇒ container resolve `DevSmtpEmailSender`
- [x] Gate build passa
- [x] Test count: teste de binding verde (2 ramos)

**Tests**: unit
**Gate**: build
**Commit**: `feat(infra): container resolve EmailSender por EMAIL_DEV_SMTP (AUTH-9) (HYG-05)`

---

### T12: Infra local + env + docs do harness

**What**: Descomentar `smtp_port = 55325` em `supabase/config.toml`; adicionar `CRON_SECRET` (valor dev) e `EMAIL_DEV_SMTP` ao `.env.example` e `.env.local`; documentar em `docs/operacao/` como rodar o cron local (header `x-cron-secret`) e ver os e-mails no Mailpit (55324). **Sem** mudança de código de prod.
**Where**: `supabase/config.toml:104`, `.env.example` (bloco e-mail ~28-33 + novo bloco cron), `.env.local`, `docs/operacao/` (doc do harness)
**Depends on**: T11
**Reuses**: hints existentes de Mailpit no `.env.example`; `verifyCronSecret` (intocado)
**Requirement**: HYG-06 · **Must-Not**: HYG-MN-04 (cron segue fail-closed; só documenta o segredo local)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `smtp_port = 55325` exposto no `config.toml`
- [x] `.env.example`/`.env.local` documentam `CRON_SECRET` + `EMAIL_DEV_SMTP`
- [x] Doc de operação explica o cron local + Mailpit; nenhum código de cron/prod alterado
- [x] Gate build passa
- [x] Test count: n/a (config/docs — build gate)

**Tests**: none
**Gate**: build
**Commit**: `docs(infra): harness de e-mail local (Mailpit smtp + CRON_SECRET local) (REL-4) (HYG-06)`

---

## Parallel Execution Map

```
Phase A (Determinismo — serial, integration não-parallel-safe):
  T1 ; T2   (order-free, sem dep)

Phase B (Cleanup — serial, integration não-parallel-safe):
  T3 ; T4 ; T5 ; T6 ; T7   (order-free, sem dep)

Phase C (Senha do seed):
  T8

Phase D (Harness de e-mail — sequential):
  T9 ──→ T10 ──→ T11 ──→ T12
```

**Parallelism constraint:** as Fases A e B são de testes de integração (**não** parallel-safe: DB compartilhado, `fileParallelism:false`) ⇒ sem `[P]`, execução serial mesmo sem dependência de código. Fase D é sequencial por dependência de código.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: publishedAt em 2 fixtures ACTIVE (jobs) | 1 correção coesa, 2 arquivos irmãos | ✅ Granular (coeso) |
| T2: escopar 1 contagem | 1 linha | ✅ Granular |
| T3: cleanup 1 arquivo | 1 afterAll | ✅ Granular |
| T4: cleanup 1 arquivo | 1 afterAll | ✅ Granular |
| T5: cleanup 1 arquivo | 1 afterAll | ✅ Granular |
| T6: cleanup 1 arquivo | 1 afterAll | ✅ Granular |
| T7: teardown 1 arquivo | 1 teardown | ✅ Granular |
| T8: senha do seed + docs + guard | 1 conceito (senha), arquivos co-relacionados + guard co-locado | ✅ Granular (coeso) |
| T9: 1 flag de env + fence + teste | 1 arquivo de config | ✅ Granular |
| T10: 1 adapter + teste + devDep | 1 componente | ✅ Granular |
| T11: 1 binding + teste | 1 ponto no container | ✅ Granular |
| T12: config + env + docs | infra/docs coesas do harness | ✅ Granular (coeso) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | — (Phase A raiz) | ✅ Match |
| T2 | None | — (Phase A raiz) | ✅ Match |
| T3 | None | — (Phase B raiz) | ✅ Match |
| T4 | None | — (Phase B raiz) | ✅ Match |
| T5 | None | — (Phase B raiz) | ✅ Match |
| T6 | None | — (Phase B raiz) | ✅ Match |
| T7 | None | — (Phase B raiz) | ✅ Match |
| T8 | None | — (Phase C raiz) | ✅ Match |
| T9 | None | T9 → T10 | ✅ Match |
| T10 | T9 | T9 → T10 → T11 | ✅ Match |
| T11 | T9, T10 | T10 → T11 (T9 transitivo via T10) | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | int-test (jobs) | integration | integration | ✅ OK |
| T2 | int-test (identity) | integration | integration | ✅ OK |
| T3 | int-test (jobs) | integration | integration | ✅ OK |
| T4 | int-test (services) | integration | integration | ✅ OK |
| T5 | int-test (jobs) | integration | integration | ✅ OK |
| T6 | int-test (services) | integration | integration | ✅ OK |
| T7 | int-test (identity) | integration | integration | ✅ OK |
| T8 | seed (config) + guard unit | unit (guard) | unit | ✅ OK |
| T9 | env schema (config) | unit | unit | ✅ OK |
| T10 | adapter (shared lib) | unit | unit | ✅ OK |
| T11 | DI binding (container) | unit | unit | ✅ OK |
| T12 | config.toml/.env/docs | none | none | ✅ OK |

---

## Must-Not Ownership (Check 4)

| Must-Not | Owning task(s) | Negative test (Done-when) |
| -------- | -------------- | ------------------------- |
| HYG-MN-01 (não deletar taxonomia canônica / demo CNPJ) | T3, T4, T5, T6, T7 | Deletes keyed por nomes de fixture; `seed.integration.test.ts` verde após a suíte |
| HYG-MN-02 (não DELETE/UPDATE em `audit_log`) | T3, T5, T6, T7 | Nenhum cleanup toca `audit_log`; `append-only.int.test.ts` verde |
| HYG-MN-03 (não enfraquecer remoção nem anti-enum) | T1, T2 | Mutação: pausar/arquivar não remove ⇒ falha; claim p/ CPF não elegível ⇒ contagem escopada > 0 ⇒ falha |
| HYG-MN-04 (prod nunca resolve dev / cron fail-closed / flag não vaza) | T9, T10, T11 | `env` LANÇA com `VERCEL_ENV=production` && flag true; container resolve Resend com flag false; adapter não loga corpo/PII |
| HYG-MN-05 (senha do seed válida pela política) | T8 | Guard: `FIXED_PASSWORD` passa `changePassword` + `password-reset` schema |

**Todos os 5 must-nots têm task dona + teste negativo.** ✅

---

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. `Done when` binário/testável, referenciando o comando de gate.
Contagem de testes esperada por task previne deleções silenciosas. **Sem migração de schema.** Única dep nova:
`nodemailer` + `@types/nodemailer` como **devDependencies** (dev-only, T10).
