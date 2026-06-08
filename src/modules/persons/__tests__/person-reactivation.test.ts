import { describe, it, expect } from 'vitest';
import {
  canReactivatePerson,
  hasReactivationPrivilege,
  institutionalRank,
  PERSON_REACTIVATION_ROLES,
} from '../domain/person-reactivation';
import {
  reactivatePersonSchema,
  REACTIVATION_REASON_MIN,
  REACTIVATION_REASON_MAX,
} from '../schemas/reactivate-person.schema';

describe('institutionalRank (modelo de hierarquia — USP-045/R1)', () => {
  it('BOARD tem rank 2', () => {
    expect(institutionalRank(['BOARD'])).toBe(2);
    expect(institutionalRank(['BOARD', 'COORDINATOR'])).toBe(2);
    expect(institutionalRank(['BOARD', 'CANDIDATE'])).toBe(2);
  });

  it('COORDINATOR tem rank 1', () => {
    expect(institutionalRank(['COORDINATOR'])).toBe(1);
    expect(institutionalRank(['COORDINATOR', 'VOLUNTEER'])).toBe(1);
  });

  it('papéis sem privilégio têm rank 0', () => {
    expect(institutionalRank(['CANDIDATE', 'PROVIDER'])).toBe(0);
    expect(institutionalRank([])).toBe(0);
    expect(institutionalRank(['VOLUNTEER'])).toBe(0);
  });
});

describe('canReactivatePerson (autorização — USP-045/R1)', () => {
  it('BOARD reativa Pessoa inativada por COORDINATOR (rank superior >= inferior)', () => {
    expect(
      canReactivatePerson({ actorRoles: ['BOARD'], inactivatorRoles: ['COORDINATOR'] }),
    ).toEqual({ allowed: true });
  });

  it('BOARD reativa Pessoa inativada por outro BOARD (rank igual)', () => {
    expect(
      canReactivatePerson({ actorRoles: ['BOARD'], inactivatorRoles: ['BOARD'] }),
    ).toEqual({ allowed: true });
  });

  it('COORDINATOR reativa Pessoa inativada por COORDINATOR (rank igual)', () => {
    expect(
      canReactivatePerson({ actorRoles: ['COORDINATOR'], inactivatorRoles: ['COORDINATOR'] }),
    ).toEqual({ allowed: true });
  });

  it('COORDINATOR NÃO reativa Pessoa inativada por BOARD (rank inferior — P-002)', () => {
    expect(
      canReactivatePerson({ actorRoles: ['COORDINATOR'], inactivatorRoles: ['BOARD'] }),
    ).toEqual({ allowed: false, reason: 'INSUFFICIENT_RANK' });
  });

  it('papel sem privilégio (CANDIDATE) recebe NOT_AUTHORIZED', () => {
    expect(
      canReactivatePerson({ actorRoles: ['CANDIDATE'], inactivatorRoles: ['COORDINATOR'] }),
    ).toEqual({ allowed: false, reason: 'NOT_AUTHORIZED' });

    expect(
      canReactivatePerson({ actorRoles: [], inactivatorRoles: [] }),
    ).toEqual({ allowed: false, reason: 'NOT_AUTHORIZED' });
  });

  it('inativador desconhecido (rank 0) — qualquer coordenador/diretoria pode reativar', () => {
    expect(
      canReactivatePerson({ actorRoles: ['COORDINATOR'], inactivatorRoles: [] }),
    ).toEqual({ allowed: true });

    expect(
      canReactivatePerson({ actorRoles: ['BOARD'], inactivatorRoles: [] }),
    ).toEqual({ allowed: true });
  });

  it('NOT_AUTHORIZED tem precedência sobre INSUFFICIENT_RANK', () => {
    expect(
      canReactivatePerson({ actorRoles: ['CANDIDATE'], inactivatorRoles: ['BOARD'] }),
    ).toEqual({ allowed: false, reason: 'NOT_AUTHORIZED' });
  });
});

describe('hasReactivationPrivilege (filtro grosso do gate da rota)', () => {
  it('autoriza COORDINATOR e BOARD', () => {
    expect(hasReactivationPrivilege(['COORDINATOR'])).toBe(true);
    expect(hasReactivationPrivilege(['BOARD'])).toBe(true);
    expect(hasReactivationPrivilege(['CANDIDATE', 'BOARD'])).toBe(true);
  });

  it('nega papéis públicos e Pessoa sem papéis', () => {
    expect(hasReactivationPrivilege(['CANDIDATE'])).toBe(false);
    expect(hasReactivationPrivilege(['PROVIDER', 'CLIENT'])).toBe(false);
    expect(hasReactivationPrivilege([])).toBe(false);
  });

  it('a lista de papéis com privilégio não inclui papéis públicos', () => {
    const allowed: readonly string[] = PERSON_REACTIVATION_ROLES;
    expect(allowed).not.toContain('CANDIDATE');
    expect(allowed).not.toContain('VOLUNTEER');
  });
});

describe('reactivatePersonSchema (motivo obrigatório — L-003)', () => {
  const VALID_ID = '11111111-1111-4111-8111-111111111111';
  const VALID_REASON = 'Reativação do voluntário — inativação por engano.';

  it('aceita uuid válido + motivo com conteúdo (e faz trim)', () => {
    const result = reactivatePersonSchema.safeParse({
      personId: VALID_ID,
      reason: `   ${VALID_REASON}   `,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personId).toBe(VALID_ID);
      expect(result.data.reason).toBe(VALID_REASON);
    }
  });

  it('rejeita personId que não é uuid', () => {
    const result = reactivatePersonSchema.safeParse({ personId: 'nope', reason: VALID_REASON });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.personId).toBeDefined();
    }
  });

  it(`rejeita motivo com menos de ${REACTIVATION_REASON_MIN} caracteres`, () => {
    const result = reactivatePersonSchema.safeParse({ personId: VALID_ID, reason: 'oi' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason).toBeDefined();
    }
  });

  it('rejeita motivo só de espaços (trim antes de medir)', () => {
    const result = reactivatePersonSchema.safeParse({ personId: VALID_ID, reason: '          ' });
    expect(result.success).toBe(false);
  });

  it(`rejeita motivo acima de ${REACTIVATION_REASON_MAX} caracteres`, () => {
    const result = reactivatePersonSchema.safeParse({
      personId: VALID_ID,
      reason: 'x'.repeat(REACTIVATION_REASON_MAX + 1),
    });
    expect(result.success).toBe(false);
  });
});
