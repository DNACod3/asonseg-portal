# Spec — Fase 6 · U3: Hardening de Segurança + Gaps LGPD (código)

**Feature slug:** `fase-6-hardening`
**Tipo de unidade:** ad-hoc de hardening — **NÃO** é linha-USP do ROADMAP (não marca checkbox). Mesma
forma dos precedentes AD-013 (reconciliação Fase-0) e AD-021 (review-fixes da Fase 4). Registrada como
**AD-023** em STATE (o orquestrador é o dono de STATE.md — este spec só referencia o id pretendido).
**Branch:** `feat/fase-6-relatorios-home-hardening` (base `master`) — a mesma da Fase 6. **Não** criar branch nova.
**Meta:** fechar os gaps de segurança **corrigíveis por código** para a fase final do MVP —
headers/CSP, revisão dos rate-limits existentes, e os gaps LGPD que são trabalho de dev (não os
gated por jurídico/DPO). No ROADMAP: "Hardening de segurança; revisão LGPD com DPO; painel de
revogação de consentimentos (transversal, não-USP)".

**Glue do projeto (ponteiros — não repetir conteúdo):** `.specs/project/ROADMAP.md` (Fase 6, nota
transversal de hardening) · `.specs/project/STATE.md` (**B-001** DPO não designado; **B-003/B-004**
gates de deploy; AD-020 cascata de revogação; AD-022 "flag ao dono" LGPD) · `CLAUDE.md`
(sequência de Server Action sensível, View Models, `ActionResult` sem `throw`, `select`/`take`) ·
`docs/arch/project-guideline.md` (DoD de Server Action) · `docs/arch/architecture-document.md`
(§ segurança/atributos de qualidade) · ADR-0014 (CAPTCHA), ADR-0025/AD-020 (cascata), ADR-0029
(lockout), ADR-0030 (sessão), ADR-0009 (logging/PII).

> **Fronteira de fabricação:** só entram os itens de hardening abaixo (H1–H5) e os deferimentos
> declarados. A postura de segurança **já é forte** (headers via `middleware.ts`/`securityHeaders.ts`,
> rate-limit em memória + contadores duráveis, CAPTCHA em register/claim/reset, sessão dois-níveis
> ADR-0030, env fail-fast, logger com `redact`, guards estáticos). Este spec **não** re-planeja o que
> já existe — só fecha as lacunas nomeadas. Traceabilidade chaveada nos ids H-NNN; cada H que adiciona
> um controle vira **must-not** de primeira classe (MN-H1..MN-H5) com teste negativo obrigatório.

---

## Sizing verdict: **Large** (piso de sizing, regra dura)

- Multi-componente (Server Action + Edge middleware + guards estáticos + logger + Supabase SSR) sobre
  ~8 arquivos de produção + testes → não é Quick/Medium.
