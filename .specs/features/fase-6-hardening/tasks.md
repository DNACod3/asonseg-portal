# Tasks — Fase 6 · U3: Hardening de Segurança + Gaps LGPD

Branch: `feat/fase-6-relatorios-home-hardening` (base `master`). **Mesma** branch — não criar branch nova.
12 tasks atômicas sobre 5 itens (H1–H5). Todo deferimento (DEF-1..DEF-6) fica só em `design.md` — **sem
task/código**.

**Regras de commit (todas as tasks):**
- **Nunca** `git add -A` / `git add .`. Adicionar **só** os arquivos listados em "Commit", por caminho
  explícito. (Working tree tem deleções pré-existentes não relacionadas em `.claude/skills/**` e
  `.agents/**` — não tocar.)
- Conventional Commits com escopo de módulo válido (`identity`, `infra`, `tests`, …). Rodapé:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Cada task deixa a árvore **verde** (typecheck+lint+unit no mínimo; integração quando a task a toca).
- Nenhum controle novo quebra teste verde existente; onde muda um contrato (login pode exigir
  `captchaToken`), a mudança do teste-âncora é deliberada.

**Paralelismo:** `[P]` = independente. Blocos H2/H3/H4/H5 são `[P]` entre si e vs. H1. Dentro de H1,
T3 é `[P]` com T2.

---

## T1 — [H1] Schema `captchaToken` + regra `requiresLoginCaptcha` (+ unit da regra)
- **What:** campo opcional de token no `signInSchema` e a regra pura de limiar de desafio.
- **Where:**
  - `src/modules/identity/schemas/signIn.ts` — adicionar `captchaToken: z.string().min(1).optional()`.
  - `src/modules/identity/domain/lockout.ts` — `export const CAPTCHA_CHALLENGE_THRESHOLD = 3;` +
    `export function requiresLoginCaptcha(attempts, now, policy?): boolean` (conta FAILURE na janela ≥
    threshold; espelha a contagem de `isLocked`).
- **Depends on:** — (raiz do H1)
- **Reuses:** a mecânica de janela/contagem de `isLocked`; tipos de `authAttemptsRepo`.
- **Done when:** `SignInInput` tem `captchaToken?`; `requiresLoginCaptcha` retorna true a partir de 3
  falhas e false abaixo; `CAPTCHA_CHALLENGE_THRESHOLD < LOCKOUT_THRESHOLD (5)`.
- **Tests:** `src/modules/identity/domain/__tests__/lockout.test.ts` — casos: 0/1/2 falhas → false; 3/4
  → true; janela expirada não conta (AC-H1-1..3, regra). Rodar: `npm run test -- lockout`.
- **Gate:** typecheck, lint, unit (arquivo).
- **Commit:** `feat(identity): schema captchaToken + regra requiresLoginCaptcha (H1)`
  — arquivos: `src/modules/identity/schemas/signIn.ts`, `src/modules/identity/domain/lockout.ts`,
  `src/modules/identity/domain/__tests__/lockout.test.ts`.

---

## T2 — [H1] Wiring do CAPTCHA adaptativo em `loginAction`
- **What:** exigir CAPTCHA verificado quando `requiresLoginCaptcha(recent)`, **após** o check de lockout
  e **antes** de `provider.signInWithPassword`.
- **Where:** `src/modules/identity/actions/login.ts` — após o bloco 3 (lockout `isLocked` → LOCKED),
  antes do bloco 4 (`provider.signInWithPassword`):
  ```
  if (requiresLoginCaptcha(recent, new Date())) {
    const captcha = container.resolve(CAPTCHA_VERIFIER_TOKEN);
    const r = await captcha.verify(parsed.data.captchaToken, ip !== '0.0.0.0' ? ip : undefined);
    if (!r.ok) return fail('CAPTCHA_REQUIRED', 'Confirme que você não é um robô e tente novamente.');
  }
  ```
- **Depends on:** T1.
- **Reuses:** `CAPTCHA_VERIFIER_TOKEN` (mesmo verificador fail-closed de register/claim/reset),
  `container`, `recent` já buscado para o lockout, `fail` de `@/shared/errors`.
