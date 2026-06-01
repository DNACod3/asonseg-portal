import { describe, expect, it } from 'vitest';
import { cpfSchema } from '../schemas/registerPerson';

describe('cpfSchema', () => {
  it('aceita CPF válido com pontuação', () => {
    expect(cpfSchema.safeParse('529.982.247-25').success).toBe(true);
  });

  it('aceita CPF válido sem pontuação', () => {
    expect(cpfSchema.safeParse('52998224725').success).toBe(true);
  });

  it('normaliza para apenas dígitos', () => {
    const result = cpfSchema.safeParse('529.982.247-25');
    expect(result.success && result.data).toBe('52998224725');
  });

  it('rejeita CPF com dígito verificador errado', () => {
    expect(cpfSchema.safeParse('529.982.247-26').success).toBe(false);
  });

  it('rejeita sequência repetida (111.111.111-11)', () => {
    expect(cpfSchema.safeParse('111.111.111-11').success).toBe(false);
  });

  it('rejeita sequência repetida (000.000.000-00)', () => {
    expect(cpfSchema.safeParse('000.000.000-00').success).toBe(false);
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(cpfSchema.safeParse('123456789').success).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(cpfSchema.safeParse('').success).toBe(false);
  });
});
