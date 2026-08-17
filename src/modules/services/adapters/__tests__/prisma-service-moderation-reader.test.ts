// Unit do PrismaServiceModerationReader (USP-066 / T3 / E-003 — corrigido
// A1/PR#294) — Prisma mockado. Cobre: mapeamento de campos de E-003 + fotos
// ordenadas, sem fotos ⇒ [], null quando ausente, e o filtro de escopo
// `status: IN_MODERATION` (A1).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const prismaState = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { service: { findFirst: (...a: unknown[]) => prismaState.findFirst(...a) } },
}));

const { PrismaServiceModerationReader } = await import('../prisma-service-moderation-reader');
const { ContentKind } = await import('@/modules/moderation');

beforeEach(() => {
  vi.clearAllMocks();
});

const baseRow = {
  title: 'Reforma elétrica',
  description: 'Descrição integral do serviço',
  category: { name: 'Elétrica' },
  region: { name: 'Centro' },
  availabilityDescription: 'Seg a sex, 8h-18h',
  priceMin: null,
  priceMax: null,
  priceUnit: null,
  photos: [] as { storagePath: string; position: number }[],
};

describe('PrismaServiceModerationReader (T3/E-003)', () => {
  it('mapeia campos de E-003 + fotos ordenadas por position', async () => {
    prismaState.findFirst.mockResolvedValue({
      ...baseRow,
      priceMin: new Prisma.Decimal(100),
      priceMax: new Prisma.Decimal(200),
      priceUnit: 'por hora',
      photos: [
        { storagePath: 'svc/1/b.jpg', position: 1 },
        { storagePath: 'svc/1/a.jpg', position: 0 },
      ],
    });

    const view = await new PrismaServiceModerationReader().readContent(ContentKind.SERVICE, 'svc-1');

    expect(view).toMatchObject({
      kind: 'SERVICE',
      title: 'Reforma elétrica',
      description: 'Descrição integral do serviço',
      category: 'Elétrica',
      serviceArea: 'Centro',
      availability: 'Seg a sex, 8h-18h',
    });
    expect(view && 'priceRange' in view ? view.priceRange : undefined).toBe('R$ 100 – R$ 200 (por hora)');
    expect(view && 'photos' in view ? view.photos : undefined).toEqual([
      expect.stringContaining('svc/1/b.jpg'),
      expect.stringContaining('svc/1/a.jpg'),
    ]);
    // A ordenação real por `position` é delegada ao Prisma (orderBy no select);
    // aqui só verificamos que o adapter pede exatamente isso.
    const callArg = prismaState.findFirst.mock.calls[0]?.[0] as {
      select: { photos: { orderBy: { position: string } } };
    };
    expect(callArg.select.photos.orderBy).toEqual({ position: 'asc' });
  });

  it('sem fotos ⇒ photos: []', async () => {
    prismaState.findFirst.mockResolvedValue({ ...baseRow, photos: [] });
    const view = await new PrismaServiceModerationReader().readContent(ContentKind.SERVICE, 'svc-2');
    expect(view).toMatchObject({ kind: 'SERVICE', photos: [] });
  });

  it('sem categoria/região ⇒ category/serviceArea null (edge)', async () => {
    prismaState.findFirst.mockResolvedValue({ ...baseRow, category: null, region: null });
    const view = await new PrismaServiceModerationReader().readContent(ContentKind.SERVICE, 'svc-3');
    expect(view).toMatchObject({ kind: 'SERVICE', category: null, serviceArea: null });
  });

  it('findFirst → null ⇒ retorna null (E-006 gracioso)', async () => {
    prismaState.findFirst.mockResolvedValue(null);
    const view = await new PrismaServiceModerationReader().readContent(ContentKind.SERVICE, 'nope');
    expect(view).toBeNull();
  });

  it('A1 (PR#294): escopa a leitura a status IN_MODERATION — serviço ACTIVE/DRAFT/ARCHIVED não é servido', async () => {
    prismaState.findFirst.mockResolvedValue(null);

    const view = await new PrismaServiceModerationReader().readContent(ContentKind.SERVICE, 'svc-active');

    expect(view).toBeNull();
    expect(prismaState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'svc-active', status: 'IN_MODERATION' } }),
    );
  });
});
