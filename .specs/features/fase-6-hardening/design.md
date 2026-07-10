# Design — Fase 6 · U3: Hardening de Segurança + Gaps LGPD

Escopo: 5 correções de hardening (H1–H5), cada uma com arquivo exato, forma da mudança (contrato, não
código completo), o que reusa, como a must-not é enforçada, e a estratégia de teste. Convenções:
`CLAUDE.md` (sequência de Server Action, `ActionResult`, sem `throw`, `select`/`take`). No fim: os
deferimentos (DEF-1..DEF-6) com o bloqueador de cada — **sem código nesta unidade**.

---

## H1 — CAPTCHA adaptativo no login

**Arquivos:** `src/modules/identity/schemas/signIn.ts` · `src/modules/identity/domain/lockout.ts` (nova
regra) · `src/modules/identity/actions/login.ts` · `src/modules/identity/components/LoginForm.tsx` ·
`src/app/(auth)/login/page.tsx`.

### Schema (`signIn.ts`)
Adicionar campo opcional ao `signInSchema`:
```
captchaToken: z.string().min(1).optional(),
```
Opcional (o caminho feliz não envia token). `SignInInput` ganha `captchaToken?: string`.

### Regra de domínio (`domain/lockout.ts`)
Nova função pura ao lado de `isLocked` (reusa a mesma lista `recent` de tentativas FAILURE):
```
export const CAPTCHA_CHALLENGE_THRESHOLD = 3; // < LOCKOUT_THRESHOLD (5)
/** true quando a chave (email,ip) já acumulou >= threshold falhas na janela — exige CAPTCHA. */
export function requiresLoginCaptcha(attempts, now, policy?): boolean {
  // conta FAILURE na janela (mesma contagem de isLocked) >= CAPTCHA_CHALLENGE_THRESHOLD
}
```
Espelha a mecânica de contagem de `isLocked` (janela rolante). **Sem** query nova — opera sobre o
`recent` já buscado em `login.ts`.

### Action (`login.ts`)
Ponto de inserção: logo **após** o check de lockout (`isLocked` → LOCKED retorna antes; ordem garante
que ≥5 continua LOCKED, 3–4 cai no CAPTCHA), **antes** de `provider.signInWithPassword`:
```
// H1: CAPTCHA adaptativo — só após CAPTCHA_CHALLENGE_THRESHOLD falhas (abaixo do lockout).
if (requiresLoginCaptcha(recent, new Date())) {
  const captcha = container.resolve(CAPTCHA_VERIFIER_TOKEN);
  const captchaResult = await captcha.verify(parsed.data.captchaToken, ip !== '0.0.0.0' ? ip : undefined);
  if (!captchaResult.ok) {
    return fail('CAPTCHA_REQUIRED', 'Confirme que você não é um robô e tente novamente.');
  }
}
```
- **Reusa:** `CAPTCHA_VERIFIER_TOKEN` (port `identity/ports/captchaVerifier.ts`, resolvido em
  `container.ts:65`) — mesmíssimo verificador fail-closed de register/claim/reset.
- **Sem novo `AuthAttempt`:** o retorno `CAPTCHA_REQUIRED` ocorre **antes** de `recordFailure`/
  `signInWithPassword` (assumption 2 do spec). Não acelera o lockout.
- `CAPTCHA_REQUIRED` é um novo code do `ActionResult` (aditivo; `shared/errors` aceita string de code).

**Enforcement de MN-H1:** o `return fail('CAPTCHA_REQUIRED', …)` está **antes** de
`provider.signInWithPassword`. Sem token verificado, o provedor nunca é chamado e nenhum sucesso é
possível na faixa de desafio.

### Form + page
`LoginForm.tsx` (RHF + `zodResolver(signInSchema)`): adicionar `<input type="hidden"
{...register('captchaToken')} />` e, quando `loginAction` retorna `error.code === 'CAPTCHA_REQUIRED'`,
setar estado `captchaRequired=true` e renderizar `<Turnstile siteKey={siteKey}
onSuccess={(t)=>setValue('captchaToken', t)} options={{ language: 'pt-BR' }} />` — **espelho exato** de
`cadastro`/`recuperar-senha` (mesmo pacote `@marsidev/react-turnstile`). A page passa
`siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}` (padrão de `src/app/(auth)/cadastro/page.tsx:60`).

