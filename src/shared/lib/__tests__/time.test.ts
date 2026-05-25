import { describe, it, expect } from 'vitest';
import {
  APP_TIME_ZONE,
  saoPauloToUtc,
  utcToSaoPaulo,
  formatSaoPaulo,
  formatDate,
} from '@/shared/lib/time';

describe('shared/lib/time', () => {
  it('expõe o fuso da aplicação', () => {
    expect(APP_TIME_ZONE).toBe('America/Sao_Paulo');
  });

  it('converte horário de parede de São Paulo para UTC (offset -03:00)', () => {
    // São Paulo está em UTC-3 (sem DST desde 2019).
    const utc = saoPauloToUtc('2026-01-15T12:00:00');
    expect(utc.toISOString()).toBe('2026-01-15T15:00:00.000Z');
  });

  it('converte UTC de volta para o horário de parede de São Paulo', () => {
    const local = utcToSaoPaulo('2026-01-15T15:00:00.000Z');
    expect(local.getHours()).toBe(12);
  });

  it('é idempotente no round-trip local→utc→local', () => {
    const original = '2026-07-15T08:30:00';
    const roundTrip = utcToSaoPaulo(saoPauloToUtc(original));
    expect(roundTrip.getHours()).toBe(8);
    expect(roundTrip.getMinutes()).toBe(30);
  });

  it('formata um instante UTC no fuso de São Paulo', () => {
    expect(formatSaoPaulo('2026-01-15T15:00:00.000Z')).toBe('15/01/2026 12:00');
  });

  it('lida com a virada de meia-noite (UTC tarde → dia anterior em SP)', () => {
    // 02:00Z do dia 16 = 23:00 do dia 15 em São Paulo.
    expect(formatSaoPaulo('2026-01-16T02:00:00.000Z')).toBe('15/01/2026 23:00');
  });

  it('formata datas puras sem fuso', () => {
    expect(formatDate('2026-03-09')).toBe('09/03/2026');
  });
});
