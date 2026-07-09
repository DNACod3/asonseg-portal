import { describe, it, expect } from 'vitest';
import { resolveReportWindow } from '../domain/report-window';

/**
 * Unit tests de `resolveReportWindow` (T2 — E-001/E-005). Fronteiras em
 * America/Sao_Paulo convertidas para instante UTC; janela vazia/invertida
 * tratada sem lançar; sem recusa por tamanho.
 */
describe('resolveReportWindow', () => {
  it('from/to ausentes → janela totalmente aberta ({gte:null, lt:null})', () => {
    expect(resolveReportWindow({})).toEqual({ gte: null, lt: null });
  });

  it('from presente / to ausente → gte fechado, lt aberto', () => {
    const window = resolveReportWindow({ from: '2026-01-15' });
    // 2026-01-15T00:00:00 America/Sao_Paulo (UTC-3, sem DST) = 2026-01-15T03:00:00Z
    expect(window.gte?.toISOString()).toBe('2026-01-15T03:00:00.000Z');
    expect(window.lt).toBeNull();
  });

  it('to presente → lt é o INÍCIO do dia seguinte (boundary exclusiva, cobre o dia todo)', () => {
    const window = resolveReportWindow({ to: '2026-01-15' });
    expect(window.gte).toBeNull();
    // início de 2026-01-16 em SP = 2026-01-16T03:00:00Z
    expect(window.lt?.toISOString()).toBe('2026-01-16T03:00:00.000Z');
  });

  it('janela de um mês fechada — from e to no mesmo mês', () => {
    const window = resolveReportWindow({ from: '2026-06-01', to: '2026-06-30' });
    expect(window.gte?.toISOString()).toBe('2026-06-01T03:00:00.000Z');
    expect(window.lt?.toISOString()).toBe('2026-07-01T03:00:00.000Z');
  });

  it('janela invertida (from > to) → tratada sem lançar; lt fica ANTES de gte (query a jusante não casa nada)', () => {
    const window = resolveReportWindow({ from: '2026-06-30', to: '2026-06-01' });
    expect(() => window).not.toThrow();
    expect(window.gte).not.toBeNull();
    expect(window.lt).not.toBeNull();
    expect((window.lt as Date).getTime()).toBeLessThan((window.gte as Date).getTime());
  });

  it('entrada inválida (não yyyy-MM-dd) → tratada como ausente (fronteira aberta), sem lançar', () => {
    expect(() => resolveReportWindow({ from: 'não-é-data', to: '' })).not.toThrow();
    const window = resolveReportWindow({ from: 'não-é-data', to: '' });
    expect(window).toEqual({ gte: null, lt: null });
  });

  it('janela longa (> 1 ano) NÃO é recusada — resolve normalmente (E-005, sem limite de tamanho no MVP)', () => {
    const window = resolveReportWindow({ from: '2020-01-01', to: '2026-12-31' });
    expect(window.gte).not.toBeNull();
    expect(window.lt).not.toBeNull();
  });
});
