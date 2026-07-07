# Fase 0 — Fundação · Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com a skill **`idsd-spec-driven`** (equivalente `bravi-spec-driven`):
**ative-a pelo nome** e siga o fluxo Execute + Critical Rules. Não procure arquivos da skill por
caminho de filesystem. A skill é a fonte da verdade do fluxo (ciclo por-task, delegação de
sub-agente, review de adequação, Verifier, sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

Uma tarefa da esteira produz o código; o **Verifier independente** (autor ≠ verificador) roda
automaticamente após a última task. O Planner NÃO roda o Verifier nem escreve código de produto.

---

**Design**: `.specs/features/fase-0-fundacao/design.md`
**Spec**: `.specs/features/fase-0-fundacao/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas:
> `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md`, `vitest.config.ts`,
> `vitest.integration.config.ts`, `package.json` (scripts). Padrão de guarda estática:
> `src/modules/companies/__tests__/no-external-verify.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Guarda estática de arquitetura (barrel, raiz fechada, anti-segredo) | unit | Todos os caminhos de violação; `expect(offenders).toEqual([])` | `src/**/__tests__/*.test.ts` | `npm run test` |
| Seed de referência (taxonomia) | integration | Popula `regions`/`job_areas`/`service_categories`; idempotente (2×, contagem estável); `is_suggestion=false`; região `is_active` | `prisma/__tests__/*.integration.test.ts` | `npm run test:integration` |
| Query de moderação (checklist seedável) | integration | Itens ativos ordenados + fallback quando tabela vazia | `src/modules/moderation/__tests__/*.int.test.ts` | `npm run test:integration` |
| Doc estrutural (checklist, runbook) | unit | Arquivo existe + seções/critérios obrigatórios presentes | `tests/docs/*.test.ts` | `npm run test` |
| Client/config/schema/migration/nota-ADR/seed-entrypoint | none | build gate only | — | build gate |

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (guardas + doc estrutural) | Yes | Leitura pura de fs / `git ls-files`; sem estado mutável compartilhado | `no-external-verify.test.ts` (só `readFileSync`, sem DB) |
| integration (seed + query) | No | Postgres local compartilhado; cleanup por tabela no setup/teardown | `*.int.test.ts` do projeto; MEMORY: cleanup apaga seed se compartilhar chave |

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Após tasks só com unit | `npm run test` |
| Full | Após tasks com integração | `npm run test && npm run test:integration` |
| Build | Fim de fase / tasks config/schema-only | `npm run build && npm run lint && npm run typecheck && npm run test` |

---

## Execution Plan

3 fases → execução inline (sem oferta de sub-agente por fase; o gatilho é >3 fases). O Verifier
independente roda automaticamente após a última task.

### Phase 1 — WS-A · Scaffolding (paralelizável, A3 destrava a Phase 2)

```
A1 [P]   A2 [P]   A4 [P]   A5 [P]
A3 ───────────────────────────────→ (gate da Phase 2)
```

### Phase 2 — WS-B · Seed + Checklist US-111 (integração = sequencial)

```
A3 ──→ B1 ──→ B2
A3 ──→ B3
B4 [P]  (independente do doc já existente)
```

### Phase 3 — WS-C · Runbook (independente, unit = paralelo)

```
C1 [P]   C2 [P]
```

---

## Task Breakdown

### T-A1: Corrigir deep-imports de módulo + guarda de barrel [P]

**What**: Rotear os 3 imports profundos de `persons/components/*form.tsx` pelo barrel de `identity` e
adicionar guarda estática que proíbe `@/modules/<x>/<subpath>` em `src/modules/**`.
**Where**: `src/modules/persons/components/{candidate-form,provider-form}.tsx` (modificar);
`src/modules/identity/index.ts` (exportar `activateAdditionalRole`, `PROFILE_FIELD_META`, `ProfileField`
se ainda não exportados); `src/__tests__/no-deep-module-imports.test.ts` (novo).
**Depends on**: None
**Reuses**: `src/modules/companies/__tests__/no-external-verify.test.ts` (padrão de guarda).
**Requirement**: F0A-01, F0-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Os 3 imports em `persons/components/*form.tsx` resolvem via `@/modules/identity`.
- [ ] Guarda varre `src/modules/**`, ignora `__tests__`, exclui `src/shared/container.ts`, `offenders===[]`.
- [ ] `npm run typecheck` e `npm run build` verdes (imports não quebraram).
- [ ] Gate: `npm run build && npm run lint && npm run typecheck && npm run test`.
- [ ] Test count: guarda +1 arquivo (≥1 teste) passa.

**Tests**: unit · **Gate**: build
**Commit**: `refactor(persons): rotear imports de identity via barrel + guarda de deep-import`

---

### T-A2: Fechar a raiz `src/` + guarda [P]

**What**: Realocar `src/__tests__/middleware.test.ts` para um local conforme (co-localizar como
`src/middleware.test.ts` ou mover para `tests/unit/`) e adicionar guarda que exige só
`app`/`modules`/`shared` como pastas de topo de `src/`.
**Where**: remover `src/__tests__/` (mover o teste); `src/shared/__tests__/closed-src-root.test.ts` (novo).
**Depends on**: None
**Reuses**: padrão `no-external-verify.test.ts`; confirmar `vitest.config.ts` include cobre o novo local.
**Requirement**: F0A-02, F0-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `src/__tests__/` não existe mais; o teste de middleware roda no novo local.
- [ ] Guarda: `readdirSync('src')` (dirs) ⊆ `['app','modules','shared']`, senão falha.
- [ ] Gate: `npm run build && npm run lint && npm run typecheck && npm run test`.
- [ ] Test count: middleware test preservado + guarda +1.

**Tests**: unit · **Gate**: build
**Commit**: `refactor(infra): fechar raiz src/ (realocar __tests__) + guarda estrutural`

---

### T-A3: Split do seed em `prisma/seeds/` (referência vs demo)

**What**: Separar `prisma/seed.ts` em `prisma/seeds/reference.ts` (taxonomia idempotente, prod-safe) e
`prisma/seeds/demo.ts` (demo dev-only), com `prisma/seed.ts` como entrypoint fino.
**Where**: `prisma/seed.ts` (reduzir a entrypoint); `prisma/seeds/reference.ts`, `prisma/seeds/demo.ts`
(novos); `package.json` (`prisma.seed` aponta ao entrypoint se necessário).
**Depends on**: None
**Reuses**: funções atuais `seedRegions`/`seedJobAreas`/`seedServiceCategories` (→ reference),
`seedDemoJobs`/`seedDemoApplications` (→ demo), movidas 1:1.
**Requirement**: F0A-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `main()` chama reference sempre; demo só fora de produção.
- [ ] `npm run db:seed` roda sem erro contra o banco local (verificação manual/CI).
- [ ] Gate: `npm run build && npm run lint && npm run typecheck && npm run test`.

**Tests**: none (validado por T-B1 integração + gate `db:seed`) · **Gate**: build
**Commit**: `refactor(infra): split prisma/seed em seeds/reference + seeds/demo`

---

### T-A4: Client de Supabase Storage [P]

**What**: Adicionar `supabase-storage.ts` em `src/shared/lib/supabase/` (client de Storage, ADR-0005),
ou registrar deferimento explícito se nenhum consumidor existir ainda.
**Where**: `src/shared/lib/supabase/supabase-storage.ts` (novo).
**Depends on**: None
**Reuses**: `src/shared/lib/supabase/{browser,server}.ts` (padrão de client).
**Requirement**: F0A-04

**Tools**: MCP: `context7` (API atual do Supabase Storage JS) · Skill: NONE

**Done when**:
- [ ] Client exportado seguindo o padrão dos clients existentes; `npm run typecheck`/`build` verdes.
- [ ] Se deferido: comentário/nota explicando o gatilho (primeiro consumidor: USP-040/consent-terms).
- [ ] Gate: `npm run build && npm run lint && npm run typecheck && npm run test`.

**Tests**: none (config/infra layer, build gate) · **Gate**: build
**Commit**: `feat(infra): adiciona client de Supabase Storage (ADR-0005)`

---

### T-A5: Nota de conformidade (ADR/doc) [P]

**What**: Documentar as exceções e a localização real: carve-out do deep-import do `container.ts`,
localização dos ADRs (`docs/arch/` e não `docs/adr/`), dívida `runbooks/` ausente, e o **deferimento
documentado** dos módulos ausentes (`services`/`referrals`/`cv-extraction`) e skeletais
(`reporting`/`persons`) às USPs donas (AD-005/AD-009).
**Where**: `docs/arch/0017-conformidade-fundacao-fase-0.md` (ou nota equivalente indexada pelo runbook).
**Depends on**: None
**Reuses**: A tabela Risks & Concerns do design.
**Requirement**: F0A-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Doc lista cada exceção/deferimento com o racional e a decisão ativa que o justifica.
- [ ] Gate: `npm run test` (build da doc não aplicável; sem código).

**Tests**: none (doc) · **Gate**: quick
**Commit**: `docs(infra): nota de conformidade de fundação (Fase 0)`

---

### T-B1: Teste de integração do seed — AC-111-1 / F0-MN-01

**What**: Escrever `prisma/__tests__/seed.integration.test.ts`: rodar o seed de referência 2× contra
banco efêmero e assertar populado + **idempotente** (contagem estável) + `is_suggestion=false` +
regiões `is_active=true`.
**Where**: `prisma/__tests__/seed.integration.test.ts` (novo).
**Depends on**: T-A3
**Reuses**: `prisma/seeds/reference.ts` (T-A3); padrão dos `*.int.test.ts` do projeto (cleanup/isolamento).
**Requirement**: US-111 / AC-111-1, F0-MN-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Caso `popula-taxonomia`: as 3 tabelas ficam não-vazias com `is_suggestion=false` e região ativa.
- [ ] Caso `idempotente` (**teste negativo F0-MN-01**): 2ª execução NÃO altera as contagens.
- [ ] Gate: `npm run test && npm run test:integration`.
- [ ] Test count: ≥2 casos passam.

**Tests**: integration · **Gate**: full
**Commit**: `test(infra): integração idempotente do seed de taxonomia (AC-111-1)`

---

### T-B2: Alinhar dado do seed a `taxonomia-inicial.md` + pinar nomes

**What**: Garantir que `prisma/seeds/reference.ts` semeia exatamente as listas canônicas de
`docs/operacao/taxonomia-inicial.md` e pinar os nomes canônicos nos `it.todo` do teste de T-B1.
**Where**: `prisma/seeds/reference.ts` (ajustar dado); `prisma/__tests__/seed.integration.test.ts`
(preencher os `it.todo` com os nomes canônicos).
**Depends on**: T-B1
**Reuses**: `docs/operacao/taxonomia-inicial.md` (fonte de verdade, A-08).
**Requirement**: US-111 / AC-111-1

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Seed contém as 10 regiões + 12 áreas + 10 categorias do doc (nomes idênticos).
- [ ] Teste assevera o conjunto de nomes canônicos (não só não-vazio).
- [ ] Gate: `npm run test && npm run test:integration`.

**Tests**: integration · **Gate**: full
**Commit**: `feat(infra): alinhar seed de taxonomia à lista canônica (AC-111-1)`

---

### T-B3: Checklist de verificação como dado seedável — F0B-01 / F0-MN-04

**What**: Introduzir o modelo `VerificationChecklistItem` (migração), semeá-lo em `prisma/seeds/` a
partir dos itens de `docs/operacao/checklist-empresa-fantasma.md` + da const atual, expor
`listVerificationChecklistItems()` via query/port no barrel `@/modules/moderation`, rewire do
`VerificationPanel` para ler dessa fonte (com fallback à const), e guarda F0-MN-04 (nenhum literal de
item no JSX).
**Where**: `prisma/schema.prisma` + migração; `prisma/seeds/reference.ts` (seed dos itens);
`src/modules/moderation/queries/list-verification-checklist.ts` (novo);
`src/modules/moderation/domain/verification-checklist.ts` (vira fonte-seed + fallback);
`src/modules/moderation/index.ts` (barrel); `src/shared/container.ts` (binding se usar port);
componente `VerificationPanel` (ler da query); guarda `src/modules/moderation/__tests__/checklist-config.test.ts`.
**Depends on**: T-A3
**Reuses**: modelo de referência `JobArea`/`ServiceCategory` (forma seedável); container DI; padrão de guarda.
**Requirement**: F0B-01, F0-MN-04

**Tools**: MCP: `context7` (Prisma migrate) · Skill: NONE

**Done when**:
- [ ] Migração cria `verification_checklist_items`; seed idempotente por `code`.
- [ ] `listVerificationChecklistItems()` retorna ativos ordenados; fallback à const quando vazio.
- [ ] `VerificationPanel` consome a query; **teste negativo F0-MN-04**: guarda confirma que o JSX não
      contém os labels literais (itens vêm da fonte seedável → troca sem redeploy).
- [ ] Gate: `npm run test && npm run test:integration`.
- [ ] Test count: query (integração) + guarda (unit) passam.

**Tests**: integration · **Gate**: full
**Commit**: `feat(moderation): itens da checklist de verificação como dado seedável (F0B-01/B-004)`

---

### T-B4: Teste estrutural do doc de checklist — AC-111-2 [P]

**What**: Escrever `tests/docs/checklist-empresa-fantasma.test.ts` que ancora o doc existente:
arquivo existe + contém os critérios verificáveis (CNPJ, razão social, endereço, aprovar/rejeitar com motivo).
**Where**: `tests/docs/checklist-empresa-fantasma.test.ts` (novo). Confirmar `vitest.config.ts` include
cobre `tests/docs/**` (senão ajustar include).
**Depends on**: None
**Reuses**: `docs/operacao/checklist-empresa-fantasma.md` (já existe); caminho da `traceability.md` upstream.
**Requirement**: US-111 / AC-111-2

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Caso `existe`: o arquivo do doc é encontrado.
- [ ] Caso `criterios`: o texto casa CNPJ, razão social, endereço, e decisão aprovar/rejeitar.
- [ ] Gate: `npm run test`.
- [ ] Test count: ≥2 casos passam.

**Tests**: unit · **Gate**: quick
**Commit**: `test(infra): teste estrutural do checklist de empresa-fantasma (AC-111-2)`

---

### T-C1: Runbook de provisionamento externo — F0C-01 [P]

**What**: Escrever `docs/infra/fase-0-provisioning-runbook.md`: por serviço (Vercel, Supabase, Resend,
Sentry, Turnstile, Anthropic) + restore drill B2 + 3 spikes, uma linha com **estado atual /
provisionar manualmente / verificar**, cross-linkando `docs/infra/*` e `docs/spikes/*` (sem duplicar).
Incluir os achados: Sentry SDK ausente (Fase 6), Anthropic/cv-extraction ausente (USP-040), mismatch
`B2_APPLICATION_KEY`×`B2_APP_KEY`, `B2_*` ausente em `.env.local/.staging`, e a **rotação pendente** de
`.env.staging` (owner external). Teste estrutural do runbook.
**Where**: `docs/infra/fase-0-provisioning-runbook.md` (novo); `tests/docs/fase-0-runbook.test.ts` (novo).
**Depends on**: None
**Reuses**: reconciliação WS-C do design (Risks & Concerns); docs `docs/infra/*`, `docs/spikes/*`.
**Requirement**: F0C-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Runbook cobre os 6 serviços + restore drill + 3 spikes com as 3 colunas e cross-links.
- [ ] Teste estrutural confirma uma seção por serviço + colunas obrigatórias.
- [ ] Gate: `npm run test`.

**Tests**: unit (doc estrutural) · **Gate**: quick
**Commit**: `docs(infra): runbook de provisionamento externo (Fase 0)`

---

### T-C2: Guarda anti-segredo (defensiva) — F0C-02 / F0-MN-05 [P]

> **Premissa corrigida pelo orquestrador (verificado no git):** `.env.staging` **NÃO está tracked**
> (0 commits no histórico, `git ls-files` limpo) e já está no `.gitignore` (linha 31). **Não há
> vazamento** — o único `.env*` tracked é `.env.example` (placeholders). Logo NÃO há `git rm --cached`
> a fazer nem credencial a rotacionar. T-C2 reduz-se à guarda defensiva (defense-in-depth) + confirmar
> a cobertura do `.gitignore`.

**What**: Adicionar guarda estática que falha se algum arquivo **tracked** contiver credencial **real**,
com **allowlist** dos valores legítimos que NÃO são segredo: `.env.example` (placeholders), o **JWT demo
público do Supabase** (issuer `supabase-demo`, usado no CI e nos docs) e chaves fake de CI (`sk-ant-ci`,
`ci-service`, `re_dummy`, test keys `1x0000…` do Turnstile). Confirmar que `.gitignore` cobre `.env*`
exceto `.env.example`.
**Where**: `src/shared/__tests__/no-committed-secrets.test.ts` (novo); `.gitignore` (confirmar, já cobre).
**Depends on**: None
**Reuses**: padrão `no-external-verify.test.ts`; `git ls-files` para o conjunto tracked.
**Requirement**: F0C-02, F0-MN-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Guarda varre tracked files por padrões de credencial **real** (senha ≥6 chars em URL de pooler,
      `sk-ant-` seguido de material real, `service_role` JWT que **não** seja o demo `supabase-demo`,
      `re_` real), com allowlist acima, `offenders===[]`. **Passa VERDE de imediato** (nada tracked vaza).
- [ ] Guarda NÃO acusa `.env.example`, o JWT demo do Supabase, nem as chaves fake do CI.
- [ ] `.gitignore` confirmadamente cobre `.env*` exceto `.env.example`.
- [ ] Gate: `npm run build && npm run lint && npm run typecheck && npm run test`.

**Tests**: unit · **Gate**: build
**Commit**: `chore(infra): untrack .env.staging + guarda anti-segredo`

---

## Parallel Execution Map

```
Phase 1 (WS-A):
  A3 ──────────────→ (destrava Phase 2)
  A1 [P]  A2 [P]  A4 [P]  A5 [P]   (order-free entre si)

Phase 2 (WS-B):
  A3 done, então:
    B1 ──→ B2        (integração = sequencial; B2 pina nomes no teste de B1)
    B3               (integração; sequencial vs B1/B2 — mesmo DB)
    B4 [P]           (unit, independente do doc já existente)

Phase 3 (WS-C):
  C1 [P]  C2 [P]     (unit, order-free)
```

**Parallelism constraint:** tasks de **integração** (B1/B2/B3) NÃO são parallel-safe (Postgres
compartilhado) → sequenciais dentro da Phase 2 mesmo sem dependência de código. Tasks unit
(A1/A2/A4/A5, B4, C1/C2) são order-free (`[P]`).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T-A1 | 3 imports + 1 barrel + 1 guarda (coeso) | ✅ Granular |
| T-A2 | 1 realocação + 1 guarda | ✅ Granular |
| T-A3 | 1 split de arquivo (3 arquivos, 1 conceito) | ✅ Granular |
| T-A4 | 1 client | ✅ Granular |
| T-A5 | 1 doc | ✅ Granular |
| T-B1 | 1 arquivo de teste de integração | ✅ Granular |
| T-B2 | 1 ajuste de dado + pin no teste | ✅ Granular |
| T-B3 | 1 modelo + seed + query + rewire + guarda (coeso p/ 1 capability) | ⚠️ OK se coeso — maior task; manter atômica ao redor de "checklist seedável" |
| T-B4 | 1 teste de doc | ✅ Granular |
| T-C1 | 1 runbook + 1 teste de doc | ✅ Granular |
| T-C2 | 1 untrack + 1 guarda | ✅ Granular |

> T-B3 é a maior; se durante o Execute passar de ~5 passos com dependências, dividir em B3a (modelo +
> seed + query) e B3b (rewire UI + guarda) conforme o safety valve da skill.

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
| ---- | ------------------ | --------------- | ------ |
| T-A1 | None | — (Phase 1, [P]) | ✅ Match |
| T-A2 | None | — (Phase 1, [P]) | ✅ Match |
| T-A3 | None | destrava Phase 2 | ✅ Match |
| T-A4 | None | — (Phase 1, [P]) | ✅ Match |
| T-A5 | None | — (Phase 1, [P]) | ✅ Match |
| T-B1 | T-A3 | A3 → B1 | ✅ Match |
| T-B2 | T-B1 | B1 → B2 | ✅ Match |
| T-B3 | T-A3 | A3 → B3 | ✅ Match |
| T-B4 | None | [P] | ✅ Match |
| T-C1 | None | [P] | ✅ Match |
| T-C2 | None | [P] | ✅ Match |

---

## Test Co-location Validation

| Task | Layer criado/modificado | Matriz exige | Task diz | Status |
| ---- | ----------------------- | ------------ | -------- | ------ |
| T-A1 | Guarda estática | unit | unit | ✅ OK |
| T-A2 | Guarda estática | unit | unit | ✅ OK |
| T-A3 | Seed entrypoint (config) | none (build) | none | ✅ OK |
| T-A4 | Client/config | none (build) | none | ✅ OK |
| T-A5 | Doc | none | none | ✅ OK |
| T-B1 | Seed de referência (integração) | integration | integration | ✅ OK |
| T-B2 | Seed de referência (integração) | integration | integration | ✅ OK |
| T-B3 | Query de moderação + guarda | integration (maior) | integration | ✅ OK |
| T-B4 | Doc estrutural | unit | unit | ✅ OK |
| T-C1 | Doc estrutural | unit | unit | ✅ OK |
| T-C2 | Guarda estática | unit | unit | ✅ OK |

---

## Must-Not Ownership

| Must-Not | Owning task | Teste negativo (em `Done when`) | Status |
| -------- | ----------- | ------------------------------- | ------ |
| F0-MN-01 (idempotência do seed) | T-B1 | `::idempotente` — 2ª execução não altera contagens | ✅ Coberto |
| F0-MN-02 (barrel) | T-A1 | guarda `no-deep-module-imports` | ✅ Coberto |
| F0-MN-03 (raiz fechada) | T-A2 | guarda `closed-src-root` | ✅ Coberto |
| F0-MN-04 (checklist sem redeploy) | T-B3 | guarda `checklist-config` (JSX sem literais) + query da fonte seedável | ✅ Coberto |
| F0-MN-05 (segredos versionados) | T-C2 | guarda `no-committed-secrets` | ✅ Coberto |

> Todas as 5 must-nots têm task dona e teste negativo. Nota: a guarda de F0-MN-05 passa **VERDE de
> imediato** — verificado que `.env.staging` não está tracked e nada tracked vaza segredo real (a
> premissa de "untrack" do plano original foi corrigida na T-C2).

---

## Tools por task (resumo)

- **context7 MCP**: T-A4 (Supabase Storage JS), T-B3 (Prisma migrate). Demais: NONE.
- **Skills**: NONE por task (a skill de teste-fonte já produziu os facts upstream da US-111; os testes
  desta unidade são guardas/integração/doc escritos direto no Execute).
