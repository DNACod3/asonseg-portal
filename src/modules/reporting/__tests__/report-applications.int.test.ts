import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `reportApplications` (T6 — E-001, AC-042-4/MP6). Requer
 * Postgres local. Janela de teste fixa e distante (junho/2019) — mesma
 * técnica de isolamento de `report-jobs.int.test.ts`.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { reportApplications } = await import('../queries/report-applications');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportAppsInt';
const CNPJ = '91000042000102';
const WINDOW_FROM = '2019-06-01';
const WINDOW_TO = '2019-06-30';
const OUTSIDE_DATE = new Date('2018-01-01T12:00:00Z');
const INSIDE_DATE = new Date('2019-06-15T12:00:00Z');

async function cleanup(): Promise<void> {
  await prisma.application.deleteMany({ where: { job: { company: { cnpj: CNPJ } } } });
  await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('USP-042/T6 — reportApplications (integração)', () => {
  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Author`, status: 'ATIVO' },
      select: { id: true },
    });
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: `${NAME_PREFIX} Ltda`,
        nomeFantasia: NAME_PREFIX,
        setor: 'Tecnologia',
        createdBy: author.id,
      },
      select: { id: true },
    });
    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        authorPersonId: author.id,
        title: `${NAME_PREFIX} Vaga`,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    // Dentro da janela: 2 candidaturas ATIVAS + 2 CANCELADAS (todas "realizadas").
    for (let i = 0; i < 4; i += 1) {
      const candidate = await prisma.person.create({
        data: { fullName: `${NAME_PREFIX} Candidate Inside ${i + 1}`, status: 'ATIVO' },
        select: { id: true },
      });
      await prisma.application.create({
        data: {
          candidatePersonId: candidate.id,
          jobId: job.id,
          appliedAt: INSIDE_DATE,
          cancelledAt: i < 2 ? null : new Date('2019-06-20T12:00:00Z'),
        },
      });
    }

    // Fora da janela: 1 candidatura, não deve contar.
    const outsideCandidate = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Candidate Outside`, status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.application.create({
      data: { candidatePersonId: outsideCandidate.id, jobId: job.id, appliedAt: OUTSIDE_DATE },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('AC-042-4/MP6: total = TODAS as candidaturas criadas na janela, ativas E canceladas (4), fora não conta', async () => {
    const rows = await reportApplications({ from: WINDOW_FROM, to: WINDOW_TO });
    expect(rows).toEqual([{ total: 4 }]);
  });

  it('período sem dados (1999) → total 0', async () => {
    const rows = await reportApplications({ from: '1999-01-01', to: '1999-01-31' });
    expect(rows).toEqual([{ total: 0 }]);
  });
});