- **Done when:** <3 falhas → login normal (sem CAPTCHA); ≥3 (e <5) sem token válido → `CAPTCHA_REQUIRED`
  **sem** chamar `signInWithPassword` e **sem** gravar `AuthAttempt`; ≥5 continua LOCKED (ordem
  preservada). Não usar always-on (design H1 / spec assumption 1).
- **Tests:** provados em T4 (negativo/positivo da action). Aqui, garantir suíte de `login` existente
  verde.
- **Gate:** typecheck, lint, unit; integração `login.int` verde.
- **Commit:** `feat(identity): CAPTCHA adaptativo no login após limiar de falhas (H1)`
  — arquivo: `src/modules/identity/actions/login.ts`.

---

## T3 — [H1][P] Widget Turnstile no `LoginForm` + page
- **What:** renderizar o widget quando a action sinaliza `CAPTCHA_REQUIRED` e reenviar com o token.
- **Where:**
  - `src/modules/identity/components/LoginForm.tsx` — `<input type="hidden"
    {...register('captchaToken')} />`; estado `captchaRequired` setado quando
    `error.code === 'CAPTCHA_REQUIRED'`; renderizar `<Turnstile siteKey={siteKey}
    onSuccess={(t)=>setValue('captchaToken', t)} options={{ language:'pt-BR' }} />` (espelho de
    `cadastro`/`recuperar-senha`); receber `siteKey: string` por prop.
  - `src/app/(auth)/login/page.tsx` — passar `siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}`.
- **Depends on:** T1 (campo `captchaToken`). `[P]` com T2.
- **Reuses:** `@marsidev/react-turnstile`, o padrão exato de `src/app/(auth)/cadastro/page.tsx:60` e do
  form de cadastro (`handleCaptchaSuccess` → `setValue('captchaToken', token)`).
- **Done when:** sem `CAPTCHA_REQUIRED` o form não renderiza o widget (caminho feliz inalterado); com
  `CAPTCHA_REQUIRED` o widget aparece e o retry inclui o token (AC-H1-4).
- **Tests:** `src/modules/identity/__tests__/LoginForm.test.tsx` — assere que o widget só aparece após o
  estado `captchaRequired`.
- **Gate:** typecheck, lint, unit (componente).
- **Commit:** `feat(identity): LoginForm exibe Turnstile ao exigir CAPTCHA (H1)`
  — arquivos: `src/modules/identity/components/LoginForm.tsx`, `src/app/(auth)/login/page.tsx`.

---

## T4 — [H1] Teste negativo (MN-H1) + positivo da action de login
- **What:** provar MN-H1 e o caminho feliz.
- **Where:** `src/modules/identity/__tests__/login.test.ts` (ou `.int.test.ts`, conforme o harness
  existente da action):
  - **Negativo (MN-H1):** `recent` com ≥3 FAILURE + sem `captchaToken` → `CAPTCHA_REQUIRED` e spy em
    `provider.signInWithPassword` **não** chamado; ≥3 + token que o verificador stub rejeita →
    `CAPTCHA_REQUIRED`, provedor **não** chamado; assere que **nenhum** `AuthAttempt` novo foi gravado.
  - **Positivo:** 0–2 falhas → login normal sem CAPTCHA (AC-H1-1); ≥3 + token válido (stub `ok:true`) →
    prossegue para a auth (AC-H1-3).
- **Depends on:** T2, T3.
- **Reuses:** mocks de `AUTH_PROVIDER_TOKEN`/`CAPTCHA_VERIFIER_TOKEN`/`AUTH_ATTEMPTS_REPO_TOKEN` já
  usados nos testes de `login`/`registerPerson`.
- **Done when:** negativo mata a mutação de remover o gate de CAPTCHA (provedor seria chamado); positivo
  confirma fricção zero <3.
