import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Integração de `resolveJobExpiryEmail` (USP-044 / T2 / AC-044-D3 / AC-044-D5).
 * Requer Postgres local (`supabase start`). Hidrata o payload leve
 * `{kind:'JOB_EXPIRY_D3', jobId}` num `EmailMessage` `job-expiry` completo,
 * carregando a vaga + o responsável ATIVO da Empresa com `emailLogin`.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { resolveJobExpiryEmail } = await import('../queries/resolve-job-expiry-email');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const CNPJ = '11444777000350';

skipIfNoDb('resolveJobExpiryEmail — integração (USP-044)', () => {
  let authorId = '';
  let companyId = '';

  async function cleanup() {
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.personCompanyGrant.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({
      data: { fullName: 'Autor Job Expiry Email Int', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;
  });

  beforeEach(async () => {
    await cleanup();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Job Expiry Email Int Ltda',
        nomeFantasia: 'Job Expiry Email Int',
        setor: 'Comércio',
        createdBy: authorId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyId = company.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('@ac-044-d3 vaga com responsável ATIVO com e-mail → EmailMessage job-expiry com `to` correto e dados mínimos', async () => {
    const responsible = await prisma.person.create({
      data: { fullName: 'Responsável Job Expiry Int', status: 'ATIVO', emailLogin: 'resp-job-expiry-int@example.com' },
      select: { id: true },
    });
    await prisma.personCompanyGrant.create({
      data: { personId: responsible.id, companyId, grantType: 'RESPONSIBLE', grantedBy: responsible.id, status: 'ACTIVE' },
    });
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Job Expiry Int', status: 'ACTIVE' },
      select: { id: true },
    });

    const message = await resolveJobExpiryEmail(job.id);

    expect(message).toMatchObject({
      to: 'resp-job-expiry-int@example.com',
      template: 'job-expiry',
      data: { empresaNome: 'Job Expiry Email Int', vagaTitulo: 'Vaga Job Expiry Int', diasRestantes: 3 },
    });

    await prisma.personCompanyGrant.deleteMany({ where: { personId: responsible.id } });
    await prisma.person.deleteMany({ where: { id: responsible.id } });
  });

  it('@ac-044-d5 vaga sem responsável com e-mail cadastrado → null (no-op gracioso)', async () => {
    const responsible = await prisma.person.create({
      data: { fullName: 'Responsável Sem Email Int', status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.personCompanyGrant.create({
      data: { personId: responsible.id, companyId, grantType: 'RESPONSIBLE', grantedBy: responsible.id, status: 'ACTIVE' },
    });
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Sem Resp Email Int', status: 'ACTIVE' },
      select: { id: true },
    });

    const message = await resolveJobExpiryEmail(job.id);

    expect(message).toBeNull();

    await prisma.personCompanyGrant.deleteMany({ where: { personId: responsible.id } });
    await prisma.person.deleteMany({ where: { id: responsible.id } });
  });

  it('@ac-044-d5 responsável REVOKED (não ATIVO) não conta → null (no-op gracioso)', async () => {
    const responsible = await prisma.person.create({
      data: { fullName: 'Responsável Revogado Int', status: 'ATIVO', emailLogin: 'resp-revogado-job-expiry-int@example.com' },
      select: { id: true },
    });
    await prisma.personCompanyGrant.create({
      data: {
        personId: responsible.id,
        companyId,
        grantType: 'RESPONSIBLE',
        grantedBy: responsible.id,
        status: 'ACTIVE',
        revokedAt: new Date(),
      },
    });
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Resp Revogado Int', status: 'ACTIVE' },
      select: { id: true },
    });

    const message = await resolveJobExpiryEmail(job.id);

    expect(message).toBeNull();

    await prisma.personCompanyGrant.deleteMany({ where: { personId: responsible.id } });
    await prisma.person.deleteMany({ where: { id: responsible.id } });
  });

  it('@ac-044-d5 jobId inexistente → null (no-op gracioso)', async () => {
    const message = await resolveJobExpiryEmail('00000000-0000-0000-0000-000000000000');

    expect(message).toBeNull();
  });
});
