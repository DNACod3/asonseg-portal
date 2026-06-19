import { describe, it, expect } from 'vitest';
import {
  buildVerificationSnapshot,
  diffVerificationSnapshot,
  type CompanyVerificationFields,
  type CompanyVerificationSnapshot,
} from '../domain/company-verification';

const FIELDS: CompanyVerificationFields = {
  cnpj: '11222333000181',
  razaoSocial: 'Padaria Aurora Alimentos Ltda',
  nomeFantasia: 'Padaria Aurora',
  setor: 'Alimentação',
  endereco: 'Rua das Flores, 100',
};

describe('buildVerificationSnapshot (USP-017 / P-004 / L-002)', () => {
  it('copia os campos vigentes e carimba capturedAt em ISO igual ao verifiedAt', () => {
    const at = new Date('2026-05-01T12:00:00.000Z');
    const snapshot = buildVerificationSnapshot(FIELDS, at);
    expect(snapshot).toEqual({
      cnpj: FIELDS.cnpj,
      razaoSocial: FIELDS.razaoSocial,
      nomeFantasia: FIELDS.nomeFantasia,
      setor: FIELDS.setor,
      endereco: FIELDS.endereco,
      capturedAt: '2026-05-01T12:00:00.000Z',
    });
  });

  it('preserva endereco nulo (coluna opcional)', () => {
    const snapshot = buildVerificationSnapshot(
      { ...FIELDS, endereco: null },
      new Date('2026-05-01T12:00:00.000Z'),
    );
    expect(snapshot.endereco).toBeNull();
  });

  it('não inclui campos fora do snapshot (ex.: phone — sem coluna no MVP)', () => {
    const snapshot = buildVerificationSnapshot(FIELDS, new Date('2026-05-01T12:00:00.000Z'));
    expect(Object.keys(snapshot).sort()).toEqual(
      ['capturedAt', 'cnpj', 'endereco', 'nomeFantasia', 'razaoSocial', 'setor'].sort(),
    );
  });
});

describe('diffVerificationSnapshot (USP-017 / D-006)', () => {
  const PREVIOUS: CompanyVerificationSnapshot = {
    ...FIELDS,
    capturedAt: '2026-05-01T12:00:00.000Z',
  };

  it('retorna [] na 1ª verificação (sem snapshot anterior)', () => {
    expect(diffVerificationSnapshot(null, FIELDS)).toEqual([]);
  });

  it('retorna [] quando nada mudou', () => {
    expect(diffVerificationSnapshot(PREVIOUS, FIELDS)).toEqual([]);
  });

  it('ignora capturedAt mesmo quando difere', () => {
    const previous: CompanyVerificationSnapshot = {
      ...PREVIOUS,
      capturedAt: '2020-01-01T00:00:00.000Z',
    };
    expect(diffVerificationSnapshot(previous, FIELDS)).toEqual([]);
  });

  it('detecta um único campo alterado', () => {
    expect(diffVerificationSnapshot(PREVIOUS, { ...FIELDS, razaoSocial: 'Nova Razão Ltda' })).toEqual([
      'razaoSocial',
    ]);
  });

  it('detecta vários campos alterados (inclusive endereco para nulo)', () => {
    const changed = diffVerificationSnapshot(PREVIOUS, {
      ...FIELDS,
      cnpj: '11444777000161',
      setor: 'Comércio',
      endereco: null,
    });
    expect(new Set(changed)).toEqual(new Set(['cnpj', 'setor', 'endereco']));
  });
});