**Testes-âncora:** os testes existentes de `login.ts`/`LoginForm` que **não** enviam `captchaToken`
seguem verdes porque o CAPTCHA só é exigido a partir de 3 falhas (fixtures partem de 0). Qualquer teste
que simule ≥3 falhas prévias e espere um outcome específico é atualizado **deliberadamente**.

---

## H2 — Headers de segurança em `/api` (via middleware, choke point único)

**Arquivo:** `src/middleware.ts` (só).

**Mudança 1 — matcher:** remover `api` do negative-lookahead para o middleware passar a rodar em
`/api/**`:
```
'/((?!_next/static|_next/image|favicon.ico|manifest|robots|sitemap|.*\\..*).+)'
```
(literal de string — o build do Next exige nó estático).

**Mudança 2 — branch inicial só-headers para `/api`** (antes do rate-limit e do gate de sessão):
```
if (request.nextUrl.pathname.startsWith('/api')) {
  const res = NextResponse.next();
  applySecurityHeaders(res.headers, { hsts, supabaseOrigin });
  return res; // sem rate-limit, sem gate de sessão
}
```
- **Reusa:** `applySecurityHeaders(target, { hsts, supabaseOrigin })` de `securityHeaders.ts` — o mesmo
  conjunto que a resposta 429 já aplica hoje. Um único code path (assumption 3): CSP é inócua em JSON.
- **Por que headers-only:** crons (`auth-attempts-retention`, `expire-jobs`) autenticam por
  `CRON_SECRET` (`verifyCronSecret`); rate-limitar/gate-of-session em `/api` quebraria o Vercel Cron. O
  branch garante que `/api` **nunca** entra no bucket nem no redirect.

**Enforcement de MN-H2:** o branch aplica os headers a `NextResponse.next()` e retorna — toda resposta
`/api` sai com headers e sem 429/redirect. O handler original executa normalmente (o middleware só
anexa headers à resposta que segue).

---

## H3 — Guard de convenção: Server Action tem gate de sessão/permissão

**Arquivo novo:** `src/shared/__tests__/action-canonical-guard.test.ts` (junto dos guards estruturais
transversais: `closed-src-root`, `no-deep-module-imports`, `no-committed-secrets`).

**Mecanismo (clona `no-out-of-band-status-write.test.ts`):** varredura `fs` recursiva
(`readdirSync`/`statSync`, sem glob) a partir de `src/modules`, coletando `*/actions/*.ts` (não
`.test.ts`, não `.d.ts`). Para cada arquivo cujo **primeiro conteúdo significativo** é `'use server'`:
```
const GATE_SYMBOLS = ['requirePermission(', 'requireCoordinator(', 'requireActivePerson(',
                      'requireServiceAuthorization(', 'getCurrentPerson('];
const PUBLIC_ACTION_ALLOWLIST = new Set([ /* paths absolutos + justificativa inline */ ]);
function isCanonicalActionGuarded(source, absPath): boolean {
  if (!startsWithUseServer(source)) return true;         // não é action entrypoint
  if (PUBLIC_ACTION_ALLOWLIST.has(absPath)) return true; // pública por desenho
  return GATE_SYMBOLS.some((s) => source.includes(s));
}
```
Assere `violations === []` na árvore real. **Allowlist (6 públicas, cada uma com a própria defesa):**
- `identity/actions/registerPerson.ts` — CAPTCHA fail-closed (ADR-0014) + Zod.
- `identity/actions/login.ts` — lockout durável (ADR-0029) + CAPTCHA adaptativo (H1).
- `identity/actions/request-password-reset.ts` — CAPTCHA + teto por IP (`passwordReset`).
- `identity/actions/request-credential-claim.ts` — CAPTCHA fail-closed antes de qualquer I/O.
- `identity/actions/reset-password.ts` — token OTP de uso único (GoTrue `verifyOtp`).
- `identity/actions/acceptRoleConsent.ts` — token HMAC `verifyConsentToken(personId, role, sig)`
  validado antes de qualquer escrita (TX2 pré-auth do auto-cadastro; **não** é buraco — defesa em
  profundidade U1-GUARD-01).

