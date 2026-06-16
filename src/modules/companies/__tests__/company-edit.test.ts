import { describe, it, expect } from 'vitest';
import { identityFieldsChanged } from '../domain/company-edit';

const BASE = {
  cnpj: '11222333000181',
  razaoSocial: 'Padaria Aurora Alimentos Ltda',
  nomeFantasia: 'Padaria Aurora',
};

describe('identityFieldsChanged (USP-015 / D-015-B)', () => {
  it('false quando nenhum campo identitário muda', () => {
    expect(identityFieldsChanged(BASE, { ...BASE })).toBe(false);
  });

  it('true quando o CNPJ muda', () => {
    expect(identityFieldsChanged(BASE, { ...BASE, cnpj: '11444777000161' })).toBe(true);
  });

  it('true quando a razão social muda', () => {
    expect(identityFieldsChanged(BASE, { ...BASE, razaoSocial: 'Outra Razão Ltda' })).toBe(true);
  });

  it('true quando o nome fantasia muda', () => {
    expect(identityFieldsChanged(BASE, { ...BASE, nomeFantasia: 'Padaria Aurora & Cia' })).toBe(true);
  });

  it('é pura: não considera campos não-identitários (setor/descricao/endereco/type)', () => {
    // Os tipos só carregam os 3 identitários; mudar qualquer outra coisa fora deles
    // (mesmo objeto identitário) não muda o resultado.
    expect(identityFieldsChanged(BASE, { ...BASE })).toBe(false);
  });
});
