import { describe, it, expect } from 'vitest';
import { isProfessionalSummaryRequired } from '../referral-rules';

/**
 * Unit tests 1:1 de `isProfessionalSummaryRequired` (USP-037 / T3 — REF-MN-03).
 */
describe('isProfessionalSummaryRequired', () => {
  it('sem CV + resumo vazio (undefined) → true (exigido)', () => {
    expect(isProfessionalSummaryRequired(false, undefined)).toBe(true);
  });

  it('sem CV + resumo vazio (null) → true (exigido)', () => {
    expect(isProfessionalSummaryRequired(false, null)).toBe(true);
  });

  it('sem CV + resumo só-espaços → true (exigido; tratado como vazio)', () => {
    expect(isProfessionalSummaryRequired(false, '   ')).toBe(true);
  });

  it('sem CV + resumo preenchido → false (não exigido; já satisfeito)', () => {
    expect(isProfessionalSummaryRequired(false, 'Experiência em vendas.')).toBe(false);
  });

  it('com CV + resumo vazio → false (nunca exigido com CV)', () => {
    expect(isProfessionalSummaryRequired(true, undefined)).toBe(false);
  });

  it('com CV + resumo preenchido → false (nunca exigido com CV)', () => {
    expect(isProfessionalSummaryRequired(true, 'Experiência em vendas.')).toBe(false);
  });
});
