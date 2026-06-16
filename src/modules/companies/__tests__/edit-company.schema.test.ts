import { describe, it, expect } from 'vitest';
import { editCompanySchema } from '../schemas/edit-company.schema';

const VALID = {
  empresaId: '11111111-1111-1111-1111-111111111111',
  cnpj: '11.222.333/0001-81',
  type: 'SIMPLES_NACIONAL' as const,
  razaoSocial: 'Padaria Aurora Alimentos Ltda',
  nomeFantasia: 'Padaria Aurora',
  setor: 'Alimentação',
  descricao: 'Pães artesanais',
  endereco: 'Rua das Flores, 100',
};

describe('editCompanySchema (USP-015)', () => {
  it('aceita payload válido e normaliza o CNPJ (remove máscara)', () => {
    const parsed = editCompanySchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cnpj).toBe('11222333000181');
      expect(parsed.data.empresaId).toBe(VALID.empresaId);
    }
  });

  it('aceita payload sem campos opcionais (descricao/endereco)', () => {
    const { descricao: _d, endereco: _e, ...semOpcionais } = VALID;
    expect(editCompanySchema.safeParse(semOpcionais).success).toBe(true);
  });

  it('rejeita CNPJ inválido (dígitos verificadores)', () => {
    const parsed = editCompanySchema.safeParse({ ...VALID, cnpj: '11.222.333/0001-99' });
    expect(parsed.success).toBe(false);
  });

  it('rejeita empresaId que não é uuid', () => {
    const parsed = editCompanySchema.safeParse({ ...VALID, empresaId: 'nao-uuid' });
    expect(parsed.success).toBe(false);
  });

  it('rejeita razão social muito curta', () => {
    const parsed = editCompanySchema.safeParse({ ...VALID, razaoSocial: 'A' });
    expect(parsed.success).toBe(false);
  });

  it('não aceita isVerified como campo de entrada (controlado pelo sistema)', () => {
    const parsed = editCompanySchema.safeParse({ ...VALID, isVerified: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('isVerified' in parsed.data).toBe(false);
    }
  });
});
