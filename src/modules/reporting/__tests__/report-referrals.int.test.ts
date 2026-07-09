import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `reportReferrals` (T8 — E-001/E-004, REL42-MN-04,
 * AC-042-6/MP8/MP9). Requer Postgres local. Janela de teste fixa e distante
 * (agosto/2019) — mesma técnica de isolamento das suítes anteriores.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { reportReferrals } = await import('../queries/report-referrals');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportRefInt';
const CNPJ = '91000042000103';
const WINDOW_FROM = '2019-08-01';
const WINDOW_TO = '2019-08-31';
const OUTSIDE_DATE = new Date('2018-01-01T12:00:00Z');
const INSIDE_DATE = new Date('2019-08-15T12:00:00Z');

async function cleanup(): Promise<void> {
  await prisma.referral.deleteMany({ where: { job: { company: { cnpj: CNPJ } } } });
  await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('USP-042/T8 — reportReferrals (integração)', () => {
  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Author`, status: 'ATIVO' },
      select: { id: true },
    });
    const referrer = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Referrer`, status: 'ATIVO' },
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
      data: { companyId: company.id, authorPersonId: author.id, title: `${NAME_PREFIX} Vaga`, status: 'ACTIVE' },
      select: { id: true },
    });

    async function makeReferral(result: 'HIRED' | 'NOT_SELECTED' | null, createdAt: Date, tag: string) {
      const referred = await prisma.person.create({
        data: { fullName: `${NAME_PREFIX} Referred ${tag}`, status: 'ATIVO' },
        select: { id: true },
      });
      await prisma.referral.create({
        data: {
          personId: referred.id,
          jobId: job.id,
          referrerPersonId: referrer.id,
          result,
          createdAt,
        },
      });
    }

    // Dentro da janela: HIRED x2, NOT_SELECTED x1, sem resultado x2 (total 5).
    await makeReferral('HIRED', INSIDE_DATE, 'hired-1');
    await makeReferral('HIRED', INSIDE_DATE, 'hired-2');
    await makeReferral('NOT_SELECTED', INSIDE_DATE, 'not-selected-1');
    await makeReferral(null, INSIDE_DATE, 'no-result-1');
    await makeReferral(null, INSIDE_DATE, 'no-result-2');

    // Fora da janela: 1 HIRED, não deve contar.
    await makeReferral('HIRED', OUTSIDE_DATE, 'outside');
  });

  afterAll(async () => {
    await cleanup();
  });

  it('AC-042-6/MP8: totalCreated = 5 (SOMENTE dentro da janela)', async () => {
    const report = await reportReferrals({ from: WINDOW_FROM, to: WINDOW_TO });
    expect(report.totalCreated).toBe(5);
  });

  it('REL42-MN-04 (negativo): outcome carrega successRate E noResultRate juntas — 2/3 e 2/5', async () => {
    const report = await reportReferrals({ from: WINDOW_FROM, to: WINDOW_TO });

    expect(report.outcome.total).toBe(5);
    expect(report.outcome.withResult).toBe(3);
    expect(report.outcome.withoutResult).toBe(2);
    expect(report.outcome.successRate).toBeCloseTo(2 / 3, 10);
    expect(report.outcome.noResultRate).toBeCloseTo(2 / 5, 10);
    // Mutação que removesse noResultRate do retorno quebraria esta asserção.
    expect(report.outcome).toHaveProperty('noResultRate');
  });

  it('período sem encaminhamento (1999) → totalCreated=0, taxas null ("—")', async () => {
    const report = await reportReferrals({ from: '1999-01-01', to: '1999-01-31' });
    expect(report.totalCreated).toBe(0);
    expect(report.outcome.successRate).toBeNull();
    expect(report.outcome.noResultRate).toBeNull();
  });
});
