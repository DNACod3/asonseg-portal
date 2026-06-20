import { describe, it, expect, afterEach, vi } from 'vitest';
import { hojeSaoPaulo } from '../time';

/**
 * FACTS (USP-021 / #170) — `hojeSaoPaulo()` é o núcleo do filtro on-read de expiração
 * (E-001 / P-003): `validUntil >= hojeSaoPaulo()`. Como São Paulo é UTC-3, há uma janela
 * (21h–24h SP) em que o dia-calendário UTC já virou mas o de SP não. Estes testes fixam
 * o relógio com `vi.setSystemTime` para garantir que retornamos sempre a meia-noite UTC
 * do dia-calendário de SP — não o de UTC.
 */

describe('hojeSaoPaulo — borda de fuso (E-001 / P-003)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function frozenAt(utcInstant: string): Date {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(utcInstant));
    return hojeSaoPaulo();
  }

  it('meio-dia SP → meia-noite UTC do mesmo dia', () => {
    // 2026-06-15 12:00 SP == 2026-06-15 15:00 UTC
    expect(frozenAt('2026-06-15T15:00:00.000Z').toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('22h SP (já dia seguinte em UTC) → ainda o dia-calendário de SP', () => {
    // 2026-06-15 22:00 SP == 2026-06-16 01:00 UTC — UTC já virou, SP não
    expect(frozenAt('2026-06-16T01:00:00.000Z').toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('23h59 SP (borda) → ainda o mesmo dia de SP', () => {
    // 2026-06-15 23:59 SP == 2026-06-16 02:59 UTC
    expect(frozenAt('2026-06-16T02:59:00.000Z').toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('00h30 SP (logo após a virada de SP) → o novo dia de SP', () => {
    // 2026-06-16 00:30 SP == 2026-06-16 03:30 UTC
    expect(frozenAt('2026-06-16T03:30:00.000Z').toISOString()).toBe('2026-06-16T00:00:00.000Z');
  });

  it('retorna sempre meia-noite UTC (hora/min/seg/ms zerados)', () => {
    const hoje = frozenAt('2026-06-16T01:00:00.000Z');
    expect(hoje.getUTCHours()).toBe(0);
    expect(hoje.getUTCMinutes()).toBe(0);
    expect(hoje.getUTCSeconds()).toBe(0);
    expect(hoje.getUTCMilliseconds()).toBe(0);
  });
});
