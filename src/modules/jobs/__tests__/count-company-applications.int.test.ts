import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração de `countCompanyApplications` (USP-067 — T4 / PNL-04,
 * A-07). Requer Postgres local (`supabase start`).
 *
 * Cobre: empresa com candidaturas ativas e canceladas (`total`/`active`
 * corretos) e empresa sem nenhuma candidatura (`{ total: 0, active: 0 }`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { countCompanyApplications } = await import('../queries/count-company-applications');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000251';
const EMPTY_CNPJ = '11444777000252';
const SETOR = 'Contagem Candidaturas Int';

skipIfNoDb('countCompanyApplications — integração (T4)', () => {
  let companyId = '';
  let emptyCompanyId = '';
  let authorId = '';
  let jobId = '';

  async function cleanup() {
    await prisma.application.deleteMany({ where: { job: { company: { cnpj: { in: [CNPJ, EMPTY_CNPJ] } } } } });
    await prisma.job.deleteMany({ where: { company: { cnpj: { in: [CNPJ, EMPTY_CNPJ] } } } });
    await prisma.company.deleteMany({ where: { cnpj: { in: [CNPJ, EMPTY_CNPJ] } } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Count Company Applications Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Count Company Applications Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const [company, emptyCompany] = await Promise.all([
      prisma.company.create({
        data: {
          cnpj: CNPJ,
          razaoSocial: 'Count Company Applications Int Ltda',
          nomeFantasia: 'Count Company Applications Int',
          setor: SETOR,
          isVerified: true,
          createdBy: authorId,
        },
        select: { id: true },
      }),
      prisma.company.create({
        data: {
          cnpj: EMPTY_CNPJ,
          razaoSocial: 'Count Company Applications Int Empty Ltda',
          nomeFantasia: 'Count Company Applications Int Empty',
          setor: SETOR,
          isVerified: true,
          createdBy: authorId,
        },
        select: { id: true },
      }),
    ]);
    companyId = company.id;
    emptyCompanyId = emptyCompany.id;

    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Count Company Applications Int', status: 'ACTIVE' },
      select: { id: true },
    });
    jobId = job.id;

    const candidate = await prisma.person.create({
      data: { fullName: 'Count Company Applications Int Candidata', status: 'ATIVO' },
      select: { id: true },
    });

    await prisma.application.createMany({
      data: [
        { candidatePersonId: candidate.id, jobId, appliedAt: new Date('2026-07-01T10:00:00Z') },
        {
          candidatePersonId: candidate.id,
          jobId,
          appliedAt: new Date('2026-06-01T10:00:00Z'),
          cancelledAt: new Date('2026-06-05T10:00:00Z'),
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('total conta todas, active só as não canceladas', async () => {
    const counts = await countCompanyApplications(companyId);
    expect(counts).toEqual({ total: 2, active: 1 });
  });

  it('empresa sem vagas/candidaturas → { total: 0, active: 0 }', async () => {
    const counts = await countCompanyApplications(emptyCompanyId);
    expect(counts).toEqual({ total: 0, active: 0 });
  });
});
