# USP-051 — Robustez de Formulários — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com a **skill spec-driven do projeto** (`bravi-spec-driven`,
ou `idsd-spec-driven` no pipeline do orquestrador): **ative-a pelo nome** e siga o
fluxo **Execute** e as **Critical Rules** (ciclo por task, teste ancorado no spec,
gate verde antes de "done", 1 commit atômico por task, sem enfraquecer/apagar
testes, Verifier independente ao final). Não procure arquivos de skill por caminho
de filesystem.

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/ajustes-uat/usp-051-robustez-forms/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes de Execute. Guidelines
> encontradas: `CLAUDE.md` (§Testing Requirements: happy/validação/edge; Vitest
> unit/integration, Playwright E2E; cobertura 70%/CI≥65%), `vitest.config.*`,
> amostras (`LoginForm.test.tsx`, `publish-job.schema.spec.ts`, `job-form.spec.tsx`,
> `CvUploadForm.test.tsx`, `securityHeaders.test.ts`, `redefinir-senha/page.test.tsx`).
> E2E autenticado **diferido** (lição L-007 — repo sem seed de sessão Supabase no
> Playwright; cobertura autoritativa em unit/component/page + build gate).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Client Component (React/RHF) | unit (RTL) | Todos os ACs da story + edge cases listados; presença de atributo (`method`/`noValidate`) e comportamento (dispatch/guard) | `src/modules/**/__tests__/*.{test,spec}.tsx` | `npm run test` |
| Domain / schema (Zod, lib pura) | unit | 1:1 aos ACs; todos os edge cases (vazio/inválido/dev/prod); must-nots com teste negativo | `src/**/__tests__/*.{spec,test}.ts` | `npm run test` |
| Route / page (RSC) | unit (page test) | Ramos `primeiroAcesso` true/false + sem sessão | `src/app/**/*.test.tsx` | `npm run test` |
| Config (`next.config.ts`) | unit (assert de config) | `bodySizeLimit` definido e ≥ `MAX_CV_BYTES` | `src/**/__tests__/*.test.ts` (import da config raiz) | `npm run test` + `npm run build` |
| E2E (fluxos autenticados) | none (diferido L-007) | — (build gate + cobertura unit/component) | — | — |

## Parallelism Assessment

> Gerada de codebase — confirmar antes de Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (RTL component) | Yes | jsdom por arquivo, todas as Server Actions/`next/navigation` mockadas; sem store compartilhado | `LoginForm.test.tsx`, `CvUploadForm.test.tsx`, `job-form.spec.tsx` |
| unit (schema/lib) | Yes | Funções puras; `vi.stubEnv` isolado por teste com `unstubAllEnvs` | `publish-job.schema.spec.ts`, `securityHeaders.test.ts` |
| unit (page RSC) | Yes | `getCurrentPerson` mockado; sem DB real | `redefinir-senha/page.test.tsx`, `login/page.test.tsx` |
| unit (config) | Yes | Import estático de objeto; sem IO | — (novo) |

Todas as tasks são parallel-safe → `[P]` permitido (a única ordem é a dependência
de código T2→T3).

## Gate Check Commands

> Gerada de codebase — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks com só testes unit de componente/schema | `npm run test` |
| Full | Após tasks de componente/schema com impacto de tipos | `npm run typecheck && npm run test` |
| Build | Após tasks de config/RSC (e ao fim da fase) | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Correções independentes (Parallel OK)

Cada task toca um arquivo/concern distinto; testes parallel-safe.

```
├── T1 [P]  securityHeaders — CSP unsafe-eval só em dev
├── T2 [P]  publish-job.schema — guard de data inválida
├── T4 [P]  LoginForm — method=post
├── T5 [P]  demais forms de credencial — method=post
├── T6 [P]  next.config — bodySizeLimit 6mb
├── T7 [P]  CvUploadForm — guard client de tamanho
└── T8 [P]  trocar-senha/page — texto condicional
```

### Phase 2: Dependente do schema (Sequential)

```
T2 ──→ T3   (job-form noValidate; o teste de submit c/ data vazia depende do fix do schema)
```

2 fases → execução inline (sem sub-agentes de fase).

---

## Task Breakdown

### T1: CSP libera `unsafe-eval` apenas em desenvolvimento [P]

