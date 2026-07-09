import { describe, it, expect } from 'vitest';
import { canViewConsolidatedPerson, CONSOLIDATED_PERSON_ROLES } from '../domain/consolidated-person';

/**
 * Testes unitários da guarda de domínio `canViewConsolidatedPerson` (USP-039 /
 * T1). Cobre SOC-039-MN-02: nenhum papel fora de {SOCIAL_ASSISTANT, BOARD,
 * COORDINATOR} pode abrir o painel consolidado — nem isolado, nem combinado com
 * outros papéis não autorizados.
 */
describe('canViewConsolidatedPerson (SOC-06, SOC-039-MN-02)', () => {
  it('CONSOLIDATED_PERSON_ROLES é exatamente {SOCIAL_ASSISTANT, BOARD, COORDINATOR}', () => {
    expect(CONSOLIDATED_PERSON_ROLES).toEqual(['SOCIAL_ASSISTANT', 'BOARD', 'COORDINATOR']);
  });

  it.each(['SOCIAL_ASSISTANT', 'BOARD', 'COORDINATOR'])(
    'papel autorizado isolado (%s) → true',
    (role) => {
      expect(canViewConsolidatedPerson([role])).toBe(true);
    },
  );

  it('combinação de papéis autorizados → true', () => {
    expect(canViewConsolidatedPerson(['SOCIAL_ASSISTANT', 'BOARD'])).toBe(true);
    expect(canViewConsolidatedPerson(['COORDINATOR', 'BOARD', 'SOCIAL_ASSISTANT'])).toBe(true);
  });

  it.each(['VOLUNTEER', 'CANDIDATE', 'PROVIDER', 'CLIENT', 'COMPANY_RESPONSIBLE'])(
    'SOC-039-MN-02: papel não autorizado isolado (%s) → false',
    (role) => {
      expect(canViewConsolidatedPerson([role])).toBe(false);
    },
  );

  it('SOC-039-MN-02: nenhum papel ([]) → false', () => {
    expect(canViewConsolidatedPerson([])).toBe(false);
  });

  it('SOC-039-MN-02: combinação de papéis não autorizados (sem nenhum autorizado) → false', () => {
    expect(canViewConsolidatedPerson(['VOLUNTEER', 'CANDIDATE', 'PROVIDER'])).toBe(false);
  });
});