**Discriminação sem tocar o repo:** `isCanonicalActionGuarded` é função pura, testada com **entradas
sintéticas** no mesmo arquivo: fonte `'use server'` sem gate e fora da allowlist → violação; com
`getCurrentPerson(` → ok; allowlisted → ok; sem `'use server'` → ignorado.

**Limitação honesta (declarada no teste):** o guard prova **referência** a um símbolo de gate (ou
allowlist), não a corretude de sequência em todo caminho — mesma limitação de
`no-out-of-band-status-write`. Valor: barra a omissão mais comum — uma action nova **sem gate nenhum**.

**Enforcement de MN-H3:** a árvore atual passa limpa (assumption 4); uma action nova sem gate e não
allowlistada falha o CI.

---

## H4 — Redação de PII no logger (+ H4b guard de console)

**Arquivo:** `src/shared/lib/logger.ts` · guard novo `src/shared/__tests__/no-console-in-modules.test.ts`.

### H4 — `SENSITIVE_FIELDS` + paths de array
Estender `SENSITIVE_FIELDS` com os nomes reais (verificados no `prisma/schema.prisma`):
`fullAddress`, `endereco`, `birthDate`, e o(s) campo(s) de texto bruto de CV do módulo `cv-extraction`
(confirmar o nome no módulo antes de adicionar — **não** inventar). Os três alvos por campo
(`campo`, `*.campo`, `*.*.campo`) permanecem via `REDACT_PATHS`.

**Arrays (fato do pino/fast-redact, confirmado):** wildcards `*.campo` **não** atravessam arrays;
elementos exigem path explícito com parent conhecido (ex.: `stuff.thats[*].secret`), e o fast-redact
permite **um** wildcard por path — uma redação universal deep+array é impossível estaticamente. Logo:
- Se algum shape de array de PII é realmente logado no código (grep pelo caller), adicionar o path
  explícito `pai[*].campo`.
- Caso não haja, documentar o resíduo (achatar PII profunda antes de logar — orientação já no docstring
  de `logger.ts`) — respaldado pelo guard de console (H4b), que força todo log de módulo pelo pino
  redator.

### H4b — guard de console (`no-console-in-modules.test.ts`)
Varredura `fs` (mesmo padrão) sobre `src/modules/**` e `src/shared/**` (`.ts`/`.tsx`, exceto testes);
regex `console\.(log|info|warn|error|debug)\(`; assere ausência, com allowlist:
- `src/middleware.ts` — **permanente** (Edge; pino/Node não roda, emite JSON via `console.warn` com IP
  mascarado).
- `src/modules/identity/actions/registerPerson.ts` e `.../acceptRoleConsent.ts` — pré-existentes
  (`console.error` de rollback/erro), marcados como **migração follow-up** para `childLogger`. Novo
  código não pode usar `console.*` fora dessa allowlist.

**Enforcement de MN-H4:** teste de redação loga objeto aninhado (raiz, `*.`, `*.*.`, + array conhecido
se houver) e assere `[REDACTED]` para cada PII; o guard de console discrimina fonte sintética
`console.log(pessoa)`.

---

## H5 — Flags de segurança do cookie de sessão Supabase

**Arquivo:** `src/shared/lib/supabase/server.ts` (só o `createSupabaseServerClient`, que é o único que
**escreve** cookies de auth — `admin` usa handlers no-op; `browser` é client-side; `middleware.ts` só lê).

**Helper puro novo (mesmo arquivo ou colocado):**
```
const isProd = process.env.NODE_ENV === 'production';
/** Piso de segurança: preenche ausências sem rebaixar o que o @supabase/ssr já define. */
export function secureCookieOptions(options, { isProd }) {
  return {
    ...options,
    httpOnly: options?.httpOnly ?? true,
    secure:   options?.secure   ?? isProd,
    sameSite: options?.sameSite ?? 'lax',
  };
}
```
**Wiring em `setAll`:**
```
setAll(cookiesToSet) {
  for (const { name, value, options } of cookiesToSet)
    cookieStore.set(name, value, secureCookieOptions(options, { isProd }));
}
```
- **Piso, não override (`??`):** o `@supabase/ssr` já emite HttpOnly/Secure/Lax para o auth-token — o
  helper só cobre o caso de ausência. Comportamento preservado (fluxo de login/logout intacto).

