# USP-050 — Rate limiting (parse/classificação/429 PT-BR) — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tasks com o skill **`bravi-spec-driven`**: ative-o **pelo nome** e siga o fluxo Execute e as
Critical Rules. Não busque arquivos do skill por caminho. O skill é a fonte da verdade do fluxo completo
(ciclo por task, delegação de sub-agentes, revisão de adequação, Verifier, sensor de discriminação). Os
**testes-fonte** (facts) de cada AC/must-not saem do skill **`skill-tdad`** (Gherkin PT-BR + specs Vitest red +
matriz AC→teste) **antes** de implementar.

**Se o skill não puder ser ativado, PARE e avise — não prossiga sem ele.**

---

**Design**: `.specs/features/ajustes-uat/usp-050-rate-limiting/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes de Execute. Guidelines encontradas:
> `CLAUDE.md` (§Testing Requirements: unit 90% domínio; Server Action cobre happy/Zod/permission/…),
> `docs/arch/project-guideline.md` (DoD), `vitest.config.ts` (coverage include = `src/shared/**`,
> `src/modules/**`, `src/middleware.ts`; `src/app/**` **fora** do include — por isso a página 429 é servida do
> Edge, não de rota). Samples: `src/shared/__tests__/env.test.ts`, `src/middleware.test.ts`,
> `src/shared/lib/__tests__/rateLimit.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Lib pura Edge-safe (`shared/lib/env-flags.ts`, `shared/lib/rateLimitResponse.ts`) | unit | Todos os ramos; 1:1 com ACs; must-nots com teste negativo | `src/shared/lib/__tests__/*.test.ts` | `npm run test` |
| Config / parse de env (`shared/env.ts` via `parseEnv`) | unit | Variações de flag (FLAG-*), guard Vercel (VERCEL-*), fail-loud (RL-MN-04/05) | `src/shared/__tests__/env.test.ts` | `npm run test` |
| Edge Middleware (`src/middleware.ts`) | unit | Classificação (REG-*), prefetch (PREF-*), 429 HTML×JSON (P429-*), must-nots RL-MN-01/02/03/06/07; contrato de headers/anti-spoof/gate/`/api` preservado | `src/middleware.test.ts` | `npm run test` |
| Lib de rate limit (`shared/lib/rateLimit.ts`) | none (**não modificado**) | — (RL-MN-07: valores inalterados; assert de regressão em `middleware.test.ts`) | — | build gate |

> **Sem integração/e2e nesta unidade.** O middleware não toca DB; a cobertura autoritativa do rate limit já vive
> em unit (`middleware.test.ts` + `rateLimit.test.ts`) — padrão do repo. Um e2e de rate limit exigiria servidor
> vivo e seria flaky. `src/app/**` fica fora do coverage include (a página 429 é string no Edge) → sem risco de
> regressão de branch-gate (lição do projeto).

## Parallelism Assessment

> Gerada de codebase — confirmar antes de Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit lib pura (`env-flags`, `rateLimitResponse`) | Yes | Funções puras; sem estado | `rateLimit.test.ts` (mesmo estilo) |
| unit `parseEnv` (`env.test.ts`) | Yes | `parseEnv(source)` recebe fonte explícita; sem `process.env` mutável | `env.test.ts` existente |
| unit `middleware.test.ts` | Yes (entre arquivos) | Singleton `rateLimiter` resetado no `beforeEach`; vitest isola módulos por arquivo; `Math.random` mockado | `middleware.test.ts:20-24` |

## Gate Check Commands

> Gerada de codebase — confirmar antes de Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com testes unit | `npm run test` |
| Full | (idêntico — sem integração nesta unidade) | `npm run test` |
| Build | Fim de fase / verificação final | `npm run typecheck && npm run lint && npm run build && npm run test` |

---

## Execution Plan

### Phase 1: Helpers puros (Parallel OK)

```
T1 [P]   parseBooleanFlag (shared/lib/env-flags.ts)
T3 [P]   rateLimitResponse (isPrefetch / isDocument / renderRateLimitedHtml)
```

### Phase 2: Wiring (depende da Fase 1)

```
T2 [P]   env.ts usa parseBooleanFlag + testes de parseEnv (dep: T1)
T4 [P]   middleware: prefetch-bypass + classificação + 429 HTML×JSON + testes (dep: T3)
```

≤3 fases → execução **inline** (sem sub-agentes).

---

## Task Breakdown

### T1: `parseBooleanFlag` — parser de flag booleana fail-loud [P]

**What**: Função pura que converte env string→boolean reconhecendo `true/1/yes/on` e `false/0/no/off/''`
(case-insensitive, trim) e devolve o valor **cru** (sentinela) para string não reconhecida.
**Where**: `src/shared/lib/env-flags.ts` (novo) + `src/shared/lib/__tests__/env-flags.test.ts`
**Depends on**: None
**Reuses**: idioma de preprocess de `env.ts` (`typeof v === 'string' ? … : v`)
**Requirement**: FLAG-01, FLAG-02, FLAG-04 (parser), RL-MN-04 (sentinela)

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] `parseBooleanFlag('1'|'true'|'YES'|'On'|' true ') === true`; `('0'|'false'|'no'|'off'|'') === false`
- [x] `parseBooleanFlag(true) === true`, `parseBooleanFlag(false) === false` (passthrough de boolean)
- [x] **RL-MN-04 (negativo)**: `parseBooleanFlag('maybe')` devolve a string crua (`'maybe'`, tipo `string`) —
      NÃO um boolean → garante reprovação posterior em `z.boolean()`
- [x] `parseBooleanFlag(undefined)` devolve `undefined` (deixa o `.default()` agir)
- [x] Unit cobre todos os ramos; Gate quick passa: `npm run test`; Test count: ≥6 casos
**Tests**: unit · **Gate**: quick
**Commit**: `feat(infra): parseBooleanFlag — parser de flag de env fail-loud (USP-050 · PUB-1a)`

---

### T3: `rateLimitResponse` — sinais de prefetch/documento + página 429 PT-BR [P]

**What**: `isPrefetchRequest(headers)`, `isDocumentRequest(headers)` e `renderRateLimitedHtml(retryAfterSeconds)`
(HTML PT-BR self-contained, casca mínima).
**Where**: `src/shared/lib/rateLimitResponse.ts` (novo) + `src/shared/lib/__tests__/rateLimitResponse.test.ts`
**Depends on**: None
**Reuses**: tom das mensagens PT-BR existentes; CSP `style-src 'unsafe-inline'` (permite `<style>` inline)
**Requirement**: PREF-01 (sinal), P429-01 (html), P429-02 (sinal RSC), FLAG n/a

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] `isPrefetchRequest`: `Next-Router-Prefetch: '1'` → `true`; ausente → `false`; (fallback `purpose: prefetch`)
- [x] `isDocumentRequest`: `Accept` com `text/html` **e** sem `rsc:1` → `true`; com `rsc:1` → `false`;
      sem `Accept` → `false` (falha segura)
- [x] `renderRateLimitedHtml(30)`: string HTML `lang="pt-BR"`, contém título/mensagem PT-BR de "muitas
      requisições" e referência ao tempo de espera; **nenhum** `http://`/`https://` externo, fonte/CDN ou `<img src=…>` remoto
- [x] Unit cobre a matriz Accept×rsc e o header de prefetch; Gate quick passa; Test count: ≥7 casos
**Tests**: unit · **Gate**: quick
**Commit**: `feat(infra): sinais de prefetch/documento + página 429 PT-BR (USP-050 · PUB-1b/1c)`

---

### T2: `env.ts` usa `parseBooleanFlag` + testes de `parseEnv` [P] (dep: T1)

**What**: Trocar o `preprocess` de `RATE_LIMIT_DISABLED` e `CV_EXTRACTOR_FAKE` por `parseBooleanFlag`
(mantendo `.default(false)` e o `superRefine` **intactos**); estender `env.test.ts` com as variações.
**Where**: `src/shared/env.ts` (editar linhas 74-76 e 82-84) + `src/shared/__tests__/env.test.ts` (estender)
**Depends on**: T1 (`parseBooleanFlag`)
**Reuses**: base `validEnv` e casos `parseEnv` de `env.test.ts`; `runtimeEnvSchema`/`superRefine` existentes
**Requirement**: FLAG-01, FLAG-02, FLAG-03, FLAG-04, VERCEL-01, VERCEL-02, VERCEL-03, RL-MN-04, RL-MN-05

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE` usam `z.preprocess(parseBooleanFlag, z.boolean()).default(false)`;
      `AUTH_LOGIN_ENABLED` **inalterado**; `superRefine` **textualmente inalterado** (VERCEL-03)
- [x] `parseEnv({…valid, RATE_LIMIT_DISABLED:'1'})` → `true`; `'true'`/`'on'` → `true`; `'0'`/`''`/ausente → `false` (FLAG-01/02)
- [x] **RL-MN-04 (negativo)**: `parseEnv({…valid, RATE_LIMIT_DISABLED:'maybe'})` **lança** citando o campo (FLAG-03); idem `CV_EXTRACTOR_FAKE:'maybe'`
- [x] **RL-MN-05 (negativo)**: `parseEnv({…valid, VERCEL_ENV:'production', RATE_LIMIT_DISABLED:'1'})` **lança** (VERCEL-01); `{…valid, NODE_ENV:'production'}` **sem** `VERCEL_ENV` + `RATE_LIMIT_DISABLED:'true'` **não lança** (VERCEL-02)
- [x] Gate quick passa; Test count: ≥8 casos novos (sem deleção dos existentes)
**Tests**: unit · **Gate**: quick
**Commit**: `fix(infra): parse robusto de RATE_LIMIT_DISABLED/CV_EXTRACTOR_FAKE, guard Vercel intacto (USP-050 · PUB-1a)`

---

### T4: middleware — prefetch-bypass + classificação por mutação/segmento + 429 HTML×JSON [P] (dep: T3)

**What**: (a) pular rate limit em prefetch; (b) `resolveCategory` por método+segmento (registration só em mutação
do `/cadastro` público; `/cadastro-assistido` fora); (c) 429 de documento → HTML, RSC/fetch → JSON. Estender
`middleware.test.ts` (atualizar o teste de registration GET→POST + novos casos).
**Where**: `src/middleware.ts` (editar) + `src/middleware.test.ts` (estender)
**Depends on**: T3 (`rateLimitResponse`)
**Reuses**: `rateLimiter`/`RATE_LIMITS` (intactos), `applyRateLimitHeaders`, `applySecurityHeaders`,
`logRateLimited`, `isAuthenticated`, `NextResponse.json` (ramo JSON atual)
**Requirement**: PREF-01, PREF-02, PREF-03, REG-01, REG-02, REG-03, P429-01, P429-02, P429-03, RL-MN-01,
RL-MN-02, RL-MN-03, RL-MN-06, RL-MN-07

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] Ramo prefetch: `isPrefetchRequest` → pula `check`/`prune`/429 e `X-RateLimit-*`; segue gate de sessão + security headers
- [x] `resolveCategory`: registration ⟺ `(path==='/cadastro' || startsWith('/cadastro/'))` **e** método ≠ GET/HEAD; ramo morto `/cadastrar` removido
- [x] Ramo 429: `isDocumentRequest` → `NextResponse(html, {status:429})` `text/html; charset=utf-8`; senão → JSON `{ok:false,…}` atual; ambos com `Retry-After` + `Cache-Control: no-store` + `X-RateLimit-*` + security headers
- [x] **RL-MN-01 (negativo)**: 15 prefetches (`Next-Router-Prefetch:'1'`) do IP X → 0×429; navegação real do IP X depois → não-429 (bucket intacto)
- [x] **RL-MN-02 (negativo)**: 4 GET `/cadastro` mesmo IP → sem 429 de registration (`X-RateLimit-Limit=10`); POST `/cadastro` depois ainda tem 3 de registration
- [x] **RL-MN-03 (negativo)**: `/cadastro-assistido` com cookie → limit `60`; sem cookie → `10`; nunca `3`
- [x] **RL-MN-06 (negativo)**: 429 com `rsc:'1'` (ou Accept sem text/html) → `content-type` JSON + `{ok:false, error:{code:'RATE_LIMITED'}}`; com `Accept: text/html` e sem `rsc` → HTML
- [x] **RL-MN-07 (regressão)**: assert de `RATE_LIMITS` (10/60/3/5/20 + janelas) inalterado; `rateLimit.ts` não modificado
- [x] **Contrato preservado**: teste de registration atualizado GET→POST (mantém 3/15min sob submissão) + teste novo GET `/cadastro`→anônimo; headers de segurança em toda resposta, anti-spoof de IP, gate de sessão, `/api` sem rate-limit **continuam verdes**
- [x] Gate quick passa; Test count: suíte de `middleware.test.ts` verde (existentes intactos exceto o de registration, ajustado deliberadamente) + ≥7 casos novos
**Tests**: unit · **Gate**: quick
**Commit**: `fix(infra): prefetch fora do rate limit, registration por mutação, 429 PT-BR (USP-050 · PUB-1b/1c, PUB-2, SOC-1)`

---

## Parallel Execution Map

```
Phase 1 (Parallel — puros):
  ├── T1 [P]  parseBooleanFlag
  └── T3 [P]  rateLimitResponse

Phase 2 (T1,T3 completas — Parallel):
  ├── T2 [P]  env.ts wiring (dep T1)
  └── T4 [P]  middleware wiring (dep T3)
```

**Parallelism constraint:** T1/T3 são order-free (puros, sem dep). T2 (dep T1) e T4 (dep T3) não dependem entre
si e não compartilham arquivo/estado (env.ts/env.test vs middleware.ts/middleware.test) → `[P]`. ≤3 fases →
execução inline (sem sub-agentes).

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 parseBooleanFlag | 1 função pura | ✅ Granular |
| T3 rateLimitResponse | 1 arquivo lib (3 funções coesas: sinais + render) | ✅ OK (coeso) |
| T2 env.ts wiring | 1 edição de config + testes | ✅ Granular |
| T4 middleware wiring | 1 arquivo (3 mudanças coesas da mesma correção) + testes | ✅ OK (coeso) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | None | Fase 1 raiz | ✅ Match |
| T3 | None | Fase 1 raiz | ✅ Match |
| T2 | T1 | Fase 2, dep T1 | ✅ Match |
| T4 | T3 | Fase 2, dep T3 | ✅ Match |

Nenhuma task `[P]` depende de outra `[P]` na mesma fase (T1∥T3; T2∥T4, e T2/T4 não dependem entre si).

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Lib pura Edge-safe | unit | unit | ✅ OK |
| T3 | Lib pura Edge-safe | unit | unit | ✅ OK |
| T2 | Config / parse de env | unit | unit | ✅ OK |
| T4 | Edge Middleware | unit | unit | ✅ OK |

Nenhuma violação: nenhuma task usa `Tests: none` indevidamente; `rateLimit.ts` (layer "none") não é modificado —
seu invariante é coberto por assert de regressão em T4.

---

## 💠 Must-Not Ownership

| Must-Not | Owning task(s) | Negative test presente? |
| --- | --- | --- |
| RL-MN-01 (prefetch não consome/bloqueia bucket) | T4 | ✅ T4: 15 prefetches → 0×429; nav real depois não bloqueada |
| RL-MN-02 (GET/prefetch `/cadastro` fora de registration) | T4 | ✅ T4: 4 GET `/cadastro` sem 429 de registration; POST mantém 3 |
| RL-MN-03 (`/cadastro-assistido` fora de registration) | T4 | ✅ T4: limit 60/10, nunca 3 |
| RL-MN-04 (valor desconhecido não vira false silencioso) | T1 (sentinela), T2 (parseEnv lança) | ✅ T1: `'maybe'`→string crua; T2: `parseEnv` lança |
| RL-MN-05 (guard Vercel não regride; mira VERCEL_ENV) | T2 | ✅ T2: deploy real lança; CI sem VERCEL_ENV não lança; superRefine intacto |
| RL-MN-06 (429 RSC/fetch nunca vira HTML) | T4 | ✅ T4: `rsc:1`/Accept≠html → JSON `{ok:false}` |
| RL-MN-07 (tetos/janelas/lib/dep/migração inalterados) | T4 | ✅ T4: assert de `RATE_LIMITS`; sem tocar `rateLimit.ts`/`package.json`/migrations (build gate) |

Todo `RL-MN-NN` da spec tem task dona + teste negativo. Sem gap de decomposição.

---

## Tools (MCPs e Skills)

- **MCP**: nenhum necessário (edições locais). Context7 já foi usado no Planner para confirmar os sinais de
  prefetch/RSC do Next 15 (documentado nas Assumptions da spec).
- **Skill**: `skill-tdad` para gerar os facts (Gherkin PT-BR + specs Vitest red + matriz AC→teste) de cada AC e
  must-not **antes** de implementar; `bravi-spec-driven` (Execute) para o ciclo por task + Verifier.

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Todo `Done when` é binário/testável e referencia o comando de
gate. Contagem de testes explicitada para prevenir deleção silenciosa. Um commit atômico por task. **Nota de
contrato (T4):** o único teste existente ajustado é o de `registration` (`middleware.test.ts:63-70`, GET→POST) —
mudança **deliberada** de contrato (PUB-2), com teste novo cobrindo GET→anônimo; não é enfraquecimento de teste.
