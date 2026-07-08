import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da query de busca pública `searchServices` (USP-030 / T030-2).
 * Requer Postgres local (`supabase start`) + extensão unaccent (migração USP-021,
 * índice funcional próprio da USP-030). Espelha `search-jobs.int.test.ts`, mas SEM
 * gate de `company.isVerified` e SEM `validUntil` (serviço não expira).
 *
 * Cobre o filtro on-read (AC-030-1/SVC030-MN-01), os filtros AND (AC-030-2), a
 * busca sem acento por título/descrição/categoria (AC-030-3), a paginação
 * (SVC030-MN-03) e o não-vazamento de contato (SVC030-MN-02).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { searchServices } = await import('../queries/search-services');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CATEGORY_NAME = 'Busca Int Categoria';
const REGION_A = 'Busca Int Serviço Região A';
const REGION_B = 'Busca Int Serviço Região B';

const anon: CurrentPerson | null = null;

skipIfNoDb('searchServices — integração', () => {
  let categoryId = '';
  let regionAId = '';
  let regionBId = '';
  let activeAuthorId = '';
  let inactiveAuthorId = '';

  // Serviços-fixture (ids capturados p/ asserção por presença).
  let sVisivel = ''; // ACTIVE, prestador ativo, Região A, título com acento, faixa 80-150
  let sModeracao = ''; // IN_MODERATION
  let sPausado = ''; // PAUSED
  let sArquivado = ''; // ARCHIVED
  let sPrestadorInativo = ''; // ACTIVE mas prestador inativado (P-005-like)
  let sOutro = ''; // ACTIVE, Região B, faixa 300-500 (p/ filtros AND)

  async function cleanup() {
    await prisma.service.deleteMany({
      where: { authorPersonId: { in: [activeAuthorId, inactiveAuthorId].filter(Boolean) } },
    });
  }

  beforeAll(async () => {
    const category = await prisma.serviceCategory.upsert({
      where: { name: CATEGORY_NAME },
      update: {},
      create: { name: CATEGORY_NAME },
      select: { id: true },
    });
    categoryId = category.id;

    const [ra, rb] = await Promise.all([
      prisma.region.upsert({
        where: { name: REGION_A },
        update: {},
        create: { name: REGION_A, cityName: 'Florianópolis' },
        select: { id: true },
      }),
      prisma.region.upsert({
        where: { name: REGION_B },
        update: {},
        create: { name: REGION_B, cityName: 'Florianópolis' },
        select: { id: true },
      }),
    ]);
    regionAId = ra.id;
    regionBId = rb.id;

    const activeAuthor = await prisma.person.create({
      data: { fullName: 'Prestador Ativo Busca Int', status: 'ATIVO' },
      select: { id: true },
    });
    activeAuthorId = activeAuthor.id;

    const inactiveAuthor = await prisma.person.create({
      data: {
        fullName: 'Prestador Inativo Busca Int',
        status: 'ATIVO',
        inactivatedAt: new Date(),
      },
      select: { id: true },
    });
    inactiveAuthorId = inactiveAuthor.id;

    const base = { categoryId, description: 'Descrição do serviço de teste.' };

    const [v, m, p, ar, pi, o] = await Promise.all([
      prisma.service.create({
        data: {
          ...base,
          authorPersonId: activeAuthorId,
          regionId: regionAId,
          title: 'Jardinagem Residência Padária', // acento proposital (AC-030-3)
          priceMin: 80,
          priceMax: 150,
          priceUnit: 'por serviço',
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.service.create({
        data: {
          ...base,
          authorPersonId: activeAuthorId,
          regionId: regionAId,
          title: 'Serviço Em Moderação Int',
          status: 'IN_MODERATION',
        },
        select: { id: true },
      }),
      prisma.service.create({
        data: {
          ...base,
          authorPersonId: activeAuthorId,
          regionId: regionAId,
          title: 'Serviço Pausado Int',
          status: 'PAUSED',
          publishedAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.service.create({
        data: {
          ...base,
          authorPersonId: activeAuthorId,
          regionId: regionAId,
          title: 'Serviço Arquivado Int',
          status: 'ARCHIVED',
          publishedAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.service.create({
        data: {
          ...base,
          authorPersonId: inactiveAuthorId,
          regionId: regionAId,
          title: 'Serviço Prestador Inativo Int',
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
        select: { id: true },
      }),
      prisma.service.create({
        data: {
          ...base,
          authorPersonId: activeAuthorId,
          regionId: regionBId,
          title: 'Outro Serviço Int',
          priceMin: 300,
          priceMax: 500,
          priceUnit: 'por diária',
          status: 'ACTIVE',
          publishedAt: new Date(Date.now() - 1000),
        },
        select: { id: true },
      }),
    ]);
    sVisivel = v.id;
    sModeracao = m.id;
    sPausado = p.id;
    sArquivado = ar.id;
    sPrestadorInativo = pi.id;
    sOutro = o.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: { in: [activeAuthorId, inactiveAuthorId] } } });
    await prisma.serviceCategory.deleteMany({ where: { name: CATEGORY_NAME } });
  });

  it('AC-030-1/SVC030-MN-01: só lista ACTIVE de prestador ativo', async () => {
    const { items } = await searchServices({ categoryId }, anon);
    const ids = items.map((i) => i.id);
    expect(ids).toContain(sVisivel);
    expect(ids).toContain(sOutro);
    expect(ids).not.toContain(sModeracao);
    expect(ids).not.toContain(sPausado);
    expect(ids).not.toContain(sArquivado);
    expect(ids).not.toContain(sPrestadorInativo);
  });

  it('AC-030-1: ordenado por published_at DESC (mais recente primeiro)', async () => {
    const { items } = await searchServices({ categoryId }, anon);
    const ids = items.map((i) => i.id);
    expect(ids.indexOf(sVisivel)).toBeLessThan(ids.indexOf(sOutro));
  });

  it('AC-030-2: combina filtros em AND (categoria + região)', async () => {
    const { items } = await searchServices({ categoryId, regionId: regionBId }, anon);
    expect(items.map((i) => i.id)).toEqual([sOutro]);
  });

  it('AC-030-2: filtro de faixa de preço por overlap', async () => {
    // Faixa [250, 600] cruza "Outro" (300-500), não "Visível" (80-150).
    const { items } = await searchServices({ categoryId, priceMin: 250, priceMax: 600 }, anon);
    const ids = items.map((i) => i.id);
    expect(ids).toContain(sOutro);
    expect(ids).not.toContain(sVisivel);
  });

  it('AC-030-3: busca textual é case-insensitive e sem acento (título)', async () => {
    for (const term of ['padaria', 'PADÁRIA', 'padária']) {
      const { items } = await searchServices({ q: term }, anon);
      expect(items.map((i) => i.id)).toContain(sVisivel);
    }
  });

  it('AC-030-3: busca textual casa pelo nome da categoria', async () => {
    const { items } = await searchServices({ q: CATEGORY_NAME }, anon);
    const ids = items.map((i) => i.id);
    expect(ids).toContain(sVisivel);
    expect(ids).toContain(sOutro);
  });

  it('SVC030-MN-02: item de busca não contém phone/emailLogin (serializado)', async () => {
    const { items } = await searchServices({ categoryId }, anon);
    expect(JSON.stringify(items)).not.toMatch(/phone|emailLogin/i);
  });

  it('AC-030-1: providerDisplayName público (PF) mesmo para anônimo', async () => {
    const { items } = await searchServices({ categoryId }, anon);
    const visivel = items.find((i) => i.id === sVisivel);
    expect(visivel?.providerDisplayName).toBe('Prestador Ativo Busca Int');
  });

  it('SVC030-MN-03/L-002: pagina com take/skip e total coerente', async () => {
    const page1 = await searchServices({ categoryId, page: 1 }, anon);
    expect(page1.pageSize).toBeGreaterThan(0);
    expect(page1.total).toBe(2); // sVisivel + sOutro
    expect(page1.items.length).toBeLessThanOrEqual(page1.pageSize);
  });

  it('estado vazio: filtro sem correspondência devolve lista vazia sem erro', async () => {
    const { items, total } = await searchServices({ q: 'termo-que-nao-existe-jamais-xyz' }, anon);
    expect(items).toEqual([]);
    expect(total).toBe(0);
  });
});
