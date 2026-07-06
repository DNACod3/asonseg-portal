import { describe, it, expect } from 'vitest';

/**
 * Integração contra o Postgres local (Supabase CLI) — US-111 / AC-111-1 /
 * F0-MN-01 (Fase 0 — Fundação, WS-B).
 *
 * Roda `seedReference()` (taxonomia — `prisma/seeds/reference.ts`) 2× contra
 * o banco e assevera: (1) as 3 tabelas ficam populadas, com `is_suggestion =
 * false` e ao menos uma região `is_active = true`; (2) **idempotência**
 * (teste negativo F0-MN-01) — a 2ª execução NÃO altera as contagens. Pulado
 * quando não há `DATABASE_URL` (mesmo padrão dos demais `*.int.test.ts`).
 *
 * Não chama `seedDemo()` — este teste cobre só a taxonomia de referência
 * (prod-safe); dados de demo são fora do escopo de AC-111-1.
 *
 * Os nomes canônicos (`docs/operacao/taxonomia-inicial.md`) são pinados em
 * `it.todo` até T-B2 confirmar o alinhamento do dado do seed ao doc.
 */
const { prisma } = await import('@/shared/lib/prisma');
const { seedReference } = await import('../seeds/reference');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('seed de taxonomia — integração (US-111 / AC-111-1 / F0-MN-01)', () => {
  it('popula-taxonomia: as 3 tabelas ficam não-vazias, is_suggestion=false e região ativa', async () => {
    await seedReference(prisma);

    const [regions, jobAreas, serviceCategories] = await Promise.all([
      prisma.region.findMany(),
      prisma.jobArea.findMany(),
      prisma.serviceCategory.findMany(),
    ]);

    expect(regions.length).toBeGreaterThan(0);
    expect(jobAreas.length).toBeGreaterThan(0);
    expect(serviceCategories.length).toBeGreaterThan(0);

    expect(jobAreas.every((a) => a.isSuggestion === false)).toBe(true);
    expect(serviceCategories.every((c) => c.isSuggestion === false)).toBe(true);
    expect(regions.some((r) => r.isActive === true)).toBe(true);
  });

  it('idempotente (F0-MN-01 — teste negativo): 2ª execução NÃO altera as contagens', async () => {
    await seedReference(prisma);
    const before = await Promise.all([
      prisma.region.count(),
      prisma.jobArea.count(),
      prisma.serviceCategory.count(),
    ]);

    await seedReference(prisma);
    const after = await Promise.all([
      prisma.region.count(),
      prisma.jobArea.count(),
      prisma.serviceCategory.count(),
    ]);

    expect(after).toEqual(before);
  });

  it.todo('a lista de regiões contém exatamente os nomes canônicos de taxonomia-inicial.md');
  it.todo('a lista de áreas de vaga contém exatamente os nomes canônicos de taxonomia-inicial.md');
  it.todo('a lista de categorias de serviço contém exatamente os nomes canônicos de taxonomia-inicial.md');
});
