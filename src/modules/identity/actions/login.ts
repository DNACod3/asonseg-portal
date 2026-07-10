'use server';

import { headers } from 'next/headers';
import { env } from '@/shared/env';
import { prisma } from '@/shared/lib/prisma';
import { clientIp } from '@/shared/lib/clientIp';
import { childLogger } from '@/shared/lib/logger';
import { container } from '@/shared/container';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { AuditEvent, withAudit } from '@/modules/audit';
import { AUTH_PROVIDER_TOKEN } from '../ports/authProvider';
import { AUTH_ATTEMPTS_REPO_TOKEN, type AuthAttemptsRepo } from '../ports/authAttemptsRepo';
import { CAPTCHA_VERIFIER_TOKEN } from '../ports/captchaVerifier';
import { isLocked, requiresLoginCaptcha, LOCKOUT_WINDOW_MS } from '../domain/lockout';
import { consumeTimingBudget } from '../domain/anti-timing';
import { signInSchema, GENERIC_AUTH_ERROR, type SignInInput } from '../schemas/signIn';

export interface LoginData {
  /** Para onde a UI deve redirecionar no sucesso. */
  redirectTo: string;
  /** `true` quando a Pessoa precisa trocar a senha no 1º acesso (D-F). */
  primeiroAcesso: boolean;
}

/**
 * Server Action de login (USP-004 — T-06).
 *
 * **Exceção à sequência canônica de Server Action sensível** (design.md §7): a
 * Pessoa ainda não está autenticada, então `requirePermission`/`requireActiveConsent`
 * não se aplicam. As pré-condições aqui são o **lockout** `(email, ip)` e o
 * **status** da Pessoa; o `withAudit` é sempre executado (sucesso ou falha) e a
 * gravação da tentativa em `auth_attempts` participa da mesma transação.
 *
 * Garantias:
 *  - Mensagem genérica única em qualquer falha ({@link GENERIC_AUTH_ERROR}).
 *  - Anti-timing: no caminho de e-mail desconhecido, gasta o orçamento de
 *    bcrypt (`consumeTimingBudget`) para nivelar com o caminho de senha errada.
 *  - Auditoria mínima: `pessoaId` só é gravado quando o e-mail existe (D-G).
 *  - Nunca lança: retorna sempre `ActionResult<LoginData>`.
 */
