import { describe, it, expect } from 'vitest';
import { DAILY_CV_UPLOAD_LIMIT, isOverDailyLimit, startOfDaySaoPaulo } from '../rate-limit';

/**
 * Rate limit diário de upload de CV (USP-040 / CVE-07, T6). Cobre a fronteira
 * de dia-calendário em América/São_Paulo (UTC-3, sem horário de verão) e o
 * limiar exato de bloqueio do 4º upload.
 */
describe('cv-extraction/domain/rate-limit — DAILY_CV_UPLOAD_LIMIT / isOverDailyLimit', () => {
  it('DAILY_CV_UPLOAD_LIMIT é 3 (CVE-07)', () => {
    expect(DAILY_CV_UPLOAD_LIMIT).toBe(3);
  });

  it('isOverDailyLimit(2) é false — 3º upload ainda permitido', () => {
    expect(isOverDailyLimit(2)).toBe(false);
  });

  it('isOverDailyLimit(3) é true — 4º upload bloqueado', () => {
    expect(isOverDailyLimit(3)).toBe(true);
  });
});

describe('cv-extraction/domain/rate-limit — startOfDaySaoPaulo (fronteira de dia)', () => {
  it('23:59 SP (08/07) resolve para o início do dia 08/07 em SP (03:00 UTC)', () => {
    // 2026-07-08T23:59:00 em America/Sao_Paulo (UTC-3) = 2026-07-09T02:59:00Z.
    const now = new Date('2026-07-09T02:59:00.000Z');
    const start = startOfDaySaoPaulo(now);
    expect(start.toISOString()).toBe('2026-07-08T03:00:00.000Z');
  });

  it('00:01 SP (09/07), 2 minutos depois, já resolve para o início do dia 09/07', () => {
    // 2026-07-09T00:01:00 em America/Sao_Paulo (UTC-3) = 2026-07-09T03:01:00Z.
    const now = new Date('2026-07-09T03:01:00.000Z');
    const start = startOfDaySaoPaulo(now);
    expect(start.toISOString()).toBe('2026-07-09T03:00:00.000Z');
  });

  it('os dois instantes acima (2min de diferença em UTC) caem em fronteiras de dia distintas', () => {
    const beforeMidnight = startOfDaySaoPaulo(new Date('2026-07-09T02:59:00.000Z'));
    const afterMidnight = startOfDaySaoPaulo(new Date('2026-07-09T03:01:00.000Z'));
    expect(beforeMidnight.getTime()).not.toBe(afterMidnight.getTime());
  });
});
