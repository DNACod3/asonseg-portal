import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `reportServices` (T7 — E-001, AC-042-5/MP5/MP7). Requer
 * Postgres local. Janela de teste fixa e distante (julho/2019) — mesma
 * técnica de isolamento das suítes anteriores.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { reportServices } = await import('../queries/report-services');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportSvcInt';
const CAT_A_NAME = `${NAME_PREFIX} Categoria A`;
const CAT_B_NAME = `${NAME_PREFIX} Categoria B`;
const WINDOW_FROM = '2019-07-01';
const WINDOW_TO = '2019-07-31';
const OUTSIDE_DATE = new Date('2018-01-01T12:00:00Z');
const INSIDE_DATE = new Date('2019-07-15T12:00:00Z');

async function cleanup(): Promise<void> {
  await prisma.serviceInterest.deleteMany({ where: { service: { title: { startsWith: NAME_PREFIX } } } });
  await prisma.service.deleteMany({ where: { title: { startsWith: NAME_PREFIX } } });
  await prisma.serviceCategory.deleteMany({ where: { name: { in: [CAT_A_NAME, CAT_B_NAME] } } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('USP-042/T7 — reportServices (integração)', () => {
  let catA: { id: string };
  let catB: { id: string };

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Author`, status: 'ATIVO' },
      select: { id: true },
    });
    catA = await prisma.serviceCategory.create({ data: { name: CAT_A_NAME }, select: { id: true } });
    catB = await prisma.serviceCategory.create({ data: { name: CAT_B_NAME }, select: { id: true } });

    // Dentro da janela: catA/ACTIVE x3, catA/DRAFT x2, catB/ACTIVE x1.
    const insideServices = await prisma.$transaction([
      ...Array.from({ length: 3 }, (_, i) =>
        prisma.service.create({
          data: {
            authorPersonId: author.id,
            categoryId: catA.id,
            title: `${NAME_PREFIX} A Active ${i + 1}`,
            status: 'ACTIVE',
            createdAt: INSIDE_DATE,
          },
        }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        prisma.service.create({
          data: {
            authorPersonId: author.id,
            categoryId: catA.id,
            title: `${NAME_PREFIX} A Draft ${i + 1}`,
            status: 'DRAFT',
            createdAt: INSIDE_DATE,
          },
        }),
      ),
      prisma.service.create({
        data: {
          authorPersonId: author.id,
          categoryId: catB.id,
          title: `${NAME_PREFIX} B Active`,
          status: 'ACTIVE',
          createdAt: INSIDE_DATE,
        },
      }),
    ]);

    // Fora da janela: catA/ACTIVE x2, não deve entrar na contagem.
    await prisma.service.createMany({
      data: Array.from({ length: 2 }, (_, i) => ({
        authorPersonId: author.id,
        categoryId: catA.id,
        title: `${NAME_PREFIX} Outside ${i + 1}`,
        status: 'ACTIVE' as const,
        createdAt: OUTSIDE_DATE,
      })),
    });

    // Manifestações de interesse: 4 dentro da janela, 1 fora.
    const targetService = insideServices[0]!;
    for (let i = 0; i < 4; i += 1) {
      const client = await prisma.person.create({
        data: { fullName: `${NAME_PREFIX} Client Inside ${i + 1}`, status: 'ATIVO' },
        select: { id: true },
      });
      await prisma.serviceInterest.create({
        data: { clientPersonId: client.id, serviceId: targetService.id, interestedAt: INSIDE_DATE },
      });
    }
    const outsideClient = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Client Outside`, status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.serviceInterest.create({
      data: { clientPersonId: outsideClient.id, serviceId: targetService.id, interestedAt: OUTSIDE_DATE },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('AC-042-5/MP5: agrega por status+categoria SOMENTE dentro da janela', async () => {
    const report = await reportServices({ from: WINDOW_FROM, to: WINDOW_TO });
    const rows = report.byStatusAndCategory.filter((r) => r.categoryId === catA.id || r.categoryId === catB.id);

    expect(rows).toEqual(
      expect.arrayContaining([
        { status: 'ACTIVE', categoryId: catA.id, count: 3 },
        { status: 'DRAFT', categoryId: catA.id, count: 2 },
        { status: 'ACTIVE', categoryId: catB.id, count: 1 },
      ]),
    );
  });

  it('filtro categoryId estreita para a categoria informada', async () => {
    const report = await reportServices({ from: WINDOW_FROM, to: WINDOW_TO, categoryId: catB.id });
    expect(report.byStatusAndCategory).toEqual([{ status: 'ACTIVE', categoryId: catB.id, count: 1 }]);
  });

  it('AC-042-5/MP7: manifestações de interesse contadas SOMENTE dentro da janela (4, não 5)', async () => {
    const report = await reportServices({ from: WINDOW_FROM, to: WINDOW_TO });
    expect(report.interestsCount).toBe(4);
  });

  it('período sem dados (1999) → byStatusAndCategory=[] e interestsCount=0', async () => {
    const report = await reportServices({ from: '1999-01-01', to: '1999-01-31' });
    expect(report.byStatusAndCategory).toEqual([]);
    expect(report.interestsCount).toBe(0);
  });
});
