// Unit dos adapters do módulo `moderation` (#122) — Prisma e next/cache mockados.
// O repositório Prisma também é exercitado contra Postgres real no int test da
// máquina de estados; aqui cobrimos a lógica pura de cada adapter sem banco.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ContentKind as ContentKindType } from '../../domain/content-status';

const prismaState = vi.hoisted(() => ({ findFirst: vi.fn() }));
const cacheState = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { moderationFixtureContent: { findFirst: (...a: unknown[]) => prismaState.findFirst(...a) } },
}));
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => cacheState.revalidatePath(...a) }));

const { NextCacheInvalidation } = await import('../next-cache-invalidation');
const { PrismaModerationContentRepository } = await import('../prisma-moderation-content-repository');
const { StubCompanyVerifyHook } = await import('../stub-company-verify-hook');
const { StubModerationNotification } = await import('../stub-moderation-notification');
const { ContentKind, ContentStatus } = await import('../../domain/content-status');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NextCacheInvalidation', () => {
  it('ACTIVE de JOB revalida /vagas; SERVICE revalida /servicos', async () => {
    const adapter = new NextCacheInvalidation();
    await adapter.revalidateForContent({
      contentKind: ContentKind.JOB,
      contentId: 'c1',
      to: ContentStatus.ACTIVE,
    });
    expect(cacheState.revalidatePath).toHaveBeenCalledWith('/vagas');

    await adapter.revalidateForContent({
      contentKind: ContentKind.SERVICE,
      contentId: 'c2',
      to: ContentStatus.ACTIVE,
    });
    expect(cacheState.revalidatePath).toHaveBeenCalledWith('/servicos');
  });

  it('CV não tem listagem pública: ACTIVE não revalida nada', async () => {
    await new NextCacheInvalidation().revalidateForContent({
      contentKind: ContentKind.CV,
      contentId: 'c3',
      to: ContentStatus.ACTIVE,
    });
    expect(cacheState.revalidatePath).not.toHaveBeenCalled();
  });

  it('transição que não muda visibilidade pública (PAUSED) faz early-return', async () => {
    await new NextCacheInvalidation().revalidateForContent({
      contentKind: ContentKind.JOB,
      contentId: 'c4',
      to: ContentStatus.PAUSED,
    });
    expect(cacheState.revalidatePath).not.toHaveBeenCalled();
  });

  it('INATIVATED também revalida (sai de ACTIVE)', async () => {
    await new NextCacheInvalidation().revalidateForContent({
      contentKind: ContentKind.JOB,
      contentId: 'c5',
      to: ContentStatus.INACTIVATED,
    });
    expect(cacheState.revalidatePath).toHaveBeenCalledWith('/vagas');
  });

  it('tipo de conteúdo desconhecido: nenhum path a revalidar (default vazio), sem lançar', async () => {
    await expect(
      new NextCacheInvalidation().revalidateForContent({
        contentKind: 'UNKNOWN' as ContentKindType,
        contentId: 'c6',
        to: ContentStatus.ACTIVE,
      }),
    ).resolves.toBeUndefined();
    expect(cacheState.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('PrismaModerationContentRepository', () => {
  it('loadStatus devolve o status quando a linha existe', async () => {
    prismaState.findFirst.mockResolvedValue({ status: 'IN_MODERATION' });
    const status = await new PrismaModerationContentRepository().loadStatus(ContentKind.JOB, 'c1');
    expect(status).toBe(ContentStatus.IN_MODERATION);
  });

  it('loadStatus devolve null quando a linha não existe', async () => {
    prismaState.findFirst.mockResolvedValue(null);
    const status = await new PrismaModerationContentRepository().loadStatus(ContentKind.JOB, 'x');
    expect(status).toBeNull();
  });

  it('updateStatus aplica via tx com guarda otimista (status = from) e devolve true se casou 1 linha', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { moderationFixtureContent: { updateMany } } as never;
    const ok = await new PrismaModerationContentRepository().updateStatus(
      tx,
      ContentKind.JOB,
      'c1',
      ContentStatus.IN_MODERATION,
      ContentStatus.ACTIVE,
    );
    expect(ok).toBe(true);
    const arg = updateMany.mock.calls[0]?.[0] as { where: { status: string }; data: { status: string } };
    expect(arg.where.status).toBe('IN_MODERATION'); // concorrência otimista
    expect(arg.data.status).toBe('ACTIVE');
  });

  it('updateStatus devolve false quando nenhuma linha casa (conflito)', async () => {
    const tx = { moderationFixtureContent: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } } as never;
    const ok = await new PrismaModerationContentRepository().updateStatus(
      tx,
      ContentKind.JOB,
      'c1',
      ContentStatus.IN_MODERATION,
      ContentStatus.ACTIVE,
    );
    expect(ok).toBe(false);
  });
});

describe('stubs (GAP-3 / GAP-4)', () => {
  it('StubModerationNotification resolve sem lançar (apenas loga)', async () => {
    await expect(
      new StubModerationNotification().sendModerationDecision({
        contentKind: ContentKind.JOB,
        contentId: 'c1',
        from: ContentStatus.IN_MODERATION,
        to: ContentStatus.ACTIVE,
        actorPersonId: 'a1',
      }),
    ).resolves.toBeUndefined();
  });

  it('StubCompanyVerifyHook resolve sem lançar (não marca is_verified)', async () => {
    await expect(
      new StubCompanyVerifyHook().onContentActivated({} as never, {
        contentKind: ContentKind.JOB,
        contentId: 'c1',
        from: ContentStatus.IN_MODERATION,
        actorPersonId: 'a1',
      }),
    ).resolves.toBeUndefined();
  });
});
