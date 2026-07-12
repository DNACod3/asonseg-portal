# USP-050 — Rate limiting: parse de flag robusto, buckets por mutação, exclusão de prefetch, página 429 PT-BR — Specification

> **Fonte da verdade upstream (adaptar, não re-derivar).** Esta unidade é uma **remediação de UAT** (Fase 8).
> Cada requisito está ancorado num achado do dossiê `.specs/features/ajustes-uat/uat-findings-2026-07-11.md`
> (tabela "Fase 8"). Os IDs de achado — **PUB-1 (a/b/c), PUB-2, SOC-1** — são **canônicos** aqui; os IDs locais
> (`FLAG-*`, `PREF-*`, `P429-*`, `REG-*`, `RL-MN-*`) cobrem só o detalhe testável que o dossiê não enumera.
> O dimensionamento dos buckets vem de **technical-design §8** (`10/min anônimo · 60/min autenticado ·
> 3 cadastros/15min/IP · 5 recuperações/15min/IP`) e **não muda** — só a **classificação** e o **parse** mudam.

## Problem Statement

O rate limiting do Edge Middleware (US #200/#201) tem quatro defeitos de **classificação/parse** que quebram a
fachada pública recém-entregue (Fase 7), todos observados no UAT de 2026-07-11:

1. **PUB-1a** — `RATE_LIMIT_DISABLED=1` vira `false` **silencioso** (`env.ts:74-76` só aceita a string `'true'`),
   contrariando o padrão do `env.ts` ("o build/boot falha se uma variável estiver malformada").
2. **PUB-1b** — o **prefetch RSC** dos `<Link>` consome o bucket anônimo (10/min). Um load da home dispara
   ~10-15 prefetches → a **navegação real** seguinte recebe **429**.
3. **PUB-1c** — o 429 de uma **navegação de documento** renderiza **JSON cru** no navegador (péssima UX).
4. **PUB-2** — a cota `registration` (3/15min, dimensionada para **submissões** — TD §8) é aplicada a
   **qualquer** request `startsWith('/cadastro')`, inclusive **GET/prefetch** do CTA "Cadastrar" → o visitante
   fica **trancado por 15min** só por olhar a página de cadastro.
5. **SOC-1** — `/cadastro-assistido` (fluxo **interno autenticado** da assistente social, em `(app)`) cai no
   **mesmo bucket `registration`** por `startsWith('/cadastro')`.

## Goals

- [x] Parse de `RATE_LIMIT_DISABLED` aceita `true`/`1`/`yes`/`on` (case-insensitive) e `false`/`0`/`no`/`off`/`''`,
      e **falha ruidoso no boot** para qualquer valor não reconhecido (PUB-1a) — **preservando intacto** o guard
      de deploy Vercel (`superRefine` sobre `VERCEL_ENV`, não `NODE_ENV`).
- [x] **Fetch de dados do client router (prefetch e navegação client-side real) não consome nem bloqueia** nenhum
      bucket — reconhecido pelo header `Next-Url` (PUB-1b). **AC atualizado no ciclo de fix pós-Verifier** (ver
      Assumptions): o header documentado `Next-Router-Prefetch: 1` nunca chega a `request.headers` no servidor
      real (Next 15.5.18) — confirmado empiricamente — e nenhum sinal distingue prefetch de navegação client-side
      real no middleware desta versão, então o bypass cobre as duas (navegação de **documento** continua contando).
- [x] 429 de **navegação de documento** (`Accept: text/html`, request não-RSC) → **página de erro PT-BR com casca
      mínima**; requests **RSC/fetch/Server Action** continuam recebendo o **JSON** `{ok:false,…}` atual (PUB-1c).
- [x] Cota `registration` aplicada **só a mutações** (POST/Server Action) do fluxo público `/cadastro`; GET/prefetch
      caem na categoria anônima/autenticada normal (PUB-2).
- [x] Matcher de `registration` restrito ao **`/cadastro` público** (segmento exato) — `/cadastro-assistido` cai na
      categoria autenticada (SOC-1).

## Out of Scope

Explicitamente excluído — documentado para evitar scope creep.

| Feature | Reason |
| --- | --- |
| Alterar tetos/janelas dos buckets ou o algoritmo de janela deslizante (`rateLimit.ts`) | **Premissa inviolável da Fase 8**: o desenho do rate limit (buckets/tetos/janelas) fica como está — só a classificação e o parse mudam. `RATE_LIMITS` **não é tocado** (RL-MN-07). |
| Mutation-gating da categoria `passwordReset` (`/recuperar-senha`, `/reivindicar-credencial`) | Não é achado do dossiê. Não há CTA público que faça prefetch-storm desses paths, e um único GET consome 1 de 5 (sem lockout). A exclusão de prefetch (PUB-1b) já protege esses paths do storm. Mudar o comportamento de um bucket não-reportado seria inventar regra (proibido na Fase 8). |
| Rate-limit distribuído (`@upstash/ratelimit`), CSP nonce-based, CAPTCHA por-IP | Follow-ups de arquitetura já registrados (architecture-document; AD-023). Fora da remediação de fluxo. |
| Casca de erro global reutilizável (`app/not-found.tsx`, `error.tsx`) e favicon | É a **USP-059** (PUB-3/PUB-4). A página 429 desta unidade é servida **do Edge Middleware** (string HTML self-contained), não de uma rota Next — o middleware retorna **antes** do roteamento. |
| Gate de sessão de rotas protegidas, extração de IP, headers de segurança, exclusão de `/api` | Comportamentos existentes (US #200/#201, H2). Preservados intactos (invariantes de regressão); esta unidade não os redesenha. |
| Mudança de arquitetura, schema/migração de DB, dependência nova | Premissa inviolável da Fase 8. |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| ~~**Sinal de prefetch** = header `Next-Router-Prefetch: 1` (investigado no Next 15 App Router via Context7).~~ **SUPERSEDIDO** — ver linha "Sinal real de fetch do client router" abaixo. | agent | ~~`isPrefetchRequest` testa `headers.get('next-router-prefetch') === '1'`~~ | **Refutado empiricamente no ciclo de fix pós-Verifier** (Next 15.5.18, `npm run build && npm run start` real): o header `Next-Router-Prefetch` (e `RSC`, e o query `?_rsc=`) **nunca chegam** a `request.headers`/`request.nextUrl` dentro do Edge Middleware — confirmado com `curl -v` + instrumentação temporária (revertida) e com um browser Chromium real via Playwright (um header de controle arbitrário chega no mesmo request; esses três, não). A doc do Next 15 promete o header, mas o servidor real desta versão o consome internamente antes de invocar o middleware do usuário. | **n — refutado ao vivo** |
| **Sinal real de fetch do client router (prefetch + navegação client-side real)** = header `Next-Url` presente. | agent | `isRouterDataRequest` testa `headers.get('next-url') !== null` (+ fallback legado `purpose: prefetch`, não confirmado). | Confirmado empiricamente (mesmo ciclo de fix): `Next-Url` é o único sinal RSC que sobrevive ao middleware nesta versão — setado pelo client router em **toda** fetch de dados RSC (`fetchServerResponse`), tanto prefetch quanto a fetch que completa uma navegação client-side real, pois **nenhum sinal as diferencia** no middleware desta versão (mesma raiz do achado do Verifier). Confirmado **ausente** em: (a) navegação de documento real (`Accept: text/html`, `Sec-Fetch-Mode: navigate`, sem `Next-Url`); (b) um Server Action POST real (`Next-Action`, `Content-Type: text/plain`, sem `Next-Url`) — por isso o bypass não abre brecha de scraping anônimo (GET sem `Next-Url` conta normalmente) nem de abuso de mutação (POST protegido também pelo gate de método explícito no middleware). | **y — confirmado ao vivo** |
| **AC alterado (PREF-01/02/03, RL-MN-01)**: como prefetch e navegação client-side real são indistinguíveis no middleware real, o bypass do rate limit passa a cobrir **ambas** — não apenas prefetch. Só a navegação de **documento** (hard load/endereço) e as **mutações** continuam contando. | agent | Opção (a) do ciclo de fix: excluir toda fetch de dados do client router da contagem. | Ancorado na intenção real de PUB-1b ("navegar normalmente pelo portal não deve estourar o teto anônimo"), não na literalidade do AC original (que presumia poder isolar só o prefetch — presunção refutada ao vivo). Preserva a proteção anti-scraping (GET sem `Next-Url` ainda conta) e anti-abuso de cadastro (POST nunca isento, gate de método explícito). | y |
| **Sinal de navegação de documento** (para servir HTML) = `Accept` contém `text/html`. | agent | `isDocumentRequest(req)`. | Navegação de documento (hard load / barra de endereço) sempre manda `Accept: text/html,…` (confirmado empiricamente: `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`). Requests RSC/fetch/Server Action mandam um `Accept` genérico (`*/*`/`text/x-component`) — confirmado tanto para prefetch/soft-nav quanto para um Server Action POST real. **Check `rsc==='1'` removido no ciclo de fix** (código morto — o header `rsc` também nunca chega ao middleware, mesma raiz do achado do Verifier); `Accept` sozinho já era e continua sendo o único sinal confiável. | y |
| **Mutação** = método HTTP **≠ GET e ≠ HEAD** (na prática, POST — único transporte de mutação do app: Server Actions e form submits). | agent | `isMutationRequest = method !== 'GET' && method !== 'HEAD'`. | Server Actions do Next são **sempre POST** (inclusive o fallback pré-hidratação de `<form method=post>`). GET/HEAD = leitura (documento, RSC nav, prefetch). Assim a submissão de cadastro pega `registration` e a leitura da página não. | y |
| **Matcher de `registration`** = `path === '/cadastro' || path.startsWith('/cadastro/')` (segmento exato do fluxo público, inclui `/cadastro/consentimento`). | agent | Substitui `startsWith('/cadastro') || startsWith('/cadastrar')`. | O segmento-exato exclui `/cadastro-assistido` (não é `=== '/cadastro'` nem começa com `/cadastro/`) → resolve SOC-1, e mantém o passo de consentimento (`/cadastro/consentimento`) sob `registration` para mutação. O ramo `startsWith('/cadastrar')` era **código morto** (não há rota `/cadastrar` top-level; `/empresa/cadastrar` não casava) — removido sem mudança de comportamento. | y |
| **Parse robusto aplicado também a `CV_EXTRACTOR_FAKE`** (mesmo idioma frágil `=== 'true'`, mesma justificativa fail-loud). **`AUTH_LOGIN_ENABLED` NÃO é tocado** (semântica diferente: `!== 'false'` = qualquer valor exceto 'false' liga). | agent | Helper puro `parseBooleanFlag` usado nas duas flags fail-closed; `AUTH_LOGIN_ENABLED` mantém seu preprocess. | `CV_EXTRACTOR_FAKE` tem o **mesmo bug silencioso** de `'1'`→false e o **mesmo** guard `VERCEL_ENV`. Uniformizar não inventa regra — é a mesma regra. `AUTH_LOGIN_ENABLED` tem intenção oposta (default-on, qualquer-valor-liga); mudá-la seria alterar semântica não reportada. | y |
| **`''` (string vazia) em `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE` → `false`** (equivalente a não-setada). | agent | `parseBooleanFlag('')` → `false`. | `.env` com `VAR=` (vazio) é intenção de "não ligado"; tratar como `false` evita boot quebrado por linha vazia. Valor **não-vazio e não-reconhecido** (ex.: `maybe`) → falha ruidoso. | y |
| **Página 429** = string HTML **self-contained** (sem asset externo, `<style>` inline permitido pela CSP `style-src 'unsafe-inline'`), servida pelo Edge com `Content-Type: text/html; charset=utf-8` e `Cache-Control: no-store`. | agent | `renderRateLimitedHtml(retryAfterSeconds)`. | O middleware retorna antes do roteamento Next → não há como usar uma rota/RSC. CSP da resposta (via `applySecurityHeaders`) proíbe origem externa; a casca é mínima e PT-BR. `no-store` evita CDN cachear um 429. | y |
| **Fetch de dados do client router preserva o gate de sessão** das rotas protegidas (só o **rate limit** é ignorado). | agent | No ramo de bypass, pula-se `rateLimiter.check`/429 e os headers `X-RateLimit-*`, mas mantém-se o gate de sessão + headers de segurança. | O achado é sobre **contagem de rate limit**, não sobre o gate de sessão (cuja autoridade real é `requireActivePerson()` no layout `(app)`, ADR-0030). Mexer no gate seria fora de escopo. | y |
| **Gate de método explícito no bypass** = o bypass de rate limit só se aplica a GET/HEAD, nunca a mutações (defesa em profundidade). | agent | `isRouterFetch = (method === 'GET' \|\| method === 'HEAD') && isRouterDataRequest(headers)`. | Confirmado empiricamente que um Server Action POST real não carrega `Next-Url` (então o risco já seria zero), mas o gate explícito no código remove qualquer ambiguidade futura e ancora diretamente a premissa "documento/POST continuam contando" do achado PUB-1b/PUB-2. | y |
| **Teste do bucket `registration` que hoje usa GET `/cadastro`** (`middleware.test.ts:63-70`) será **atualizado para POST** (submissão), e um teste novo cobrirá GET `/cadastro` → anônimo. | agent | Editar o teste-âncora para refletir o **novo contrato** (mutação → registration; GET → anônimo). | O teste hoje ancora o **comportamento bugado** (GET conta em `registration`) — corrigido pela spec (PUB-2). Atualizá-lo é adequar ao contrato novo, **não** enfraquecer teste para passar (a asserção de 3/15min continua, só que sob POST). | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Parse robusto de `RATE_LIMIT_DISABLED` — fail-loud no boot ⭐ MVP

**User Story**: Como operador/deployer, quero que `RATE_LIMIT_DISABLED` aceite as grafias usuais (`1`/`true`) e
**falhe no boot** para valores não reconhecidos, para que eu nunca **desligue a proteção sem querer** por causa de
um parse silencioso.

**Why P1**: PUB-1a (P1). O silêncio esconde uma falha de segurança (rate limit inesperadamente ligado/desligado) e
viola o contrato do `env.ts` ("boot falha se malformado").

**Acceptance Criteria**:

1. QUANDO `RATE_LIMIT_DISABLED` é `'1'`, `'true'`, `'yes'`, `'on'` (qualquer caixa) ENTÃO `parseEnv` DEVE
   resolver `RATE_LIMIT_DISABLED === true` (FLAG-01).
2. QUANDO `RATE_LIMIT_DISABLED` é `'0'`, `'false'`, `'no'`, `'off'`, `''` ou ausente ENTÃO `parseEnv` DEVE
   resolver `RATE_LIMIT_DISABLED === false` (FLAG-02).
3. QUANDO `RATE_LIMIT_DISABLED` é uma string **não reconhecida** (ex.: `'maybe'`, `'2'`) ENTÃO `parseEnv` DEVE
   **lançar** com a mensagem agregada PT-BR citando `RATE_LIMIT_DISABLED` — **nunca** resolver `false` silencioso
   (FLAG-03).
4. QUANDO o parser é aplicado ENTÃO DEVE cobrir também `CV_EXTRACTOR_FAKE` (mesmo idioma), e `AUTH_LOGIN_ENABLED`
   DEVE permanecer com sua semântica atual (`!== 'false'`) (FLAG-04).

**Independent Test**: unit de `parseBooleanFlag` (todas as grafias + valor desconhecido → sentinela que reprova em
`z.boolean()`); unit de `parseEnv` (variações de `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE` sobre a base
`validEnv` de `env.test.ts`).

---

### P1: Guard de deploy Vercel preservado (não regredir a proteção fail-closed)

**User Story**: Como responsável pela segurança, quero que **nenhuma** grafia de `RATE_LIMIT_DISABLED` desligue o
rate limit num **deploy Vercel real**, e que o **build de CI/E2E** (sem `VERCEL_ENV`) continue podendo usar a flag,
para não regredir o hardening (US #200 / ADR-0029) nem quebrar o E2E de CI.

**Why P1**: Memória do projeto: o guard mira `VERCEL_ENV` (não `NODE_ENV`) exatamente para o E2E de CI funcionar.
O parse novo **não pode** afrouxar isso.

**Acceptance Criteria**:

1. QUANDO `VERCEL_ENV` é `'production'` ou `'preview'` **e** `RATE_LIMIT_DISABLED` resolve `true` (via `'1'`,
   `'true'`, …) ENTÃO `parseEnv` DEVE **lançar** (superRefine dispara para a grafia nova também) (VERCEL-01).
2. QUANDO `VERCEL_ENV` é **ausente** (CI/local) e `NODE_ENV='production'` e `RATE_LIMIT_DISABLED='true'` ENTÃO
   `parseEnv` **NÃO** DEVE lançar (caminho do E2E de CI preservado) (VERCEL-02).
3. QUANDO a mudança de parse é feita ENTÃO o `superRefine` (chave `VERCEL_ENV`) DEVE permanecer **textualmente
   intacto** — a alteração toca **apenas** o `preprocess` do campo (VERCEL-03).

**Independent Test**: unit de `parseEnv` com `VERCEL_ENV=production` + `RATE_LIMIT_DISABLED=1` → lança; sem
`VERCEL_ENV` + `NODE_ENV=production` + `RATE_LIMIT_DISABLED=true` → não lança; o mesmo par para `CV_EXTRACTOR_FAKE`.

---

### P1: Fetch de dados do client router (prefetch + navegação client-side real) não consome nem bloqueia bucket

> **AC atualizado no ciclo de fix pós-Verifier (2026-07-12).** O achado empírico do Verifier (live outcome-check
> com `npm run build && npm run start` real + `curl -v` + browser Chromium real via Playwright) refutou a
> premissa original: o header `Next-Router-Prefetch: 1` — a doc do Next 15 promete, mas o servidor real (Next
> 15.5.18) **nunca o entrega** a `request.headers` dentro do Edge Middleware (consumido internamente antes de
> invocar o middleware do usuário; mesmo destino do header `RSC` e do query `_rsc`). Como isso também vale para
> uma navegação client-side real (clique em `<Link>` que completa a rota — mesma função de fetch,
> `fetchServerResponse`, mesmos headers), **nenhum sinal disponível no middleware desta versão diferencia
> prefetch de navegação client-side real**. Decisão ancorada na intenção do achado PUB-1b ("navegar normalmente
> pelo portal não deve estourar o teto anônimo"): o bypass passa a cobrir **as duas** — só a navegação de
> **documento** (hard load/endereço) continua contando. Ver Assumptions para as linhas supersedidas e a evidência.

**User Story**: Como visitante anônimo, quero que os prefetches automáticos e a navegação client-side real dos
links da home **não gastem** minha cota de rate limit, para que minha **navegação de documento** não receba 429.

**Why P1**: PUB-1b (P1). É o defeito que trava a navegação pública recém-lançada (Fase 7).

**Acceptance Criteria**:

1. QUANDO um request carrega o header `Next-Url` (fetch de dados do client router — prefetch **ou** navegação
   client-side real) ENTÃO o middleware **NÃO** DEVE registrar hit no `rateLimiter` nem retornar 429 — segue
   para o gate de sessão + headers de segurança (PREF-01).
2. QUANDO um request carrega o header `Next-Url` ENTÃO a resposta **NÃO** DEVE incluir headers `X-RateLimit-*`
   (não é contabilizado) (PREF-02).
3. QUANDO N fetches de dados do client router (N > teto anônimo) do mesmo IP são processados ENTÃO uma
   **navegação de documento** subsequente do mesmo IP DEVE ser permitida (bucket intacto) (PREF-03).
4. QUANDO um request é uma **mutação** (método ≠ GET/HEAD) ENTÃO o bypass **NÃO** DEVE se aplicar, mesmo que o
   request carregue `Next-Url` — o gate de método é explícito no código (defesa em profundidade; PUB-2 exige que
   POST sempre conte).

**Independent Test**: unit de `isRouterDataRequest` (header `Next-Url` presente/ausente; regressão comprovando que
`Next-Router-Prefetch` sozinho NÃO basta); unit de middleware — 15 requests com `Next-Url` do IP X não geram 429 e
não incrementam o bucket, navegação de documento do IP X depois segue 200; POST com `Next-Url` em `/cadastro`
continua contando em `registration` (3/15min).

---

### P1: 429 de navegação de documento → página PT-BR (casca mínima)

**User Story**: Como visitante que estourou o limite navegando, quero ver uma **página em português** explicando o
bloqueio, em vez de JSON cru, para entender o que houve.

**Why P1**: PUB-1c (P1). JSON cru no navegador é UX inaceitável na fachada pública.

**Acceptance Criteria**:

1. QUANDO um request de **documento** (`Accept: text/html`) é bloqueado (429) ENTÃO a resposta DEVE ser
   **HTML PT-BR** (`Content-Type: text/html; charset=utf-8`), casca mínima self-contained, com título/mensagem de
   "muitas requisições" e o tempo de espera (`Retry-After`) (P429-01).
2. QUANDO um request **RSC/fetch/Server Action** (`Accept` sem `text/html` — tipicamente `*/*` ou
   `text/x-component`) é bloqueado (429) ENTÃO a resposta DEVE continuar sendo o **JSON**
   `{ok:false, error:{code:'RATE_LIMITED', message:…}}` atual — **inalterado** (P429-02). **Correção pós-Verifier**:
   o check `rsc==='1'` era código morto (o header `rsc` também nunca chega ao middleware — mesma raiz de PREF-01)
   e foi removido; `Accept` sozinho já era e continua sendo o único sinal confiável.
3. QUANDO qualquer 429 é emitido (HTML ou JSON) ENTÃO a resposta DEVE carregar `Retry-After`, os headers
   `X-RateLimit-*` e **todos** os headers de segurança (CSP etc.), e `Cache-Control: no-store` (P429-03).

**Independent Test**: unit de `isDocumentRequest` (matriz de `Accept`); unit de `renderRateLimitedHtml` (contém
PT-BR, sem `http(s)://` externo); unit de middleware — Accept text/html no 429 → `text/html` + CSP; Accept
genérico (`*/*`/`text/x-component`, assinatura real de RSC/Server Action) no 429 → JSON `{ok:false}` + CSP.

---

### P1: Cota `registration` só em mutação; `/cadastro-assistido` fora do bucket

**User Story**: Como visitante que só **olhou** a página de cadastro (GET/prefetch), quero **não** ser trancado por
15 minutos; e como assistente social no fluxo interno `/cadastro-assistido`, quero não cair na cota de
auto-cadastro público.

**Why P1**: PUB-2 e SOC-1 (P1). A cota 3/15min foi dimensionada para **submissões** (TD §8), não para leituras.

**Acceptance Criteria**:

1. QUANDO um **GET** (ou HEAD/prefetch) chega a `/cadastro` (ou `/cadastro/consentimento`) ENTÃO o middleware
   **NÃO** DEVE classificá-lo como `registration` — cai em `anonymous` (10/min) ou `authenticated` (60/min)
   conforme o cookie (REG-01).
2. QUANDO um **POST** (Server Action/submit) chega a `/cadastro` ou `/cadastro/consentimento` ENTÃO o middleware
   DEVE classificá-lo como `registration` (teto 3/15min preservado) (REG-02).
3. QUANDO um request chega a `/cadastro-assistido` ENTÃO o middleware **NÃO** DEVE classificá-lo como
   `registration` — cai em `authenticated` (com cookie de sessão da AS) ou `anonymous` (sem cookie) (REG-03).

**Independent Test**: unit de middleware — `X-RateLimit-Limit` de GET `/cadastro` = `10`; de POST `/cadastro` =
`3` e 4º POST → 429; de `/cadastro-assistido` com cookie = `60`, sem cookie = `10`; nunca `3` para
`/cadastro-assistido`.

---

## Edge Cases

- QUANDO `RATE_LIMIT_DISABLED` é `'TRUE'`/`'On'`/`'1 '` (caixa/espaços) ENTÃO DEVE resolver `true` (trim +
  lowercase) — FLAG-01.
- QUANDO `RATE_LIMIT_DISABLED='true'` (proteção desligada) ENTÃO **nenhum** 429 é emitido (HTML **ou** JSON) — o
  ramo de bloqueio depende de `!env.RATE_LIMIT_DISABLED` (comportamento existente preservado).
- QUANDO um request é **fetch de dados do client router (prefetch ou soft-nav) de rota protegida sem cookie**
  ENTÃO o gate de sessão ainda pode redirecionar (307 /login) — o bypass só ignora o **rate limit**, não o gate.
- QUANDO um request é uma **mutação (POST) que carrega o header `Next-Url`** ENTÃO o bypass **NÃO** DEVE se
  aplicar — o gate de método é explícito no código (o bucket `registration` continua contando a submissão).
- QUANDO uma navegação de documento **sem** header `Accept` chega ao 429 ENTÃO cai no ramo **JSON** (falha segura:
  na ausência de sinal de HTML, não se serve HTML) — P429-02.
- QUANDO um POST chega a `/cadastro-assistido` ENTÃO segue `authenticated`/`anonymous` (mutação **não** reativa
  `registration` fora do segmento público) — REG-03.
- QUANDO `/api/*` é acessado ENTÃO continua **sem** rate limit e **sem** gate (branch dedicado H2 intacto —
  invariante de regressão, não reintroduzido aqui).

---

## Must-Nots (world-level prohibitions)

Cada must-not exige um teste negativo que assevera que o resultado proibido não ocorre (ver validate.md §6b).

| ID | QUANDO [contexto] ENTÃO o sistema NÃO DEVE… | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| RL-MN-01 | QUANDO um request carrega o header `Next-Url` (fetch de dados do client router — prefetch **ou** navegação client-side real, indistinguíveis no middleware real) ENTÃO NÃO DEVE registrar hit no `rateLimiter` nem emitir 429 — e uma navegação de **documento** subsequente do mesmo IP NÃO DEVE ser bloqueada por conta desses fetches. **AC atualizado (ciclo de fix pós-Verifier)**: sinal trocado de `Next-Router-Prefetch` (confirmado morto no servidor real) para `Next-Url` (confirmado sobrevivente); escopo ampliado de "só prefetch" para "prefetch + soft-nav", ancorado na intenção de PUB-1b. | Navegação pública recebendo 429 por prefetch/soft-nav (PUB-1b). | T4 | Unit: 15 requests com `Next-Url` do IP X → 0×429; navegação de documento do IP X depois → não-429; regressão: `Next-Router-Prefetch` sozinho (sem `Next-Url`) NÃO isenta o bucket; POST com `Next-Url` em `/cadastro` continua contando em `registration`. |
| RL-MN-02 | QUANDO um GET/HEAD/prefetch chega a `/cadastro` (ou `/cadastro/consentimento`) ENTÃO NÃO DEVE ser classificado como `registration` (nem consumir a cota 3/15min). | Lockout de 15min do visitante que só abriu o cadastro (PUB-2). | T4 | Unit: 4 GET `/cadastro` do mesmo IP → nenhum 429 por `registration` (`X-RateLimit-Limit=10`); depois um POST `/cadastro` ainda tem os 3 de `registration` intactos. |
| RL-MN-03 | QUANDO um request chega a `/cadastro-assistido` ENTÃO NÃO DEVE ser classificado como `registration`. | Fluxo interno da AS trancado pela cota de auto-cadastro público (SOC-1). | T4 | Unit: `/cadastro-assistido` com cookie → `X-RateLimit-Limit=60`; sem cookie → `10`; **nunca** `3`. |
| RL-MN-04 | QUANDO `RATE_LIMIT_DISABLED` (ou `CV_EXTRACTOR_FAKE`) recebe um valor não reconhecido ENTÃO `parseEnv` NÃO DEVE resolvê-lo como `false` silencioso — DEVE lançar. | Desligar/enganar a proteção por parse silencioso (PUB-1a). | T2 | Unit: `parseEnv({…valid, RATE_LIMIT_DISABLED:'maybe'})` lança citando o campo; `parseBooleanFlag('maybe')` retorna sentinela que reprova em `z.boolean()`. |
| RL-MN-05 | QUANDO `VERCEL_ENV` é `production`/`preview` e `RATE_LIMIT_DISABLED` resolve `true` (qualquer grafia) ENTÃO `parseEnv` NÃO DEVE deixar passar — e o guard NÃO DEVE mirar `NODE_ENV` (o caminho CI/E2E sem `VERCEL_ENV` continua permitido). | Regressão do hardening fail-closed / quebra do E2E de CI (memória do projeto). | T2 | Unit: `VERCEL_ENV=production` + `RATE_LIMIT_DISABLED=1` → lança; sem `VERCEL_ENV` + `NODE_ENV=production` + `=true` → não lança; `superRefine` inalterado. |
| RL-MN-06 | QUANDO um request RSC/fetch/Server Action é bloqueado (429) ENTÃO a resposta NÃO DEVE ser HTML — DEVE manter o JSON `{ok:false,…}` no shape do `ActionResult`. **Correção pós-Verifier**: o check `rsc==='1'` era código morto (removido); o discriminador é `Accept` sozinho. | Quebrar Server Actions/RSC que esperam JSON (PUB-1c). | T4 | Unit: 429 com Accept genérico (`*/*`/`text/x-component`, assinatura real de RSC/Server Action) → `content-type` JSON e body `{ok:false, error:{code:'RATE_LIMITED'}}`. |
| RL-MN-07 | QUANDO esta unidade é implementada ENTÃO NÃO DEVE alterar os tetos/janelas de `RATE_LIMITS`, nem o algoritmo de `rateLimit.ts`, nem adicionar dependência ou migração. | Violar a premissa "o desenho do rate limit fica como está". | T4 | Unit/guard: valores de `RATE_LIMITS` inalterados (10/60/3/5/20 + janelas); `git diff` não toca `rateLimit.ts` nem `package.json`/`prisma/migrations` (build gate). |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PUB-1a (upstream, canônico) | P1 Parse robusto | Tasks | Implementing |
| PUB-1b (upstream, canônico) | P1 Prefetch | Tasks | Implementing |
| PUB-1c (upstream, canônico) | P1 Página 429 | Tasks | Implementing |
| PUB-2 (upstream, canônico) | P1 Registration por mutação | Tasks | Implementing |
| SOC-1 (upstream, canônico) | P1 /cadastro-assistido | Tasks | Implementing |
| FLAG-01..04 (local) | P1 Parse robusto | Tasks | Implementing |
| VERCEL-01..03 (local) | P1 Guard Vercel | Tasks | Implementing |
| PREF-01..03 (local) | P1 Prefetch | Tasks | Implementing |
| P429-01..03 (local) | P1 Página 429 | Tasks | Implementing |
| REG-01..03 (local) | P1 Registration/assistido | Tasks | Implementing |
| RL-MN-01..07 (local) | P1 (todas) | Tasks | Implementing |

**ID format:** achados do dossiê são canônicos (PUB-1a/b/c, PUB-2, SOC-1); locais em `[AREA]-NN` e must-nots em
`RL-MN-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 5 upstream + 16 locais + 7 must-nots = 28 itens; todos mapeados a tasks em `tasks.md`.

---

## Success Criteria

- [x] `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE=1`/`true`/`on` → `true`; valor desconhecido → boot falha ruidoso;
      `AUTH_LOGIN_ENABLED` intacto (FLAG-*, RL-MN-04 verdes).
- [x] Guard Vercel preserva fail-closed no deploy real e permite o caminho CI/E2E sem `VERCEL_ENV` (VERCEL-*,
      RL-MN-05 verdes; `superRefine` textualmente inalterado).
- [x] Fetch de dados do client router (prefetch + navegação client-side real) nunca consome bucket nem gera 429;
      navegação de documento depois de um storm de prefetch/soft-nav segue 200 — **confirmado ao vivo** (build +
      start real, browser Chromium real via Playwright: 0 slots consumidos, vs. 8/10 antes do fix) (PREF-*,
      RL-MN-01 verdes). Scraping anônimo (GET sem `Next-Url`) e abuso de mutação (POST) continuam limitados —
      confirmado ao vivo com curl.
- [x] 429 de documento → HTML PT-BR com casca mínima + Retry-After + CSP; 429 de RSC/fetch → JSON `{ok:false}`
      inalterado (P429-*, RL-MN-06 verdes).
- [x] GET/prefetch `/cadastro` → anônimo (não trava 15min); POST `/cadastro` → `registration` 3/15min;
      `/cadastro-assistido` → autenticado/anônimo, nunca `registration` (REG-*, RL-MN-02/03 verdes).
- [x] `RATE_LIMITS`/`rateLimit.ts` inalterados; sem dep nova; sem migração (RL-MN-07 verde).
- [x] Contrato de `middleware.test.ts` preservado onde é invariante (headers de segurança em toda resposta,
      anti-spoof de IP, gate de sessão, `/api` nunca rate-limitado); o único teste ajustado é o de `registration`
      (GET→POST) por mudança **deliberada** de contrato (PUB-2), com teste novo de GET→anônimo.
- [x] Gates verdes: typecheck, lint, unit; build `NODE_ENV=production`; **zero migração, zero dependência nova**.
