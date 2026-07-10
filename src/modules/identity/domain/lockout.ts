/**
 * Política de lockout de login (USP-004 — T-03, ADR-0029 / D-B).
 *
 * Regra pura, sem IO: dada uma lista de tentativas FALHAS já filtradas pela
 * chave `(email, ip)`, decide se a chave está bloqueada. O bloqueio é não
 * exponencial — janela rolante de 15 min, threshold de 5 falhas (D-B).
 *
 * A chave combinada `(email, ip)` cobre dois vetores de força-bruta: troca de
 * IP mantendo o e-mail e troca de e-mail mantendo o IP. A filtragem por chave
 * acontece no repositório (`AuthAttemptsRepo.recent`); aqui só contamos falhas
 * dentro da janela, tolerando clock skew (tentativas no "futuro" são ignoradas).
 *
 * Cf. `docs/IDSD/.specs/features/usp-004-autenticar-no-portal/design.md §D-B`.
 */

/** Janela rolante padrão para contagem de falhas: 15 minutos (ADR-0029). */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/** Número de falhas dentro da janela que dispara o bloqueio (ADR-0029). */
export const LOCKOUT_THRESHOLD = 5;

/** Duração do bloqueio após atingir o threshold: 15 minutos (ADR-0029). */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/** Tentativa mínima necessária para a regra de lockout (subconjunto de `AuthAttempt`). */
export interface LockoutAttempt {
  outcome: 'SUCCESS' | 'FAILURE';
  attemptedAt: Date;
}

export interface LockoutPolicy {
  /** Tamanho da janela rolante em ms (default {@link LOCKOUT_WINDOW_MS}). */
  windowMs?: number;
  /** Quantidade de falhas que dispara o bloqueio (default {@link LOCKOUT_THRESHOLD}). */
  threshold?: number;
}

/**
 * Filtra as tentativas que caem na janela `[now - windowMs, now]`.
 * Tentativas com `attemptedAt` no futuro (clock skew) são descartadas — uma
 * tentativa adulterada não deve servir nem para bloquear nem para liberar.
 */
export function withinWindow(
  attempts: readonly LockoutAttempt[],
  now: Date,
  windowMs: number = LOCKOUT_WINDOW_MS,
): LockoutAttempt[] {
  const start = now.getTime() - windowMs;
  const end = now.getTime();
  return attempts.filter((a) => {
    const t = a.attemptedAt.getTime();
    return t >= start && t <= end;
  });
}

/**
 * `true` se a chave deve ser bloqueada: ≥ `threshold` FALHAS dentro da janela.
 *
 * A política conta **falhas na janela**, independentemente de sucessos
 * intercalados (um acerto não "zera" a contagem aqui — o reset acontece no
 * fluxo de sucesso da `loginAction`, que apaga as tentativas da chave).
 */
export function isLocked(
  attempts: readonly LockoutAttempt[],
  now: Date,
  policy: LockoutPolicy = {},
): boolean {
  const windowMs = policy.windowMs ?? LOCKOUT_WINDOW_MS;
  const threshold = policy.threshold ?? LOCKOUT_THRESHOLD;
  const failures = withinWindow(attempts, now, windowMs).filter((a) => a.outcome === 'FAILURE');
  return failures.length >= threshold;
}

/**
 * Limiar de desafio de CAPTCHA adaptativo no login (H1, Fase 6 — hardening).
 * Deliberadamente **abaixo** de {@link LOCKOUT_THRESHOLD} (5): entre 3 e 4
 * falhas, o login passa a exigir prova humana antes de tentar a senha; ao
 * atingir 5, o lockout durável assume (checado primeiro em `loginAction`).
 */
export const CAPTCHA_CHALLENGE_THRESHOLD = 3;

/**
 * `true` quando a chave `(email, ip)` já acumulou `>= CAPTCHA_CHALLENGE_THRESHOLD`
 * falhas dentro da janela — o login deve exigir um `captchaToken` Turnstile
 * verificado antes de prosseguir para `provider.signInWithPassword`.
 *
 * Espelha a mesma mecânica de janela/contagem de {@link isLocked} e opera
 * sobre a mesma lista `recent` já buscada para o lockout (sem query nova).
 */
export function requiresLoginCaptcha(
  attempts: readonly LockoutAttempt[],
  now: Date,
  policy: LockoutPolicy = {},
): boolean {
  const windowMs = policy.windowMs ?? LOCKOUT_WINDOW_MS;
  const threshold = policy.threshold ?? CAPTCHA_CHALLENGE_THRESHOLD;
  const failures = withinWindow(attempts, now, windowMs).filter((a) => a.outcome === 'FAILURE');
  return failures.length >= threshold;
}
