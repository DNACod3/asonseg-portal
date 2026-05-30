# design.md — USP-004: Autenticar no portal com e-mail e senha

> **Modo híbrido IDSD.** Este design **referencia** o `architecture-document.md` e `technical-design.md` — não duplica. Aqui só decisões locais da feature + apontadores para a arquitetura.
>
> Fontes canônicas:
> - `IDSD/architecture/architecture-document.md §4–6` (visão, componentes, módulos)
> - `IDSD/architecture/technical-design.md §4.2` (responsabilidades do módulo `identity`)
> - `IDSD/architecture/technical-design.md §4.4` (contrato de `login(...)`)
> - `IDSD/architecture/technical-design.md §4.5` (schemas: `persons`, `credential`, `auth_attempts`)
> - `IDSD/architecture/technical-design.md §7.1` (autenticação/autorização)
> - `IDSD/architecture/project-guideline.md §5.1, §7.1, §8.3` (mapa de erros, Server Action sensível, auditoria)

## 1. Visão Local

Login = adapter sobre Supabase Auth + camada Portal que aplica **lockout local** (`auth_attempts`), **anti-enumeração** (mensagem + timing), **auditoria** (`audit_log` append-only) e **revalidação por request** (ADR-0030).

```
User → Login Form (RHF+Zod) → Server Action login(email, senha)
                                  │
                                  ├─ 1. Zod input
                                  ├─ 2. consultar auth_attempts → se bloqueado, response genérica
                                  ├─ 3. supabase.auth.signInWithPassword(email, senha)
                                  │     ├─ sucesso → busca Pessoa + papéis ativos
                                  │     └─ falha → bcrypt.compare contra dummy hash (nivelar tempo)
                                  ├─ 4. withAudit('AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_FAILURE', tx)
                                  │     └─ tx: incrementar/zerar auth_attempts + INSERT audit_log
                                  ├─ 5. set cookie sessão (HttpOnly+Secure+SameSite=Lax, 12h)
                                  └─ 6. response: { ok:true, data:{ redirectTo } } | { ok:false, error:'INVALID_CREDENTIALS' }
```

Detalhes do contrato em `IDSD/architecture/technical-design.md §4.4` (entrada `login(email, senha)`).

## 2. Componentes

| Componente | Local | Responsabilidade |
|------------|-------|-------------------|
| `LoginForm` | `src/app/(auth)/login/page.tsx` + `_components/LoginForm.tsx` | UI (shadcn + RHF + Zod); chama Server Action. |
| `ChangePasswordForm` | `src/app/(auth)/trocar-senha/page.tsx` | Forçada quando `primeiro_acesso=true`. |
| `loginAction` | `src/modules/identity/actions/login.ts` | Server Action `'use server'` orquestrando fluxo. |
| `SupabaseAuthAdapter` | `src/modules/identity/adapters/SupabaseAuthAdapter.ts` | Implementa `AuthProvider` port; isola Supabase. |
| `LockoutGate` | `src/modules/identity/domain/lockout.ts` | Função pura `isLocked(attempts, now)` + `recordAttempt(...)`. |
| `auth_attempts` repo | `src/modules/identity/adapters/AuthAttemptsRepo.ts` | INSERT por tentativa, query window. |
| `requirePermission()` | `src/modules/identity/server/requirePermission.ts` | Helper revalidação por request (ADR-0030). Usado por Server Components autenticados. |
| `withAudit` | `src/modules/audit/withAudit.ts` (já planejado) | Wrapper de transação que escreve `audit_log` ao final. |
| `auditEvents` | `src/modules/audit/events.ts` | Catálogo: `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`, `AUTH_SESSION_INVALIDATED`. |
| Middleware Next | `src/middleware.ts` (atualização) | Lê cookie, valida sessão, re-checa `pessoa.status` via cache curta (≤30s) — ADR-0030. |

## 3. Modelo de Dados

Já especificado no IDSD — replicado abaixo só o pertinente à USP-004. Schemas completos em `IDSD/architecture/technical-design.md §4.5`.

```prisma
model Person {
  id            String       @id @default(cuid())
  status        PersonStatus // ATIVO, INATIVO  ← lido em cada request (ADR-0030)
  credential    Credential?
  // ...demais campos da Pessoa
}

model Credential {
  id              String   @id @default(cuid())
  personId        String   @unique
  person          Person   @relation(fields: [personId], references: [id])
  // senhaHash é gerenciada por Supabase Auth (bcrypt, cost 10) — não armazenamos aqui
  primeiroAcesso  Boolean  @default(false)
  createdAt       DateTime @default(now())
}

model AuthAttempt {
  id        String   @id @default(cuid())
  email     String                       // normalizado (lowercase + trim)
  ip        String                       // de x-forwarded-for ou request.ip
  outcome   AuthOutcome                  // SUCCESS, FAILURE
  attemptedAt DateTime @default(now())

  @@index([email, ip, attemptedAt])      // suporta query da janela
  @@index([attemptedAt])                 // suporta job de retenção
}

enum AuthOutcome { SUCCESS FAILURE }
```

**Notas:**
- Senha em si **nunca** transita pelo nosso código fora do `signInWithPassword`. Supabase Auth gerencia bcrypt (cost 10, default — *não assumir cost ≥12*, ver `technical-design.md §7.1`).
- `auth_attempts` é uma tabela **separada** de `audit_log` (técnico vs auditoria de domínio). O job de retenção de 90 dias roda contra `auth_attempts` apenas (env `AUTH_ATTEMPTS_RETENTION_DAYS`).

