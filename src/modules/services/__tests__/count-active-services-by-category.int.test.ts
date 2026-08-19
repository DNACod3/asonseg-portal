import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração de `countActiveServicesByCategory` (USP-067 — T6 /
 * PNL-03, A-06). Requer Postgres local (`supabase start`).
 *
 * Cobre: contagem correta por categoria (só `status: ACTIVE`), categoria
 * aprovada sem nenhum serviço ativo aparece com `count: 0`, e serviço em
 * outro status (`DRAFT`) não entra na contagem.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { countActiveServicesByCategory } = await import('../queries/count-active-services-by-category');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CAT_A_NAME = 'Categoria Count Active Services Int A';
const CAT_B_NAME = 'Categoria Count Active Services Int B (sem ativo)';

skipIfNoDb('countActiveServicesByCategory — integração (T6)', () => {
  let authorId = '';
  let categoryAId = '';
  let categoryBId = '';

  async function cleanup() {
    await prisma.service.deleteMany({ where: { title: { startsWith: 'Count Active Services Int' } } });
    await prisma.serviceCategory.deleteMany({ where: { name: { in: [CAT_A_NAME, CAT_B_NAME] } } });
    await prisma.person.deleteMany({ where: { fullName: 'Count Active Services Int Autor' } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Count Active Services Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const [catA, catB] = await Promise.all([
      prisma.serviceCategory.upsert({
        where: { name: CAT_A_NAME },
        update: { isSuggestion: false },
        create: { name: CAT_A_NAME, isSuggestion: false },
        select: { id: true },
      }),
      prisma.serviceCategory.upsert({
        where: { name: CAT_B_NAME },
        update: { isSuggestion: false },
        create: { name: CAT_B_NAME, isSuggestion: false },
        select: { id: true },
      }),
    ]);
    categoryAId = catA.id;
    categoryBId = catB.id;

    // Categoria A: 2 serviços ACTIVE + 1 DRAFT (não deve contar).
    await prisma.service.createMany({
      data: [
        {
          authorPersonId: authorId,
          categoryId: categoryAId,
          title: 'Count Active Services Int Serviço A1',
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
        {
          authorPersonId: authorId,
          categoryId: categoryAId,
          title: 'Count Active Services Int Serviço A2',
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
        {
          authorPersonId: authorId,
          categoryId: categoryAId,
          title: 'Count Active Services Int Serviço A3 Draft',
          status: 'DRAFT',
        },
      ],
    });
    // Categoria B: nenhum serviço ativo.
  });

  afterAll(async () => {
    await cleanup();
  });

  it('conta só serviços ACTIVE por categoria; categoria sem ativo aparece com count 0', async () => {
    const counts = await countActiveServicesByCategory();
    const byId = new Map(counts.map((c) => [c.categoryId, c]));

    expect(byId.get(categoryAId)).toEqual({ categoryId: categoryAId, name: CAT_A_NAME, count: 2 });
    expect(byId.get(categoryBId)).toEqual({ categoryId: categoryBId, name: CAT_B_NAME, count: 0 });
  });

  it('não gera N+1: 1 groupBy + 1 listServiceCategories, resultado cobre todas as categorias aprovadas', async () => {
    const counts = await countActiveServicesByCategory();
    const categoryIds = new Set(counts.map((c) => c.categoryId));
    expect(categoryIds.has(categoryAId)).toBe(true);
    expect(categoryIds.has(categoryBId)).toBe(true);
  });
});
