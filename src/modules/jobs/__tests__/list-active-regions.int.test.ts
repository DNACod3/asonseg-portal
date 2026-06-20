import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração da query listActiveRegions (USP-021 / #170).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — só regiões ativas (`isActive === true`) entram nos selects de
 * região (formulário de vaga e filtro da busca pública); inativas ficam de fora.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listActiveRegions } = await import('../queries/list-active-regions');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const ACTIVE_NAME = 'Ativa List Int';
const INACTIVE_NAME = 'Inativa List Int';

skipIfNoDb('listActiveRegions — integração', () => {
  async function cleanup() {
    await prisma.region.deleteMany({ where: { name: { in: [ACTIVE_NAME, INACTIVE_NAME] } } });
  }

  beforeAll(async () => {
    await cleanup();
    await prisma.region.create({
      data: { name: ACTIVE_NAME, cityName: 'Florianópolis', isActive: true },
    });
    await prisma.region.create({
      data: { name: INACTIVE_NAME, cityName: 'Florianópolis', isActive: false },
    });
  });

  afterAll(cleanup);

  it('retorna a região ativa e exclui a inativa (isActive=true)', async () => {
    const regions = await listActiveRegions();
    const names = regions.map((r) => r.name);

    expect(names).toContain(ACTIVE_NAME);
    expect(names).not.toContain(INACTIVE_NAME);
  });

  it('cada item expõe só {id, name} (sem vazar colunas extras)', async () => {
    const regions = await listActiveRegions();
    const active = regions.find((r) => r.name === ACTIVE_NAME);

    expect(active).toBeDefined();
    expect(Object.keys(active ?? {}).sort()).toEqual(['id', 'name']);
  });
});
