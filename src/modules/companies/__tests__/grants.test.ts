import { describe, it, expect } from 'vitest';
import { wouldLeaveCompanyWithoutResponsible } from '../domain/grants';

/**
 * Unit da regra pura de invariante (USP-014 / T3 / VPE-05 / AC-014-2).
 * Materializa os facts red de `tests/unit/usp-014-remover-responsavel.spec.ts`.
 */
describe('wouldLeaveCompanyWithoutResponsible', () => {
  it('true quando o grant alvo é o ÚNICO ativo', () => {
    expect(wouldLeaveCompanyWithoutResponsible(['g1'], 'g1')).toBe(true);
  });

  it('false quando há ≥2 responsáveis ativos', () => {
    expect(wouldLeaveCompanyWithoutResponsible(['g1', 'g2'], 'g1')).toBe(false);
    expect(wouldLeaveCompanyWithoutResponsible(['g1', 'g2', 'g3'], 'g2')).toBe(false);
  });

  it('false quando o grant alvo não está entre os ativos (ausente / PENDING / já revogado)', () => {
    expect(wouldLeaveCompanyWithoutResponsible(['g1', 'g2'], 'g3')).toBe(false);
    expect(wouldLeaveCompanyWithoutResponsible([], 'g1')).toBe(false);
  });
});
