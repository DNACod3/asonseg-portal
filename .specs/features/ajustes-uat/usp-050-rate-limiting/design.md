# USP-050 — Rate limiting (parse/classificação/429 PT-BR) — Design

**Spec**: `.specs/features/ajustes-uat/usp-050-rate-limiting/spec.md`
**Status**: Draft

> **Adaptar, não re-derivar (design upstream).** As decisões de arquitetura do rate limit estão fixadas em
> **technical-design §8** (tetos/janelas), **ADR-0029** (hardening/anti-brute-force), **ADR-0014** (CAPTCHA como
> defesa complementar) e no design da US #200/#201. Este design **não re-decide** nenhuma delas — só ajusta a
> **classificação** (que categoria/quando conta) e o **parse** de uma flag. Buckets, tetos, janelas e o algoritmo
> de janela deslizante (`rateLimit.ts`) ficam **intactos** (RL-MN-07).

## Decisões de projeto ativas (STATE.md `## Decisions`)

Nenhuma AD ativa conflita com esta unidade. Relevantes/conformadas:
- **Memória do projeto — guard `RATE_LIMIT_DISABLED` mira `VERCEL_ENV` (não `NODE_ENV`)**: o `superRefine` de
  `env.ts` permanece **textualmente intacto**; a mudança toca só o `preprocess` do campo (RL-MN-05).
- **Fase 8 (dossiê UAT)**: correção de fluxo sem alterar arquitetura/premissas técnicas — conformado.
- **AD-025 (casca pública)** e lição "anonimizar no View Model não basta": não há PII nesta unidade; a página 429
  é estática/sem dados de Pessoa. Nenhuma interação.

Nenhuma decisão nova de projeto é criada (mudanças são feature-local). Nenhuma AD é superseded.

## Architecture Overview

Três pontos de mudança, todos **medidos pela cobertura** (`src/shared/**`, `src/middleware.ts`) — nenhum arquivo
em `src/app/**` (a página 429 é servida **do Edge**, evitando a regressão de branch-gate do projeto):

```mermaid
graph TD
    subgraph boot["Boot / parse de env (Node + Edge)"]
      A["process.env"] --> B["parseBooleanFlag (novo, puro)"]
      B --> C["envSchema.RATE_LIMIT_DISABLED / CV_EXTRACTOR_FAKE"]
      C --> D["superRefine VERCEL_ENV (INTACTO)"]
    end

    subgraph edge["Edge Middleware (por request)"]
      R["NextRequest"] --> API{"/api/*?"}
      API -->|sim| SH1["só security headers (H2, intacto)"]
      API -->|não| PF{"GET/HEAD && isRouterDataRequest (Next-Url)?"}
      PF -->|sim| GATE["pula rate-limit; gate de sessão + security headers"]
      PF -->|não| CAT["resolveCategory (method + segmento)"]
      CAT --> CHK["rateLimiter.check (RATE_LIMITS, INTACTO)"]
      CHK -->|allowed| GATE
      CHK -->|bloqueado & !RATE_LIMIT_DISABLED| RESP{"isDocumentRequest?"}
      RESP -->|sim| HTML["renderRateLimitedHtml (novo, PT-BR)"]
      RESP -->|não| JSON["JSON ActionResult (INTACTO)"]
    end
```

**Fluxo de decisão do 429** (PUB-1c): `isDocumentRequest` = `Accept` contém `text/html`. Só o ramo de documento
vira HTML; RSC/fetch/Server Action seguem JSON (RL-MN-06). **Correção pós-Verifier**: o check `rsc !== '1'` era
código morto (`rsc` nunca chega ao middleware no servidor real) — removido; `Accept` sozinho é suficiente.

**Fluxo de classificação** (PUB-2/SOC-1): `registration` só quando `path` é o segmento público `/cadastro`
(exato ou `/cadastro/…`) **e** o método é mutação (POST). GET/HEAD/fetch do client router e `/cadastro-assistido`
caem em `anonymous`/`authenticated`.

