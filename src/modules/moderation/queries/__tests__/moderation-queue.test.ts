// Unit de `viewModerationQueue` (#123) — filtro/ordem/seleção e o mapeamento para
// a View Model, com Prisma e o View Model de staff mockados (sem banco). O
// caminho com Postgres real está em `./moderation-queue.int.test.ts`.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentStatus as PrismaContentStatus } from '@prisma/client';

const prismaState = vi.hoisted(() => ({ findMany: vi.fn() }));
const personsState = vi.hoisted(() => ({ viewStaffPersonNames: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { moderationFixtureContent: { findMany: (...a: unknown[]) => prismaState.findMany(...a) } },
}));
vi.mock('@/modules/persons', () => ({
  viewStaffPersonNames: (...a: unknown[]) => personsState.viewStaffPersonNames(...a),
}));

const { viewModerationQueue } = await import('../moderation-queue');

const VIEWER = '00000000-0000-0000-0000-0000000000aa';
const AUTHOR = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  personsState.viewStaffPersonNames.mockResolvedValue(new Map([[AUTHOR, 'Maria da Silva']]));
});

describe('viewModerationQueue', () => {
  it('consulta IN_MODERATION, exclui o próprio viewer (P-005), ordena ASC, com take e select explícito', async () => {
    prismaState.findMany.mockResolvedValue([]);

    await viewModerationQueue({ viewerPersonId: VIEWER });

    const arg = prismaState.findMany.mock.calls[0]?.[0] as {
      where: { status: string; authorPersonId: { not: string } };
      orderBy: { submittedAt: string };
      take: number;
      select: Record<string, unknown>;
    };
    expect(arg.where.status).toBe(PrismaContentStatus.IN_MODERATION);
    expect(arg.where.authorPersonId).toEqual({ not: VIEWER });
    expect(arg.orderBy).toEqual({ submittedAt: 'asc' });
    expect(arg.take).toBeGreaterThan(0);
    expect(Object.keys(arg.select).sort()).toEqual(
      ['authorPersonId', 'id', 'kind', 'submittedAt', 'title'].sort(),
    );
  });

  it('fila vazia: devolve [] sem resolver nomes de autor', async () => {
    prismaState.findMany.mockResolvedValue([]);
    const out = await viewModerationQueue({ viewerPersonId: VIEWER });
    expect(out).toEqual([]);
    expect(personsState.viewStaffPersonNames).not.toHaveBeenCalled();
  });

  it('mapeia para a View Model resolvendo o nome do autor via View Model de staff', async () => {
    const submittedAt = new Date('2026-06-01T12:00:00Z');
    prismaState.findMany.mockResolvedValue([
      { id: 'c1', kind: 'JOB', title: 'Vaga A', authorPersonId: AUTHOR, submittedAt },
    ]);

    const out = await viewModerationQueue({ viewerPersonId: VIEWER });

    expect(personsState.viewStaffPersonNames).toHaveBeenCalledWith([AUTHOR]);
    expect(out).toEqual([
      {
        contentKind: 'JOB',
        contentId: 'c1',
        title: 'Vaga A',
        authorName: 'Maria da Silva',
        submittedAt,
      },
    ]);
  });

  it('autor sem nome resolvido vira authorName null (não quebra a fila)', async () => {
    personsState.viewStaffPersonNames.mockResolvedValue(new Map());
    prismaState.findMany.mockResolvedValue([
      { id: 'c1', kind: 'CV', title: 'CV B', authorPersonId: AUTHOR, submittedAt: new Date() },
    ]);

    const out = await viewModerationQueue({ viewerPersonId: VIEWER });
    expect(out[0]?.authorName).toBeNull();
  });
});
