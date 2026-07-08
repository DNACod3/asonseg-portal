import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração de `getMyActiveApplication` (USP-025 / CAN-025-06).
 * Requer Postgres local (`supabase start`) e `DATABASE_URL` no env.
 *
 * Esta query decide, na página pública de detalhe da vaga, entre o CTA
 * "Candidatar-se" (USP-025) e "Cancelar candidatura" (USP-026). O ramo
 * autenticado que a consome só é alcançável pelo E2E autenticado (deferido),
 * então o filtro `cancelledAt: null` — que distingue candidatura ativa de
 * cancelada — precisa de cobertura autoritativa aqui. Matriz:
 * ativa → `{ id }` · cancelada → `null` · inexistente → `null` · escopo por
 * `candidatePersonId` (candidatura de terceiro não vaza).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getMyActiveApplication } = await import('../queries/get-my-application');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05777888000144';
const SETOR = 'Get My Application Int';

skipIfNoDb('getMyActiveApplication — integração', () => {
  let authorId = '';
  let companyId = '';
  let jobId = '';
  let candidateActiveId = '';
  let candidateCancelledId = '';
  let candidateNoneId = '';
  let activeApplicationId = '';

  async function cleanup() {
    const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (company) {
      await prisma.application.deleteMany({ where: { job: { companyId: company.id } } });
      await prisma.job.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });
    }
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'GetMyApp Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      const ids = stalePeople.map((p) => p.id);
      await prisma.candidateProfile.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'GetMyApp Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Get My Application Int Ltda',
        nomeFantasia: 'Get My Application Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const future = new Date();
    future.setDate(future.getDate() + 30);
    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga GetMyApp Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobId = job.id;

    async function candidate(fullName: string): Promise<string> {
      const p = await prisma.person.create({
        data: { fullName, status: 'ATIVO' },
        select: { id: true },
      });
      await prisma.candidateProfile.create({ data: { personId: p.id, publicationStatus: 'ACTIVE' } });
      return p.id;
    }

    candidateActiveId = await candidate('GetMyApp Int Ativo');
    candidateCancelledId = await candidate('GetMyApp Int Cancelado');
    candidateNoneId = await candidate('GetMyApp Int SemCandidatura');

    const active = await prisma.application.create({
      data: { jobId, candidatePersonId: candidateActiveId, viaEncaminhamento: false },
      select: { id: true },
    });
    activeApplicationId = active.id;

    await prisma.application.create({
      data: { jobId, candidatePersonId: candidateCancelledId, viaEncaminhamento: false, cancelledAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanup();
    if (authorId) await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('candidatura ativa → retorna { id } da candidatura', async () => {
    const res = await getMyActiveApplication(jobId, candidateActiveId);
    expect(res).toEqual({ id: activeApplicationId });
  });

  it('candidatura cancelada → null (filtro cancelledAt: null)', async () => {
    const res = await getMyActiveApplication(jobId, candidateCancelledId);
    expect(res).toBeNull();
  });

  it('sem candidatura → null', async () => {
    const res = await getMyActiveApplication(jobId, candidateNoneId);
    expect(res).toBeNull();
  });

  it('escopo por candidato: não vaza candidatura ativa de terceiro', async () => {
    // candidateNoneId nunca se candidatou; a vaga tem candidatura ativa de outro
    // candidato, mas a query é escopada por candidatePersonId.
    const res = await getMyActiveApplication(jobId, candidateNoneId);
    expect(res).toBeNull();
  });
});
