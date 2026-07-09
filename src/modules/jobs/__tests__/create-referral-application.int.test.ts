import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração de `createReferralApplication` (USP-037 / T4). Requer
 * Postgres local (`supabase start`) e `DATABASE_URL` no env. Helper tx-participant
 * — chamado dentro de uma transação própria do teste (mesmo contrato do chamador
 * real, `createReferral`). Cobre a criação vinculada (AC-037-5) e a garantia real
 * de unicidade REF-MN-01 (índice único parcial `uq_application_active`, exercitado
 * por corrida — lição L-010, não só o pré-check da app, que este helper nem tem).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { createReferralApplication } = await import('../actions/create-referral-application');
const { ApplyConflictError } = await import('../domain/apply-errors');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '05666777000188';
const SETOR = 'Create Referral Application Int';

skipIfNoDb('createReferralApplication — integração', () => {
  let authorId = '';
  let companyId = '';
  let jobId = '';
  let jobRaceId = '';
  let candidateId = '';
  let candidateRaceId = '';
  let referralId = '';
  let referralConflictId = '';
  let referralRaceAId = '';
  let referralRaceBId = '';

  async function cleanup() {
    const company = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (company) {
      await prisma.application.deleteMany({ where: { job: { companyId: company.id } } });
      await prisma.referral.deleteMany({ where: { job: { companyId: company.id } } });
      await prisma.job.deleteMany({ where: { companyId: company.id } });
      await prisma.company.delete({ where: { id: company.id } });
    }
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'CreateRefApp Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      const ids = stalePeople.map((p) => p.id);
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'CreateRefApp Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Create Referral Application Int Ltda',
        nomeFantasia: 'Create Referral Application Int',
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
      data: { companyId, authorPersonId: authorId, title: 'Vaga CreateRefApp Int', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobId = job.id;

    const jobRace = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga CreateRefApp Int Corrida', status: 'ACTIVE', validUntil: future },
      select: { id: true },
    });
    jobRaceId = jobRace.id;

    const candidate = await prisma.person.create({
      data: { fullName: 'CreateRefApp Int Candidato', status: 'ATIVO' },
      select: { id: true },
    });
    candidateId = candidate.id;

    const candidateRace = await prisma.person.create({
      data: { fullName: 'CreateRefApp Int Candidato Corrida', status: 'ATIVO' },
      select: { id: true },
    });
    candidateRaceId = candidateRace.id;

    const referral = await prisma.referral.create({
      data: { personId: candidateId, jobId, referrerPersonId: authorId },
      select: { id: true },
    });
    referralId = referral.id;

    const referralConflict = await prisma.referral.create({
      data: { personId: candidateId, jobId, referrerPersonId: authorId },
      select: { id: true },
    });
    referralConflictId = referralConflict.id;

    const referralRaceA = await prisma.referral.create({
      data: { personId: candidateRaceId, jobId: jobRaceId, referrerPersonId: authorId },
      select: { id: true },
    });
    referralRaceAId = referralRaceA.id;

    const referralRaceB = await prisma.referral.create({
      data: { personId: candidateRaceId, jobId: jobRaceId, referrerPersonId: authorId },
      select: { id: true },
    });
    referralRaceBId = referralRaceB.id;
  });

  afterAll(async () => {
    await cleanup();
    if (authorId) await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('@ac-037-5 cria Application vinculada (viaReferralId + viaEncaminhamento=true)', async () => {
    const result = await prisma.$transaction((tx) =>
      createReferralApplication(tx, { jobId, candidatePersonId: candidateId, referralId }),
    );
    expect(result.applicationId).toBeTruthy();

    const application = await prisma.application.findUnique({
      where: { id: result.applicationId },
      select: { jobId: true, candidatePersonId: true, viaReferralId: true, viaEncaminhamento: true, cancelledAt: true },
    });
    expect(application).toMatchObject({
      jobId,
      candidatePersonId: candidateId,
      viaReferralId: referralId,
      viaEncaminhamento: true,
      cancelledAt: null,
    });
  });

  it('@ref-mn-01 2ª chamada com candidatura ativa já existente (mesmo candidato/vaga) → ApplyConflictError', async () => {
    await expect(
      prisma.$transaction((tx) =>
        createReferralApplication(tx, { jobId, candidatePersonId: candidateId, referralId: referralConflictId }),
      ),
    ).rejects.toBeInstanceOf(ApplyConflictError);

    const activeCount = await prisma.application.count({
      where: { jobId, candidatePersonId: candidateId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });

  it('@ref-mn-01 corrida: duas chamadas concorrentes do mesmo candidato/vaga → 1 ok, 1 ApplyConflictError (índice único parcial real)', async () => {
    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        createReferralApplication(tx, { jobId: jobRaceId, candidatePersonId: candidateRaceId, referralId: referralRaceAId }),
      ),
      prisma.$transaction((tx) =>
        createReferralApplication(tx, { jobId: jobRaceId, candidatePersonId: candidateRaceId, referralId: referralRaceBId }),
      ),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ApplyConflictError);

    const activeCount = await prisma.application.count({
      where: { jobId: jobRaceId, candidatePersonId: candidateRaceId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });
});
