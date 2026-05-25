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
    // `getHours()` lê os campos locais do Date; o setup fixa TZ=UTC, então o
    // resultado é determinístico (12h de SP é lido como 12h sob UTC).
    const local = utcToSaoPaulo('2026-01-15T15:00:00.000Z');
    expect(local.getHours()).toBe(12);
  });

  it('é idempotente no round-trip local→utc→local', () => {
    const original = '2026-07-15T08:30:00';
    const roundTrip = utcToSaoPaulo(saoPauloToUtc(original));
    expect(roundTrip.getHours()).toBe(8);
    expect(roundTrip.getMinutes()).toBe(30);
  });

  it('aceita um objeto Date (não só string) em saoPauloToUtc/utcToSaoPaulo', () => {
    // Exercita o ramo `Date` da assinatura `Date | string`. Sob TZ=UTC, os
    // campos de parede deste Date são 15:00 — é esse valor que saoPauloToUtc
    // interpreta como horário de SP, resultando em 18:00Z (SP = UTC-3).
    const localDate = new Date('2026-01-15T15:00:00.000Z');
    const utc = saoPauloToUtc(localDate);
    expect(utc.toISOString()).toBe('2026-01-15T18:00:00.000Z');

    const back = utcToSaoPaulo(new Date('2026-01-15T15:00:00.000Z'));
    expect(back.getHours()).toBe(12);
  });

  it('formata um instante UTC no fuso de São Paulo', () => {
    expect(formatSaoPaulo('2026-01-15T15:00:00.000Z')).toBe('15/01/2026 12:00');
  });

  it('formata um objeto Date no fuso de São Paulo (ramo Date)', () => {
    expect(formatSaoPaulo(new Date('2026-01-15T15:00:00.000Z'))).toBe('15/01/2026 12:00');
  });

  it('lida com a virada de meia-noite (UTC tarde → dia anterior em SP)', () => {
    // 02:00Z do dia 16 = 23:00 do dia 15 em São Paulo.
    expect(formatSaoPaulo('2026-01-16T02:00:00.000Z')).toBe('15/01/2026 23:00');
  });

  it('formata datas puras sem fuso', () => {
    expect(formatDate('2026-03-09')).toBe('09/03/2026');
  });

  it('formata um objeto Date puro sem fuso (ramo Date)', () => {
    // Date construído com campos locais; sob TZ=UTC reflete o dia esperado.
    expect(formatDate(new Date(2026, 2, 9))).toBe('09/03/2026');
  });
});
