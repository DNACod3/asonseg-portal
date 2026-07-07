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
 * Os nomes canônicos (`docs/operacao/taxonomia-inicial.md`) são pinados nos
 * testes abaixo (T-B2) — confirmado que `prisma/seeds/reference.ts` já semeia
 * exatamente as 3 listas do doc (10 regiões, 12 áreas, 10 categorias, nomes
 * idênticos); nenhum ajuste de dado foi necessário.
 */
const { prisma } = await import('@/shared/lib/prisma');
const { seedReference, REGIONS, JOB_AREAS, SERVICE_CATEGORIES } = await import(
  '../seeds/reference'
);

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

/** Nomes canônicos de `docs/operacao/taxonomia-inicial.md` §1 (Regiões). */
const CANONICAL_REGIONS = [
  'Canasvieiras',
  'Jurerê',
  'Ingleses',
  'Cachoeira do Bom Jesus',
  'Ponta das Canas',
  'Praia Brava',
  'Vargem do Bom Jesus',
  'Santinho',
  'Daniela',
  'Toda Florianópolis',
] as const;

/** Nomes canônicos de `docs/operacao/taxonomia-inicial.md` §2 (Áreas de vaga). */
const CANONICAL_JOB_AREAS = [
  'Administrativa',
  'Comércio e Vendas',
  'Alimentação e Gastronomia',
  'Turismo e Hotelaria',
  'Saúde',
  'Limpeza e Conservação',
  'Construção e Reformas',
  'Logística e Transporte',
  'Beleza e Estética',
  'Educação',
  'Tecnologia',
  'Serviços Gerais',
] as const;

/** Nomes canônicos de `docs/operacao/taxonomia-inicial.md` §3 (Categorias de serviço). */
const CANONICAL_SERVICE_CATEGORIES = [
  'Serviços Domésticos',
  'Reparos e Manutenção',
  'Área Externa e Jardinagem',
  'Beleza e Bem-estar',
  'Aulas e Reforço',
  'Cuidados (idosos, crianças, pets)',
  'Eventos e Buffet',
  'Tecnologia e Informática',
  'Costura e Confecção',
  'Transporte e Fretes',
] as const;

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

  // Exclusividade à prova de poluição do banco compartilhado (F0-MN-01 — teste
  // negativo "taxonomia inflada"): o banco de integração é compartilhado e outros
  // *.int.test.ts criam regiões/áreas não-canônicas (ex.: 'Busca Int Região A')
  // que não removem — por isso o check no banco filtra por `name in [canônicos]`.
  // Esse filtro sozinho NÃO pega uma linha EXTRA/typada que o próprio seed criasse
  // (ela ficaria fora do `in`). Fechamos o gap na FONTE: as listas exportadas de
  // `reference.ts` (o que o seed realmente semeia, por upsert-por-nome) têm de
  // bater EXATAMENTE com as canônicas — comprimento + conjunto, sem depender do DB.
  it('a lista de regiões contém exatamente os nomes canônicos de taxonomia-inicial.md', async () => {
    await seedReference(prisma);
    const names = (
      await prisma.region.findMany({ where: { name: { in: [...CANONICAL_REGIONS] } } })
    ).map((r) => r.name);
    expect(new Set(names)).toEqual(new Set(CANONICAL_REGIONS));

    // Fonte do seed sem extras/typos (exclusividade real, imune à poluição).
    expect(REGIONS).toHaveLength(CANONICAL_REGIONS.length);
    expect(new Set(REGIONS)).toEqual(new Set(CANONICAL_REGIONS));
  });

  it('a lista de áreas de vaga contém exatamente os nomes canônicos de taxonomia-inicial.md', async () => {
    await seedReference(prisma);
    const names = (
      await prisma.jobArea.findMany({ where: { name: { in: [...CANONICAL_JOB_AREAS] } } })
    ).map((a) => a.name);
    expect(new Set(names)).toEqual(new Set(CANONICAL_JOB_AREAS));

    expect(JOB_AREAS).toHaveLength(CANONICAL_JOB_AREAS.length);
    expect(new Set(JOB_AREAS)).toEqual(new Set(CANONICAL_JOB_AREAS));
  });

  it('a lista de categorias de serviço contém exatamente os nomes canônicos de taxonomia-inicial.md', async () => {
    await seedReference(prisma);
    const names = (
      await prisma.serviceCategory.findMany({
        where: { name: { in: [...CANONICAL_SERVICE_CATEGORIES] } },
      })
    ).map((c) => c.name);
    expect(new Set(names)).toEqual(new Set(CANONICAL_SERVICE_CATEGORIES));

    expect(SERVICE_CATEGORIES).toHaveLength(CANONICAL_SERVICE_CATEGORIES.length);
    expect(new Set(SERVICE_CATEGORIES)).toEqual(new Set(CANONICAL_SERVICE_CATEGORIES));
  });
});