**Fluxo de bypass do client router** (PUB-1b — **corrigido no ciclo de fix pós-Verifier**): `GET`/`HEAD` **e**
`Next-Url` presente → o request **não** entra no `rateLimiter` (não conta, não bloqueia, sem headers
`X-RateLimit-*`), mas segue o resto do middleware (gate de sessão + security headers). Cobre prefetch **e**
navegação client-side real (indistinguíveis no middleware do Next 15.5.18 real — `Next-Router-Prefetch` nunca
chega a `request.headers`, confirmado empiricamente com `curl -v` + browser real via Playwright). O gate de
método garante que uma mutação nunca é isenta.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `envSchema` + `parseEnv` + `superRefine` | `src/shared/env.ts` | Editar **só** o `preprocess` de `RATE_LIMIT_DISABLED` e `CV_EXTRACTOR_FAKE` para chamar `parseBooleanFlag`. `superRefine` e `AUTH_LOGIN_ENABLED` **inalterados**. |
| `middleware` + `resolveCategory` + `isAuthenticated` + `applyRateLimitHeaders` + `logRateLimited` | `src/middleware.ts` | `resolveCategory` passa a considerar método + segmento; novo ramo prefetch antes do `check`; ramo 429 decide HTML×JSON. Helpers de header/log reusados. |
| `rateLimiter` (singleton) + `RATE_LIMITS` + `RateLimitResult` | `src/shared/lib/rateLimit.ts` | **Consumido como está** — nenhuma mudança de lib (RL-MN-07). |
| `applySecurityHeaders` / `securityHeaders` | `src/shared/lib/securityHeaders.ts` | Aplicado à resposta 429 (HTML e JSON) e às respostas normais — **inalterado**. A CSP `style-src 'unsafe-inline'` já permite o `<style>` inline da página 429. |
| `clientIp` | `src/shared/lib/clientIp.ts` | Reusado para a chave do bucket — **inalterado**. |
| base `validEnv` + testes `parseEnv` | `src/shared/__tests__/env.test.ts` | Estender com as variações de flag (fail-loud, Vercel-guard, CI-path). |
| padrão de teste do middleware (`req()` helper, `rateLimiter.reset()`, mock `Math.random`) | `src/middleware.test.ts` | Estender: `reqPost`/opção de método, header de prefetch, header `rsc`, `Accept`. |

### Integration Points

| System | Integration Method |
| --- | --- |
| Edge Runtime (Next 15) | Todos os helpers novos são **Edge-safe** (só `Request`/`Headers`/strings; sem Node/`Buffer`/fs). |
| Next App Router | Sinais de request lidos dos headers (`Next-Router-Prefetch`, `rsc`, `Accept`) confirmados via Context7 (doc do Next 15). |
| CSP (`securityHeaders`) | A resposta HTML 429 usa `<style>` inline coberto por `style-src 'unsafe-inline'`; sem asset externo (`default-src 'self'`). |

---

## Components

### 1. `parseBooleanFlag` — parser de flag booleana fail-loud (novo, puro)

- **Purpose**: Converter uma env string em `boolean` reconhecendo as grafias usuais e devolvendo o valor **cru**
  (sentinela) para qualquer string não reconhecida, de modo que `z.boolean()` reprove e o boot **falhe ruidoso**.
- **Location**: `src/shared/lib/env-flags.ts` (+ export nomeado; usado por `src/shared/env.ts`)
- **Interfaces**:
  - `parseBooleanFlag(raw: unknown): unknown` — `boolean` in → devolve o próprio boolean; `string` in → `trim()`+
    `toLowerCase()`: `'true'|'1'|'yes'|'on'` → `true`; `'false'|'0'|'no'|'off'|''` → `false`; **qualquer outra
    string** → devolve a string **inalterada** (reprova em `z.boolean()`); qualquer outro tipo (ex.: `undefined`)
    → devolve inalterado (deixa o `.default()` agir).
- **Dependencies**: nenhuma (função pura).
- **Reuses**: idioma de preprocess já usado em `env.ts` (`typeof v === 'string' ? … : v`).

> **Nota de ordem Zod**: em `z.preprocess(parseBooleanFlag, z.boolean()).default(false)`, o `ZodDefault`
> curto-circuita quando o input é `undefined` (chave ausente) → `false`; para chave presente, `parseBooleanFlag`
> roda antes de `z.boolean()`. `''` é mapeado explicitamente a `false` (linha vazia = não-setada).

