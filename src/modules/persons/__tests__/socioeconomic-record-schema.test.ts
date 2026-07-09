import { describe, it, expect } from 'vitest';
import {
  socioeconomicRecordSchema,
  SOCIAL_BENEFIT_MAX,
  FAMILY_COMPOSITION_MAX,
} from '../schemas/socioeconomic-record.schema';

// FACTS da USP-036 (SOC-01, T4) — schema puro, sem IO.

const PERSON_ID = '00000000-0000-4000-8000-000000000001';

const FULL_VALID = {
  personId: PERSON_ID,
  incomeBracket: 'UP_TO_1_MW',
  socialBenefit: 'Bolsa Família',
  housingSituation: 'RENTED',
  familyComposition: '4 pessoas (2 adultos, 2 crianças)',
};

describe('socioeconomicRecordSchema', () => {
  it('aceita entrada válida completa (todos os 4 campos)', () => {
    const res = socioeconomicRecordSchema.safeParse(FULL_VALID);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual(FULL_VALID);
  });

  it('aceita entrada parcial (só personId, demais ausentes)', () => {
    const res = socioeconomicRecordSchema.safeParse({ personId: PERSON_ID });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.incomeBracket).toBeUndefined();
    expect(res.data.socialBenefit).toBeUndefined();
    expect(res.data.housingSituation).toBeUndefined();
    expect(res.data.familyComposition).toBeUndefined();
  });

  it('aceita campos vazios ("") normalizando para undefined', () => {
    const res = socioeconomicRecordSchema.safeParse({
      personId: PERSON_ID,
      incomeBracket: '',
      socialBenefit: '  ',
      housingSituation: '',
      familyComposition: '',
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.incomeBracket).toBeUndefined();
    expect(res.data.socialBenefit).toBeUndefined();
    expect(res.data.housingSituation).toBeUndefined();
    expect(res.data.familyComposition).toBeUndefined();
  });

  it('rejeita personId que não é uuid', () => {
    const res = socioeconomicRecordSchema.safeParse({ ...FULL_VALID, personId: 'abc' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.flatten().fieldErrors.personId).toBeDefined();
  });

  it('rejeita incomeBracket fora da taxonomia', () => {
    const res = socioeconomicRecordSchema.safeParse({ ...FULL_VALID, incomeBracket: 'RICO' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.flatten().fieldErrors.incomeBracket).toBeDefined();
  });

  it('rejeita housingSituation fora da taxonomia', () => {
    const res = socioeconomicRecordSchema.safeParse({ ...FULL_VALID, housingSituation: 'MANSAO' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.flatten().fieldErrors.housingSituation).toBeDefined();
  });

  it(`rejeita socialBenefit acima de ${SOCIAL_BENEFIT_MAX} caracteres`, () => {
    const res = socioeconomicRecordSchema.safeParse({
      ...FULL_VALID,
      socialBenefit: 'a'.repeat(SOCIAL_BENEFIT_MAX + 1),
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.flatten().fieldErrors.socialBenefit).toBeDefined();
  });

  it(`rejeita familyComposition acima de ${FAMILY_COMPOSITION_MAX} caracteres`, () => {
    const res = socioeconomicRecordSchema.safeParse({
      ...FULL_VALID,
      familyComposition: 'a'.repeat(FAMILY_COMPOSITION_MAX + 1),
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.flatten().fieldErrors.familyComposition).toBeDefined();
  });

  it('aceita socialBenefit/familyComposition exatamente no limite', () => {
    const res = socioeconomicRecordSchema.safeParse({
      ...FULL_VALID,
      socialBenefit: 'a'.repeat(SOCIAL_BENEFIT_MAX),
      familyComposition: 'b'.repeat(FAMILY_COMPOSITION_MAX),
    });
    expect(res.success).toBe(true);
  });
});