- **Tests:** `npm run test -- login`.
- **Gate:** typecheck, lint, unit; integração se `.int`.
- **Commit:** `test(identity): login exige CAPTCHA sob brute-force sem chamar o provedor (H1)`
  — arquivo: `src/modules/identity/__tests__/login.test.ts` (ou `.int.test.ts`).

---

## T5 — [H2][P] Middleware aplica headers de segurança em `/api`
- **What:** incluir `/api` no matcher e adicionar branch inicial só-headers (sem rate-limit, sem gate).
- **Where:** `src/middleware.ts`:
  - `config.matcher`: remover `api|` do negative-lookahead (manter literal de string estático).
  - No início de `middleware()`, após computar `hsts`/`supabaseOrigin`, antes do rate-limit:
    ```
    if (request.nextUrl.pathname.startsWith('/api')) {
      const res = NextResponse.next();
      applySecurityHeaders(res.headers, { hsts, supabaseOrigin });
      return res;
    }
    ```
- **Depends on:** — (`[P]`)
- **Reuses:** `applySecurityHeaders` de `securityHeaders.ts` (mesmo conjunto da resposta 429).
- **Done when:** resposta `/api` carrega os headers; `/api` **não** entra no bucket de rate-limit nem no
  gate de sessão; rotas não-`/api` inalteradas.
- **Tests:** provado em T6.
- **Gate:** typecheck, lint, unit (`middleware.test.ts` existente verde); confirmar que o matcher
  compila no build.
- **Commit:** `fix(infra): headers de segurança nas respostas /api via middleware (H2)`
  — arquivo: `src/middleware.ts`.

---

