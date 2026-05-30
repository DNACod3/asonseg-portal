# tasks.md — USP-004: Autenticar no portal com e-mail e senha

> Tasks atômicas com **Done when** + **Tests** + **Gate**. Cada task referencia ACs (`AC-004-*`) e proibições (`P-00*`) da `spec.md` para rastreabilidade. Runbooks operacionais em `IDSD/architecture/runbooks/`.
>
> **Marcador `[P]`** = paralelizável (sem dependência inter-task).
> **Gate** = comando(s) que **devem** passar antes de marcar Done.

## Pré-requisitos do ambiente

- `supabase start` rodando (`CLAUDE.md §"Ambiente local"`).
- Variáveis em `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_ATTEMPTS_RETENTION_DAYS=90`, `AUTH_LOGIN_ENABLED=true`.
- Esquema base de `Person` e `Credential` já criado (estará disponível ao iniciar USP-001/USP-003; **se ainda não existir**, ver task **T-00**).

---

## T-00 — Garantir schema mínimo `Person` / `Credential` no Prisma

**Why:** USP-004 depende de `Person.status` e `Credential.primeiroAcesso`. Se já criados por USP-001/003, skipar.
**What:** Validar/criar models `Person`, `Credential` no `prisma/schema.prisma` conforme `IDSD/architecture/technical-design.md §4.5`.
**Where:** `prisma/schema.prisma`.
**Depends on:** —
**Reuses:** —
**Done when:** Models presentes; `npx prisma migrate dev --name init-identity` aplica sem erro; `prisma generate` ok.
**Tests:** —
**Gate:** `npx prisma validate && npx prisma migrate status` (clean).
**Traces:** AC-004-1, AC-004-4, P-007

## T-01 — [P] Criar tabela `auth_attempts` (migration Prisma)

**Why:** Lockout `(email, IP)` 5/15 min (ADR-0029) precisa de tabela dedicada. Separada de `audit_log` (técnico vs domínio).
**What:** Adicionar model `AuthAttempt` (e enum `AuthOutcome`) ao `prisma/schema.prisma` conforme `design.md §3`. Índices em `(email, ip, attemptedAt)` e `(attemptedAt)`.
**Where:** `prisma/schema.prisma` + migration nova.
**Depends on:** T-00
**Reuses:** —
**Done when:** Migration aplicada localmente; `SELECT 1 FROM auth_attempts` retorna; índices visíveis em `\d auth_attempts`.
**Tests:** N/A (DDL).
**Gate:** `npx prisma migrate dev --name auth-attempts-lockout && npx prisma migrate status`.
**Traces:** AC-004-3, P-001, L-003

## T-02 — [P] Catálogo de eventos de auditoria `AUTH_*`

