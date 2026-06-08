import { describe, it, expect } from 'vitest';
import { checkPermission, isCoordinator, DELEGABLE_PERMISSIONS } from '../domain/permissions';
import type { CurrentPerson } from '../server/session';
import type { DelegatedGrant } from '../domain/permissions';

function makePerson(roles: string[]): CurrentPerson {
  return {
    id: 'person-1',
    supabaseUserId: 'supa-1',
    fullName: 'Teste',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

function activeGrant(permission: string, scopeArea: string | null = null): DelegatedGrant {
  return { permission: permission as DelegatedGrant['permission'], scopeArea, revokedAt: null };
}

function revokedGrant(permission: string): DelegatedGrant {
  return { permission: permission as DelegatedGrant['permission'], scopeArea: null, revokedAt: new Date() };
}

describe('checkPermission', () => {
  it('nega quando person é null', () => {
    const r = checkPermission(null, 'MODERATE_JOB', []);
    expect(r.granted).toBe(false);
    if (!r.granted) expect(r.reason).toBe('UNAUTHENTICATED');
  });

  it('concede via papel COORDINATOR (permissão inerente)', () => {
    const r = checkPermission(makePerson(['COORDINATOR']), 'MODERATE_JOB', []);
    expect(r.granted).toBe(true);
  });

  it('concede SOCIAL_ASSISTANT apenas para suas permissões inerentes', () => {
    const person = makePerson(['SOCIAL_ASSISTANT']);
    expect(checkPermission(person, 'REFER_PERSON_TO_JOB', []).granted).toBe(true);
    expect(checkPermission(person, 'MODERATE_JOB', []).granted).toBe(false);
  });

  it('concede via delegação explícita ativa', () => {
    const person = makePerson(['VOLUNTEER']);
    const r = checkPermission(person, 'MODERATE_JOB', [activeGrant('MODERATE_JOB')]);
    expect(r.granted).toBe(true);
  });

  it('nega delegação revogada', () => {
    const person = makePerson(['VOLUNTEER']);
    const r = checkPermission(person, 'MODERATE_JOB', [revokedGrant('MODERATE_JOB')]);
    expect(r.granted).toBe(false);
  });

  it('nega sem papel nem delegação', () => {
    const person = makePerson(['CANDIDATE']);
    const r = checkPermission(person, 'MODERATE_JOB', []);
    expect(r.granted).toBe(false);
    if (!r.granted) expect(r.reason).toBe('FORBIDDEN');
  });

  it('respeita scopeArea — concede quando áreas coincidem', () => {
    const person = makePerson(['VOLUNTEER']);
    const r = checkPermission(
      person,
      'MODERATE_JOB',
      [activeGrant('MODERATE_JOB', 'empregabilidade')],
      { scopeArea: 'empregabilidade' },
    );
    expect(r.granted).toBe(true);
  });

  it('respeita scopeArea — nega quando áreas divergem', () => {
    const person = makePerson(['VOLUNTEER']);
    const r = checkPermission(
      person,
      'MODERATE_JOB',
      [activeGrant('MODERATE_JOB', 'empregabilidade')],
      { scopeArea: 'servicos' },
    );
    expect(r.granted).toBe(false);
  });

  it('delegação sem scopeArea cobre qualquer área', () => {
    const person = makePerson(['VOLUNTEER']);
    const r = checkPermission(
      person,
      'MODERATE_JOB',
      [activeGrant('MODERATE_JOB', null)],
      { scopeArea: 'qualquer' },
    );
    expect(r.granted).toBe(true);
  });
});

describe('isCoordinator', () => {
  it('retorna true para COORDINATOR', () => {
    expect(isCoordinator(makePerson(['COORDINATOR']))).toBe(true);
  });

  it('retorna false para outros papéis', () => {
    expect(isCoordinator(makePerson(['VOLUNTEER', 'SOCIAL_ASSISTANT']))).toBe(false);
  });
});

describe('DELEGABLE_PERMISSIONS catálogo', () => {
  it('contém exatamente 9 permissões do catálogo R1', () => {
    expect(DELEGABLE_PERMISSIONS).toHaveLength(9);
  });

  it('não tem duplicatas', () => {
    expect(new Set(DELEGABLE_PERMISSIONS).size).toBe(DELEGABLE_PERMISSIONS.length);
  });
});
