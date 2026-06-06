import { describe, it, expect } from 'vitest';
import {
  ROLE_PROFILE_FIELDS,
  ROLE_LABELS,
  ROLE_NEXT_STEP,
  PROFILE_FIELD_META,
  missingProfileFields,
} from '../domain/role-activation';
import { PUBLIC_ROLES } from '../schemas/registerPerson';

describe('identity/domain/role-activation', () => {
  it('todo papel público tem campos de perfil, rótulo e próximo passo', () => {
    for (const role of PUBLIC_ROLES) {
      expect(ROLE_PROFILE_FIELDS[role]).toBeDefined();
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_NEXT_STEP[role]).toMatch(/^\//);
    }
  });

  it('todo campo de perfil exigido tem metadados de renderização', () => {
    const allFields = new Set(Object.values(ROLE_PROFILE_FIELDS).flat());
    for (const field of allFields) {
      expect(PROFILE_FIELD_META[field]?.label).toBeTruthy();
    }
  });

  describe('missingProfileFields', () => {
    it('retorna os campos vazios/ausentes do papel', () => {
      expect(missingProfileFields({ phone: null, fullAddress: null }, 'CANDIDATE')).toEqual([
        'phone',
        'fullAddress',
      ]);
    });

    it('ignora campos já preenchidos (a Pessoa não repreenche)', () => {
      expect(
        missingProfileFields({ phone: '11999990000', fullAddress: 'Rua X, 123' }, 'CANDIDATE'),
      ).toEqual([]);
    });

    it('trata string em branco como ausente', () => {
      expect(missingProfileFields({ phone: '   ', fullAddress: 'Rua X' }, 'CANDIDATE')).toEqual([
        'phone',
      ]);
    });

    it('só exige os campos do papel selecionado (CLIENT não pede endereço)', () => {
      expect(missingProfileFields({ phone: null, fullAddress: null }, 'CLIENT')).toEqual(['phone']);
    });
  });
});