**Why:** AC-004-6 e P-005 exigem registro de auditoria de sucesso e falha. ADR-0023 manda usar catálogo fechado.
**What:** Adicionar ao `src/modules/audit/events.ts` (criar se não existir): `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`, `AUTH_SESSION_INVALIDATED`, `AUTH_PASSWORD_CHANGED_FIRST_ACCESS`. Definir payload TS para cada.
**Where:** `src/modules/audit/events.ts` (+ `src/modules/audit/index.ts` barrel).
**Depends on:** —
**Reuses:** Padrão do catálogo (verificar exemplos em outras USPs já mergeadas — commits #229/230).
**Done when:** Tipos exportados; consumível via `import { AuditEvent } from '@/modules/audit'`.
**Tests:** Type-level — `npm run typecheck` passa com imports nos módulos cliente.
**Gate:** `npm run typecheck && npm run lint`.
**Traces:** AC-004-6, P-005

## T-03 — Implementar `LockoutGate` (domain puro)

**Why:** Lógica de bloqueio precisa ser pura (testável sem DB) e usada por `loginAction`.
**What:** Função `isLocked(attempts: AuthAttempt[], now: Date): boolean` e `withinWindow(attempts, windowMs): AuthAttempt[]`. Critério: ≥5 failures em janela de 15 min cuja chave é `(email, ip)`. Função pura — recebe attempts já filtrados por chave; window e threshold como parâmetros.
**Where:** `src/modules/identity/domain/lockout.ts`.
**Depends on:** —
**Reuses:** `date-fns` (já no stack).
**Done when:** Função exporta + 100% coverage unitária; lida com clock skew (ignora attempts no futuro).
**Tests:**
- `lockout.test.ts` — 8 cenários: vazio, 4 failures → unlocked, 5 failures → locked, mix success/failure → respeita só failures consecutivos? **Não** — política é 5 failures na janela, independente de successes; testar isso; failures fora da janela; clock no futuro; ordenação irrelevante; threshold/window como parâmetro.
- Cobertura ≥ 95% (regra de domínio, `CLAUDE.md §"Testing"`).
**Gate:** `npm run test -- lockout.test.ts && npm run typecheck`.
**Traces:** AC-004-3, P-001

## T-04 — Implementar `AuthAttemptsRepo` (adapter)

**Why:** Persistência de tentativas. Isolada via repo para permitir mock nos testes de `loginAction`.
**What:** Classe/objeto com `record({ email, ip, outcome })` e `recent({ email, ip, windowMs })`. Email normalizado (lowercase + trim) no momento do save/query.
**Where:** `src/modules/identity/adapters/AuthAttemptsRepo.ts` + port em `src/modules/identity/ports/AuthAttemptsRepo.ts`.
**Depends on:** T-01
**Reuses:** Singleton Prisma em `src/shared/lib/prisma.ts`.
**Done when:** Métodos funcionais contra Supabase local; testes de integração passam.
**Tests:**
- Integração (`__tests__/AuthAttemptsRepo.int.test.ts`) — insere 6 falhas, query retorna 6; insere com IPs diferentes, query por `(email, ip)` específica retorna só os correspondentes; query com janela curta filtra antigos.
- Reset via `DELETE FROM auth_attempts` no `beforeEach`.
**Gate:** `npm run test -- AuthAttemptsRepo.int.test.ts` com Supabase local rodando.
**Traces:** AC-004-3, AC-004-6, L-003

## T-05 — Implementar `SupabaseAuthAdapter` (adapter)

**Why:** Isolar Supabase do domínio. Permite trocar provedor no futuro sem refator (ADR-0010 — custo mínimo evita over-engineering, mas porta é leve).
**What:** Port `AuthProvider` com `signInWithPassword(email, senha): Promise<{ userId, sessionToken } | { error: 'INVALID' | 'UNKNOWN_EMAIL' | 'WRONG_PASSWORD' }>`. Adapter usa `@supabase/ssr` server client.
**Where:** `src/modules/identity/ports/AuthProvider.ts` + `src/modules/identity/adapters/SupabaseAuthAdapter.ts`.
**Depends on:** T-00
**Reuses:** Cliente Supabase em `src/shared/lib/supabase/server.ts` (criar se não existir, padrão `@supabase/ssr`).
**Done when:** Adapter chamado com credenciais válidas retorna `{ userId, ... }`; inválidas retorna error variante.
**Tests:**
- Integração contra Supabase local: criar Pessoa+credencial via service-role, fazer signIn, validar retorno; testar e-mail inexistente; testar senha errada.
**Gate:** `npm run test -- SupabaseAuthAdapter.int.test.ts`.
**Traces:** AC-004-1, AC-004-2, P-002

## T-06 — Implementar `loginAction` Server Action

**Why:** Orquestrador central. Atende AC-004-1 a AC-004-6 e proibições P-001 a P-007. Núcleo da feature.
**What:** Server Action `'use server'` em `src/modules/identity/actions/login.ts`. Sequência:
1. Validar input com Zod (`LoginInput` em `design.md §4`).
2. Normalizar `email` (lowercase + trim).
3. `attempts = AuthAttemptsRepo.recent({ email, ip, windowMs: 15min })`.
4. Se `LockoutGate.isLocked(attempts.failures, now)` → registrar failure (audit) + retornar `INVALID_CREDENTIALS`.
5. `AuthProvider.signInWithPassword(email, senha)`.
6. Se falha:
   - Se `unknown_email` → executar `bcrypt.compare(senha, DUMMY_HASH)` para nivelar tempo (D-A).
   - `withAudit('AUTH_LOGIN_FAILURE', tx => { tx.authAttempts.record({ email, ip, outcome:'FAILURE' }) })` — payload sem `pessoaId` se unknown.
   - Retornar `INVALID_CREDENTIALS`.
7. Se sucesso: carregar `Person` + papéis; checar `person.status === 'ATIVO'` (senão retorna `INVALID_CREDENTIALS`, audit `AUTH_LOGIN_FAILURE reason='inactive'`); zerar attempts (DELETE WHERE email AND ip); `withAudit('AUTH_LOGIN_SUCCESS', tx => ...)`.
8. Cookie 12h via Supabase SSR (HttpOnly+Secure+SameSite=Lax, maxAge fixo).
9. `return { ok:true, data:{ redirectTo: credential.primeiroAcesso ? '/trocar-senha' : '/inicio', primeiroAcesso } }`.
**Where:** `src/modules/identity/actions/login.ts` + export pelo barrel `src/modules/identity/index.ts`.
**Depends on:** T-02, T-03, T-04, T-05
**Reuses:** `withAudit` (T-09 do épico audit — se ainda não existir, criar stub mínimo aqui e refatorar quando módulo audit canônico chegar; **registrar SPEC_DEVIATION** se for o caso).
**Done when:** Action exportada, retorna `ActionResult<LoginData>`; logs em `pino` (sem PII em mensagem livre — ADR-0028).
**Tests:**
- Unit (`login.test.ts` com mocks dos repos):
  - happy path → ok + audit success + reset attempts (5 cenários).
  - validation fail (email malformado, senha curta) → `VALIDATION`.
  - lockout ativo → `INVALID_CREDENTIALS` + audit failure + sem chamar Supabase.
  - e-mail inexistente → `INVALID_CREDENTIALS` + bcrypt dummy executado (assert via mock spy).
  - senha errada → `INVALID_CREDENTIALS` + audit com `pessoaId`.
  - Pessoa inativa → `INVALID_CREDENTIALS` + audit `reason='inactive'`.
  - `primeiroAcesso=true` → `redirectTo='/trocar-senha'`.
  - audit falha → rollback → action retorna falha genérica (alerta).
- Integração (`login.int.test.ts`): contra Supabase local, ponta a ponta.
**Gate:** `npm run test -- login` + `npm run typecheck && npm run lint`.
**Traces:** AC-004-1, AC-004-2, AC-004-3, AC-004-5, AC-004-6, P-001, P-002, P-005, P-007

## T-07 — [P] UI: tela de login (`LoginForm`)

**Why:** Cumpre o I/O da AC-004-1 e AC-004-2 (mensagem genérica única). Acessível por teclado e ARIA.
**What:** Página `src/app/(auth)/login/page.tsx` (server) + `_components/LoginForm.tsx` (client) com React Hook Form + Zod adapter + shadcn (`Input`, `Button`, `Form`, `FormMessage`). Mensagem de erro **única**: `"Credenciais inválidas. Verifique e tente novamente."` Quando `redirectTo='/trocar-senha'`, navegar imediatamente.
**Where:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/_components/LoginForm.tsx`.
**Depends on:** T-06
**Reuses:** Shadcn forms já scaffoldados; layout `(auth)` (criar se não existir).
**Done when:** Página renderiza, submete via Server Action, mostra mensagem única em qualquer falha.
**Tests:**
- E2E (`e2e/login.spec.ts` Playwright): happy path; e-mail inválido formato (Zod) — mensagem específica de validação client-side; credencial errada — mensagem única; após 5 tentativas → mesma mensagem (lockout transparente); 1º acesso → redireciona para `/trocar-senha`.
- Acessibilidade: `expect(page).toHaveScreenshot('login.png')` + auditoria axe-core sem violações sérias.
**Gate:** `npm run test:e2e -- login.spec.ts` com app rodando localmente.
**Traces:** AC-004-1, AC-004-2, AC-004-5

## T-08 — Atualizar `middleware.ts` para revalidação de sessão (ADR-0030)

**Why:** P-004 (Pessoa inativada não pode operar com sessão de 12h) e P-006 (reset invalida sessões antigas).
**What:** No `src/middleware.ts`: para rotas `(app)/*`, ler cookie, decodificar; consultar `Person.status` (com cache LRU local 30s opcional); se `INATIVO` → invalidar cookie + redirect `/login`. Adicionar `session_version` custom claim (bump em USP-005/USP-007 quando implementadas) — preparar leitura aqui mesmo (Pessoa.sessionVersion compare com claim).
**Where:** `src/middleware.ts`, `src/modules/identity/server/requirePermission.ts` (criar mínimo).
**Depends on:** T-00, T-06
**Reuses:** Padrões do Next 15 middleware + `@supabase/ssr`.
**Done when:** Inativar uma Pessoa via Prisma Studio → próxima request autenticada redireciona em ≤30s.
**Tests:**
- Integração (`middleware.int.test.ts`): seed Pessoa ativa + login; inativar via script; request a rota protegida → 302/401 + cookie clearado.
- E2E inclui esse cenário (`e2e/login.spec.ts` → cenário "inativação invalida sessão").
**Gate:** `npm run test -- middleware && npm run test:e2e -- login`.
**Traces:** AC-004-4, P-004, P-006, D-003

## T-09 — Página `/trocar-senha` para 1º acesso

**Why:** AC-004-5 — forçar troca de senha quando `primeiroAcesso=true`. Middleware bloqueia outras rotas até a troca.
**What:** `src/app/(auth)/trocar-senha/page.tsx` + form (`senhaAtual` opcional para fluxo de 1º acesso? — no 1º acesso só `senhaNova` + `confirmar`, validação Zod min 8 + força). Server Action `changePasswordFirstAccess` em `src/modules/identity/actions/changePassword.ts` que chama `supabase.auth.updateUser({ password })` + seta `credential.primeiroAcesso=false` + audit `AUTH_PASSWORD_CHANGED_FIRST_ACCESS`. Middleware (T-08) bloqueia rotas `(app)/*` enquanto `primeiroAcesso=true`.
**Where:** `src/app/(auth)/trocar-senha/page.tsx`, `src/modules/identity/actions/changePassword.ts`.
**Depends on:** T-06, T-08
**Reuses:** RHF + Zod + shadcn.
**Done when:** Após login com `primeiroAcesso=true`, usuário só consegue navegar para `/trocar-senha`; após salvar, `primeiroAcesso=false` e usuário acessa `/inicio`.
**Tests:**
- Unit/int da action (validação, audit, atualização Supabase).
- E2E (`e2e/login.spec.ts → cenário "primeiro acesso"`).
**Gate:** `npm run test -- changePassword && npm run test:e2e -- login`.
**Traces:** AC-004-5

## T-10 — Teste de anti-timing (variância de resposta) — CI

**Why:** P-002 / L-001 — sem isso, P-002 vira promessa sem garantia. Cobre D-002.
**What:** Teste de integração (`login.timing.int.test.ts`) que executa N=20 logins com (a) e-mail inexistente, (b) senha errada para e-mail existente; mede `Date.now()` antes/depois; assert `|median(a) - median(b)| < 50ms` (configurável `AUTH_TIMING_TOLERANCE_MS`). Documentar no comentário do teste o número estatístico-mínimo (mediana, não média; tolerância).
**Where:** `src/modules/identity/__tests__/login.timing.int.test.ts`.
**Depends on:** T-06
**Reuses:** Supabase local + bcrypt dummy.
**Done when:** Teste verde 3 runs consecutivos no CI; documentado o uso de mediana (resistente a outliers).
**Tests:** O próprio teste é o gate. Pode ser flaky em CI compartilhado — marcar `@timing` e rodar em job dedicado se necessário (registrar SPEC_DEVIATION se for movido para job manual).
**Gate:** `npm run test -- login.timing.int.test.ts` (3 runs).
**Traces:** P-002, L-001, D-002

## T-11 — Job de retenção `auth_attempts` (Vercel Cron)

**Why:** L-006 — 90 dias (env `AUTH_ATTEMPTS_RETENTION_DAYS`). Sem job, tabela cresce indefinidamente.
**What:** Route handler `src/app/api/cron/auth-attempts-retention/route.ts` (GET protegido por header `x-cron-secret`) que executa `DELETE FROM auth_attempts WHERE attempted_at < NOW() - INTERVAL '$days days'`. Registrar `vercel.json` com schedule diário 03:00 sa-east-1.
**Where:** `src/app/api/cron/auth-attempts-retention/route.ts`, `vercel.json`.
**Depends on:** T-01
**Reuses:** Padrão de cron Vercel já documentado no runbook se existir (`IDSD/architecture/runbooks/`).
**Done when:** Endpoint responde 200 + retorna `{ deleted: N }`. `vercel.json` válido.
**Tests:**
- Integração: seed com `attempted_at` antigo + recente, executa handler com env=1 dia, valida que só os antigos sumiram.
**Gate:** `npm run test -- auth-attempts-retention && npx vercel build` (valida schema).
**Traces:** L-006

## T-12 — Carga sintética para ensaio D-001 (manual)

**Why:** D-001 exige validar com sponsor empiricamente. Não é automatizado em CI.
**What:** Script `scripts/load/login-brute-force.ts` que dispara 100 tentativas paralelas de senha errada para a mesma Pessoa de IPs sintéticos (header `x-forwarded-for` simulado em ambiente local). Demonstra bloqueio ativando após 5/15 min na chave `(email, ip)`. Documentar saída esperada (5 sucessos parciais por IP único, então bloqueio).
**Where:** `scripts/load/login-brute-force.ts`, mini-readme `scripts/load/README.md` com exemplo de execução.
**Depends on:** T-06
**Reuses:** `tsx` ou `bun` script runner.
**Done when:** Script roda local; output mostra contagem de respostas bloqueadas; sponsor + engenheiro validam visualmente (registrar no PR).
**Tests:** N/A (operacional).
**Gate:** Run manual + screenshot/log anexado no PR review.
**Traces:** D-001

---

## Ordem sugerida + paralelismo

```
T-00 (schema base)
  ├─ T-01 [P] (auth_attempts)
  ├─ T-02 [P] (audit events)
  └─ T-05 (SupabaseAuthAdapter)
T-03 [P] (LockoutGate puro)
T-04 (AuthAttemptsRepo)        ← depende T-01
T-06 (loginAction)             ← depende T-02, T-03, T-04, T-05
  ├─ T-07 [P] (LoginForm UI)
  ├─ T-08 (middleware)
  ├─ T-10 (timing test)
  └─ T-11 (cron retenção)
T-09 (trocar-senha)            ← depende T-06, T-08
T-12 (carga manual)            ← depende T-06; gate final
```

Tasks marcadas `[P]` podem rodar em paralelo (worktree por agente em caso de execução concorrente — `CLAUDE.md` não tem essa convenção mas o protocolo do Bravi sub-agent prevê).

## Mapa de rastreabilidade AC → Task

| Critério / Proibição | Task(s) responsável(is) |
|----------------------|--------------------------|
| AC-004-1 | T-05, T-06, T-07 |
| AC-004-2 | T-05, T-06, T-07, T-10 |
| AC-004-3 | T-01, T-03, T-04, T-06 |
| AC-004-4 | T-06, T-08 |
| AC-004-5 | T-06, T-07, T-09 |
| AC-004-6 | T-02, T-06 |
| P-001 | T-03, T-04, T-06, T-12 |
| P-002 | T-06, T-07, T-10 |
| P-003 | T-06 (cookie config), validado em T-07 (E2E inspeciona Set-Cookie) |
| P-004 | T-08 |
| P-005 | T-02, T-06 |
| P-006 | T-08 (preparação session_version) — implementação completa na USP-005 |
| P-007 | T-00 (schema), T-06 |
| L-001 | T-10 |
| L-006 | T-11 |
| D-001 | T-12 |
| D-002 | T-10 |
| D-003 | T-08 |
| D-004 | (fora desta USP — entregue em USP-005) |
| D-005 | T-02, T-06 (auditoria — visualização via USP-008/USP-039) |

## Commits sugeridos (Conventional)

Um commit por task quando faz sentido; agrupar T-00..T-02 num único `feat(identity): scaffold` se forem triviais.

- `feat(identity): schema base Person/Credential` (T-00)
- `feat(identity): tabela auth_attempts para lockout (USP-004)` (T-01)
- `feat(audit): eventos AUTH_* no catálogo` (T-02)
- `feat(identity): LockoutGate domain puro` (T-03)
- `feat(identity): AuthAttemptsRepo` (T-04)
- `feat(identity): adapter Supabase Auth` (T-05)
- `feat(identity): Server Action loginAction (USP-004)` (T-06)
- `feat(identity): UI login + form (USP-004)` (T-07)
- `feat(identity): revalidação de sessão por request (ADR-0030)` (T-08)
- `feat(identity): troca obrigatória de senha no 1º acesso (USP-004)` (T-09)
- `test(identity): variância de tempo login anti-enumeração (P-002)` (T-10)
- `feat(infra): cron retenção auth_attempts 90d` (T-11)
- `chore(tests): script de carga login brute-force (D-001)` (T-12)