### 2. `rateLimitResponse` — sinais de request + página 429 (novo, Edge-safe)

> **Ciclo de fix pós-Verifier (2026-07-12, achado empírico do live outcome-check).** O live outcome-check
> (`npm run build && npm run start` real + `curl -v` + browser Chromium real via Playwright) refutou a premissa
> original: `Next-Router-Prefetch`, `RSC` e o query `_rsc` **nunca chegam** a `request.headers`/`request.nextUrl`
> dentro do Edge Middleware no Next 15.5.18 real (consumidos internamente antes de invocar o middleware do
> usuário — confirmado com instrumentação temporária revertida). O sinal `Next-Url` **sobrevive** e é usado no
> lugar de `Next-Router-Prefetch`; `rsc==='1'` foi removido de `isDocumentRequest` (mesma raiz, dead code).
> `isPrefetchRequest` foi renomeado para `isRouterDataRequest` (escopo ampliado: cobre prefetch + navegação
> client-side real, indistinguíveis no middleware real — ver spec.md Assumptions).

- **Purpose**: Isolar (a) o reconhecimento de **fetch de dados do client router** (prefetch + navegação
  client-side real) e de **navegação de documento** a partir dos headers e (b) a renderização da **página 429
  PT-BR**, mantendo o `middleware.ts` enxuto e os predicados unit-testáveis.
- **Location**: `src/shared/lib/rateLimitResponse.ts` (+ exports nomeados)
- **Interfaces**:
  - `isRouterDataRequest(headers: Headers): boolean` — `headers.get('next-url') !== null`
    (fallback secundário: `headers.get('purpose') === 'prefetch'`).
  - `isDocumentRequest(headers: Headers): boolean` — `(headers.get('accept') ?? '').includes('text/html')`.
  - `renderRateLimitedHtml(retryAfterSeconds: number): string` — HTML PT-BR **self-contained**: `<!doctype html>`,
    `<html lang="pt-BR">`, `<title>Muitas requisições — Portal ASONSEG</title>`, `<h1>` + parágrafo de
    "aguarde ~N segundos e tente novamente", `<a href="/">Voltar ao início</a>`; `<style>` inline mínimo; **sem**
    `http(s)://` externo, fonte/CDN ou imagem remota.
- **Dependencies**: nenhuma (funções puras de `Headers`/número → string/boolean).
- **Reuses**: strings PT-BR no mesmo tom das mensagens de erro existentes; casca mínima (não a casca `(public)`,
  que é de rota — indisponível no Edge).

### 3. `middleware` — wiring da classificação, bypass do client router e 429 (editar)

- **Purpose**: Aplicar o bypass de rate limit para fetches de dados do client router, classificação por
  método/segmento e a decisão HTML×JSON no 429, sem tocar o algoritmo de rate limit.
- **Location**: `src/middleware.ts`
- **Interfaces** (mudanças internas):
  - Após o branch `/api`: `const isRouterFetch = (method === 'GET' || method === 'HEAD') &&
    isRouterDataRequest(request.headers)`. Se `isRouterFetch` → **pular** `resolveCategory`/`check`/`prune`/429 e
    os headers `X-RateLimit-*`; seguir para o gate de sessão + security headers. (`result` fica `null`;
    `applyRateLimitHeaders` é chamado **só** quando `result !== null`.) O gate de método (`GET`/`HEAD`) é defesa
    em profundidade: confirmado empiricamente que um Server Action POST real não carrega `Next-Url`, mas o gate
    explícito remove qualquer ambiguidade futura (PUB-2 exige que mutações sempre contem).
  - `resolveCategory(request)`:
    ```
    const path = request.nextUrl.pathname;
    const isPublicCadastro = path === '/cadastro' || path.startsWith('/cadastro/');
    const isMutation = request.method !== 'GET' && request.method !== 'HEAD';
    if (isPublicCadastro && isMutation) return 'registration';
    if (path.startsWith('/recuperar-senha') || path.startsWith('/reivindicar-credencial')) return 'passwordReset';
    return isAuthenticated(request) ? 'authenticated' : 'anonymous';
    ```
    (Remove o ramo morto `startsWith('/cadastrar')`.)
  - Ramo 429 (`!result.allowed && !env.RATE_LIMIT_DISABLED`): se `isDocumentRequest(request.headers)` →
    `new NextResponse(renderRateLimitedHtml(result.retryAfterSeconds), { status: 429 })` com
    `Content-Type: text/html; charset=utf-8`; senão → o `NextResponse.json({ ok:false, … })` **atual** (intacto).
    Ambos setam `Retry-After`, `Cache-Control: no-store`, `applyRateLimitHeaders(…, 0, resetAt)` e
    `applySecurityHeaders(…)`.
