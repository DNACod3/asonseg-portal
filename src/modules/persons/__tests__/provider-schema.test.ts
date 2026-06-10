import { describe, it, expect } from 'vitest';
import { providerProfileSchema } from '../schemas/provider';

/**
 * Facts de schema da USP-010 (#114). Sem CNPJ (ADR-0031): o schema desconhece
 * `cnpjMei` e o descarta no parse.
 */
describe('persons/providerProfileSchema', () => {
  it('aceita perfil mínimo (todos os campos opcionais)', () => {
    const result = providerProfileSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({});
  });

  it('aceita headline/description/regionId válidos', () => {
    const result = providerProfileSchema.safeParse({
      headline: 'Eletricista',
      description: 'Serviços elétricos.',
      regionId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita regionId que não é UUID', () => {
    const result = providerProfileSchema.safeParse({ regionId: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejeita headline acima de 120 caracteres', () => {
    const result = providerProfileSchema.safeParse({ headline: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('NÃO conhece o campo cnpjMei — descartado no parse (CNPJ vive em companies — ADR-0031)', () => {
    const result = providerProfileSchema.safeParse({ cnpjMei: '12345678000195' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty('cnpjMei');
  });
});
