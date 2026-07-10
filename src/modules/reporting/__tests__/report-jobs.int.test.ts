import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `reportJobs` (T5 — E-001/E-005, AC-042-3/MP4). Requer
 * Postgres local (`supabase start`). Degrada com graça sem banco.
 *
 * Janela de teste fixa e distante (maio/2019) para não colidir com outros
 * seeds/testes que rodam contra o mesmo Postgres compartilhado (mesma
 * técnica de isolamento de `home-indicators.int.test.ts`, mas por período em
 * vez de delta — o filtro de janela É o que está sob teste aqui).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { reportJobs } = await import('../queries/report-jobs');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportJobsInt';
const CNPJ = '91000042000101';
const WINDOW_FROM = '2019-05-01';
const WINDOW_TO = '2019-05-31';
const OUTSIDE_DATE = new Date('2018-01-01T12:00:00Z');
const INSIDE_DATE = new Date('2019-05-15T12:00:00Z');

async function cleanup(): Promise<void> {
  await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('USP-042/T5 — reportJobs (integração)', () => {
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
        nomeFantasia: `${NAME_PREFIX}`,
        setor: 'Tecnologia',
        createdBy: author.id,
      },
      select: { id: true },
    });

    // Dentro da janela: 3 ACTIVE, 2 DRAFT, 1 EXPIRED.
    await prisma.job.createMany({
      data: [
        ...Array.from({ length: 3 }, (_, i) => ({
          companyId: company.id,
          authorPersonId: author.id,
          title: `${NAME_PREFIX} Active ${i + 1}`,
          status: 'ACTIVE' as const,
          createdAt: INSIDE_DATE,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          companyId: company.id,
          authorPersonId: author.id,
          title: `${NAME_PREFIX} Draft ${i + 1}`,
          status: 'DRAFT' as const,
          createdAt: INSIDE_DATE,
        })),
        {
          companyId: company.id,
          authorPersonId: author.id,
          title: `${NAME_PREFIX} Expired`,
          status: 'EXPIRED' as const,
          createdAt: INSIDE_DATE,
        },
      ],
    });

    // Fora da janela: 2 ACTIVE, não devem entrar na contagem.
    await prisma.job.createMany({
      data: Array.from({ length: 2 }, (_, i) => ({
        companyId: company.id,
        authorPersonId: author.id,
        title: `${NAME_PREFIX} Outside ${i + 1}`,
        status: 'ACTIVE' as const,
        createdAt: OUTSIDE_DATE,
      })),
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('AC-042-3/MP4: agrega por status SOMENTE dentro da janela — 3 ACTIVE, 2 DRAFT, 1 EXPIRED', async () => {
    const rows = await reportJobs({ from: WINDOW_FROM, to: WINDOW_TO });
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));

    expect(byStatus.ACTIVE).toBe(3);
    expect(byStatus.DRAFT).toBe(2);
    expect(byStatus.EXPIRED).toBe(1);
  });

  it('filtro status estreita o resultado a um único status', async () => {
    const rows = await reportJobs({ from: WINDOW_FROM, to: WINDOW_TO, status: 'DRAFT' });
    expect(rows).toEqual([{ status: 'DRAFT', count: 2 }]);
  });

  it('período sem dados (janela em 1999, antes de qualquer seed real) → [] sem lançar', async () => {
    await expect(reportJobs({ from: '1999-01-01', to: '1999-01-31' })).resolves.toEqual([]);
  });

  it('janela sem `from`/`to` (aberta) inclui os jobs semeados (dentro E fora) — filtro é opcional', async () => {
    const rows = await reportJobs({});
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBeGreaterThanOrEqual(8); // 6 dentro + 2 fora, no mínimo (banco compartilhado pode ter mais)
  });
});
