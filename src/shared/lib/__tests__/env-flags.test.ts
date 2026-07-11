import { describe, it, expect } from 'vitest';
import { parseBooleanFlag } from '@/shared/lib/env-flags';

/**
 * USP-050 (PUB-1a) — parser puro de flag booleana fail-loud. Cobre todas as
 * grafias aceitas (FLAG-01/02) e a sentinela para valor não reconhecido
 * (RL-MN-04: NÃO deve virar `false` silencioso).
 */
describe('parseBooleanFlag', () => {
  it.each(['1', 'true', 'YES', 'On', ' true ', 'TRUE', 'yes', 'on'])(
    '%s → true (grafias aceitas, case-insensitive, trim)',
    (raw) => {
      expect(parseBooleanFlag(raw)).toBe(true);
    },
  );

  it.each(['0', 'false', 'no', 'off', '', ' off ', 'FALSE'])(
    '%s → false (grafias aceitas, case-insensitive, trim)',
    (raw) => {
      expect(parseBooleanFlag(raw)).toBe(false);
    },
  );

  it('passthrough de boolean: true → true, false → false', () => {
    expect(parseBooleanFlag(true)).toBe(true);
    expect(parseBooleanFlag(false)).toBe(false);
  });

  it('undefined → undefined (deixa o .default() do schema agir)', () => {
    expect(parseBooleanFlag(undefined)).toBeUndefined();
  });

  it('RL-MN-04 (negativo): string não reconhecida devolve a string crua, NÃO um boolean', () => {
    const result = parseBooleanFlag('maybe');
    expect(result).toBe('maybe');
    expect(typeof result).toBe('string');
    expect(result).not.toBe(true);
    expect(result).not.toBe(false);
  });

  it('RL-MN-04 (negativo): "2" (grafia numérica não mapeada) devolve a string crua', () => {
    const result = parseBooleanFlag('2');
    expect(result).toBe('2');
    expect(typeof result).toBe('string');
  });
});
