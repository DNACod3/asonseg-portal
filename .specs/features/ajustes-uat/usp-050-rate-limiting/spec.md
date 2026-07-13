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
- [x] **Fetch de dados do client router (prefetch e navegação client-side real) não penaliza indevidamente** o
      volume típico de navegação — reconhecido pelo header `Next-Url` (PUB-1b), roteado para a categoria própria
      `routerData` (teto 60/min — **não um bypass**). **AC atualizado duas vezes** (ver Assumptions): iteração 2
      trocou o sinal morto `Next-Router-Prefetch` por `Next-Url`; iteração 3 (verificação adversarial — `Next-Url`
      é forjável) trocou o bypass total por esse teto finito, preservando a proteção anti-scraping (ADR-0029).
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
| Alterar tetos/janelas das categorias **herdadas** ou o algoritmo de janela deslizante (`rateLimit.ts`) | **Premissa inviolável da Fase 8** para `anonymous`/`authenticated`/`registration`/`passwordReset`/`responsibleLookup`: ficam byte-a-byte como estão. **Reconciliado na iteração 3** (RL-MN-07/RL-MN-08): a chave nova `routerData` é uma adição explicitamente autorizada para corrigir o achado adversarial (`Next-Url` forjável) — não uma alteração das categorias existentes nem do algoritmo de `rateLimit.ts`. |
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
| **Sinal real de fetch do client router (prefetch + navegação client-side real)** = header `Next-Url` presente. | agent | `isRouterDataRequest` testa `headers.get('next-url') !== null` (+ fallback legado `purpose: prefetch`, não confirmado). | Confirmado empiricamente (mesmo ciclo de fix): `Next-Url` é o único sinal RSC que sobrevive ao middleware nesta versão — setado pelo client router em **toda** fetch de dados RSC (`fetchServerResponse`), tanto prefetch quanto a fetch que completa uma navegação client-side real, pois **nenhum sinal as diferencia** no middleware desta versão (mesma raiz do achado do Verifier). Confirmado **ausente** em: (a) navegação de documento real (`Accept: text/html`, `Sec-Fetch-Mode: navigate`, sem `Next-Url`); (b) um Server Action POST real (`Next-Action`, `Content-Type: text/plain`, sem `Next-Url`). **Nota (iteração 3)**: por ser um header comum, `Next-Url` é forjável — por isso NÃO vira um bypass (ver linha "AC final" abaixo); a ausência confirmada em (a)/(b) só garante que o roteamento para `routerData` não confunde documento/mutação com router-fetch. | **y — confirmado ao vivo** |
| ~~**AC alterado (PREF-01/02/03, RL-MN-01), iteração 2**: bypass TOTAL do rate limit para toda fetch de dados do client router (prefetch + soft-nav).~~ **SUPERSEDIDO na iteração 3** — ver as duas linhas abaixo. | agent | ~~Opção (a) do ciclo de fix (iteração 2): excluir toda fetch de dados do client router da contagem.~~ | **Refutado empiricamente pela verificação adversarial (iteração 3)**: `Next-Url` é **forjável** por qualquer cliente (`curl -H "Next-Url: /" ...` em loop nunca gerava 429) — um bypass total baseado nele é um opt-out gratuito e não-autenticado da proteção anti-scraping de **toda** rota GET pública (US #200/#201, ADR-0029), não apenas do bucket anônimo. Lição L-016 registrada. | **n — refutado ao vivo (adversarial)** |
| **AC final (PREF-01/02/03, RL-MN-01), iteração 3**: GET/HEAD com `Next-Url` cai numa categoria própria `routerData` — teto **generoso-mas-finito** (60/min), NÃO um bypass. Conta e bloqueia como qualquer outra categoria; só não penaliza o volume típico de navegação real. | agent | `resolveCategory` roteia `!isMutation && isRouterDataRequest(headers)` para `'routerData'` **antes** das demais categorias; `RATE_LIMITS.routerData = { limit: 60, windowMs: 60_000 }` (`shared/lib/rateLimit.ts`). | Ancorado na intenção real de PUB-1b ("navegar normalmente pelo portal não deve estourar o teto anônimo") **sem** abrir a brecha de scraping que o bypass total (iteração 2) introduzia. Volume medido: uma navegação real dispara ~8-15 router-fetches por load (dossiê PUB-1b; confirmado no outcome-check da iteração 2 — 8/10 do bucket anônimo consumidos por 1 load da home antes do fix). 60/min dá ~4-7x de folga sobre um único load (cobre várias páginas/min de navegação real) e reusa o teto já aceito de `authenticated` (não é um número novo inventado) — mas ainda limita um scraper forjando o header a no máximo 1 req/s sustentado. Confirmado ao vivo: `curl -H "Next-Url: /" ...` em loop no mesmo IP → 60× 200, 61ª → 429 (cenário adversarial b′ do Verifier, reproduzido e agora bloqueado). | **y — confirmado ao vivo (build+start real, cenário adversarial reproduzido e corrigido)** |
| **`RATE_LIMITS.routerData` é uma ADIÇÃO explicitamente autorizada** (iteração 3), não uma alteração das categorias herdadas — reconcilia com RL-MN-07 (que proíbe alterar tetos/janelas das categorias **existentes**, não proíbe adicionar uma categoria nova para corrigir um achado de segurança). | agent | `RATE_LIMITS` ganha a chave `routerData`; `anonymous`/`authenticated`/`registration`/`passwordReset`/`responsibleLookup` permanecem byte-a-byte idênticos (ver `git diff` do commit). | Autorizado explicitamente pelo coordenador na iteração 3 do ciclo de fix, para corrigir o achado adversarial (Next-Url forjável) sem reintroduzir o bug original (PUB-1b) nem deixar a brecha aberta. `rateLimit.ts` (algoritmo de janela deslizante) continua intocado. | y |
| **Sinal de navegação de documento** (para servir HTML) = `Accept` contém `text/html`. | agent | `isDocumentRequest(req)`. | Navegação de documento (hard load / barra de endereço) sempre manda `Accept: text/html,…` (confirmado empiricamente: `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`). Requests RSC/fetch/Server Action mandam um `Accept` genérico (`*/*`/`text/x-component`) — confirmado tanto para prefetch/soft-nav quanto para um Server Action POST real. **Check `rsc==='1'` removido no ciclo de fix** (código morto — o header `rsc` também nunca chega ao middleware, mesma raiz do achado do Verifier); `Accept` sozinho já era e continua sendo o único sinal confiável. | y |
| **Mutação** = método HTTP **≠ GET e ≠ HEAD** (na prática, POST — único transporte de mutação do app: Server Actions e form submits). | agent | `isMutationRequest = method !== 'GET' && method !== 'HEAD'`. | Server Actions do Next são **sempre POST** (inclusive o fallback pré-hidratação de `<form method=post>`). GET/HEAD = leitura (documento, RSC nav, prefetch). Assim a submissão de cadastro pega `registration` e a leitura da página não. | y |
| **Matcher de `registration`** = `path === '/cadastro' || path.startsWith('/cadastro/')` (segmento exato do fluxo público, inclui `/cadastro/consentimento`). | agent | Substitui `startsWith('/cadastro') || startsWith('/cadastrar')`. | O segmento-exato exclui `/cadastro-assistido` (não é `=== '/cadastro'` nem começa com `/cadastro/`) → resolve SOC-1, e mantém o passo de consentimento (`/cadastro/consentimento`) sob `registration` para mutação. O ramo `startsWith('/cadastrar')` era **código morto** (não há rota `/cadastrar` top-level; `/empresa/cadastrar` não casava) — removido sem mudança de comportamento. | y |
| **Parse robusto aplicado também a `CV_EXTRACTOR_FAKE`** (mesmo idioma frágil `=== 'true'`, mesma justificativa fail-loud). **`AUTH_LOGIN_ENABLED` NÃO é tocado** (semântica diferente: `!== 'false'` = qualquer valor exceto 'false' liga). | agent | Helper puro `parseBooleanFlag` usado nas duas flags fail-closed; `AUTH_LOGIN_ENABLED` mantém seu preprocess. | `CV_EXTRACTOR_FAKE` tem o **mesmo bug silencioso** de `'1'`→false e o **mesmo** guard `VERCEL_ENV`. Uniformizar não inventa regra — é a mesma regra. `AUTH_LOGIN_ENABLED` tem intenção oposta (default-on, qualquer-valor-liga); mudá-la seria alterar semântica não reportada. | y |
| **`''` (string vazia) em `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE` → `false`** (equivalente a não-setada). | agent | `parseBooleanFlag('')` → `false`. | `.env` com `VAR=` (vazio) é intenção de "não ligado"; tratar como `false` evita boot quebrado por linha vazia. Valor **não-vazio e não-reconhecido** (ex.: `maybe`) → falha ruidoso. | y |
| **Página 429** = string HTML **self-contained** (sem asset externo, `<style>` inline permitido pela CSP `style-src 'unsafe-inline'`), servida pelo Edge com `Content-Type: text/html; charset=utf-8` e `Cache-Control: no-store`. | agent | `renderRateLimitedHtml(retryAfterSeconds)`. | O middleware retorna antes do roteamento Next → não há como usar uma rota/RSC. CSP da resposta (via `applySecurityHeaders`) proíbe origem externa; a casca é mínima e PT-BR. `no-store` evita CDN cachear um 429. | y |
| **Fetch de dados do client router preserva o gate de sessão** das rotas protegidas — só a **categoria de rate limit** muda (`routerData` em vez de `anonymous`/`authenticated`). | agent | `routerData` passa pelo MESMO `rateLimiter.check`/429/headers que qualquer categoria; o gate de sessão roda depois, igual para todas. | O achado é sobre **classificação** de rate limit, não sobre o gate de sessão (cuja autoridade real é `requireActivePerson()` no layout `(app)`, ADR-0030). Mexer no gate seria fora de escopo. | y |
| **Gate de método explícito na classificação `routerData`** = só se aplica a GET/HEAD, nunca a mutações (defesa em profundidade). | agent | `resolveCategory`: `!isMutation && isRouterDataRequest(headers)` → `'routerData'`, testado **antes** de `registration`. | Confirmado empiricamente que um Server Action POST real não carrega `Next-Url` (então o risco já seria zero), mas o gate explícito no código remove qualquer ambiguidade futura e ancora diretamente a premissa "mutação sempre conta em `registration` quando aplicável" do achado PUB-1b/PUB-2. | y |
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

### P1: Fetch de dados do client router (prefetch + navegação client-side real) cai num teto próprio, generoso-mas-finito

> **AC atualizado duas vezes.**
>
> **Iteração 2 (ciclo de fix pós-Verifier):** o live outcome-check refutou a premissa original — o header
> `Next-Router-Prefetch: 1` (a doc do Next 15 promete) **nunca chega** a `request.headers` no servidor real (Next
> 15.5.18); o sinal que sobrevive é `Next-Url`. Como prefetch e navegação client-side real são indistinguíveis no
> middleware desta versão, a correção da iteração 2 fez um **bypass total** para as duas.
>
> **Iteração 3 (verificação adversarial do Verifier — SUPERSEDE a iteração 2):** o bypass total foi refutado por
> ser **explorável** — `Next-Url` é um header comum, forjável por qualquer cliente HTTP (`curl -H "Next-Url: /"
> ...`). Um bypass rígido baseado nele vira um **opt-out gratuito e não-autenticado** do rate limit anônimo para
> **toda** rota GET pública, anulando a proteção anti-scraping do US #200/#201/ADR-0029 — não só o achado
> PUB-1b que a unidade deveria corrigir. Lição L-016 registrada.
>
> **Decisão final**: NÃO há bypass. GET/HEAD com `Next-Url` cai numa categoria própria `routerData`
> (`RATE_LIMITS.routerData`, `shared/lib/rateLimit.ts`) com teto **generoso-mas-finito** — conta e bloqueia como
> qualquer outra categoria, só que alto o bastante para não penalizar o volume típico de navegação real. Ver
> Assumptions para o volume medido, a justificativa do teto escolhido (60/min) e a evidência ao vivo (cenário
> adversarial reproduzido e agora bloqueado).

**User Story**: Como visitante anônimo, quero que os prefetches automáticos e a navegação client-side real dos
links da home **não gastem indevidamente** minha cota de rate limit numa navegação normal, **e** quero que um
scraper que force esse mesmo sinal **continue sendo limitado**, para que a proteção anti-abuso da fachada pública
não seja anulada.

**Why P1**: PUB-1b (P1) — defeito original. ADR-0029/US #200 (P1) — a correção da iteração 2 não pode reabrir a
proteção anti-scraping que essas decisões estabeleceram.

**Acceptance Criteria**:

1. QUANDO um request GET/HEAD carrega o header `Next-Url` (fetch de dados do client router — prefetch **ou**
   navegação client-side real) ENTÃO o middleware DEVE classificá-lo na categoria `routerData` e contá-lo contra
   esse bucket — **NÃO** um bypass total (PREF-01).
2. QUANDO um request cai em `routerData` ENTÃO a resposta DEVE incluir os headers `X-RateLimit-*` refletindo o
   bucket `routerData` (limite 60), distintos do bucket `anonymous`/`authenticated` (PREF-02).
3. QUANDO o volume típico de uma navegação real (uma dezena de router-fetches por load — bem abaixo do teto de
   60/min) é processado do mesmo IP ENTÃO nenhum 429 deve ocorrer, e uma **navegação de documento** subsequente do
   mesmo IP (bucket `anonymous`/`authenticated` independente) também DEVE ser permitida (PREF-03).
4. QUANDO um cliente **forja** o header `Next-Url` e excede o teto de `routerData` (60 requests/min do mesmo IP)
   ENTÃO o middleware DEVE bloquear com 429 — o forjamento do header **NÃO** DEVE ser um opt-out infinito do rate
   limit (RL-MN-08, novo must-not desta iteração).
5. QUANDO um request é uma **mutação** (método ≠ GET/HEAD) ENTÃO NUNCA cai em `routerData` mesmo que carregue
   `Next-Url` — o gate de método é explícito no código (defesa em profundidade; PUB-2 exige que POST sempre conte
   em `registration` quando aplicável).

**Independent Test**: unit de middleware — 15 requests com `Next-Url` do IP X não geram 429 (headers refletem
`routerData`, limite 60); navegação de documento do IP X depois segue 200 (bucket independente); **60 requests com
`Next-Url` forjado do mesmo IP → 200, a 61ª → 429** (cenário adversarial); `Next-Router-Prefetch` sozinho (sem
`Next-Url`) cai em `anonymous`; POST com `Next-Url` em `/cadastro` continua contando em `registration` (3/15min).

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
  ENTÃO o gate de sessão ainda pode redirecionar (307 /login) mesmo estando sob a categoria `routerData` — a
  classificação de rate limit não afeta o gate de sessão.
- QUANDO um request é uma **mutação (POST) que carrega o header `Next-Url`** ENTÃO **NÃO** DEVE cair em
  `routerData` — o gate de método é explícito no código (o bucket `registration` continua contando a submissão).
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
| RL-MN-01 | QUANDO o volume típico de navegação real (fetches de dados do client router com `Next-Url` — prefetch **ou** soft-nav, indistinguíveis no middleware real) é processado ENTÃO NÃO DEVE gerar 429 nem penalizar uma navegação de **documento** subsequente do mesmo IP (bucket independente). **AC atualizado duas vezes**: iteração 2 trocou o sinal morto `Next-Router-Prefetch` por `Next-Url`; iteração 3 (verificação adversarial) trocou o **bypass total** (explorável — `Next-Url` é forjável) por uma categoria `routerData` com teto generoso-mas-finito (60/min) — ver RL-MN-08 abaixo para a face complementar (o teto DEVE bloquear quando excedido). | Navegação pública recebendo 429 por prefetch/soft-nav (PUB-1b) sem reabrir uma brecha de scraping (ADR-0029). | T4 | Unit: 15 requests com `Next-Url` do IP X → 0×429, headers refletem `routerData` (limite 60); navegação de documento do IP X depois → não-429; regressão: `Next-Router-Prefetch` sozinho (sem `Next-Url`) cai em `anonymous`; POST com `Next-Url` em `/cadastro` continua contando em `registration`. |
| RL-MN-02 | QUANDO um GET/HEAD/prefetch chega a `/cadastro` (ou `/cadastro/consentimento`) ENTÃO NÃO DEVE ser classificado como `registration` (nem consumir a cota 3/15min). | Lockout de 15min do visitante que só abriu o cadastro (PUB-2). | T4 | Unit: 4 GET `/cadastro` do mesmo IP → nenhum 429 por `registration` (`X-RateLimit-Limit=10`); depois um POST `/cadastro` ainda tem os 3 de `registration` intactos. |
| RL-MN-03 | QUANDO um request chega a `/cadastro-assistido` ENTÃO NÃO DEVE ser classificado como `registration`. | Fluxo interno da AS trancado pela cota de auto-cadastro público (SOC-1). | T4 | Unit: `/cadastro-assistido` com cookie → `X-RateLimit-Limit=60`; sem cookie → `10`; **nunca** `3`. |
| RL-MN-04 | QUANDO `RATE_LIMIT_DISABLED` (ou `CV_EXTRACTOR_FAKE`) recebe um valor não reconhecido ENTÃO `parseEnv` NÃO DEVE resolvê-lo como `false` silencioso — DEVE lançar. | Desligar/enganar a proteção por parse silencioso (PUB-1a). | T2 | Unit: `parseEnv({…valid, RATE_LIMIT_DISABLED:'maybe'})` lança citando o campo; `parseBooleanFlag('maybe')` retorna sentinela que reprova em `z.boolean()`. |
| RL-MN-05 | QUANDO `VERCEL_ENV` é `production`/`preview` e `RATE_LIMIT_DISABLED` resolve `true` (qualquer grafia) ENTÃO `parseEnv` NÃO DEVE deixar passar — e o guard NÃO DEVE mirar `NODE_ENV` (o caminho CI/E2E sem `VERCEL_ENV` continua permitido). | Regressão do hardening fail-closed / quebra do E2E de CI (memória do projeto). | T2 | Unit: `VERCEL_ENV=production` + `RATE_LIMIT_DISABLED=1` → lança; sem `VERCEL_ENV` + `NODE_ENV=production` + `=true` → não lança; `superRefine` inalterado. |
| RL-MN-06 | QUANDO um request RSC/fetch/Server Action é bloqueado (429) ENTÃO a resposta NÃO DEVE ser HTML — DEVE manter o JSON `{ok:false,…}` no shape do `ActionResult`. **Correção pós-Verifier**: o check `rsc==='1'` era código morto (removido); o discriminador é `Accept` sozinho. | Quebrar Server Actions/RSC que esperam JSON (PUB-1c). | T4 | Unit: 429 com Accept genérico (`*/*`/`text/x-component`, assinatura real de RSC/Server Action) → `content-type` JSON e body `{ok:false, error:{code:'RATE_LIMITED'}}`. |
| RL-MN-07 | QUANDO esta unidade é implementada ENTÃO NÃO DEVE alterar os tetos/janelas das categorias **herdadas** de `RATE_LIMITS` (`anonymous`/`authenticated`/`registration`/`passwordReset`/`responsibleLookup`), nem o algoritmo de `rateLimit.ts`, nem adicionar dependência ou migração. **Reconciliado na iteração 3**: a chave nova `routerData` é uma **adição** explicitamente autorizada para corrigir o achado adversarial (RL-MN-08) — não uma alteração das categorias existentes; o must-not original mirava exatamente isso ("o desenho do rate limit fica como está" = as categorias que já existiam, não proíbe estender o desenho para fechar uma brecha de segurança). | Violar a premissa "o desenho do rate limit fica como está" nas categorias herdadas; ao mesmo tempo, não bloquear a correção de um achado de segurança legítimo. | T4 | Unit/guard: valores de `anonymous`/`authenticated`/`registration`/`passwordReset`/`responsibleLookup` inalterados (10/60/3/5/20 + janelas); `routerData` = `{60, 60_000}` (novo, documentado); `git diff` não toca `rateLimit.ts` (algoritmo) nem `package.json`/`prisma/migrations` (build gate); `env.ts`/`superRefine` inalterados. |
| RL-MN-08 | QUANDO um cliente **forja** o header `Next-Url` (sem de fato ser o client router do Next) e excede o teto de `routerData` (60 requests/min por IP) ENTÃO o middleware DEVE bloquear com 429 — o header **NÃO** DEVE funcionar como opt-out infinito e não-autenticado do rate limit anônimo. | Anular a proteção anti-scraping de toda rota GET pública ao forjar um header comum (achado adversarial do Verifier, iteração 3; ADR-0029/US #200; lição L-016). | T4 (fix cycle — iteração 3) | Unit: 60 requests com `Next-Url` forjado do mesmo IP → 200, a 61ª → 429, `X-RateLimit-Limit=60`. Live: `curl -H "Next-Url: /" ...` em loop no mesmo IP → eventualmente 429 (reproduz e corrige o cenário adversarial b′ do Verifier). |

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
| PREF-01..05 (local) | P1 routerData (ex-Prefetch) | Tasks | Implementing |
| P429-01..03 (local) | P1 Página 429 | Tasks | Implementing |
| REG-01..03 (local) | P1 Registration/assistido | Tasks | Implementing |
| RL-MN-01..08 (local) | P1 (todas) | Tasks | Implementing |

**ID format:** achados do dossiê são canônicos (PUB-1a/b/c, PUB-2, SOC-1); locais em `[AREA]-NN` e must-nots em
`RL-MN-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 5 upstream + 18 locais + 8 must-nots = 31 itens (PREF ganhou +2 ACs e RL-MN ganhou +1 must-not na
iteração 3); todos mapeados a tasks em `tasks.md`.

---

## Success Criteria

- [x] `RATE_LIMIT_DISABLED`/`CV_EXTRACTOR_FAKE=1`/`true`/`on` → `true`; valor desconhecido → boot falha ruidoso;
      `AUTH_LOGIN_ENABLED` intacto (FLAG-*, RL-MN-04 verdes).
- [x] Guard Vercel preserva fail-closed no deploy real e permite o caminho CI/E2E sem `VERCEL_ENV` (VERCEL-*,
      RL-MN-05 verdes; `superRefine` textualmente inalterado).
- [x] Fetch de dados do client router (prefetch + navegação client-side real) cai na categoria própria
      `routerData` (60/min) — NÃO um bypass; volume típico de navegação real fica bem abaixo do teto e não gera
      429 — **confirmado ao vivo** (build + start real, browser Chromium real via Playwright: bucket `anonymous`
      quase intacto após o storm) (PREF-*, RL-MN-01 verdes).
- [x] **Iteração 3 — achado adversarial corrigido**: `Next-Url` forjado em loop pelo mesmo IP eventualmente toma
      429 (teto de 60/min) — **confirmado ao vivo** (`curl -H "Next-Url: /" ...` × 60 → 200, 61ª → 429); scraping
      anônimo (GET sem `Next-Url`) e abuso de mutação (POST) continuam limitados normalmente — confirmado ao vivo
      com curl (RL-MN-08 verde).
- [x] 429 de documento → HTML PT-BR com casca mínima + Retry-After + CSP; 429 de RSC/fetch → JSON `{ok:false}`
      inalterado (P429-*, RL-MN-06 verdes).
- [x] GET/prefetch `/cadastro` → anônimo (não trava 15min); POST `/cadastro` → `registration` 3/15min;
      `/cadastro-assistido` → autenticado/anônimo, nunca `registration` (REG-*, RL-MN-02/03 verdes).
- [x] Categorias herdadas de `RATE_LIMITS` (`anonymous`/`authenticated`/`registration`/`passwordReset`/
      `responsibleLookup`) e `rateLimit.ts` (algoritmo) inalterados; `routerData` é adição explicitamente
      autorizada (iteração 3); sem dep nova; sem migração; `env.ts`/`superRefine` inalterados (RL-MN-07 verde).
- [x] Contrato de `middleware.test.ts` preservado onde é invariante (headers de segurança em toda resposta,
      anti-spoof de IP, gate de sessão, `/api` nunca rate-limitado); o único teste ajustado é o de `registration`
      (GET→POST) por mudança **deliberada** de contrato (PUB-2), com teste novo de GET→anônimo.
- [x] Gates verdes: typecheck, lint, unit; build `NODE_ENV=production`; **zero migração, zero dependência nova**.
