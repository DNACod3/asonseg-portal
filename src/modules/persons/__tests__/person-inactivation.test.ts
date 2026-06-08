import { describe, it, expect } from 'vitest';
import {
  canInactivatePerson,
  hasInactivationPrivilege,
  PERSON_INACTIVATION_ROLES,
} from '../domain/person-inactivation';
import {
  inactivatePersonSchema,
  INACTIVATION_REASON_MIN,
  INACTIVATION_REASON_MAX,
} from '../schemas/inactivate-person.schema';

const ACTOR = 'aaaaaaaa-1111-4111-8111-111111111111';
const TARGET = 'bbbbbbbb-2222-4222-8222-222222222222';

describe('canInactivatePerson (autorização sensível ao alvo — E-001)', () => {
  it('diretoria (BOARD) inativa qualquer Pessoa', () => {
    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: ['BOARD'],
        targetId: TARGET,
        targetRoles: ['CANDIDATE'],
      }),
    ).toEqual({ allowed: true });

    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: ['BOARD'],
        targetId: TARGET,
        targetRoles: ['VOLUNTEER', 'COORDINATOR'],
      }),
    ).toEqual({ allowed: true });
  });

  it('coordenador inativa voluntário', () => {
    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: ['COORDINATOR'],
        targetId: TARGET,
        targetRoles: ['VOLUNTEER'],
      }),
    ).toEqual({ allowed: true });
  });

  it('coordenador NÃO inativa quem não é voluntário (fora do escopo)', () => {
    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: ['COORDINATOR'],
        targetId: TARGET,
        targetRoles: ['CANDIDATE'],
      }),
    ).toEqual({ allowed: false, reason: 'COORDINATOR_SCOPE' });
  });

  it('papel sem privilégio recebe NOT_AUTHORIZED', () => {
    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: ['CANDIDATE', 'PROVIDER'],
        targetId: TARGET,
        targetRoles: ['VOLUNTEER'],
      }),
    ).toEqual({ allowed: false, reason: 'NOT_AUTHORIZED' });

    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: [],
        targetId: TARGET,
        targetRoles: ['VOLUNTEER'],
      }),
    ).toEqual({ allowed: false, reason: 'NOT_AUTHORIZED' });
  });

  it('ninguém inativa a si mesmo — nem a diretoria (trava de segurança)', () => {
    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: ['BOARD'],
        targetId: ACTOR,
        targetRoles: ['BOARD'],
      }),
    ).toEqual({ allowed: false, reason: 'SELF_INACTIVATION' });
  });

  it('self-inactivation tem precedência sobre o privilégio do papel', () => {
    expect(
      canInactivatePerson({
        actorId: ACTOR,
        actorRoles: ['COORDINATOR', 'VOLUNTEER'],
        targetId: ACTOR,
        targetRoles: ['COORDINATOR', 'VOLUNTEER'],
      }),
    ).toEqual({ allowed: false, reason: 'SELF_INACTIVATION' });
  });
});

describe('hasInactivationPrivilege (filtro grosso do gate da rota)', () => {
  it('autoriza COORDINATOR e BOARD', () => {
    expect(hasInactivationPrivilege(['COORDINATOR'])).toBe(true);
    expect(hasInactivationPrivilege(['BOARD'])).toBe(true);
    expect(hasInactivationPrivilege(['CANDIDATE', 'BOARD'])).toBe(true);
  });

  it('nega papéis públicos e Pessoa sem papéis', () => {
    expect(hasInactivationPrivilege(['CANDIDATE'])).toBe(false);
    expect(hasInactivationPrivilege(['PROVIDER', 'CLIENT'])).toBe(false);
    expect(hasInactivationPrivilege([])).toBe(false);
  });

  it('a lista de papéis com privilégio não inclui papéis públicos', () => {
    const allowed: readonly string[] = PERSON_INACTIVATION_ROLES;
    expect(allowed).not.toContain('CANDIDATE');
    expect(allowed).not.toContain('VOLUNTEER');
  });
});

describe('inactivatePersonSchema (motivo obrigatório — L-004)', () => {
  const VALID_ID = '11111111-1111-4111-8111-111111111111';
  const VALID_REASON = 'Desligamento do voluntário ao fim do projeto.';

  it('aceita uuid válido + motivo com conteúdo (e faz trim do motivo)', () => {
    const result = inactivatePersonSchema.safeParse({
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
    const result = inactivatePersonSchema.safeParse({ personId: 'nope', reason: VALID_REASON });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.personId).toBeDefined();
    }
  });

  it(`rejeita motivo com menos de ${INACTIVATION_REASON_MIN} caracteres`, () => {
    const result = inactivatePersonSchema.safeParse({ personId: VALID_ID, reason: 'oi' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason).toBeDefined();
    }
  });

  it('rejeita motivo só de espaços (trim antes de medir)', () => {
    const result = inactivatePersonSchema.safeParse({
      personId: VALID_ID,
      reason: '          ',
    });
    expect(result.success).toBe(false);
  });

  it(`rejeita motivo acima de ${INACTIVATION_REASON_MAX} caracteres`, () => {
    const result = inactivatePersonSchema.safeParse({
      personId: VALID_ID,
      reason: 'x'.repeat(INACTIVATION_REASON_MAX + 1),
    });
    expect(result.success).toBe(false);
  });
});
