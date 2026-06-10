// Unit de `canAccessModerationQueue` (#123) — coordenador (permissão inerente) vs
// voluntário com delegação de moderação ativa, com Prisma e `isCoordinator`
// mockados (sem banco).

import { describe, it, expect, beforeEach, vi } from 'vitest';

const prismaState = vi.hoisted(() => ({ findFirst: vi.fn() }));
const identityState = vi.hoisted(() => ({ isCoordinator: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { delegatedPermission: { findFirst: (...a: unknown[]) => prismaState.findFirst(...a) } },
}));
vi.mock('@/modules/identity', () => ({
  isCoordinator: (...a: unknown[]) => identityState.isCoordinator(...a),
}));

const { canAccessModerationQueue } = await import('../moderation-access');

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