export async function loginAction(rawInput: SignInInput): Promise<ActionResult<LoginData>> {
  const log = childLogger({ module: 'identity', action: 'login' });

  // 0. Feature flag de manutenção/rollback (design.md §8).
  if (!env.AUTH_LOGIN_ENABLED) {
    return fail('MAINTENANCE', 'Login temporariamente indisponível. Tente novamente mais tarde.');
  }

  // 1. Validação de input (Zod) — normaliza e-mail (lowercase + trim).
  const parsed = signInSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { email, senha } = parsed.data;

  // 2. Contexto da request (IP, user-agent) para lockout e auditoria.
  const hdrs = await headers();
  const rawIp = clientIp(hdrs);
  const ip = rawIp === 'unknown' ? '0.0.0.0' : rawIp;
  const userAgent = hdrs.get('user-agent');

  const provider = container.resolve(AUTH_PROVIDER_TOKEN);
  const attempts = container.resolve(AUTH_ATTEMPTS_REPO_TOKEN);

  // 3. Lockout: ≥5 falhas da chave (email, ip) na janela de 15 min (ADR-0029).
  const recent = await attempts.recent({ email, ip, windowMs: LOCKOUT_WINDOW_MS });
  if (isLocked(recent, new Date())) {
    await recordFailure({ attempts, email, ip, userAgent, reason: 'locked', personId: null });
    log.warn({ ip: maskIp(ip) }, 'login:locked');
    return fail('INVALID_CREDENTIALS', GENERIC_AUTH_ERROR);
  }

  // 3b. CAPTCHA adaptativo (H1, Fase 6 — hardening): a partir de
  // CAPTCHA_CHALLENGE_THRESHOLD falhas recentes (abaixo do lockout de 5), exige
  // um captchaToken Turnstile verificado antes de testar a senha. Curto-circuita
  // ANTES do provedor e ANTES de recordFailure — não é uma tentativa de
  // credencial, não acelera o lockout (spec assumption 2).
  if (requiresLoginCaptcha(recent, new Date())) {
    const captcha = container.resolve(CAPTCHA_VERIFIER_TOKEN);
    const captchaResult = await captcha.verify(parsed.data.captchaToken, ip !== '0.0.0.0' ? ip : undefined);
    if (!captchaResult.ok) {
      return fail('CAPTCHA_REQUIRED', 'Confirme que você não é um robô e tente novamente.');
    }
  }

  // 4. Autenticação no provedor (Supabase). Erro genérico — não distingue motivo.
  const result = await provider.signInWithPassword(email, senha);

  if (!result.ok) {
    // 4a. Inferir o motivo pela base própria (D-G): existe Pessoa com este e-mail?
    const person = await prisma.person.findUnique({
      where: { emailLogin: email },
      select: { id: true },
    });

    if (!person) {
      // E-mail desconhecido — nivela o tempo com o caminho de bcrypt (D-A / P-002).
      consumeTimingBudget();
      await recordFailure({ attempts, email, ip, userAgent, reason: 'unknown_email', personId: null });
    } else {
      await recordFailure({ attempts, email, ip, userAgent, reason: 'wrong_password', personId: person.id });
    }
    return fail('INVALID_CREDENTIALS', GENERIC_AUTH_ERROR);
  }

  // 5. Sucesso no provedor: carregar Pessoa + credencial pelo vínculo Supabase.
  const person = await prisma.person.findUnique({
    where: { supabaseUserId: result.userId },
    select: {
      id: true,
      status: true,
      credential: { select: { primeiroAcesso: true } },
    },
  });

  // 5a. Sessão autenticada sem Pessoa vinculada, ou Pessoa INATIVA (P-004): não
  // manter sessão de quem não pode operar — encerra e responde genérico.
  if (!person || person.status !== 'ATIVO') {
    await provider.signOut();
    await recordFailure({
      attempts,
      email,
      ip,
      userAgent,
      reason: person ? 'inactive' : 'no_person',
      personId: person?.id ?? null,
      actorUserId: result.userId,
    });
    return fail('INVALID_CREDENTIALS', GENERIC_AUTH_ERROR);
  }

  // 6. Sucesso: registra SUCCESS + zera as tentativas da chave, na mesma transação.
  await withAudit(
    AuditEvent.AUTH_LOGIN_SUCCESS,
    async (tx, audit) => {
      await attempts.record({ email, ip, outcome: 'SUCCESS' }, tx);
      await attempts.reset({ email, ip }, tx);
      audit.entityType = 'person';
      audit.entityId = person.id;
      audit.after = { reason: 'password' };
    },
    { actorUserId: result.userId, actorPersonId: person.id, ip, userAgent, context: { route: '/login' } },
  );

  const primeiroAcesso = person.credential?.primeiroAcesso ?? false;
  log.info({ actorPersonId: person.id, ip: maskIp(ip) }, 'login:success');

  return ok({ redirectTo: primeiroAcesso ? '/trocar-senha' : '/inicio', primeiroAcesso });
}

// ── Helpers privados ────────────────────────────────────────────────────────

type FailureReason = 'locked' | 'unknown_email' | 'wrong_password' | 'inactive' | 'no_person';

/**
 * Registra uma tentativa FALHA em `auth_attempts` e um `AUTH_LOGIN_FAILURE` no
 * `audit_log`, na mesma transação. `personId` só é informado quando o e-mail
 * existe (D-G — evita enumeração via log).
 */
async function recordFailure(args: {
  attempts: AuthAttemptsRepo;
  email: string;
  ip: string;
  userAgent: string | null;
  reason: FailureReason;
  personId: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  const { attempts, email, ip, userAgent, reason, personId, actorUserId } = args;
  await withAudit(
    AuditEvent.AUTH_LOGIN_FAILURE,
    async (tx, audit) => {
      await attempts.record({ email, ip, outcome: 'FAILURE' }, tx);
      if (personId) {
        audit.entityType = 'person';
        audit.entityId = personId;
      }
      audit.after = { reason };
    },
    {
      actorPersonId: personId,
      actorUserId: actorUserId ?? null,
      ip,
      userAgent,
      context: { route: '/login' },
    },
  );
}

/** Mascara o IP no log estruturado (LGPD): mantém só os 2 primeiros octetos. */
function maskIp(ip: string): string {
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : 'masked';
}
