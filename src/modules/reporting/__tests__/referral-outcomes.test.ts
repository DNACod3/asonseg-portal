import { describe, it, expect } from 'vitest';
import { referralOutcomeRates, type ReferralResultCounts } from '../domain/referral-outcomes';

/**
 * Unit tests de `referralOutcomeRates` (T3 — E-004 / REL42-MN-04). O caso
 * canônico do task (`HIRED=17,NOT_SELECTED=3,null=5`) e a garantia
 * discriminante: `noResultRate` está SEMPRE no retorno ao lado de `successRate`.
 */
describe('referralOutcomeRates', () => {
  it('caso canônico (T3): HIRED=17, NOT_SELECTED=3, UNDER_REVIEW=0, NO_RESPONSE=0, withoutResult=5', () => {
    const counts: ReferralResultCounts = {
      HIRED: 17,
      NOT_SELECTED: 3,
      UNDER_REVIEW: 0,
      NO_RESPONSE: 0,
      withoutResult: 5,
    };
    const result = referralOutcomeRates(counts);

    expect(result.total).toBe(25);
    expect(result.withResult).toBe(20);
    expect(result.withoutResult).toBe(5);
    expect(result.successRate).toBeCloseTo(17 / 20, 10);
    expect(result.noResultRate).toBeCloseTo(5 / 25, 10);
  });

  it('REL42-MN-04 (negativo): o retorno SEMPRE inclui noResultRate junto de successRate — mutação que o omite fica vermelha', () => {
    const counts: ReferralResultCounts = {
      HIRED: 10,
      NOT_SELECTED: 5,
      UNDER_REVIEW: 2,
      NO_RESPONSE: 1,
      withoutResult: 3,
    };
    const result = referralOutcomeRates(counts);

    expect(result).toHaveProperty('successRate');
    expect(result).toHaveProperty('noResultRate');
    expect(result.noResultRate).not.toBeUndefined();
    expect(result.noResultRate).not.toBeNull();
    // Ambas as chaves sempre presentes no shape — não apenas uma delas.
    expect(Object.keys(result).sort()).toEqual(
      ['noResultRate', 'successRate', 'total', 'withResult', 'withoutResult'].sort(),
    );
  });

  it('total=0 (nenhum encaminhamento na janela) → ambas as taxas null ("—", não 0%)', () => {
    const result = referralOutcomeRates({
      HIRED: 0,
      NOT_SELECTED: 0,
      UNDER_REVIEW: 0,
      NO_RESPONSE: 0,
      withoutResult: 0,
    });
    expect(result.total).toBe(0);
    expect(result.successRate).toBeNull();
    expect(result.noResultRate).toBeNull();
  });

  it('withResult=0 mas withoutResult>0 → successRate null, noResultRate=1 (100% sem resultado)', () => {
    const result = referralOutcomeRates({
      HIRED: 0,
      NOT_SELECTED: 0,
      UNDER_REVIEW: 0,
      NO_RESPONSE: 0,
      withoutResult: 4,
    });
    expect(result.total).toBe(4);
    expect(result.successRate).toBeNull();
    expect(result.noResultRate).toBe(1);
  });

  it('sem HIRED mas com outros resultados → successRate=0 (não null — há withResult>0)', () => {
    const result = referralOutcomeRates({
      HIRED: 0,
      NOT_SELECTED: 4,
      UNDER_REVIEW: 1,
      NO_RESPONSE: 0,
      withoutResult: 0,
    });
    expect(result.successRate).toBe(0);
    expect(result.noResultRate).toBe(0);
  });
});
