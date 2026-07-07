import { describe, expect, it } from 'vitest';
import { cn } from '../cn';

/**
 * Fundação de Design System da Fase 1 — T1. `cn` é a base de merge de classes
 * de todos os primitivos (DS-05 parcial).
 */
describe('cn', () => {
  it('mescla múltiplas classes estáticas', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('dedup de classes conflitantes de padding (tailwind-merge) — última vence', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('dedup de classes conflitantes de cor — última vence', () => {
    expect(cn('bg-cta', 'bg-primary')).toBe('bg-primary');
  });

  it('ignora valores falsy (condicionais)', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('aceita arrays e objetos condicionais (assinatura clsx)', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });
});
