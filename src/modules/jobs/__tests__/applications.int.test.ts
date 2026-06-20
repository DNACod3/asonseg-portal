import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração da tabela `applications` (USP-022 / #276 / AD-012). Requer
 * Postgres local (`supabase start`). A USP-022 só lê desta tabela: o contador do
 * detalhe (E-003) conta candidaturas ATIVAS (`cancelledAt = null`) por vaga; uma
 * candidatura cancelada (`cancelledAt != null`) NÃO entra na contagem (P-001 depende
 * da contagem correta). A escrita (candidatar/cancelar) é da USP-025.
 */

const { prisma } = await import('@/shared/lib/prisma');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000299';
const SETOR = 'Applications Int';

skipIfNoDb('applications — contagem on-read', () => {
  let authorId = '';
  let companyId = '';
  let jobId = '';
  const candidateIds: string[] = [];

  async function cleanup() {
    await prisma.application.deleteMany({ where: { job: { company: { cnpj: CNPJ } } } });
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Applications Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Applications Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Applications Int Ltda',
        nomeFantasia: 'Applications Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const job = await prisma.job.create({
      data: {
        companyId,
        authorPersonId: authorId,
        title: 'Vaga Applications Int',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    jobId = job.id;

    // 4 pessoas candidatas demo.
    for (let i = 0; i < 4; i += 1) {
      const c = await prisma.person.create({
        data: { fullName: `Applications Int Candidato ${i + 1}`, status: 'ATIVO' },
        select: { id: true },
      });
      candidateIds.push(c.id);
    }

    // 3 candidaturas ativas + 1 cancelada na MESMA vaga.
    await prisma.application.createMany({
      data: [
        { candidatoId: candidateIds[0]!, jobId, cancelledAt: null },
        { candidatoId: candidateIds[1]!, jobId, cancelledAt: null },
        { candidatoId: candidateIds[2]!, jobId, cancelledAt: null },
        { candidatoId: candidateIds[3]!, jobId, cancelledAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('@e-003 conta candidaturas ativas por vaga ignorando as canceladas', async () => {
    const ativas = await prisma.application.count({ where: { jobId, cancelledAt: null } });
    expect(ativas).toBe(3);

    const total = await prisma.application.count({ where: { jobId } });
    expect(total).toBe(4); // a cancelada existe, mas não conta para o contador
  });
});
