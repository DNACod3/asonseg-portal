import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';

/**
 * Testes de integração de `listPersonApplications` (USP-039 / T2 — dimensão
 * "candidaturas" do painel consolidado). Requer Postgres local (`supabase
 * start`). Exercita o `where: { candidatePersonId }` real (lição AD-021 —
 * `where` de escopo nunca só mockado).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listPersonApplications } = await import('../queries/list-person-applications');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000250';
const SETOR = 'Candidaturas Consolidado Int';

skipIfNoDb('listPersonApplications — integração', () => {
  let companyId = '';
  let authorId = '';
  let jobId = '';
  let targetPersonId = '';
  let otherPersonId = '';
  let emptyPersonId = '';

  async function cleanup() {
    await prisma.application.deleteMany({ where: { job: { company: { cnpj: CNPJ } } } });
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.personCompanyGrant.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Consolidado Applications Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Consolidado Applications Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Consolidado Applications Int Ltda',
        nomeFantasia: 'Consolidado Applications Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Consolidado Applications Int', status: 'ACTIVE' },
      select: { id: true },
    });
    jobId = job.id;

    const [target, other, empty] = await Promise.all([
      prisma.person.create({
        data: { fullName: 'Consolidado Applications Int Alvo', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Applications Int Outro', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'Consolidado Applications Int Vazio', status: 'ATIVO' },
        select: { id: true },
      }),
    ]);
    targetPersonId = target.id;
    otherPersonId = other.id;
    emptyPersonId = empty.id;

    await prisma.application.createMany({
      data: [
        { candidatePersonId: targetPersonId, jobId, appliedAt: new Date('2026-07-01T10:00:00Z') },
        {
          candidatePersonId: targetPersonId,
          jobId,
          appliedAt: new Date('2026-06-01T10:00:00Z'),
          cancelledAt: new Date('2026-06-05T10:00:00Z'),
        },
        // candidatura de outra Pessoa — não deve aparecer no escopo do alvo.
        { candidatePersonId: otherPersonId, jobId, appliedAt: new Date('2026-07-02T10:00:00Z') },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  it('retorna candidatura ativa e histórica do alvo com `active` correto', async () => {
    const rows = await listPersonApplications(targetPersonId);
    expect(rows).toHaveLength(2);

    const active = rows.find((r) => r.cancelledAt === null);
    const historical = rows.find((r) => r.cancelledAt !== null);
    expect(active).toBeDefined();
    expect(historical).toBeDefined();
    expect(active?.active).toBe(true);
    expect(historical?.active).toBe(false);
    expect(active?.jobTitle).toBe('Vaga Consolidado Applications Int');
    expect(active?.companyName).toBe('Consolidado Applications Int');
    expect(active?.jobId).toBe(jobId);
  });

  it('ordena a candidatura ativa antes da histórica (NULLS FIRST)', async () => {
    const rows = await listPersonApplications(targetPersonId);
    expect(rows).toHaveLength(2);

    // Ordenação documentada: ativas primeiro (cancelledAt asc, null primeiro),
    // depois appliedAt desc. Asserção posicional — pega regressão para NULLS LAST.
    expect(rows[0]?.active).toBe(true);
    expect(rows[0]?.cancelledAt).toBeNull();
    expect(rows[1]?.active).toBe(false);
    expect(rows[1]?.cancelledAt).not.toBeNull();
  });

  it('escopo candidatePersonId: candidatura de outra Pessoa não aparece', async () => {
    const rows = await listPersonApplications(targetPersonId);
    expect(rows.every((r) => r.jobId === jobId)).toBe(true);
    expect(rows).toHaveLength(2);

    const otherRows = await listPersonApplications(otherPersonId);
    expect(otherRows).toHaveLength(1);
    expect(otherRows[0]?.active).toBe(true);
  });

  it('Pessoa sem candidatura → []', async () => {
    const rows = await listPersonApplications(emptyPersonId);
    expect(rows).toEqual([]);
  });

  it('respeita `take` (paginação defensiva)', async () => {
    const manyPersonId = crypto.randomUUID();
    await prisma.person.create({
      data: { id: manyPersonId, fullName: 'Consolidado Applications Int Muitas', status: 'ATIVO' },
    });

    await prisma.application.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        candidatePersonId: manyPersonId,
        jobId,
        appliedAt: new Date(Date.UTC(2026, 0, 1 + i)),
        cancelledAt: new Date(Date.UTC(2026, 0, 2 + i)),
      })),
    });

    const rows = await listPersonApplications(manyPersonId);
    expect(rows.length).toBeLessThanOrEqual(50);

    await prisma.application.deleteMany({ where: { candidatePersonId: manyPersonId } });
    await prisma.person.deleteMany({ where: { id: manyPersonId } });
  });
});
