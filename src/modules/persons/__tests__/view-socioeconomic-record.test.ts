import { describe, it, expect } from 'vitest';
import { viewSocioeconomicRecord, type SocioeconomicRow } from '../views/view-socioeconomic-record';

// FACTS da USP-036 (T6) — serializer puro, sem IO.

const FULL_ROW: SocioeconomicRow = {
  personId: '00000000-0000-4000-8000-000000000001',
  incomeBracket: 'UP_TO_1_MW',
  socialBenefit: 'Bolsa Família',
  housingSituation: 'RENTED',
  familyComposition: '4 pessoas',
  updatedAt: new Date('2026-07-01T12:00:00.000Z'),
  updatedByPersonId: '00000000-0000-4000-8000-000000000002',
};

describe('viewSocioeconomicRecord', () => {
  it('molda todos os campos da linha para o View Model (1:1)', () => {
    expect(viewSocioeconomicRecord(FULL_ROW)).toEqual({
      personId: FULL_ROW.personId,
      incomeBracket: 'UP_TO_1_MW',
      socialBenefit: 'Bolsa Família',
      housingSituation: 'RENTED',
      familyComposition: '4 pessoas',
      updatedAt: FULL_ROW.updatedAt,
      updatedByPersonId: FULL_ROW.updatedByPersonId,
    });
  });

  it('preserva null nos 4 campos declarados (ficha ainda não preenchida)', () => {
    const row: SocioeconomicRow = {
      personId: FULL_ROW.personId,
      incomeBracket: null,
      socialBenefit: null,
      housingSituation: null,
      familyComposition: null,
      updatedAt: null,
      updatedByPersonId: null,
    };
    expect(viewSocioeconomicRecord(row)).toEqual(row);
  });

  it('view resultante não contém nenhuma chave além das 7 esperadas (sem cross-Person)', () => {
    const view = viewSocioeconomicRecord(FULL_ROW);
    expect(Object.keys(view).sort()).toEqual(
      [
        'personId',
        'incomeBracket',
        'socialBenefit',
        'housingSituation',
        'familyComposition',
        'updatedAt',
        'updatedByPersonId',
      ].sort(),
    );
  });
});
