import { describe, it, expect } from 'vitest';
import {
  canManageSocioeconomicRecord,
  isEmptyRecord,
  SOCIOECONOMIC_RECORD_ROLES,
  INCOME_BRACKETS,
  HOUSING_SITUATIONS,
} from '../domain/socioeconomic-record';

// FACTS da USP-036 (SOC-01/SOC-02, SOC-036-MN-01) — domain puro, sem IO.

describe('canManageSocioeconomicRecord (SOC-036-MN-01 — discriminador de domínio)', () => {
  it.each(['SOCIAL_ASSISTANT', 'BOARD'])('papel autorizado isolado (%s) → true', (role) => {
    expect(canManageSocioeconomicRecord([role])).toBe(true);
  });

  it('papéis autorizados combinados → true', () => {
    expect(canManageSocioeconomicRecord(['SOCIAL_ASSISTANT', 'BOARD'])).toBe(true);
  });

  it.each([
    'COORDINATOR',
    'VOLUNTEER',
    'CANDIDATE',
    'PROVIDER',
    'CLIENT',
    'COMPANY_RESPONSIBLE',
  ])('papel não autorizado (%s) → false', (role) => {
    expect(canManageSocioeconomicRecord([role])).toBe(false);
  });

  it('sem papéis ([]) → false', () => {
    expect(canManageSocioeconomicRecord([])).toBe(false);
  });

  it('mistura de papel autorizado + não autorizado → true (basta um)', () => {
    expect(canManageSocioeconomicRecord(['VOLUNTEER', 'SOCIAL_ASSISTANT'])).toBe(true);
  });

  it('SOCIOECONOMIC_RECORD_ROLES é exatamente {SOCIAL_ASSISTANT, BOARD}', () => {
    expect(SOCIOECONOMIC_RECORD_ROLES).toEqual(['SOCIAL_ASSISTANT', 'BOARD']);
  });
});

describe('INCOME_BRACKETS / HOUSING_SITUATIONS — taxonomias fechadas', () => {
  it('INCOME_BRACKETS casa com o enum Prisma IncomeBracket', () => {
    expect(INCOME_BRACKETS).toEqual([
      'NO_INCOME',
      'UP_TO_1_MW',
      'FROM_1_TO_2_MW',
      'FROM_2_TO_3_MW',
      'ABOVE_3_MW',
      'UNDECLARED',
    ]);
  });

  it('HOUSING_SITUATIONS casa com o enum Prisma HousingSituation', () => {
    expect(HOUSING_SITUATIONS).toEqual(['OWNED', 'RENTED', 'GRANTED', 'FAMILY', 'HOMELESS', 'OTHER']);
  });
});

describe('isEmptyRecord', () => {
  it('todos os 4 campos null → true', () => {
    expect(
      isEmptyRecord({
        incomeBracket: null,
        socialBenefit: null,
        housingSituation: null,
        familyComposition: null,
      }),
    ).toBe(true);
  });

  it('qualquer campo preenchido → false', () => {
    expect(
      isEmptyRecord({
        incomeBracket: 'UP_TO_1_MW',
        socialBenefit: null,
        housingSituation: null,
        familyComposition: null,
      }),
    ).toBe(false);
    expect(
      isEmptyRecord({
        incomeBracket: null,
        socialBenefit: 'Bolsa Família',
        housingSituation: null,
        familyComposition: null,
      }),
    ).toBe(false);
  });
});
