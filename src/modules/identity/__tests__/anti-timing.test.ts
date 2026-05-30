import { describe, it, expect } from 'vitest';
import { DUMMY_HASH, consumeTimingBudget } from '../domain/anti-timing';

describe('identity/domain/anti-timing', () => {
  it('DUMMY_HASH é um hash bcrypt válido (60 chars, prefixo $2)', () => {
    expect(DUMMY_HASH).toHaveLength(60);
    expect(DUMMY_HASH.startsWith('$2')).toBe(true);
  });

  it('consumeTimingBudget executa sem lançar', () => {
    expect(() => consumeTimingBudget()).not.toThrow();
  });

  it('consumeTimingBudget gasta tempo não-trivial (>5ms — sinal de bcrypt real)', () => {
    const t0 = performance.now();
    consumeTimingBudget();
    const elapsed = performance.now() - t0;
    // bcrypt cost 10 leva tipicamente 50-200ms; threshold conservador para CI lento.
    expect(elapsed).toBeGreaterThan(5);
  });
});
