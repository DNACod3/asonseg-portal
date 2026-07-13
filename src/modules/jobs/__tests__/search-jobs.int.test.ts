import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';
import { hojeSaoPaulo } from '@/shared/lib/time';

/**
 * Testes de integração da query de busca pública `searchJobs` (USP-021 / #170).
 * Requer Postgres local (`supabase start`) + extensão unaccent (migração USP-021).
 *
 * Real: Prisma/Postgres + índice funcional unaccent. Cobre o filtro on-read
 * (E-001/P-003/P-005), os filtros AND (E-002), a busca sem acento (E-003) e a
 * paginação (L-002). Para isolar das vagas de seed, os cenários estruturais filtram
 * pela área de teste; a busca textual usa termos únicos.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { searchJobs } = await import('../queries/search-jobs');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const AREA_NAME = 'Busca Int Área';
const REGION_A = 'Busca Int Região A';
const REGION_B = 'Busca Int Região B';
const CNPJ_VERIFIED = '11444777000200';
const CNPJ_UNVERIFIED = '11444777000201';
const SETOR = 'Comércio Int';

/**
 * `days` a partir do dia-calendário de São Paulo (não do relógio local do processo).
 * `hojeSaoPaulo()` já normaliza "hoje" para meia-noite UTC do dia-calendário em SP; a
 * partir daí a aritmética usa `setUTCDate` para permanecer imune ao fuso do runner —
 * evita a janela 21h-00h BRT em que dia-calendário local e UTC divergem (L-006).
 */
