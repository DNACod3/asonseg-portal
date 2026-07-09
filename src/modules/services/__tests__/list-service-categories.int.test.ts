import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração de `listServiceCategories` (F5, review PR #284). Requer
 * Postgres local (`supabase start`). O `where: { isSuggestion: false }` só era
 * exercitado via `vi.fn()` em page tests — este teste prova o filtro real
 * contra o DB.
 *
 * Cobre: categoria aprovada (`isSuggestion:false`) é retornada; categoria-
 * sugestão (`isSuggestion:true`) é excluída (AC-F5-1).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listServiceCategories } = await import('../queries/list-service-categories');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const APPROVED_NAME = 'Categoria Aprovada F5 Int';
const SUGGESTION_NAME = 'Categoria Sugestão F5 Int';

skipIfNoDb('listServiceCategories — integração (F5)', () => {
  let approvedId = '';
  let suggestionId = '';

  beforeAll(async () => {
    const [approved, suggestion] = await Promise.all([
      prisma.serviceCategory.upsert({
        where: { name: APPROVED_NAME },
        update: { isSuggestion: false },
        create: { name: APPROVED_NAME, isSuggestion: false },
        select: { id: true },
      }),
      prisma.serviceCategory.upsert({
        where: { name: SUGGESTION_NAME },
        update: { isSuggestion: true },
        create: { name: SUGGESTION_NAME, isSuggestion: true },
        select: { id: true },
      }),
    ]);
    approvedId = approved.id;
    suggestionId = suggestion.id;
  });

  afterAll(async () => {
    await prisma.serviceCategory.deleteMany({
      where: { name: { in: [APPROVED_NAME, SUGGESTION_NAME] } },
    });
  });

  it('AC-F5-1: inclui categorias aprovadas e exclui sugestões', async () => {
    const categories = await listServiceCategories();
    const ids = categories.map((c) => c.id);

    expect(ids).toContain(approvedId);
    expect(ids).not.toContain(suggestionId);
  });
});