**What**: Em `buildCsp`, adicionar `'unsafe-eval'` ao `script-src` só quando
`NODE_ENV === 'development'`; incluir o flag de ambiente na `cacheKey`.
**Where**: `src/shared/lib/securityHeaders.ts`
**Depends on**: None
**Reuses**: estrutura/memoização existentes de `buildCsp`
**Requirement**: RF-02, RF-MN-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `script-src` inclui `'unsafe-eval'` com `NODE_ENV='development'`.
- [ ] `script-src` **não** inclui `'unsafe-eval'` com `NODE_ENV='production'` e `'test'` (RF-MN-02).
- [ ] `cacheKey` inclui o flag de ambiente (memoização correta ao alternar env).
- [ ] Contrato existente preservado: `securityHeaders.test.ts` verde sem alteração de asserts.
- [ ] Novos testes usando `vi.stubEnv('NODE_ENV', …)` + `vi.unstubAllEnvs()`.
- [ ] Gate: `npm run typecheck && npm run test`.
- [ ] Test count: suíte de `securityHeaders` +≥2 (dev/prod), 0 deleções.

**Tests**: unit · **Gate**: full
**Commit**: `fix(infra): CSP libera unsafe-eval apenas em desenvolvimento (ORQ-2)`

---

### T2: `publishJobSchema` não lança em validade vazia/inválida [P]

**What**: Guardar `new Date(data.validUntil)` inválida antes de chamar
`validadeStatus` no `superRefine`.
**Where**: `src/modules/jobs/schemas/publish-job.schema.ts`
**Depends on**: None
**Reuses**: `validadeStatus` (intacta), mensagens existentes
**Requirement**: RF-03, RF-MN-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `publishJobSchema.safeParse({…, validUntil:''})` **não lança** e retorna `success:false` com issue em `validUntil` (RF-MN-03).
- [ ] `safeParse` com `validUntil` não parseável (ex.: `'2020-13-40'`) também não lança.
- [ ] Contrato preservado: passado (`'2020-01-01'`), excede teto, happy path continuam com o mesmo veredito — `publish-job.schema.spec.ts` verde.
- [ ] Novo teste negativo `expect(() => …).not.toThrow()`.
- [ ] Gate: `npm run typecheck && npm run test`.
- [ ] Test count: `publish-job.schema.spec.ts` +≥2, 0 deleções.

**Tests**: unit · **Gate**: full
**Commit**: `fix(jobs): publishJobSchema não lança em validade vazia (EMP-1)`

---

### T3: `noValidate` no formulário de vaga

**What**: Adicionar `noValidate` ao `<form>` do `JobForm`; validar que a data vazia
rende erro PT-BR inline (sem tooltip nativo, sem crash).
**Where**: `src/modules/jobs/components/job-form.tsx`
**Depends on**: T2 (o teste de submit com validade vazia depende do schema não lançar)
**Reuses**: padrão `noValidate` dos forms de auth
**Requirement**: RF-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `<form>` do `JobForm` tem `noValidate`.
- [ ] Teste: submeter "Enviar para moderação" com `validUntil` vazio exibe "Data de validade é obrigatória." inline (sem crash).
- [ ] Contrato preservado: `job-form.spec.tsx` (sugerir área, restyle DS, submit/rascunho) verde.
- [ ] Gate: `npm run typecheck && npm run test`.
- [ ] Test count: `job-form.spec.tsx` +≥1, 0 deleções.

**Tests**: unit · **Gate**: full
**Commit**: `fix(jobs): noValidate no formulário de vaga p/ validação PT-BR (EMP-6)`

---

### T4: `method="post"` no `LoginForm` [P]

**What**: Adicionar `method="post"` ao `<form>` do login (inerte pós-hidratação).
**Where**: `src/modules/identity/components/LoginForm.tsx`
**Depends on**: None
**Reuses**: RHF `handleSubmit` (`preventDefault`)
**Requirement**: RF-01, RF-MN-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `<form>` do `LoginForm` tem `method="post"` (RF-MN-01 — teste negativo: assert `toHaveAttribute('method','post')`).
- [ ] Contrato preservado: `LoginForm.test.tsx` (caminho feliz, CAPTCHA adaptativo, mensagem única) verde.
- [ ] Gate: `npm run test`.
- [ ] Test count: `LoginForm.test.tsx` +1, 0 deleções.

**Tests**: unit · **Gate**: quick
**Commit**: `fix(identity): method=post no LoginForm evita fallback GET (ORQ-3)`

---

### T5: `method="post"` nos demais formulários de credencial [P]

