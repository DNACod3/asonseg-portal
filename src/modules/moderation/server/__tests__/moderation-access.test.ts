// Unit de `canAccessModerationQueue` (#123) e `listViewerModeratableKinds`
// (USP-056/MOD-7) — coordenador (permissão inerente) vs voluntário com
// delegação de moderação ativa, com Prisma e `isCoordinator` mockados (sem banco).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn() }));
const identityState = vi.hoisted(() => ({ isCoordinator: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    delegatedPermission: {
      findFirst: (...a: unknown[]) => prismaState.findFirst(...a),
      findMany: (...a: unknown[]) => prismaState.findMany(...a),
    },
  },
}));
vi.mock('@/modules/identity', () => ({
  isCoordinator: (...a: unknown[]) => identityState.isCoordinator(...a),
}));

const { canAccessModerationQueue, listViewerModeratableKinds } = await import('../moderation-access');

const person = { id: '00000000-0000-0000-0000-0000000000aa' } as unknown as Parameters<
  typeof canAccessModerationQueue
>[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('canAccessModerationQueue', () => {
  it('coordenador acessa por permissão inerente, sem consultar delegações', async () => {
    identityState.isCoordinator.mockReturnValue(true);

    expect(await canAccessModerationQueue(person)).toBe(true);
    expect(prismaState.findFirst).not.toHaveBeenCalled();
  });

  it('voluntário com delegação de moderação ativa acessa', async () => {
    identityState.isCoordinator.mockReturnValue(false);
    prismaState.findFirst.mockResolvedValue({ id: 'grant-1' });

    expect(await canAccessModerationQueue(person)).toBe(true);
    const arg = prismaState.findFirst.mock.calls[0]?.[0] as {
      where: { personId: string; permission: { in: string[] }; revokedAt: null };
    };
    expect(arg.where.personId).toBe(person.id);
    expect(arg.where.revokedAt).toBeNull(); // só delegação ATIVA
    expect(arg.where.permission.in).toEqual(
      expect.arrayContaining(['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE']),
    );
  });

  it('voluntário sem delegação ativa NÃO acessa', async () => {
    identityState.isCoordinator.mockReturnValue(false);
    prismaState.findFirst.mockResolvedValue(null);

    expect(await canAccessModerationQueue(person)).toBe(false);
  });
});

describe('listViewerModeratableKinds (USP-056/MOD-7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[MOD7-01] coordenador → todos os ContentKind moderáveis, sem consultar delegações', async () => {
    identityState.isCoordinator.mockReturnValue(true);

    const kinds = await listViewerModeratableKinds(person);
    expect(kinds).toEqual(['JOB', 'SERVICE', 'CV', 'CANDIDATE_PROFILE']);
    expect(prismaState.findMany).not.toHaveBeenCalled();
  });

  it('[MOD7-01] voluntário só com MODERATE_JOB → [JOB]', async () => {
    identityState.isCoordinator.mockReturnValue(false);
    prismaState.findMany.mockResolvedValue([{ permission: 'MODERATE_JOB' }]);

    const kinds = await listViewerModeratableKinds(person);
    expect(kinds).toEqual(['JOB']);
    const arg = prismaState.findMany.mock.calls[0]?.[0] as {
      where: { personId: string; permission: { in: string[] }; revokedAt: null };
    };
    expect(arg.where.personId).toBe(person.id);
    expect(arg.where.revokedAt).toBeNull();
    expect(arg.where.permission.in).toEqual(
      expect.arrayContaining(['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE']),
    );
  });

  it('[MOD7-01] voluntário com MODERATE_CV → inclui CV e CANDIDATE_PROFILE', async () => {
    identityState.isCoordinator.mockReturnValue(false);
    prismaState.findMany.mockResolvedValue([{ permission: 'MODERATE_CV' }]);

    const kinds = await listViewerModeratableKinds(person);
    expect(kinds.sort()).toEqual(['CANDIDATE_PROFILE', 'CV'].sort());
  });

  it('voluntário sem nenhuma delegação → []', async () => {
    identityState.isCoordinator.mockReturnValue(false);
    prismaState.findMany.mockResolvedValue([]);

    expect(await listViewerModeratableKinds(person)).toEqual([]);
  });
});
