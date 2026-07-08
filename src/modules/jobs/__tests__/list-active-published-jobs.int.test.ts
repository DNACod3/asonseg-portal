import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração da query `listActivePublishedJobs` (USP-018 / T6 / INACT-06).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — só vagas `ACTIVE` entram na listagem de gestão de
 * conteúdo publicado; `INACTIVATED`/`DRAFT` ficam de fora. Cobre paginação
 * (`take`, `total`, `page`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listActivePublishedJobs, PUBLISHED_JOBS_PAGE_SIZE } = await import(
  '../queries/list-active-published-jobs'
);

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000240';
const SETOR = 'Publicados List Int';
const AREA_NAME = 'Publicados List Int Área';

skipIfNoDb('listActivePublishedJobs — integração (USP-018 / T6)', () => {
  let companyId = '';
  let authorId = '';
  let areaId = '';
  const jobIds: string[] = [];

  let jActive = '';
  let jInactivated = '';
  let jDraft = '';

  async function cleanup() {
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    jobIds.length = 0;
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.jobArea.deleteMany({ where: { name: AREA_NAME } });
    if (authorId) await prisma.person.deleteMany({ where: { id: authorId } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Autor Publicados List Int', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Publicados List Int Ltda',
        nomeFantasia: 'Publicados List Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const area = await prisma.jobArea.create({ data: { name: AREA_NAME } });
    areaId = area.id;

    const base = { companyId, authorPersonId: authorId, areaId };

    const active = await prisma.job.create({
      data: { ...base, title: 'Vaga Ativa Publicados Int', status: 'ACTIVE', publishedAt: new Date() },
      select: { id: true },
    });
    jActive = active.id;

    const inactivated = await prisma.job.create({
      data: { ...base, title: 'Vaga Inativada Publicados Int', status: 'INACTIVATED', publishedAt: new Date() },
      select: { id: true },
    });
    jInactivated = inactivated.id;

    const draft = await prisma.job.create({
      data: { ...base, title: 'Vaga Rascunho Publicados Int', status: 'DRAFT' },
      select: { id: true },
    });
    jDraft = draft.id;

    jobIds.push(jActive, jInactivated, jDraft);
  });

  afterAll(cleanup);

  it('retorna só a vaga ACTIVE, excluindo INACTIVATED e DRAFT', async () => {
    const res = await listActivePublishedJobs();
    const ids = res.items.map((i) => i.id);

    expect(ids).toContain(jActive);
    expect(ids).not.toContain(jInactivated);
    expect(ids).not.toContain(jDraft);
  });

  it('projeta companyName e areaName a partir das relações', async () => {
    const res = await listActivePublishedJobs();
    const row = res.items.find((i) => i.id === jActive);

    expect(row).toBeDefined();
    expect(row?.companyName).toBe('Publicados List Int');
    expect(row?.areaName).toBe(AREA_NAME);
  });

  it('pagina com take/total/page corretos', async () => {
    const res = await listActivePublishedJobs({ page: 1 });

    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(PUBLISHED_JOBS_PAGE_SIZE);
    expect(res.items.length).toBeLessThanOrEqual(PUBLISHED_JOBS_PAGE_SIZE);
    expect(res.total).toBeGreaterThanOrEqual(1); // ao menos a vaga ACTIVE do fixture
  });
});
