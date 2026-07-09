import { describe, it, expect } from 'vitest';
import { registerReferralResultSchema } from '../schemas/referral.schema';

/**
 * Unit tests de `registerReferralResultSchema` (USP-038 / T1 — REF38-MN-01).
 */

const VALID_REFERRAL_ID = '33333333-3333-4333-8333-333333333333';

describe('registerReferralResultSchema', () => {
  it.each(['HIRED', 'NOT_SELECTED', 'UNDER_REVIEW', 'NO_RESPONSE'] as const)(
    'aceita o valor válido do enum "%s"',
    (result) => {
      const parsed = registerReferralResultSchema.safeParse({ referralId: VALID_REFERRAL_ID, result });
      expect(parsed.success).toBe(true);
    },
  );

  it('aceita input completo válido com observação', () => {
    const parsed = registerReferralResultSchema.safeParse({
      referralId: VALID_REFERRAL_ID,
      result: 'HIRED',
      observation: 'Contratado após entrevista em 10/07.',
    });
    expect(parsed.success).toBe(true);
  });

  it('@ref38-mn-01 rejeita valor fora do enum', () => {
    const parsed = registerReferralResultSchema.safeParse({
      referralId: VALID_REFERRAL_ID,
      result: 'APPROVED',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejeita referralId com uuid inválido', () => {
    const parsed = registerReferralResultSchema.safeParse({ referralId: 'not-a-uuid', result: 'HIRED' });
    expect(parsed.success).toBe(false);
  });

  it('rejeita observação acima do máximo (2000 caracteres)', () => {
    const parsed = registerReferralResultSchema.safeParse({
      referralId: VALID_REFERRAL_ID,
      result: 'HIRED',
      observation: 'a'.repeat(2001),
    });
    expect(parsed.success).toBe(false);
  });

  it('observação é opcional — ausente é válido', () => {
    const parsed = registerReferralResultSchema.safeParse({ referralId: VALID_REFERRAL_ID, result: 'NO_RESPONSE' });
    expect(parsed.success).toBe(true);
  });
});
