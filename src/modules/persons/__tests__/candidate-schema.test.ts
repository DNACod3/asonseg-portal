import { describe, it, expect } from 'vitest';
import { candidateProfileSchema } from '../schemas/candidate';
import { normalizePhone, EDUCATION_LEVELS } from '../domain/candidate';

// FACTS da USP-009 (#41 / CAD-01 + EDGE) — domain/schema puros, sem IO.

const VALID = {
  educationLevel: 'ENSINO_MEDIO',
  primaryAreaOfInterestId: '00000000-0000-0000-0000-000000000001',
  phone: '(11) 98888-7777',
  headline: 'Auxiliar administrativo',
};

describe('USP-009 #41 — candidateProfileSchema (CAD-01 / EDGE)', () => {
  it('aceita entrada válida e normaliza o telefone para dígitos', () => {
    const res = candidateProfileSchema.safeParse(VALID);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBe('11988887777');
  });

  it.each(['educationLevel', 'primaryAreaOfInterestId', 'phone'] as const)(
    'rejeita ausência do campo obrigatório %s',
    (campo) => {
      const input: Record<string, unknown> = { ...VALID };
      delete input[campo];
      const res = candidateProfileSchema.safeParse(input);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.flatten().fieldErrors[campo]).toBeDefined();
      }
    },
  );

  it('rejeita escolaridade fora da taxonomia', () => {
    const res = candidateProfileSchema.safeParse({ ...VALID, educationLevel: 'MESTRADO_INVALIDO' });
    expect(res.success).toBe(false);
  });

  it('rejeita area de interesse que não é uuid', () => {
    const res = candidateProfileSchema.safeParse({ ...VALID, primaryAreaOfInterestId: 'abc' });
    expect(res.success).toBe(false);
  });

  it('rejeita telefone com menos de 10 dígitos', () => {
    const res = candidateProfileSchema.safeParse({ ...VALID, phone: '1234' });
    expect(res.success).toBe(false);
  });

  it('aceita os campos opcionais ausentes', () => {
    const res = candidateProfileSchema.safeParse({
      educationLevel: 'ENSINO_SUPERIOR',
      primaryAreaOfInterestId: '00000000-0000-0000-0000-000000000002',
      phone: '11988887777',
    });
    expect(res.success).toBe(true);
  });
});

describe('USP-009 #41 — normalizePhone', () => {
  it.each([
    ['(11) 98888-7777', '11988887777'],
    ['+55 48 3333-2222', '554833332222'],
    ['11 9 8888 7777', '11988887777'],
  ])('normaliza %s → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
});

describe('USP-009 #41 — EDUCATION_LEVELS', () => {
  it('inclui os níveis esperados', () => {
    expect(EDUCATION_LEVELS).toContain('ENSINO_MEDIO');
    expect(EDUCATION_LEVELS).toContain('ENSINO_SUPERIOR');
  });
});