- **Dependencies**: `rateLimitResponse` (novo), `rateLimit`/`securityHeaders`/`clientIp`/`env` (existentes).
- **Reuses**: `logRateLimited`, `applyRateLimitHeaders`, `applySecurityHeaders`, `isAuthenticated`.

### 4. `env.ts` — wiring do parser (editar)

- **Purpose**: Trocar o `preprocess` frágil de `RATE_LIMIT_DISABLED` e `CV_EXTRACTOR_FAKE` por `parseBooleanFlag`.
- **Location**: `src/shared/env.ts`
- **Interfaces**: `RATE_LIMIT_DISABLED: z.preprocess(parseBooleanFlag, z.boolean()).default(false)` (idem
  `CV_EXTRACTOR_FAKE`). `superRefine` e `AUTH_LOGIN_ENABLED` **inalterados**.
- **Dependencies**: `parseBooleanFlag` (comp. 1).
- **Reuses**: `envSchema`/`runtimeEnvSchema`/`parseEnv` existentes.

---

## Data Models

Nenhum. Sem schema/migração. Sem novo tipo persistido. `RateLimitResult`/`RateLimitCategory`/`RATE_LIMITS`
permanecem como estão.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE` com valor não reconhecido | `parseBooleanFlag` devolve a string crua → `z.boolean()` reprova → `parseEnv` lança a mensagem agregada PT-BR citando o campo (fail-fast no boot) | Boot falha ruidoso (dev/deploy) em vez de proteção silenciosamente errada |
| `RATE_LIMIT_DISABLED=true` num deploy Vercel real | `superRefine` (intacto) adiciona issue `VERCEL_ENV` → boot falha | Deploy real nunca sobe com rate limit desligado (fail-closed) |
| 429 em navegação de documento | Página HTML PT-BR + `Retry-After` + `no-store` | Usuário lê explicação em português, sabe quanto esperar |
| 429 em RSC/fetch/Server Action | JSON `{ok:false, error:{code:'RATE_LIMITED', message}}` (intacto) | Cliente RSC/Action recebe o shape esperado, sem quebrar |
| Fetch de dados do client router (prefetch ou soft-nav) que estouraria o teto | Ignorado (não conta, não bloqueia) — GET/HEAD com `Next-Url` | Navegação de documento do usuário não é penalizada por prefetch/soft-nav |
| Request sem `Accept` no 429 | Ramo JSON (falha segura) | Sem HTML indevido; comportamento previsível |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Teste-âncora `middleware.test.ts:63-70` fixa o comportamento **bugado** (GET `/cadastro` = `registration`) | `src/middleware.test.ts:63` | Ao corrigir PUB-2, esse teste quebra | **Atualizar** o teste para POST (mantém a asserção 3/15min sob submissão) + teste novo GET→anônimo. É adequação de contrato deliberada (spec Assumptions), não enfraquecimento — documentado em tasks (T4). |
| ~~Confiar só em `RSC: 1`/`?_rsc=` para detectar prefetch classificaria navegações soft como prefetch~~ **MATERIALIZADO NO LIVE OUTCOME-CHECK** (não apenas um risco teórico) | `src/shared/lib/rateLimitResponse.ts` | O sinal documentado (`Next-Router-Prefetch: 1`) confirmado Context7 **nunca chega** a `request.headers` no servidor real (Next 15.5.18) — o risco anotado aqui na fase de design se concretizou; `PREF-01/RL-MN-01` falharam no live outcome-check do Verifier. | **Corrigido no ciclo de fix pós-Verifier**: sinal trocado para `Next-Url` (confirmado empiricamente sobrevivente); escopo ampliado para cobrir prefetch + soft-nav (indistinguíveis no middleware real); gate de método (GET/HEAD) protege mutações. Ver spec.md Assumptions para a evidência completa. |
| Servir HTML a um request RSC quebraria o cliente Flight | `src/middleware.ts` (ramo 429) | Server Actions/RSC receberiam HTML e falhariam | `isDocumentRequest` exige `Accept: text/html`; `rsc==='1'` era dead code (removido no ciclo de fix — nunca chega ao middleware real). RL-MN-06 é o sensor; confirmado ao vivo que um Server Action POST real (`Accept: text/x-component`) segue no ramo JSON. |
| CSP bloquear a página 429 se usasse asset externo | `renderRateLimitedHtml` | Página 429 quebrada | Página 100% self-contained; `<style>` inline coberto por `style-src 'unsafe-inline'`; `default-src 'self'`. |
| Singleton `rateLimiter` compartilhado entre testes | `src/middleware.test.ts` | Contaminação de estado entre casos | `rateLimiter.reset()` no `beforeEach` (padrão já existente); vitest isola módulos por arquivo. |
| Regredir o guard `VERCEL_ENV` (memória do projeto) ao mexer no parse | `src/shared/env.ts:92-120` | Quebra do E2E de CI ou fail-closed | Mudança cirúrgica **só** no `preprocess`; `superRefine` textualmente intacto; RL-MN-05 cobre ambos os lados. |

> Nenhuma outra fragilidade nova encontrada nas áreas tocadas.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Onde servir a página 429 | **Do Edge Middleware** (string HTML), não de uma rota Next | O middleware retorna antes do roteamento; `not-found.tsx`/`error.tsx` só chegam na USP-059. Mantém a correção auto-contida e **fora de `src/app/**`** (evita a regressão de branch-gate: `src/app` não entra no coverage include). |
| ~~Sinal de prefetch~~ Sinal de fetch do client router | ~~`Next-Router-Prefetch: 1`~~ → **`Next-Url`** (revisado no ciclo de fix pós-Verifier) | O sinal documentado (`Next-Router-Prefetch: 1`) **nunca chega** a `request.headers` no servidor real (Next 15.5.18) — refutado empiricamente (curl -v + browser real). `Next-Url` é o sinal que sobrevive, presente em toda fetch de dados RSC (prefetch **e** navegação client-side real — as duas indistinguíveis no middleware desta versão, então o bypass cobre ambas, gate de método `GET`/`HEAD` protege mutações). |
| Sinal HTML×JSON | `Accept: text/html` (check `rsc` removido) | Casa exatamente o dossiê ("Accept text/html → HTML; RSC/fetch → JSON") e falha segura (sem Accept → JSON). O check `!== 'rsc:1'` era código morto (mesma raiz do achado acima) — removido no ciclo de fix; `Accept` sozinho já discriminava corretamente. |
| `registration` por método | Mutação = método ≠ GET/HEAD (POST) | A cota foi dimensionada para submissões (TD §8). Server Actions são sempre POST. |
| Matcher por segmento exato | `=== '/cadastro' || startsWith('/cadastro/')` | Exclui `/cadastro-assistido` (SOC-1) e mantém `/cadastro/consentimento`. Remove o ramo morto `/cadastrar`. |
| Estender o parser a `CV_EXTRACTOR_FAKE` | Sim (mesmo idioma/guard); **não** a `AUTH_LOGIN_ENABLED` | Consistência sem inventar regra; `AUTH_LOGIN_ENABLED` tem semântica oposta (default-on). |
| Helper puro `parseBooleanFlag` em `shared/lib` | Arquivo próprio, medido, unit-testável | Evita lógica não-testada em `env.ts`; segue a lição do projeto (núcleo puro em módulo medido). |

> **Project-level decisions:** nenhuma — todas as decisões acima são feature-local (não viram AD-NNN).
