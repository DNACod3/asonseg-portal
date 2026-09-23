import { describe, it, expect } from 'vitest';
import { countRecentWithin7Days } from '../domain/recent-within-days';

/**
 * Unit test de `countRecentWithin7Days` (USP-067 — T9 / PNL-02, A-15).
 * Import direto do arquivo (não do barrel `@/modules/services`) — lição
 * MEMORY `coverage-gate-branch-loading-drop`.
 */
describe('countRecentWithin7Days (T9)', () => {
  const now = new Date('2026-08-19T12:00:00Z');

  it('conta só interessados dentro da janela de 7 dias', () => {
    const rows = [
      { interestedAt: new Date('2026-08-19T11:00:00Z') }, // hoje — dentro
      { interestedAt: new Date('2026-08-12T12:00:00Z') }, // exatamente 7d atrás — dentro (borda)
      { interestedAt: new Date('2026-08-11T00:00:00Z') }, // fora da janela
      { interestedAt: new Date('2026-08-18T00:00:00Z') }, // dentro
    ];
    expect(countRecentWithin7Days(rows, now)).toBe(3);
  });

  it('sem linhas → 0', () => {
    expect(countRecentWithin7Days([], now)).toBe(0);
  });

  it('todas fora da janela → 0', () => {
    const rows = [{ interestedAt: new Date('2026-01-01T00:00:00Z') }];
    expect(countRecentWithin7Days(rows, now)).toBe(0);
  });
});