**Enforcement de MN-H5:** o helper puro é testado exaustivamente — ausência → piso preenchido;
valor seguro presente → preservado; `sameSite:'none'` vindo de upstream → o teste assere
`sameSite !== 'none'` e **falha** (pega a regressão). Isso é discriminação sem depender de
`next/headers`.

---

## Estratégia de teste — matriz AC → teste

| AC | Prova | Arquivo de teste | Tipo |
|---|---|---|---|
| AC-H1-1 | <3 falhas → sem CAPTCHA, login normal | `identity/__tests__/login.test.ts` (ou `.int`) | unit/integração |
| AC-H1-2/3 · MN-H1 | ≥3 falhas + sem/token-inválido → `CAPTCHA_REQUIRED`, provedor não chamado | `login` test (spy em `signInWithPassword`) | unit (negativo) |
| AC-H1-1..3 (regra) | limiar/janela de `requiresLoginCaptcha` | `identity/domain/__tests__/lockout.test.ts` (estende) | unit (puro) |
| AC-H1-4 | form renderiza Turnstile ao receber `CAPTCHA_REQUIRED` | `identity/__tests__/LoginForm.test.tsx` | componente |
| AC-H2-1/2 · MN-H2 | resposta `/api` carrega headers e não é 429/redirect | `src/middleware.test.ts` (estende) | unit (Edge) |
| AC-H3-1/2 · MN-H3 | árvore limpa + predicado discrimina fonte sem gate | `src/shared/__tests__/action-canonical-guard.test.ts` (novo) | guard + unit puro |
| AC-H4-1/2 · MN-H4 | PII (address/birth/CV/cpf/email) → `[REDACTED]` em raiz/`*.`/`*.*.`/array | `src/shared/lib/__tests__/logger.test.ts` (novo) | unit |
| AC-H4-3 | `console.*` proibido em módulos (allowlist) + discrimina sintético | `src/shared/__tests__/no-console-in-modules.test.ts` (novo) | guard + unit puro |
| AC-H5-1/2 · MN-H5 | piso preenche ausência; `sameSite:'none'` pego | `src/shared/lib/supabase/__tests__/server.test.ts` (novo) | unit (puro) |

**DoD de Server Action (H1):** o achado de segurança tem **teste negativo** dedicado (MN-H1: brute-force
sem CAPTCHA → rejeitado, provedor não chamado) além do caminho feliz preservado — conforme
`project-guideline.md`.

---

## Riscos / regressões
- **H1 — ordem lockout×captcha:** o check de CAPTCHA deve vir **depois** do `isLocked` (≥5 → LOCKED
  primeiro), senão os testes de lockout mudam. Mitigado pela ordem fixada acima.
- **H1 — fricção/disponibilidade:** adaptativo (não always-on) mantém o Cloudflare **fora** do caminho
  feliz do login (a ação mais crítica). Trade-off documentado (assumption 1); DEF-6 cobre o resíduo IP-wide.
- **H2 — não rate-limitar cron:** o branch `/api` retorna antes do bucket. Verificar no teste que um
  path `/api/cron/...` não recebe 429 nem redirect.
- **H2 — matcher:** remover `api` do lookahead faz o middleware rodar em `/api`; o build do Next exige
  o matcher como literal estático (manter string, não `String.raw`).
- **H4 — over-redaction:** **não** adicionar `name`/`nome` genéricos (redigiria `category.name`,
  `module` etc.). Escopar só a nomes de PII de pessoa. CV: confirmar o nome do campo no módulo.
- **H4b — allowlist:** os `console.error` pré-existentes em `registerPerson`/`acceptRoleConsent` devem
  estar na allowlist para a árvore passar verde; migrá-los é follow-up, não desta unidade.
- **H5 — testabilidade:** extrair o piso no helper puro dá discriminação sem montar `next/headers`.

