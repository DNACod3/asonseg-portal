import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CurrentPerson } from '../server/session';

const sessionState = vi.hoisted(() => ({ person: null as CurrentPerson | null }));
const prismaState = vi.hoisted(() => ({ grants: [] as Array<{ permission: string; scopeArea: string | null; revokedAt: Date | null }> }));

vi.mock('../server/session', () => ({
  getCurrentPerson: () => Promise.resolve(sessionState.person),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    delegatedPermission: {
      findMany: () => Promise.resolve(prismaState.grants),
    },
  },
}));

const { requirePermission, requireCoordinator } = await import('../server/require-permission');

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

beforeEach(() => {
  sessionState.person = null;
  prismaState.grants = [];
});

// ────────────────────────────────────────────────
// requirePermission
// ────────────────────────────────────────────────
describe('requirePermission', () => {
  it('retorna UNAUTHENTICATED quando não há sessão', async () => {
    const r = await requirePermission('MODERATE_JOB');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('UNAUTHENTICATED');
  });

  it('concede via papel inerente (COORDINATOR)', async () => {
    sessionState.person = makePerson(['COORDINATOR']);
    const r = await requirePermission('MODERATE_JOB');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.person.id).toBe('person-1');
  });

  it('concede via delegação explícita ativa (sem escopo)', async () => {
    sessionState.person = makePerson(['VOLUNTEER']);
    prismaState.grants = [{ permission: 'MODERATE_JOB', scopeArea: null, revokedAt: null }];
    const r = await requirePermission('MODERATE_JOB');
    expect(r.ok).toBe(true);
  });

  it('concede via delegação escopada quando a action informa a área correta', async () => {
    sessionState.person = makePerson(['VOLUNTEER']);
    prismaState.grants = [{ permission: 'MODERATE_JOB', scopeArea: 'empregabilidade', revokedAt: null }];
    const r = await requirePermission('MODERATE_JOB', { scopeArea: 'empregabilidade' });
    expect(r.ok).toBe(true);
  });

  it('retorna FORBIDDEN para grant escopado quando a action omite scopeArea (fail-closed)', async () => {
    sessionState.person = makePerson(['VOLUNTEER']);
    prismaState.grants = [{ permission: 'MODERATE_JOB', scopeArea: 'empregabilidade', revokedAt: null }];
    const r = await requirePermission('MODERATE_JOB');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('FORBIDDEN');
  });

  it('retorna FORBIDDEN sem papel nem delegação', async () => {
    sessionState.person = makePerson(['CANDIDATE']);
    const r = await requirePermission('MODERATE_JOB');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('FORBIDDEN');
  });

  it('retorna FORBIDDEN quando grant está revogado', async () => {
    sessionState.person = makePerson(['VOLUNTEER']);
    prismaState.grants = [{ permission: 'MODERATE_JOB', scopeArea: null, revokedAt: new Date() }];
    const r = await requirePermission('MODERATE_JOB');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('FORBIDDEN');
  });

  it('retorna SOCIAL_ASSISTANT com permissões inerentes', async () => {
    sessionState.person = makePerson(['SOCIAL_ASSISTANT']);
    const r = await requirePermission('REFER_PERSON_TO_JOB');
    expect(r.ok).toBe(true);
  });
});

// ────────────────────────────────────────────────
// requireCoordinator
// ────────────────────────────────────────────────
describe('requireCoordinator', () => {
  it('retorna UNAUTHENTICATED quando não há sessão', async () => {
    const r = await requireCoordinator();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('UNAUTHENTICATED');
  });

  it('retorna FORBIDDEN para papel que não é COORDINATOR', async () => {
    sessionState.person = makePerson(['VOLUNTEER']);
    const r = await requireCoordinator();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('FORBIDDEN');
  });

  it('concede para COORDINATOR', async () => {
    sessionState.person = makePerson(['COORDINATOR']);
    const r = await requireCoordinator();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.person.roles).toContain('COORDINATOR');
  });

  it('concede para BOARD (papel institucional)', async () => {
    sessionState.person = makePerson(['BOARD', 'COORDINATOR']);
    const r = await requireCoordinator();
    expect(r.ok).toBe(true);
  });
});
