import { describe, it, expect } from 'vitest';
import { moderationAvgHours, type ModerationPair } from '../domain/moderation-time';

/** Unit tests de `moderationAvgHours` (T3 — MP10, design.md §5). */
describe('moderationAvgHours', () => {
  it('lista vazia → null', () => {
    expect(moderationAvgHours([])).toBeNull();
  });

  it('todos os pares sem decisão (ainda na fila) → null', () => {
    const pairs: ModerationPair[] = [
      { submittedAt: new Date('2026-01-01T10:00:00Z'), decidedAt: null },
      { submittedAt: new Date('2026-01-02T10:00:00Z'), decidedAt: null },
    ];
    expect(moderationAvgHours(pairs)).toBeNull();
  });

  it('um par, decisão 2h depois → média = 2', () => {
    const pairs: ModerationPair[] = [
      {
        submittedAt: new Date('2026-01-01T10:00:00Z'),
        decidedAt: new Date('2026-01-01T12:00:00Z'),
      },
    ];
    expect(moderationAvgHours(pairs)).toBe(2);
  });

  it('média de 2 pares (2h e 4h) → 3', () => {
    const pairs: ModerationPair[] = [
      {
        submittedAt: new Date('2026-01-01T10:00:00Z'),
        decidedAt: new Date('2026-01-01T12:00:00Z'),
      },
      {
        submittedAt: new Date('2026-01-01T10:00:00Z'),
        decidedAt: new Date('2026-01-01T14:00:00Z'),
      },
    ];
    expect(moderationAvgHours(pairs)).toBe(3);
  });

  it('par sem decisão é IGNORADO no cálculo (não conta como 0h nem derruba a média)', () => {
    const pairs: ModerationPair[] = [
      {
        submittedAt: new Date('2026-01-01T10:00:00Z'),
        decidedAt: new Date('2026-01-01T12:00:00Z'),
      }, // 2h
      { submittedAt: new Date('2026-01-05T10:00:00Z'), decidedAt: null }, // ainda na fila
    ];
    expect(moderationAvgHours(pairs)).toBe(2);
  });
});