---

## Deferimentos (DEF-1..DEF-6) — documentados, **sem código nesta unidade**

> Cada deferimento fica atado ao seu bloqueador. O orquestrador copia estes para
> `STATE.md ## Deferred Ideas`.

- **DEF-1 — CSP baseada em nonce (endurecer `'unsafe-inline'`).** `securityHeaders.ts` usa
  `'unsafe-inline'` em `script-src`/`style-src` porque o Next 15 injeta scripts/estilos inline de
  hidratação. Nonce por request exige reescrever a resposta HTML e threadar o nonce pelo App Router +
  widget Turnstile — grande demais para esta unidade. **Nenhum** outro directive é barato de apertar
  sem quebrar a hidratação inline do Next 15; um endpoint de report de violação de CSP precisaria de
  infra própria. **Chamada explícita:** deferido por tamanho. Atado a: decisão de arquitetura + infra
  (endpoint de report).
- **DEF-2 — Aplicação da cascata de revogação (inclui o efeito `ANONIMIZAR`).** **Achado:** a
  `REVOCATION_CASCADE_MATRIX` (`consents/domain/revocation-cascade.ts`) é **dado declarativo morto** —
  nenhum código lê a matriz nem faz `switch` sobre `CascadeEffect`; `revokeConsent` aplica apenas a sua
  própria cascata hardcoded (role→`REVOKED` via `purpose-role-map`), **não** os `artifactEffects`. O
  efeito `ANONIMIZAR` está no vocabulário `CASCADE_EFFECTS` mas atribuído a **zero** artefatos na
  matriz. Aplicá-lo exige (a) uma decisão semântica DPO/jurídico de **atribuir** ANONIMIZAR a um
  artefato, (b) **construir** o aplicador cross-módulo da cascata (escopo das USPs-025/030/033, ainda
  inexistentes), e (c) mutação real de PII (adjacente a apagamento). **Não é bounded nem code-only.**
  Atado a: **B-001** (DPO não designado) + USP-025/030/033 (aplicadores não construídos) + gate
  jurídico de apagamento. *Correção ao briefing:* a premissa "wire the effect where it realizes
  existing declared design" é vazia — a matriz não atribui ANONIMIZAR a nada; não há alvo bounded.
- **DEF-3 — Direito ao apagamento / anonimização total de PII na inativação.** `inactivate-person.ts`
  preserva todos os dados por desenho (ADR-0008, preservação histórica). Atado a: revisão jurídica
  (rotulada "D-003" pelo orquestrador — **nota:** não existe D-003 em STATE.md; o único direito LGPD
  modelado é o de **acesso em ≤15 dias** em PROJECT.md, já atendido por `issueAccessReport`) + **B-001**
  (DPO).
- **DEF-4 — Política de retenção de PII operacional** (Pessoas inativas, CVs obsoletos, registros
  socioeconômicos). Prazos de guarda precisam de input jurídico/DPO. Atado a: **B-001** (DPO).
  *Correção factual:* existem **dois** crons de retenção — `/api/cron/auth-attempts-retention` (90d) e
  `/api/cron/expire-jobs` (horário). **NÃO** existe cron de retenção de `audit_log` 365d (o `audit_log`
  é append-only por desenho — ADR-0008/0023 — e sua retenção ainda não é um cron). A menção do briefing
  a "audit_log 365d" é aspiracional.
- **DEF-5 — Store distribuído de rate-limit (Upstash).** O rate-limit atual é sliding-window em memória
  (Edge, por instância). Distribuir exige provisionamento externo (infra Fase 0), não code-only. Atado
  a: provisionamento de infra.
- **DEF-6 — CAPTCHA adaptativo por IP (credential-stuffing entre e-mails).** H1 chaveia em `(email, ip)`
  (reusa o fetch do lockout). Um atacante rotacionando e-mails de um IP não cruza o limiar por e-mail; o
  controle IP-wide atual é o rate-limit do middleware (10/min anônimo). Um CAPTCHA adaptativo IP-wide
  exigiria uma contagem de falhas por IP (query nova) — follow-up bounded, fora do mínimo desta unidade.