## T6 — [H2] Teste: resposta `/api` tem headers, sem rate-limit/redirect (MN-H2)
- **What:** provar MN-H2.
- **Where:** `src/middleware.test.ts` — novos casos: `middleware(request)` com path
  `/api/cron/auth-attempts-retention` → resposta carrega `Content-Security-Policy`, `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (e HSTS sob `https:`); status **não**
  é 429 e **não** é redirect (mesmo simulando estouro de rate-limit e ausência de cookie de sessão).
- **Depends on:** T5.
- **Reuses:** helpers de construção de `NextRequest` já no `middleware.test.ts`.
- **Done when:** casos verdes; mata a mutação de remover o branch `/api` (headers sumiriam) e de
  rate-limitar `/api` (429 apareceria).
- **Tests:** `npm run test -- middleware`.
- **Gate:** typecheck, lint, unit (arquivo).
- **Commit:** `test(infra): /api carrega headers de segurança e não é rate-limitado (H2)`
  — arquivo: `src/middleware.test.ts`.

---

## T7 — [H3][P] Guard: toda Server Action tem gate de sessão/permissão (+ discriminação)
- **What:** teste de guard que varre `**/actions/*.ts` `'use server'` e exige gate ou allowlist.
- **Where:** **Novo** `src/shared/__tests__/action-canonical-guard.test.ts` — clonar o mecanismo de
  `no-out-of-band-status-write.test.ts` (walk `fs` recursivo a partir de `src/modules`, coletar
  `*/actions/*.ts` não-teste). Predicado puro `isCanonicalActionGuarded(source, absPath)`:
  ignora não-`'use server'`; ok se `PUBLIC_ACTION_ALLOWLIST.has(absPath)`; senão exige um de
  `['requirePermission(','requireCoordinator(','requireActivePerson(','requireServiceAuthorization(','getCurrentPerson(']`.
  `PUBLIC_ACTION_ALLOWLIST` (paths absolutos + justificativa inline): `registerPerson`, `login`,
  `request-password-reset`, `request-credential-claim`, `reset-password`, `acceptRoleConsent` (ver
  design H3). Casos sintéticos no mesmo arquivo: fonte sem gate e fora da allowlist → violação; com
  `getCurrentPerson(` → ok; allowlisted → ok; sem `'use server'` → ignorado.
- **Depends on:** — (`[P]`)
- **Reuses:** `listSourceFiles`/`readFileSync` (padrão `no-out-of-band-status-write.test.ts`).
- **Done when:** a árvore real passa limpa (assumption 4); os casos sintéticos provam discriminação;
  comentário declara a limitação (prova referência, não corretude de sequência). Se a varredura
  flagrar algum arquivo inesperado (ex.: um helper que seja `'use server'`), **classificar** (allowlist
  com justificativa OU tratar como buraco real e escalar) — **não** silenciar afrouxando o predicado.
- **Tests:** `npm run test -- action-canonical-guard`.
- **Gate:** typecheck, lint, unit (arquivo). Árvore inteira `npm run test` verde (nenhum falso-positivo).
- **Commit:** `test(infra): guard exige gate de sessão/permissão em toda Server Action (H3)`
  — arquivo: `src/shared/__tests__/action-canonical-guard.test.ts`.

---

## T8 — [H4][P] Estender `SENSITIVE_FIELDS` com PII do domínio (+ array conhecido)
- **What:** cobrir os campos PII reais na redação do pino.
- **Where:** `src/shared/lib/logger.ts` — adicionar a `SENSITIVE_FIELDS`: `fullAddress`, `endereco`,
  `birthDate`, e o(s) campo(s) de texto bruto de CV do `cv-extraction` (**confirmar o nome real** via
  grep no módulo antes de adicionar — não inventar). Os três alvos (`campo`/`*.campo`/`*.*.campo`)
  permanecem. Se houver array de PII realmente logado no código (grep do caller), adicionar path
  explícito `pai[*].campo`; senão, deixar o docstring de "achatar PII profunda antes de logar" (o
  fast-redact não atravessa arrays com wildcard e só aceita um wildcard por path).
- **Depends on:** — (`[P]`)
- **Reuses:** estrutura `REDACT_PATHS`/`redact` já existente.
- **Done when:** os nomes reais entram; **não** adicionar `name`/`nome` genéricos (evita over-redaction
  de `category.name` etc.).
- **Tests:** provado em T9.
- **Gate:** typecheck, lint, unit.
- **Commit:** `fix(infra): redação de PII do domínio (endereço, nascimento, CV) no logger (H4)`
  — arquivo: `src/shared/lib/logger.ts`.

---

## T9 — [H4] Teste de redação de PII (MN-H4)
- **What:** provar que PII sai `[REDACTED]` em raiz/`*.`/`*.*.`/array.
- **Where:** **Novo** `src/shared/lib/__tests__/logger.test.ts` — capturar a saída do pino (stream/
  destino de teste) ao logar objeto com `fullAddress`/`endereco`/`birthDate`/campo-CV/`cpf`/`email` em
  raiz, um nível, dois níveis, e (se aplicável) dentro do array `pai[*]`; assere `[REDACTED]` para cada
  e que campos não-sensíveis vizinhos permanecem.
- **Depends on:** T8.
- **Reuses:** padrão de teste de logger (pino com `destination`/stream de teste).
- **Done when:** mata a mutação de remover cada campo de `SENSITIVE_FIELDS`.
- **Tests:** `npm run test -- logger`.
- **Gate:** typecheck, lint, unit (arquivo).
- **Commit:** `test(infra): logger redige PII do domínio em profundidade (H4)`
  — arquivo: `src/shared/lib/__tests__/logger.test.ts`.

---

## T10 — [H4b][P] Guard: sem `console.*` em módulos (allowlist) + discriminação
- **What:** proibir `console.*` em `src/modules/**` e `src/shared/**`, com allowlist.
- **Where:** **Novo** `src/shared/__tests__/no-console-in-modules.test.ts` — walk `fs`; regex
  `console\.(log|info|warn|error|debug)\(`; allowlist (paths absolutos): `src/middleware.ts`
  (permanente, Edge), `src/modules/identity/actions/registerPerson.ts` e
  `src/modules/identity/actions/acceptRoleConsent.ts` (pré-existentes; comentário "migração follow-up").
  Caso sintético: fonte com `console.log(...)` fora da allowlist → violação.
- **Depends on:** — (`[P]`)
- **Reuses:** padrão de varredura `fs` dos guards.
- **Done when:** árvore atual verde (com a allowlist); novo `console.*` em módulo falha o CI (AC-H4-3).
- **Tests:** `npm run test -- no-console-in-modules`.
- **Gate:** typecheck, lint, unit (arquivo). `npm run test` inteiro verde.
- **Commit:** `test(infra): guard proíbe console.* em módulos fora da allowlist (H4)`
  — arquivo: `src/shared/__tests__/no-console-in-modules.test.ts`.

---

## T11 — [H5][P] Piso de segurança nas flags do cookie Supabase
- **What:** helper puro que preenche `httpOnly`/`secure`/`sameSite` ausentes e wiring no `setAll`.
- **Where:** `src/shared/lib/supabase/server.ts`:
  - `export function secureCookieOptions(options, { isProd }) { return { ...options, httpOnly:
    options?.httpOnly ?? true, secure: options?.secure ?? isProd, sameSite: options?.sameSite ?? 'lax' }; }`
  - no `createSupabaseServerClient().setAll`, trocar `cookieStore.set(name, value, options)` por
    `cookieStore.set(name, value, secureCookieOptions(options, { isProd }))`.
- **Depends on:** — (`[P]`)
- **Reuses:** `NODE_ENV` de produção; o `setAll` existente.
- **Done when:** `??` só preenche ausência (nunca rebaixa o que o `@supabase/ssr` define); fluxo de
  login/logout intacto. `admin` (no-op) e `browser` inalterados.
- **Tests:** provado em T12.
- **Gate:** typecheck, lint, unit; integração de auth verde.
- **Commit:** `fix(infra): piso de segurança (HttpOnly/Secure/SameSite) no cookie de sessão (H5)`
  — arquivo: `src/shared/lib/supabase/server.ts`.

---

## T12 — [H5] Teste do piso de cookie (MN-H5)
- **What:** provar MN-H5 sobre o helper puro.
- **Where:** **Novo** `src/shared/lib/supabase/__tests__/server.test.ts` — casos de
  `secureCookieOptions`: `{}` → `httpOnly:true`, `secure` = `isProd`, `sameSite:'lax'`; valores seguros
  presentes → preservados; `sameSite:'none'` de upstream → assere `result.sameSite !== 'none'` (o teste
  **falha** se um dia o upstream mandar `none`, pegando a regressão); `secure` explícito `true` em dev →
  preservado.
- **Depends on:** T11.
- **Reuses:** função pura exportada (sem `next/headers`).
- **Done when:** cobre a matriz (ausente/seguro/inseguro) e mata a mutação de remover o piso.
- **Tests:** `npm run test -- supabase/server` (ou o nome do arquivo).
- **Gate:** typecheck, lint, unit (arquivo).
- **Commit:** `test(infra): piso de flags de cookie de sessão (HttpOnly/Secure/SameSite) (H5)`
  — arquivo: `src/shared/lib/supabase/__tests__/server.test.ts`.

---

## Gate final (no HEAD, após todas as tasks — pré-condição de PASS do Verifier)
- `npm run typecheck` · `npm run lint`
- `npm run test` (unit, inclui Edge middleware + os 3 guards novos) · integração completa (DB local
  :55322; `login.int` em Node 22)
- `NODE_ENV=production npm run build` (confirma que o `config.matcher` novo compila)
- `git status` limpo dos arquivos-alvo; **nenhuma** migração nova em `prisma/migrations/`; nenhuma
  deleção de `.claude/skills/**` / `.agents/**` commitada por engano.

## Grafo de dependências
```
H1:  T1 ─┬─→ T2 ─┐
         └─→ T3 ─┴─→ T4
H2:  T5 ─→ T6                (P vs H1/H3/H4/H5)
H3:  T7                      (P, self-contained)
H4:  T8 ─→ T9                (P)
     T10                     (P, self-contained)
H5:  T11 ─→ T12              (P)
```
Blocos H2/H3/H4/H5 e H1 rodam em paralelo entre si; dentro de H1, T2 e T3 são `[P]` e convergem em T4.
