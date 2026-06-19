// Unit de `viewModerationQueue` (#123 / USP-017) — une vagas reais (`jobs`) e o
// store transitório (`_moderation_fixture`), filtra/ordena e mapeia para a View
// Model, com Prisma e o View Model de staff mockados (sem banco). O caminho com
// Postgres real está em `./moderation-queue.int.test.ts`.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentStatus as PrismaContentStatus } from '@prisma/client';

const jobState = vi.hoisted(() => ({ findMany: vi.fn() }));
const fixtureState = vi.hoisted(() => ({ findMany: vi.fn() }));
const personsState = vi.hoisted(() => ({ viewStaffPersonNames: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    job: { findMany: (...a: unknown[]) => jobState.findMany(...a) },
    moderationFixtureContent: { findMany: (...a: unknown[]) => fixtureState.findMany(...a) },
  },
}));
vi.mock('@/modules/persons', () => ({
  viewStaffPersonNames: (...a: unknown[]) => personsState.viewStaffPersonNames(...a),
}));

const { viewModerationQueue } = await import('../moderation-queue');

const VIEWER = '00000000-0000-0000-0000-0000000000aa';
const AUTHOR = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  jobState.findMany.mockResolvedValue([]);
  fixtureState.findMany.mockResolvedValue([]);
  personsState.viewStaffPersonNames.mockResolvedValue(new Map([[AUTHOR, 'Maria da Silva']]));
});

describe('viewModerationQueue', () => {
  it('consulta IN_MODERATION em ambas as fontes, exclui o próprio viewer (P-005), ordena ASC, com take e select explícito', async () => {
    await viewModerationQueue({ viewerPersonId: VIEWER });

    const fixtureArg = fixtureState.findMany.mock.calls[0]?.[0] as {
      where: { status: string; authorPersonId: { not: string } };
      orderBy: { submittedAt: string };
      take: number;
      select: Record<string, unknown>;
    };
    expect(fixtureArg.where.status).toBe(PrismaContentStatus.IN_MODERATION);
    expect(fixtureArg.where.authorPersonId).toEqual({ not: VIEWER });
    expect(fixtureArg.orderBy).toEqual({ submittedAt: 'asc' });
    expect(fixtureArg.take).toBeGreaterThan(0);
    expect(Object.keys(fixtureArg.select).sort()).toEqual(
      ['authorPersonId', 'id', 'kind', 'submittedAt', 'title'].sort(),
    );

    const jobArg = jobState.findMany.mock.calls[0]?.[0] as {
      where: { status: string; authorPersonId: { not: string } };
      orderBy: { lastStatusChangeAt: string };
    };
    expect(jobArg.where.status).toBe(PrismaContentStatus.IN_MODERATION);
    expect(jobArg.where.authorPersonId).toEqual({ not: VIEWER });
    expect(jobArg.orderBy).toEqual({ lastStatusChangeAt: 'asc' });
  });

  it('fila vazia: devolve [] sem resolver nomes de autor', async () => {
    const out = await viewModerationQueue({ viewerPersonId: VIEWER });
    expect(out).toEqual([]);
    expect(personsState.viewStaffPersonNames).not.toHaveBeenCalled();
  });

  it('vaga real: mapeia companyUnverified e companyId a partir da Empresa', async () => {
    const at = new Date('2026-06-01T12:00:00Z');
    jobState.findMany.mockResolvedValue([
      {
        id: 'j1',
        title: 'Vaga A',
        authorPersonId: AUTHOR,
        lastStatusChangeAt: at,
        company: { id: 'co-1', isVerified: false },
      },
    ]);

    const out = await viewModerationQueue({ viewerPersonId: VIEWER });

    expect(personsState.viewStaffPersonNames).toHaveBeenCalledWith([AUTHOR]);
    expect(out).toEqual([
      {
        contentKind: 'JOB',
        contentId: 'j1',
        title: 'Vaga A',
        authorName: 'Maria da Silva',
        submittedAt: at,
        companyUnverified: true,
        companyId: 'co-1',
      },
    ]);
  });

  it('une e ordena vagas + fixture por submittedAt (mais antigo primeiro)', async () => {
    jobState.findMany.mockResolvedValue([
      {
        id: 'j1',
        title: 'Vaga nova',
        authorPersonId: AUTHOR,
        lastStatusChangeAt: new Date('2026-06-03T09:00:00Z'),
        company: { id: 'co-1', isVerified: true },
      },
    ]);
    fixtureState.findMany.mockResolvedValue([
      { id: 'f1', kind: 'CV', title: 'CV antigo', authorPersonId: AUTHOR, submittedAt: new Date('2026-06-01T09:00:00Z') },
    ]);

    const out = await viewModerationQueue({ viewerPersonId: VIEWER });
    expect(out.map((o) => o.contentId)).toEqual(['f1', 'j1']); // mais antigo primeiro
    expect(out[0]?.companyUnverified).toBeUndefined(); // fixture não tem Empresa
    expect(out[1]?.companyUnverified).toBe(false); // vaga de Empresa verificada
  });

  it('autor sem nome resolvido vira authorName null (não quebra a fila)', async () => {
    personsState.viewStaffPersonNames.mockResolvedValue(new Map());
    fixtureState.findMany.mockResolvedValue([
      { id: 'f1', kind: 'CV', title: 'CV B', authorPersonId: AUTHOR, submittedAt: new Date() },
    ]);

    const out = await viewModerationQueue({ viewerPersonId: VIEWER });
    expect(out[0]?.authorName).toBeNull();
  });
});