## 4. Contratos / Server Action

```ts
// src/modules/identity/actions/login.ts
'use server';

import { z } from 'zod';
import { actionResult, type ActionResult } from '@/shared/errors';

const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(8).max(128),
});

type LoginData = { redirectTo: string; primeiroAcesso: boolean };

export async function loginAction(
  input: z.infer<typeof LoginInput>,
  ctx: { ip: string; userAgent: string },
): Promise<ActionResult<LoginData>>;
```

Tipos de erro retornados (cf. `IDSD/architecture/project-guideline.md §5.1`):
- `INVALID_CREDENTIALS` — qualquer falha (e-mail inexistente, senha errada, lockout ativo). Mensagem UI única.
- `VALIDATION` — Zod falhou (email malformado, senha vazia).
- `PERSON_INACTIVE` — credencial OK mas Pessoa marcada INATIVA. Mesma mensagem genérica na UI (não revelar).

A UI sempre exibe `"Credenciais inválidas. Verifique e tente novamente."` para `INVALID_CREDENTIALS` e `PERSON_INACTIVE`.

## 5. Decisões locais

### D-A — Anti-timing via bcrypt dummy
Quando `signInWithPassword` retorna "e-mail não encontrado", executar `bcrypt.compare(senha, DUMMY_HASH)` antes de responder, nivelando o tempo total com o caminho de senha incorreta. Testado em CI com `expect(|t_success_failure - t_failure_unknown|).toBeLessThan(50)`.

### D-B — Lockout por `(email, IP)`, não-exponencial
Conforme ADR-0029. Janela rolling de 15 min, threshold = 5. Chave combinada cobre dois vetores (troca de IP para mesmo e-mail; troca de e-mail isolada). Não usar backoff exponencial (operacionalmente complexo e fora do ADR).

### D-C — Cookie de sessão
Supabase Auth já emite cookie HTTP-only. Validar config:
```ts
cookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 12*60*60 }
```
Em ambiente `local`, `secure=false` é permitido apenas via env explicitamente.

### D-D — Sessão fixa 12h (não inatividade)
Decisão de elicitação documentada em `expectations §1 E-004`. Significa **não** renovar cookie em cada request. Refresh automático Supabase deve ser **desligado** para esta sessão; expiração estrita em `iat + 12h`.

### D-E — Revalidação por request via middleware
Middleware lê cookie, decodifica JWT custom claim com `session_version` (bumpado quando Pessoa é inativada — USP-007 — ou senha é resetada — USP-005). Se claim ≠ valor atual no DB → 401 + invalidação de cookie. Cache curta (LRU local, TTL 30s) opcional para reduzir hit no DB (ADR-0030).

### D-F — Forçar troca de senha no 1º acesso
Após login bem-sucedido, se `credential.primeiroAcesso=true`, retornar `redirectTo: '/trocar-senha'`. Middleware bloqueia acesso a qualquer rota `(app)` enquanto `primeiroAcesso=true` (whitelist apenas `/trocar-senha` e `/logout`).

### D-G — Auditoria com payload mínimo
Evento `AUTH_LOGIN_FAILURE` registra `{ email, ip, ua, timestamp, reason }`. Para evitar log-driven enumeração, **não** registrar `pessoaId` quando `reason='unknown_email'`. Quando `reason='wrong_password'`, `pessoaId` é registrado (essencial para investigação).

## 6. Fluxos de exceção

| Cenário | Comportamento |
|---------|---------------|
| Supabase Auth indisponível | Resposta genérica `INVALID_CREDENTIALS` + alerta operacional (não revelar outage interno). |
| `audit_log` falha no commit | A transação faz rollback → login falha → usuário vê genérico. Alerta P-005 disparado. |
| `auth_attempts` cresce além de threshold operacional | Job de retenção 90 dias + alerta de volume anômalo (`technical-design.md §8.3`). |
| Race condition: 6ª tentativa concorrente entre check e insert | Aceitável — janela de 15 min absorve. Não usar lock; throughput > exatidão de borda. |

## 7. Conformidade com Padrões IDSD

Cf. `IDSD/architecture/project-guideline.md §7.1`. A `loginAction` é um caso **especial** (não é "Server Action sensível" típica), pois:

- **Zod**: ✅ aplicado.
- `requirePermission`: ❌ não aplicável (a Pessoa ainda não está autenticada).
- `requireActiveConsent`: ❌ não aplicável (login = operação técnica de identidade, não finalidade LGPD).
- Pré-condições: ✅ lockout + status da Pessoa.
- `withAudit`: ✅ sempre (sucesso ou falha).
- Transação única: ✅ incremento `auth_attempts` + `audit_log` no mesmo `$tx`.
- Retorno `ActionResult`: ✅.

Documentar essa exceção como nota no header da action.

## 8. Plano de Rollback

- Feature flag `AUTH_LOGIN_ENABLED` no `shared/env.ts` (Zod). Off ⇒ Server Action retorna `{ ok:false, error:'MAINTENANCE' }` com mensagem "Login temporariamente indisponível".
- Hotfix de senha: como Supabase Auth é independente, sempre é possível resetar manualmente um usuário via console.
- Sessão suja após bug: bump global de `session_version` (config de ambiente) força re-login universal.

## 9. Não-Decisões (deferred)

- **Pool de Pessoas para futura troca de provedor de auth** — manter `Credential` desacoplada do user_id Supabase via FK indireta? Adiado para Release 2.
- **Refresh token rotativo** — fora da USP-004 (sessão fixa 12h é decisão de produto).
- **MFA** — fora do MVP (intent §2).