function dateOffset(days: number): Date {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const anon: CurrentPerson | null = null;

skipIfNoDb('searchJobs — integração', () => {
  let areaId = '';
  let regionAId = '';
  let regionBId = '';
  let verifiedCompanyId = '';
  let unverifiedCompanyId = '';
  let authorId = '';

  // Vagas-fixture (ids capturados p/ asserção por presença).
  let jVisivel = ''; // ACTIVE, verificada, válida, área/Região A, CLT, faixa 2000-3000, título com acento
  let jExpirada = ''; // ACTIVE persistido mas validUntil no passado (P-003)
  let jModeracao = ''; // IN_MODERATION (E-001)
  let jNaoVerificada = ''; // ACTIVE válida mas Empresa não verificada (P-005)
  let jOutra = ''; // ACTIVE verificada, Região B, PJ (p/ filtros AND)
  let jInativada = ''; // INACTIVATED pelo coordenador (USP-018 / INACT-MN-04)

  async function cleanup() {
    await prisma.job.deleteMany({
      where: { company: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } } },
    });
    await prisma.company.deleteMany({
      where: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } },
    });
  }

  beforeAll(async () => {
    await cleanup();

    const area = await prisma.jobArea.upsert({
      where: { name: AREA_NAME },
      update: {},
      create: { name: AREA_NAME },
      select: { id: true },
    });
    areaId = area.id;

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

    const author = await prisma.person.create({
      data: { fullName: 'Autor Busca Int', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const verified = await prisma.company.create({
      data: {
        cnpj: CNPJ_VERIFIED,
        razaoSocial: 'Verificada Int Ltda',
        nomeFantasia: 'Verificada Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    verifiedCompanyId = verified.id;

    const unverified = await prisma.company.create({
      data: {
        cnpj: CNPJ_UNVERIFIED,
        razaoSocial: 'Não Verificada Int Ltda',
        nomeFantasia: 'Não Verificada Int',
        setor: SETOR,
        isVerified: false,
        createdBy: authorId,
      },
      select: { id: true },
    });
    unverifiedCompanyId = unverified.id;

    const base = {
      authorPersonId: authorId,
      areaId,
      description: 'Descrição da vaga de teste.',
      requirements: 'Requisitos de teste.',
      workRegime: 'Presencial',
    };

    const [v, e, m, nv, o, ina] = await Promise.all([
      prisma.job.create({
        data: {
          ...base,
          companyId: verifiedCompanyId,
          regionId: regionAId,
          title: 'Atendente de Padária Central', // acento proposital (E-003)
          contractType: 'CLT',
          salaryMin: 2000,
          salaryMax: 3000,
          salaryVisible: true,
          status: 'ACTIVE',
          publishedAt: dateOffset(-1),
          validUntil: dateOffset(30),
        },
        select: { id: true },
      }),
      prisma.job.create({
        data: {
          ...base,
          companyId: verifiedCompanyId,
          regionId: regionAId,
          title: 'Vaga Expirada Int',
          contractType: 'CLT',
          status: 'ACTIVE', // status persistido ACTIVE...
          publishedAt: dateOffset(-10),
          validUntil: dateOffset(-1), // ...mas validade vencida (P-003/D-004)
        },
        select: { id: true },
      }),
      prisma.job.create({
        data: {
          ...base,
          companyId: verifiedCompanyId,
          regionId: regionAId,
          title: 'Vaga Em Moderação Int',
          contractType: 'CLT',
          status: 'IN_MODERATION',
          validUntil: dateOffset(30),
        },
        select: { id: true },
      }),
      prisma.job.create({
        data: {
          ...base,
          companyId: unverifiedCompanyId, // Empresa não verificada (P-005)
          regionId: regionAId,
          title: 'Vaga Empresa Não Verificada Int',
          contractType: 'CLT',
          status: 'ACTIVE',
          publishedAt: dateOffset(-1),
          validUntil: dateOffset(30),
        },
        select: { id: true },
      }),
      prisma.job.create({
        data: {
          ...base,
          companyId: verifiedCompanyId,
          regionId: regionBId,
          title: 'Outra Vaga Int',
          contractType: 'PJ',
          salaryMin: 5000,
          salaryMax: 7000,
          salaryVisible: true,
          status: 'ACTIVE',
          publishedAt: dateOffset(-2),
          validUntil: dateOffset(30),
        },
        select: { id: true },
      }),
      prisma.job.create({
        data: {
          ...base,
          companyId: verifiedCompanyId,
          regionId: regionAId,
          title: 'Vaga Inativada Int',
          contractType: 'CLT',
          status: 'INACTIVATED', // USP-018 — inativada pelo coordenador
          publishedAt: dateOffset(-1),
          validUntil: dateOffset(30),
        },
        select: { id: true },
      }),
    ]);
    jVisivel = v.id;
    jExpirada = e.id;
    jModeracao = m.id;
    jNaoVerificada = nv.id;
    jOutra = o.id;
    jInativada = ina.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
    // HYG-09/HYG-11: remove a taxonomia própria deste arquivo (nunca a canônica do
    // seed) — evita poluir os dropdowns públicos (PUB-6). Jobs já foram removidos
    // acima (cleanup()), então não há FK pendente.
    await prisma.jobArea.deleteMany({ where: { name: AREA_NAME } });
    await prisma.region.deleteMany({ where: { name: { in: [REGION_A, REGION_B] } } });
    expect(await prisma.jobArea.count({ where: { name: AREA_NAME } })).toBe(0);
    expect(await prisma.region.count({ where: { name: { in: [REGION_A, REGION_B] } } })).toBe(0);
  });

  it('@e-001 @p-003 @p-005 só lista ACTIVE + não-expirada + Empresa verificada', async () => {
    const { items } = await searchJobs({ areaId }, anon);
    const ids = items.map((i) => i.id);
    expect(ids).toContain(jVisivel);
    expect(ids).toContain(jOutra);
    // Excluídas pelo on-read:
    expect(ids).not.toContain(jExpirada); // validade vencida apesar de status ACTIVE (P-003)
    expect(ids).not.toContain(jModeracao); // não-ACTIVE (E-001)
    expect(ids).not.toContain(jNaoVerificada); // Empresa não verificada (P-005)
    expect(ids).not.toContain(jInativada); // INACTIVATED (USP-018 / INACT-MN-04)
  });

  it('@usp-018 @inact-mn-04 vaga INACTIVATED some da busca pública e não afeta o total', async () => {
    const { items, total } = await searchJobs({ areaId }, anon);
    expect(items.map((i) => i.id)).not.toContain(jInativada);
    expect(total).toBe(2); // só jVisivel + jOutra — a inativada nunca conta
  });

  it('@e-002 combina filtros em AND (área + região + contrato)', async () => {
    const { items } = await searchJobs(
      { areaId, regionId: regionBId, contractType: 'PJ' },
      anon,
    );
    const ids = items.map((i) => i.id);
    expect(ids).toEqual([jOutra]); // só a vaga da Região B / PJ
  });

  it('@e-002 filtro de faixa salarial por overlap', async () => {
    // Faixa [4000, 8000] cruza a vaga "Outra" (5000-7000), não a "Visível" (2000-3000).
    const { items } = await searchJobs({ areaId, salaryMin: 4000, salaryMax: 8000 }, anon);
    const ids = items.map((i) => i.id);
    expect(ids).toContain(jOutra);
    expect(ids).not.toContain(jVisivel);
  });

  it('@e-003 busca textual é case-insensitive e sem acento', async () => {
    for (const term of ['padaria central', 'PADÁRIA CENTRAL', 'padária']) {
      const { items } = await searchJobs({ q: term }, anon);
      expect(items.map((i) => i.id)).toContain(jVisivel);
    }
  });

  it('@e-004 @p-001 anônimo recebe a Empresa anonimizada por setor', async () => {
    const { items } = await searchJobs({ areaId }, anon);
    const visivel = items.find((i) => i.id === jVisivel);
    expect(visivel?.company.isAnonymized).toBe(true);
    expect(visivel?.company.displayName).toBe(`Empresa do setor de ${SETOR}`);
    expect(JSON.stringify(items)).not.toContain('Verificada Int');
  });

  it('@l-002 pagina com take/skip e total coerente', async () => {
    const page1 = await searchJobs({ areaId, page: 1 }, anon);
    expect(page1.pageSize).toBeGreaterThan(0);
    expect(page1.total).toBe(2); // jVisivel + jOutra
    expect(page1.items.length).toBeLessThanOrEqual(page1.pageSize);
  });
});
