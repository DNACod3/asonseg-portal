import { describe, expect, it } from 'vitest';
import {
  applyMinimumDisplay,
  MINIMUM_DISPLAY_THRESHOLD,
} from '../domain/indicators';

/**
 * USP-041 / T1 — regra pura `applyMinimumDisplay` (E-003 / REL41-MN-02).
 * Cobre o limiar N=5: 0..4 → placeholder ("Em breve" na UI); ≥5 → value.
 * Fronteira exata em 5 é o alvo primário de mutação (`<` → `<=`, `5` → `0`).
 */
describe('applyMinimumDisplay — USP-041 E-003/REL41-MN-02', () => {
  it('MINIMUM_DISPLAY_THRESHOLD é 5', () => {
    expect(MINIMUM_DISPLAY_THRESHOLD).toBe(5);
  });

  it.each([0, 1, 2, 3, 4])(
    'REL41-MN-02 (negativo): n=%i (< limiar) retorna placeholder, nunca o número cru',
    (n) => {
      expect(applyMinimumDisplay(n)).toEqual({ kind: 'placeholder' });
    },
  );

  it.each([5, 6, 47])('n=%i (>= limiar) retorna { kind: value, value: n }', (n) => {
    expect(applyMinimumDisplay(n)).toEqual({ kind: 'value', value: n });
  });

  it('fronteira exata: 4 é placeholder e 5 é value (discrimina mutação < -> <=)', () => {
    expect(applyMinimumDisplay(4)).toEqual({ kind: 'placeholder' });
    expect(applyMinimumDisplay(5)).toEqual({ kind: 'value', value: 5 });
  });

  it('threshold customizado (tunável) — n=2 com threshold=3 ainda é placeholder; com threshold=0 vira value', () => {
    expect(applyMinimumDisplay(2, 3)).toEqual({ kind: 'placeholder' });
    expect(applyMinimumDisplay(2, 0)).toEqual({ kind: 'value', value: 2 });
  });

  it('nunca retorna 0 cru para um indicador abaixo do limiar (baseline cold start)', () => {
    const display = applyMinimumDisplay(0);
    expect(display.kind).toBe('placeholder');
    expect(display).not.toHaveProperty('value');
  });
});
