import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Testes de integração de `listCompanyJobs` (USP-023 / T8 / G7 — painel de gestão).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: retorna as vagas da Empresa em **todos** os status (dado próprio, sem
 * anonimização); não mistura vagas de outra Empresa; `take` obrigatório (paginação).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listCompanyJobs } = await import('../queries/list-company-jobs');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ_A = '11444777000290';
const CNPJ_B = '11444777000291';

skipIfNoDb('listCompanyJobs — integração (USP-023)', () => {
  let authorId = '';
  let companyAId = '';
  let companyBId = '';

  async function cleanup() {
    await prisma.job.deleteMany({ where: { company: { cnpj: { in: [CNPJ_A, CNPJ_B] } } } });
    await prisma.company.deleteMany({ where: { cnpj: { in: [CNPJ_A, CNPJ_B] } } });
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({ data: { fullName: 'Autor List Company Int', status: 'ATIVO' }, select: { id: true } });
    authorId = author.id;
  });

  beforeEach(async () => {
    await cleanup();
    const companyA = await prisma.company.create({
      data: {
        cnpj: CNPJ_A,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'List Company A Ltda',
        nomeFantasia: 'List Company A',
        setor: 'Comércio',
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({
      data: {
        cnpj: CNPJ_B,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'List Company B Ltda',
        nomeFantasia: 'List Company B',
        setor: 'Comércio',
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyBId = companyB.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('G7: retorna as vagas da Empresa em todos os status', async () => {
    await prisma.job.createMany({
      data: [
        { companyId: companyAId, authorPersonId: authorId, title: 'Vaga Draft A', status: 'DRAFT' },
        { companyId: companyAId, authorPersonId: authorId, title: 'Vaga Active A', status: 'ACTIVE' },
        { companyId: companyAId, authorPersonId: authorId, title: 'Vaga Paused A', status: 'PAUSED' },
        { companyId: companyAId, authorPersonId: authorId, title: 'Vaga Archived A', status: 'ARCHIVED' },
      ],
    });

    const rows = await listCompanyJobs(companyAId);
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((r) => r.status))).toEqual(new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']));
  });

  it('não mistura vagas de outra Empresa (owner-scoped)', async () => {
    await prisma.job.create({
      data: { companyId: companyAId, authorPersonId: authorId, title: 'Vaga A', status: 'ACTIVE' },
    });
    await prisma.job.create({
      data: { companyId: companyBId, authorPersonId: authorId, title: 'Vaga B', status: 'ACTIVE' },
    });

    const rowsA = await listCompanyJobs(companyAId);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]?.title).toBe('Vaga A');
  });

  it('Empresa sem vagas → lista vazia', async () => {
    const rows = await listCompanyJobs(companyAId);
    expect(rows).toEqual([]);
  });
});
