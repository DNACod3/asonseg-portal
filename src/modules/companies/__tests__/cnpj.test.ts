import { describe, it, expect } from 'vitest';
import { isValidCnpj, normalizeCnpj, formatCnpj } from '../domain/cnpj';

describe('normalizeCnpj', () => {
  it('remove pontuação', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('mantém somente dígitos', () => {
    expect(normalizeCnpj('11222333000181')).toBe('11222333000181');
  });
});

describe('isValidCnpj', () => {
  const VALID = [
    '11222333000181',
    '11444777000161',
    '45997418000153',
  ];

  const INVALID = [
    '00000000000000',
    '11111111111111',
    '12345678000100',
    '1234567800011',
    '123456780001810',
    '',
  ];

  it.each(VALID)('aceita CNPJ válido %s', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(true);
  });

  it.each(INVALID)('rejeita CNPJ inválido %s', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });

  it('aceita CNPJ com máscara (normaliza internamente)', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
  });
});

describe('formatCnpj', () => {
  it('formata 14 dígitos no padrão XX.XXX.XXX/XXXX-XX', () => {
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });
});
