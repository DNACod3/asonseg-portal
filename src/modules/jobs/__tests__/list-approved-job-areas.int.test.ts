import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração da query listApprovedJobAreas (USP-020 / #165).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — só áreas aprovadas (`isSuggestion === false`) entram no
 * select de "área" do formulário; sugestões pendentes ficam de fora.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listApprovedJobAreas } = await import('../queries/list-approved-job-areas');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const APPROVED_NAME = 'Aprovada List Int';
const SUGGESTION_NAME = 'Sugestao List Int';

skipIfNoDb('listApprovedJobAreas — integração', () => {
  async function cleanup() {
    await prisma.jobArea.deleteMany({ where: { name: { in: [APPROVED_NAME, SUGGESTION_NAME] } } });
  }

  beforeAll(async () => {
    await cleanup();
    await prisma.jobArea.create({ data: { name: APPROVED_NAME, isSuggestion: false } });
    await prisma.jobArea.create({ data: { name: SUGGESTION_NAME, isSuggestion: true } });
  });

  afterAll(cleanup);

  it('retorna a área aprovada e exclui a sugestão pendente (isSuggestion=false)', async () => {
    const areas = await listApprovedJobAreas();
    const names = areas.map((a) => a.name);

    expect(names).toContain(APPROVED_NAME);
    expect(names).not.toContain(SUGGESTION_NAME);
  });

  it('cada item expõe só {id, name} (sem vazar colunas extras)', async () => {
    const areas = await listApprovedJobAreas();
    const approved = areas.find((a) => a.name === APPROVED_NAME);

    expect(approved).toBeDefined();
    expect(Object.keys(approved ?? {}).sort()).toEqual(['id', 'name']);
  });
});
