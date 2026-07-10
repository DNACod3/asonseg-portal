import { describe, it, expect } from 'vitest';
import {
  isLocked,
  withinWindow,
  requiresLoginCaptcha,
  CAPTCHA_CHALLENGE_THRESHOLD,
  LOCKOUT_THRESHOLD,
  LOCKOUT_WINDOW_MS,
  type LockoutAttempt,
} from '../domain/lockout';

const NOW = new Date('2026-06-02T12:00:00.000Z');

/** Helper: tentativa a `minutesAgo` minutos de NOW. */
function attempt(outcome: 'SUCCESS' | 'FAILURE', minutesAgo: number): LockoutAttempt {
  return { outcome, attemptedAt: new Date(NOW.getTime() - minutesAgo * 60_000) };
}

describe('identity/domain/lockout', () => {
  it('lista vazia → não bloqueado', () => {
    expect(isLocked([], NOW)).toBe(false);
  });

  it('4 falhas na janela → não bloqueado (abaixo do threshold)', () => {
    const attempts = Array.from({ length: 4 }, (_, i) => attempt('FAILURE', i));
    expect(attempts.length).toBeLessThan(LOCKOUT_THRESHOLD);
    expect(isLocked(attempts, NOW)).toBe(false);
  });

  it('5 falhas na janela → bloqueado (atinge o threshold)', () => {
    const attempts = Array.from({ length: 5 }, (_, i) => attempt('FAILURE', i));
    expect(isLocked(attempts, NOW)).toBe(true);
  });

  it('conta falhas na janela independentemente de sucessos intercalados', () => {
    const attempts = [
      attempt('FAILURE', 1),
      attempt('SUCCESS', 2),
      attempt('FAILURE', 3),
      attempt('SUCCESS', 4),
      attempt('FAILURE', 5),
      attempt('FAILURE', 6),
      attempt('FAILURE', 7),
    ];
    // 5 falhas dentro da janela ⇒ bloqueado (o sucesso não zera a contagem aqui).
    expect(isLocked(attempts, NOW)).toBe(true);
  });

  it('falhas fora da janela de 15min não contam', () => {
    const attempts = [
      attempt('FAILURE', 16),
      attempt('FAILURE', 20),
      attempt('FAILURE', 30),
      attempt('FAILURE', 40),
      attempt('FAILURE', 50),
    ];
    expect(isLocked(attempts, NOW)).toBe(false);
  });

  it('tentativas no futuro (clock skew) são ignoradas', () => {
    const future = Array.from({ length: 6 }, (_, i) => ({
      outcome: 'FAILURE' as const,
      attemptedAt: new Date(NOW.getTime() + (i + 1) * 60_000),
    }));
    expect(isLocked(future, NOW)).toBe(false);
    expect(withinWindow(future, NOW)).toHaveLength(0);
  });

  it('a ordenação das tentativas é irrelevante', () => {
    const ordered = Array.from({ length: 5 }, (_, i) => attempt('FAILURE', i));
    const shuffled = [...ordered].reverse();
    expect(isLocked(shuffled, NOW)).toBe(true);
  });

  it('threshold e janela são parametrizáveis', () => {
    const attempts = Array.from({ length: 3 }, (_, i) => attempt('FAILURE', i));
    expect(isLocked(attempts, NOW, { threshold: 3 })).toBe(true);
    expect(isLocked(attempts, NOW, { threshold: 10 })).toBe(false);

    const old = [attempt('FAILURE', 6), attempt('FAILURE', 7), attempt('FAILURE', 8)];
    // janela curta de 5min descarta tudo
    expect(isLocked(old, NOW, { threshold: 1, windowMs: 5 * 60_000 })).toBe(false);
  });

  it('withinWindow mantém apenas tentativas dentro de [now - windowMs, now]', () => {
    const attempts = [attempt('FAILURE', 1), attempt('FAILURE', 14), attempt('FAILURE', 16)];
    const kept = withinWindow(attempts, NOW, LOCKOUT_WINDOW_MS);
    expect(kept).toHaveLength(2);
  });
});

describe('identity/domain/lockout — requiresLoginCaptcha (H1, Fase 6 hardening)', () => {
  it('o limiar de CAPTCHA fica abaixo do limiar de lockout', () => {
    expect(CAPTCHA_CHALLENGE_THRESHOLD).toBeLessThan(LOCKOUT_THRESHOLD);
  });

  it.each([0, 1, 2])('%i falha(s) → não exige CAPTCHA', (n) => {
    const attempts = Array.from({ length: n }, (_, i) => attempt('FAILURE', i));
    expect(requiresLoginCaptcha(attempts, NOW)).toBe(false);
  });

  it.each([3, 4])('%i falhas → exige CAPTCHA (abaixo do lockout de 5)', (n) => {
    const attempts = Array.from({ length: n }, (_, i) => attempt('FAILURE', i));
    expect(requiresLoginCaptcha(attempts, NOW)).toBe(true);
  });

  it('falhas fora da janela de 15min não contam para o CAPTCHA', () => {
    const attempts = [
      attempt('FAILURE', 16),
      attempt('FAILURE', 20),
      attempt('FAILURE', 30),
    ];
    expect(requiresLoginCaptcha(attempts, NOW)).toBe(false);
  });

  it('threshold é parametrizável independente do default', () => {
    const attempts = Array.from({ length: 2 }, (_, i) => attempt('FAILURE', i));
    expect(requiresLoginCaptcha(attempts, NOW, { threshold: 2 })).toBe(true);
    expect(requiresLoginCaptcha(attempts, NOW, { threshold: 5 })).toBe(false);
  });
});
