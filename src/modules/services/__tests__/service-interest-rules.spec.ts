import { describe, it, expect } from 'vitest';
import { isServiceOpenForInterest, canCancelInterest } from '../domain/service-interest-rules';

// FACTS (USP-033 / SVC033-MN-05) — regra pura de elegibilidade de manifestação
// de interesse. Espelha o `where` on-read de `get-service-detail.ts`:
// status='ACTIVE' AND author.inactivatedAt IS NULL.
describe('isServiceOpenForInterest — regra pura (SVC033-MN-05)', () => {
  it('serviço ACTIVE com autor ativo → true', () => {
    expect(isServiceOpenForInterest({ status: 'ACTIVE', authorInactivatedAt: null })).toBe(true);
  });

  it('serviço PAUSED (não-ACTIVE) → false', () => {
    expect(isServiceOpenForInterest({ status: 'PAUSED', authorInactivatedAt: null })).toBe(false);
  });

  it('serviço DRAFT → false', () => {
    expect(isServiceOpenForInterest({ status: 'DRAFT', authorInactivatedAt: null })).toBe(false);
  });

  it('serviço ACTIVE mas autor inativado → false', () => {
    expect(
      isServiceOpenForInterest({ status: 'ACTIVE', authorInactivatedAt: new Date('2026-01-01') }),
    ).toBe(false);
  });
});

// FACTS (USP-034 / AC-034-3) — regra pura de elegibilidade de cancelamento. A
// checagem de dono/existência NÃO é desta função (é da query escopada em
// cancelInterest) — aqui só o estado da linha.
describe('canCancelInterest — regra pura (AC-034-3)', () => {
  it('manifestação ativa (cancelledAt null) → { ok: true }', () => {
    expect(canCancelInterest({ cancelledAt: null })).toEqual({ ok: true });
  });

  it('manifestação já cancelada → { ok: false, reason: ALREADY_CANCELLED }', () => {
    expect(canCancelInterest({ cancelledAt: new Date('2026-07-01T00:00:00Z') })).toEqual({
      ok: false,
      reason: 'ALREADY_CANCELLED',
    });
  });
});
