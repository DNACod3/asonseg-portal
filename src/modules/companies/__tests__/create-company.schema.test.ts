import { describe, it, expect } from 'vitest';
import { createCompanySchema } from '../schemas/create-company.schema';

const VALID_BASE = {
  cnpj: '11.222.333/0001-81',
  type: 'SIMPLES_NACIONAL' as const,
  razaoSocial: 'Empresa Teste Ltda',
  nomeFantasia: 'Empresa Teste',
  setor: 'Tecnologia',
  companyRepresentationTermVersion: 'v1.0',
  companyRepresentationTermHash: 'a'.repeat(64),
};

describe('createCompanySchema', () => {
  it('parseia input válido normalizando o CNPJ', () => {
    const result = createCompanySchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cnpj).toBe('11222333000181');
    }
  });

  it('falha com CNPJ inválido (dígito errado)', () => {
    const result = createCompanySchema.safeParse({ ...VALID_BASE, cnpj: '11.222.333/0001-99' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.cnpj).toBeDefined();
    }
  });

  it('falha com CNPJ vazio', () => {
    const result = createCompanySchema.safeParse({ ...VALID_BASE, cnpj: '' });
    expect(result.success).toBe(false);
  });

  it('falha com razão social muito curta', () => {
    const result = createCompanySchema.safeParse({ ...VALID_BASE, razaoSocial: 'A' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.razaoSocial).toBeDefined();
    }
  });

  it('falha com setor vazio', () => {
    const result = createCompanySchema.safeParse({ ...VALID_BASE, setor: '' });
    expect(result.success).toBe(false);
  });

  it('aceita campos opcionais ausentes', () => {
    const result = createCompanySchema.safeParse({
      ...VALID_BASE,
      descricao: undefined,
      endereco: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('aplica default SIMPLES_NACIONAL quando type omitido', () => {
    const { type: _type, ...withoutType } = VALID_BASE;
    const result = createCompanySchema.safeParse(withoutType);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('SIMPLES_NACIONAL');
    }
  });

  it('aceita type MEI', () => {
    const result = createCompanySchema.safeParse({ ...VALID_BASE, type: 'MEI' });
    expect(result.success).toBe(true);
  });
});