**What**: Adicionar `method="post"` aos `<form>` de `ChangePasswordForm`,
`PasswordResetForm` e `PasswordResetRequestForm` (defesa em profundidade).
**Where**: `src/modules/identity/components/{ChangePasswordForm.tsx, password-reset-form.tsx, password-reset-request-form.tsx}`
**Depends on**: None
**Reuses**: RHF `handleSubmit` (`preventDefault`)
**Requirement**: RF-01, RF-MN-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Os três `<form>` têm `method="post"` (RF-MN-01 — teste negativo por form: assert `method="post"`).
- [ ] Contrato preservado: `ChangePasswordForm.test.tsx` e `PasswordResetForms.test.tsx` verdes.
- [ ] Gate: `npm run test`.
- [ ] Test count: suítes de troca/reset +≥3, 0 deleções.

**Tests**: unit · **Gate**: quick
**Commit**: `fix(identity): method=post nos demais forms de credencial (ORQ-3)`

---

### T6: `serverActions.bodySizeLimit` no `next.config.ts` [P]

**What**: Adicionar `experimental.serverActions.bodySizeLimit: '6mb'` preservando as
opções existentes; teste que asserta `bodySizeLimit` ≥ `MAX_CV_BYTES`.
**Where**: `next.config.ts` (+ teste em `src/**/__tests__/`)
**Depends on**: None
**Reuses**: `MAX_CV_BYTES` (`@/modules/cv-extraction` / `domain/mime`)
**Requirement**: RF-05, RF-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `next.config.ts` mantém `outputFileTracingRoot`/`outputFileTracingIncludes` e adiciona `experimental.serverActions.bodySizeLimit: '6mb'`.
- [ ] Teste importa a config raiz e asserta `bodySizeLimit` definido e, convertido para bytes (`'6mb'` = 6·1024·1024), ≥ `MAX_CV_BYTES` (5 MB) — parte de RF-MN-04.
- [ ] `npm run build` conclui (config válida).
- [ ] Gate: `npm run typecheck && npm run lint && npm run test && npm run build`.
- [ ] Test count: +1, 0 deleções.

**Tests**: unit · **Gate**: build
**Commit**: `fix(infra): serverActions.bodySizeLimit 6mb p/ upload de CV (CAND-5)`

---

### T7: guard de tamanho no cliente do `CvUploadForm` [P]

**What**: Em `onUploadClick`, barrar arquivo > `MAX_CV_BYTES` com mensagem PT-BR
antes de chamar `uploadCv`.
**Where**: `src/modules/cv-extraction/components/CvUploadForm.tsx`
**Depends on**: None
**Reuses**: `MAX_CV_BYTES`/`isWithinCvSizeLimit` de `../domain/mime` (leaf puro — confirmar sem import server-only)
**Requirement**: RF-05, RF-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Selecionar `File` com `size > MAX_CV_BYTES` → mensagem PT-BR de tamanho e `uploadCv` **não** é chamado (RF-MN-04 — teste negativo).
- [ ] Selecionar `File` ≤ `MAX_CV_BYTES` → `uploadCv` é chamado (fluxo atual).
- [ ] Contrato preservado: `CvUploadForm.test.tsx` (render, CVE-03, CVE-MN-06, confirmar, erro de upload) verde.
- [ ] Gate: `npm run typecheck && npm run test`.
- [ ] Test count: `CvUploadForm.test.tsx` +≥1, 0 deleções.

**Tests**: unit · **Gate**: full
**Commit**: `fix(cv-extraction): guard client de tamanho no CvUploadForm (CAND-5)`

---

### T8: texto de 1º acesso condicional em `/trocar-senha` [P]

**What**: Tornar a page `async`, ler `getCurrentPerson()` e condicionar a
`description` do `FormHeader` a `primeiroAcesso`.
**Where**: `src/app/(auth)/trocar-senha/page.tsx` (+ page test)
**Depends on**: None
**Reuses**: `getCurrentPerson` (`@/modules/identity`), `FormHeader`/`FormCard`/`StepIcon`
**Requirement**: RF-06, RF-MN-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `primeiroAcesso === true` → descrição contém "Este é seu primeiro acesso".
- [ ] `primeiroAcesso === false` ou sem sessão → descrição sem "primeiro acesso" (copy neutra) (RF-MN-05 — teste negativo).
- [ ] A page continua sem `redirect` (não confina — ADR-0030); título inalterado.
- [ ] Page test com `getCurrentPerson` mockado nos ramos true/false/null.
- [ ] Gate: `npm run typecheck && npm run lint && npm run test && npm run build`.
- [ ] Test count: novo `trocar-senha/page.test.tsx` +≥2, 0 deleções.

**Tests**: unit (page) · **Gate**: build
**Commit**: `fix(identity): texto de 1º acesso condicional em /trocar-senha (AUTH-7)`

