import { describe, it, expect } from 'vitest';
import {
  SlidingWindowRateLimiter,
  RATE_LIMITS,
} from '@/shared/lib/rateLimit';

describe('SlidingWindowRateLimiter', () => {
  it('permite requisições até o limite e bloqueia a seguinte', () => {
    const rl = new SlidingWindowRateLimiter();
    const rule = { limit: 3, windowMs: 1000 };
    const t0 = 1_000_000;

    expect(rl.check('k', rule, t0).allowed).toBe(true);
    expect(rl.check('k', rule, t0 + 1).allowed).toBe(true);
    const third = rl.check('k', rule, t0 + 2);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = rl.check('k', rule, t0 + 3);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('libera espaço quando a janela desliza (reset)', () => {
    const rl = new SlidingWindowRateLimiter();
    const rule = { limit: 2, windowMs: 1000 };
    const t0 = 0;

    rl.check('k', rule, t0);
    rl.check('k', rule, t0 + 100);
    expect(rl.check('k', rule, t0 + 200).allowed).toBe(false);

    // Após a janela (1000ms) a partir do 1º hit, há espaço de novo.
    expect(rl.check('k', rule, t0 + 1101).allowed).toBe(true);
  });

  it('isola contadores por chave (IP/sessão distintos)', () => {
    const rl = new SlidingWindowRateLimiter();
    const rule = { limit: 1, windowMs: 1000 };
    const t0 = 5_000;

    expect(rl.check('ip-a', rule, t0).allowed).toBe(true);
    expect(rl.check('ip-a', rule, t0).allowed).toBe(false);
    // Outra chave não é afetada.
    expect(rl.check('ip-b', rule, t0).allowed).toBe(true);
  });

  it('reporta remaining decrescente e resetAt coerente', () => {
    const rl = new SlidingWindowRateLimiter();
    const rule = { limit: 3, windowMs: 60_000 };
    const t0 = 1_700_000_000_000;

    const r1 = rl.check('k', rule, t0);
    expect(r1.remaining).toBe(2);
    expect(r1.limit).toBe(3);
    expect(r1.resetAt).toBe(t0 + 60_000);
  });

  describe('limites canônicos por categoria (technical-design §8)', () => {
    it('anônimo: 10 req/min', () => {
      const rl = new SlidingWindowRateLimiter();
      const t0 = 0;
      for (let i = 0; i < 10; i++) {
        expect(rl.check('anon', RATE_LIMITS.anonymous, t0 + i).allowed).toBe(true);
      }
      expect(rl.check('anon', RATE_LIMITS.anonymous, t0 + 10).allowed).toBe(false);
    });

    it('autenticado: 60 req/min', () => {
      const rl = new SlidingWindowRateLimiter();
      const t0 = 0;
      for (let i = 0; i < 60; i++) {
        expect(rl.check('auth', RATE_LIMITS.authenticated, t0 + i).allowed).toBe(true);
      }
      expect(rl.check('auth', RATE_LIMITS.authenticated, t0 + 60).allowed).toBe(false);
    });

    it('cadastro: 3 req/15min por IP', () => {
      const rl = new SlidingWindowRateLimiter();
      const t0 = 0;
      expect(RATE_LIMITS.registration.windowMs).toBe(15 * 60_000);
      for (let i = 0; i < 3; i++) {
        expect(rl.check('reg', RATE_LIMITS.registration, t0 + i).allowed).toBe(true);
      }
      expect(rl.check('reg', RATE_LIMITS.registration, t0 + 3).allowed).toBe(false);
      // Ainda bloqueado 14 min depois; liberado após 15 min.
      expect(rl.check('reg', RATE_LIMITS.registration, t0 + 14 * 60_000).allowed).toBe(false);
      expect(rl.check('reg', RATE_LIMITS.registration, t0 + 15 * 60_000 + 1).allowed).toBe(true);
    });

    it('recuperação de senha: 5 req/15min por IP (USP-005)', () => {
      const rl = new SlidingWindowRateLimiter();
      const t0 = 0;
      expect(RATE_LIMITS.passwordReset.windowMs).toBe(15 * 60_000);
      for (let i = 0; i < 5; i++) {
        expect(rl.check('pwr', RATE_LIMITS.passwordReset, t0 + i).allowed).toBe(true);
      }
      expect(rl.check('pwr', RATE_LIMITS.passwordReset, t0 + 5).allowed).toBe(false);
      // Liberado após a janela de 15 min.
      expect(rl.check('pwr', RATE_LIMITS.passwordReset, t0 + 15 * 60_000 + 1).allowed).toBe(true);
    });
  });

  it('prune remove chaves expiradas', () => {
    const rl = new SlidingWindowRateLimiter();
    rl.check('old', RATE_LIMITS.anonymous, 0);
    rl.check('new', RATE_LIMITS.anonymous, 10 * 60_000);
    expect(rl.size).toBe(2);

    // 16 min após o início: a janela mais longa (15min) já expirou para 'old'.
    rl.prune(16 * 60_000);
    expect(rl.size).toBe(1);
  });
});
