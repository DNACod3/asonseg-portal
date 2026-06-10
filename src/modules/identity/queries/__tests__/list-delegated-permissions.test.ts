// Unit das queries read-only de permissões delegadas (USP-008) — Prisma mockado.
// Cobre o agrupamento por Pessoa (múltiplas concessões → um item) e a listagem
// de voluntários elegíveis.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({
  delegatedFindMany: vi.fn(),
  personFindMany: vi.fn(),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    delegatedPermission: { findMany: (...a: unknown[]) => prismaState.delegatedFindMany(...a) },
    person: { findMany: (...a: unknown[]) => prismaState.personFindMany(...a) },
  },
}));

const { listDelegatedPermissions, listEligibleVolunteers } = await import(
  '../list-delegated-permissions'
);

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listDelegatedPermissions', () => {
  it('agrupa múltiplas concessões da mesma Pessoa em um único item (só ativas)', async () => {
    prismaState.delegatedFindMany.mockResolvedValue([
      { id: 'g1', permission: 'MODERATE_JOB', scopeArea: null, grantedAt: new Date('2026-01-01'), person: { id: P1, fullName: 'Ana' } },
      { id: 'g2', permission: 'MODERATE_CV', scopeArea: 'empregabilidade', grantedAt: new Date('2026-01-02'), person: { id: P1, fullName: 'Ana' } },
      { id: 'g3', permission: 'MODERATE_SERVICE', scopeArea: null, grantedAt: new Date('2026-01-03'), person: { id: P2, fullName: 'Bruno' } },
    ]);

    const out = await listDelegatedPermissions();

    expect(prismaState.delegatedFindMany.mock.calls[0]?.[0]).toMatchObject({ where: { revokedAt: null } });
    expect(out).toHaveLength(2);
    const ana = out.find((v) => v.personId === P1);
    expect(ana?.fullName).toBe('Ana');
    expect(ana?.grants.map((g) => g.permission)).toEqual(['MODERATE_JOB', 'MODERATE_CV']);
    const bruno = out.find((v) => v.personId === P2);
    expect(bruno?.grants).toHaveLength(1);
  });

  it('sem concessões ativas: lista vazia', async () => {
    prismaState.delegatedFindMany.mockResolvedValue([]);
    expect(await listDelegatedPermissions()).toEqual([]);
  });
});

describe('listEligibleVolunteers', () => {
  it('devolve voluntários ATIVOS (id + nome), filtrando por papel VOLUNTEER ativo', async () => {
    prismaState.personFindMany.mockResolvedValue([{ id: P1, fullName: 'Ana' }]);

    const out = await listEligibleVolunteers();

    expect(out).toEqual([{ id: P1, fullName: 'Ana' }]);
    const arg = prismaState.personFindMany.mock.calls[0]?.[0] as {
      where: { status: string; roleGrants: { some: { role: string; status: string } } };
      take: number;
    };
    expect(arg.where.status).toBe('ATIVO');
    expect(arg.where.roleGrants.some).toEqual({ role: 'VOLUNTEER', status: 'ACTIVE' });
    expect(arg.take).toBeGreaterThan(0);
  });
});