---

## Parallel Execution Map

```
Phase 1 (Parallel, order-free):
  ├── T1 [P]
  ├── T2 [P]
  ├── T4 [P]
  ├── T5 [P]
  ├── T6 [P]
  ├── T7 [P]
  └── T8 [P]

Phase 2 (Sequential):
  T2 complete, then:
    T3
```

Execução inline (≤3 fases). `[P]` = order-free dentro da fase (sem dependência
inter-task, testes parallel-safe) — não é diretiva de sub-agente por task.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: CSP dev flag | 1 função (`buildCsp`) + testes | ✅ Granular |
| T2: guard de data no schema | 1 bloco (`superRefine`) + testes | ✅ Granular |
| T3: `noValidate` no form | 1 atributo + teste | ✅ Granular |
| T4: `method=post` LoginForm | 1 atributo + teste | ✅ Granular |
| T5: `method=post` 3 forms de credencial | mesma mudança de 1 linha × 3 arquivos coesos | ⚠️ OK (coeso — mesmo must-not, mudança idêntica) |
| T6: `bodySizeLimit` | 1 opção de config + teste | ✅ Granular |
| T7: guard de tamanho | 1 função (`onUploadClick`) + teste | ✅ Granular |
| T8: texto condicional | 1 page + teste | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1 [P] (sem seta de entrada) | ✅ Match |
| T2 | None | Phase 1 [P]; seta T2→T3 | ✅ Match |
| T3 | T2 | Phase 2: T2→T3 | ✅ Match |
| T4 | None | Phase 1 [P] | ✅ Match |
| T5 | None | Phase 1 [P] | ✅ Match |
| T6 | None | Phase 1 [P] | ✅ Match |
| T7 | None | Phase 1 [P] | ✅ Match |
| T8 | None | Phase 1 [P] | ✅ Match |

Nenhuma task marcada `[P]` depende de outra `[P]` da mesma fase (T3 não é `[P]`).

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Domain/lib (`securityHeaders`) | unit | unit | ✅ OK |
| T2 | Domain/schema (Zod) | unit | unit | ✅ OK |
| T3 | Client Component (`JobForm`) | unit | unit | ✅ OK |
| T4 | Client Component (`LoginForm`) | unit | unit | ✅ OK |
| T5 | Client Component (3 forms) | unit | unit | ✅ OK |
| T6 | Config (`next.config.ts`) | unit (assert) | unit | ✅ OK |
| T7 | Client Component (`CvUploadForm`) | unit | unit | ✅ OK |
| T8 | Route/page RSC (`trocar-senha`) | unit (page) | unit | ✅ OK |

Nenhum `Tests: none`; nenhum deferimento de teste para outra task.

---

## Must-Not Ownership Check (💠 Check 4)

| Must-Not | Owning task(s) | Negative test no `Done when`? | Status |
| --- | --- | --- | --- |
| RF-MN-01 (sem credencial na URL) | T4 (LoginForm), T5 (troca/reset/solicitação) | Sim — assert `<form method="post">` em cada form | ✅ |
| RF-MN-02 (prod sem `unsafe-eval`) | T1 | Sim — `NODE_ENV='production'` → sem `unsafe-eval` | ✅ |
| RF-MN-03 (schema não lança) | T2 | Sim — `safeParse('') not.toThrow` + `success:false` | ✅ |
| RF-MN-04 (CV grande não despacha / config ≥5 MB) | T7 (guard client) + T6 (config) | Sim — `File`>5 MB não chama `uploadCv`; `bodySizeLimit`≥`MAX_CV_BYTES` | ✅ |
| RF-MN-05 (sem texto enganoso) | T8 | Sim — `primeiroAcesso:false` → sem "primeiro acesso" | ✅ |

Todos os 5 must-nots têm task dona e teste negativo. Nenhuma lacuna de decomposição.

---

## MCPs and Skills

Nenhum MCP necessário (mudanças locais, sem consulta externa em runtime). Nenhuma
skill de execução além da spec-driven do projeto (Execução Protocol acima). A
verificação de config do Next (bodySizeLimit) já foi resolvida no Design via
Context7 — não repetir em Execute.

---

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Após a última task (T3), o
**Verifier independente** roda automaticamente (author ≠ verifier): checagem
spec-anchored por AC + sensor de discriminação + verificação dos 5 must-nots
(evidence-or-zero) + relatório em `validation.md`. Gate final do PR:
`npm run typecheck && npm run lint && npm run test && npm run build` verdes, zero
migração, zero dependência nova.