- **Piso de sizing:** todos os 5 itens incluídos são controles de segurança/privacidade — proibições
  de mundo ("login sob brute-force **não pode** passar sem CAPTCHA verificado"; "resposta `/api`
  **não pode** sair sem headers de segurança"; "action nova **não pode** subir sem gate de
  sessão/permissão"; "PII **não pode** vazar em claro no log"; "cookie de sessão **não pode** sair
  sem HttpOnly/Secure"). Materializados como **must-nots** com teste negativo discriminante cada → o
  auto-sizing **não pode** rebaixar. Design + Tasks obrigatórios.

---

## Escopo

**Em escopo (código, bounded):** exatamente H1–H5. Cada correção + o(s) teste(s) que a prova.

**Fora de escopo — DEFERIDOS (documentados em design.md §Deferimentos; sem código nesta unidade):**
DEF-1 CSP baseada em nonce · DEF-2 aplicação da cascata de revogação (efeito `ANONIMIZAR` incluso) ·
DEF-3 direito ao apagamento / anonimização total de PII na inativação · DEF-4 política de retenção de
PII operacional · DEF-5 store distribuído de rate-limit (Upstash) · DEF-6 CAPTCHA adaptativo por IP.
Cada um atado ao seu bloqueador em design.md.

---

## Requisitos e critérios de aceitação

### REQ-H1 — 🔒 CAPTCHA adaptativo no login (consistência ADR-0014)
**Gap:** `src/modules/identity/actions/login.ts` **não** chama o verificador de CAPTCHA (register,
claim e reset chamam — ADR-0014). Único freio no login é o lockout durável ≥5 falhas/(email,ip)/15min
(`domain/lockout.ts`, ADR-0029). Uma sessão de brute-force nas 4 primeiras tentativas passa sem
qualquer prova humana.

- **AC-H1-1** — Login com **menos** de `CAPTCHA_CHALLENGE_THRESHOLD` falhas recentes na chave
  `(email, ip)` prossegue **sem** CAPTCHA (fricção zero no caminho feliz; comportamento atual
  preservado). O widget não é exigido.
- **AC-H1-2** — Ao cruzar o limiar de desafio (`>= CAPTCHA_CHALLENGE_THRESHOLD`, **abaixo** do lockout
  de 5) e **antes** do lockout disparar, o login exige um `captchaToken` Turnstile válido: sem token,
  a action retorna `fail('CAPTCHA_REQUIRED', …)` **sem** chamar o provedor de auth.
- **AC-H1-3** — Com o `captchaToken` presente e verificado (`CAPTCHA_VERIFIER_TOKEN`, fail-closed) a
  action prossegue para a autenticação normal. Token inválido/expirado → `fail('CAPTCHA_REQUIRED', …)`.
- **AC-H1-4** — O `LoginForm` renderiza o widget Turnstile (mesmo padrão de cadastro/recuperar-senha)
  quando a action sinaliza `CAPTCHA_REQUIRED`, e reenvia com o token no retry.
- **MN-H1 (must-not)** — Uma tentativa de login cuja chave `(email, ip)` já cruzou o limiar de desafio
  **não pode** alcançar `provider.signInWithPassword` nem retornar sucesso sem um `captchaToken`
  Turnstile verificado. Verificação: teste negativo — `recent >= threshold` + sem token → `CAPTCHA_REQUIRED`
  e `signInWithPassword` **não** chamado (spy); `recent >= threshold` + token que o verificador stub
  rejeita → `CAPTCHA_REQUIRED`, provedor **não** chamado.

### REQ-H2 — 🔒 Headers de segurança nas rotas `/api` (cobertura)
**Gap:** o `config.matcher` do `middleware.ts` **exclui** `/api`, então os route handlers
(`src/app/api/cron/auth-attempts-retention`, `.../expire-jobs`, e qualquer futuro) respondem **sem**
nenhum header de segurança. A resposta 429 do próprio middleware já aplica `applySecurityHeaders` — a
mesma cobertura deve valer para `/api`.

- **AC-H2-1** — Uma resposta de rota `/api/**` carrega o conjunto de headers de segurança
  (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`; `Strict-Transport-Security` sob HTTPS).
- **AC-H2-2** — Rotas `/api` recebem **apenas** headers: **não** entram no bucket de rate-limit nem no
  gate de sessão (crons são protegidos por `CRON_SECRET`; rate-limitar cron quebraria o Vercel Cron).
  O corpo/status do handler é preservado (cron 200 `{ ok, deleted }` intacto).
- **MN-H2 (must-not)** — Uma resposta servida sob `/api/**` **não pode** sair sem os headers de
  segurança, e **não pode** ser bloqueada por rate-limit ou redirecionada pelo gate de sessão.
  Verificação: teste que invoca `middleware(request)` para um path `/api/...` e assere presença dos
  headers **e** ausência de 429/redirect.

### REQ-H3 — 🔒 Guard de convenção: toda Server Action tem gate de sessão/permissão (regressão)
**Gap:** não há guard estático que garanta que todo arquivo `'use server'` em `**/actions/*.ts` siga a
sequência canônica (validação Zod + `requirePermission`/gate de sessão). Uma action nova sem gate
passa despercebida no CI.

- **AC-H3-1** — Um teste de guard varre todo `src/modules/*/actions/*.ts` que declara `'use server'` e
  assere que cada um referencia ao menos um símbolo de gate (`requirePermission(`, `requireCoordinator(`,
  `requireActivePerson(`, `requireServiceAuthorization(`, `getCurrentPerson(`) **ou** consta na
  `PUBLIC_ACTION_ALLOWLIST` (paths absolutos, cada um com justificativa inline da sua própria defesa).
- **AC-H3-2** — A árvore **atual** passa limpa: a allowlist cobre exatamente as actions públicas por
  desenho — `registerPerson` (CAPTCHA), `login` (lockout+CAPTCHA), `request-password-reset`
  (CAPTCHA+teto IP), `request-credential-claim` (CAPTCHA), `reset-password` (token OTP de uso único),
  `acceptRoleConsent` (token HMAC `verifyConsentToken`). Nenhum buraco de autorização novo é
  introduzido.
- **MN-H3 (must-not)** — Uma **nova** action `'use server'` **não pode** subir sem referência a um gate
  de sessão/permissão **nem** entrada explícita (justificada) na allowlist. Verificação: predicado puro
  testado com entradas sintéticas — fonte sem gate e fora da allowlist → **violação**; fonte com gate →
  ok; fonte pública allowlisted → ok.

### REQ-H4 — 🔒 Redação de PII no logger (LGPD / ADR-0009)
**Gap:** `SENSITIVE_FIELDS` (`src/shared/lib/logger.ts`) não cobre campos PII do domínio
(`fullAddress`/`endereco`, `birthDate`, texto de CV). Os wildcards do pino (`*.campo`/`*.*.campo`)
**não** atravessam arrays (confirmado: elementos de array exigem path explícito `pai[*].campo`, e o
fast-redact permite só **um** wildcard por path). Módulos que logam PII via `console.*` também
contornam a redação do pino.

- **AC-H4-1** — `SENSITIVE_FIELDS` passa a cobrir os nomes reais de campos PII do domínio (verificados
  no schema): `fullAddress`, `endereco`, `birthDate`, o(s) campo(s) de texto bruto de CV do módulo
  `cv-extraction` (nome confirmado no módulo, **não** fabricado), além dos já existentes (cpf, rg,
  email, telefone, etc.). Os três alvos por campo (raiz, `*.`, `*.*.`) permanecem.
- **AC-H4-2** — Para shape(s) de array de PII efetivamente logado(s) no código, um path explícito
  `pai[*].campo` é adicionado. Se nenhum array de PII é logado hoje, o resíduo é documentado (achatar
  antes de logar) — sem path inventado.
- **AC-H4-3 (H4b — guard de console)** — Um teste de guard proíbe `console.*` em `src/modules/**` e
  `src/shared/**`, com allowlist de: `src/middleware.ts` (Edge — pino/Node não roda) e os pontos
  pré-existentes (`registerPerson.ts`, `acceptRoleConsent.ts`, marcados como migração follow-up). Novo
  código não pode logar fora do pino redator.
- **MN-H4 (must-not)** — Campos PII (`fullAddress`/`endereco`/`birthDate`/texto de CV/cpf/email/
  telefone) **não podem** aparecer em claro na saída estruturada do logger. Verificação: teste que loga
  um objeto aninhado (raiz, `*.`, `*.*.`, e um array conhecido) e assere `[REDACTED]` para cada; + o
  guard de console discrimina uma fonte sintética `console.log(pessoa)`.

### REQ-H5 — 🔒 Flags de segurança do cookie de sessão Supabase (pin/assert)
**Gap:** os atributos `HttpOnly`/`Secure`/`SameSite` do cookie de sessão são delegados aos defaults do
`@supabase/ssr` (o `options` é repassado verbatim em `createSupabaseServerClient().setAll`,
`src/shared/lib/supabase/server.ts`) e **não** são assertados — podem regredir em silêncio.

- **AC-H5-1** — Um helper puro (`secureCookieOptions(options, { isProd })`) aplica um **piso** de
  segurança preenchendo o que estiver ausente (`httpOnly ?? true`, `secure ?? isProd`,
  `sameSite ?? 'lax'`) **sem** rebaixar valores que o `@supabase/ssr` já define (comportamento
  preservado: o Supabase já emite HttpOnly/Secure/Lax para o auth-token).
- **AC-H5-2** — `setAll` roteia cada cookie por esse helper. O fluxo de login/logout existente segue
  verde.
- **MN-H5 (must-not)** — O cookie `sb-*-auth-token` **não pode** ser emitido sem `HttpOnly`, sem
  `Secure` em produção, ou com `SameSite: 'none'` (cross-site). Verificação: teste do helper puro —
  ausência → piso preenchido; `sameSite:'none'` vindo de upstream → o teste **falha** (assere
  `sameSite !== 'none'`), pegando a regressão.

---

## Assumptions pinned (resolvidas do código real)

1. **H1 é adaptativo, não always-on.** Limiar `CAPTCHA_CHALLENGE_THRESHOLD = 3` (abaixo do
   `LOCKOUT_THRESHOLD = 5`), chave `(email, ip)` — **reusa** o `attempts.recent(...)` já buscado para o
   lockout (zero query nova). O check de CAPTCHA vem **depois** do check de lockout (≥5 → LOCKED
   retorna antes; 3–4 → CAPTCHA_REQUIRED), então os testes de lockout existentes ficam intactos. A
   alternativa "always-on invisível" é **rejeitada** (adiciona dependência dura do Cloudflare ao
   caminho mais crítico: fail-closed bloquearia todos os logins durante uma queda do Turnstile —
   risco de disponibilidade). CAPTCHA adaptativo por IP (credential-stuffing entre e-mails) → DEF-6.
2. **H1 não conta como falha de credencial.** `CAPTCHA_REQUIRED` curto-circuita antes de
   `signInWithPassword` e **não** grava um `AuthAttempt` FAILURE (a credencial nem foi testada) — não
   acelera o lockout.
3. **H2 reusa `applySecurityHeaders` para `/api`** (um único code path; CSP é inócua em JSON — mesmo
   conjunto que a resposta 429 já carrega hoje). O matcher passa a **incluir** `/api`, com um branch
   inicial que aplica só headers e retorna (sem rate-limit, sem gate de sessão) para `/api`.
4. **H3 varre só arquivos `'use server'`.** Os helpers internos de orquestração (`transition-content`,
   `create-referral-application`, `enqueue-expiry-reminder`, `run-job-expiration`, `ensure-*-role`)
   **não** são `'use server'` (recebem `personId` de quem já os guardou) → fora da varredura, sem
   allowlist. `grant/revoke-delegated-permission` usam `requireCoordinator()` → cobertos pelo detector.
5. **H4 não fabrica nomes de campo.** Só os confirmados no schema (`fullAddress`, `endereco`,
   `birthDate`) + os do `cv-extraction` a confirmar no módulo. O(s) path(s) de array só entram se houver
   array de PII realmente logado; caso contrário, resíduo documentado.
6. **H5 é piso, não override.** `??` garante que nunca **rebaixa** o que o `@supabase/ssr` define;
   só preenche ausências e o teste pega `sameSite:'none'`.

---

## Gates obrigatórios no HEAD (antes de declarar PASS)
- `npm run typecheck` · `npm run lint`
- `npm run test` (unit, inclui Edge middleware + guards) · integração (Postgres/Supabase local :55322;
  `login.int` requer WebSocket global — Node 22)
- `NODE_ENV=production npm run build`
- **Sem migração nova** (nenhum item toca `prisma/`).

## Restrições de execução
- **Nunca** `git add -A` / `git add .` — o working tree tem deleções pré-existentes não relacionadas em
  `.claude/skills/**` e `.agents/**`. Cada task commita **só** os arquivos que tocou, por caminho explícito.
- Conventional Commits com escopo de módulo: `feat(identity):`, `fix(infra):`, `test(identity):`,
  `chore(infra):` etc. (escopos válidos no `CLAUDE.md`).
- Manter os padrões do `CLAUDE.md` (sequência de Server Action, `ActionResult`, sem `throw`, `select`
  explícito, `take` obrigatório). Nenhum controle novo pode quebrar teste verde existente — onde um
  controle muda legitimamente um contrato (login passa a poder exigir `captchaToken`), a mudança do
  teste-âncora é deliberada e documentada.
