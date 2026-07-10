import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `getHomeIndicators` (USP-041 / T2 — E-001 / REL41-MN-01).
 * Requer Postgres local (`supabase start` + `.env.local`). Degrada com graça
 * sem banco.
 *
 * O banco de integração é compartilhado com outras suítes/seed — por isso as
 * asserções usam **delta** (antes/depois da semeadura desta suíte), não
 * contagens absolutas (mesma técnica de `apply-to-job.int.test.ts` para o
 * outbox). O baseline "0" do AC é coberto pela metade não-elegível da
 * semeadura: os 2 Jobs DRAFT / 1 CandidateProfile DRAFT / 1 Company não
 * verificada contribuem `0` para o delta — provando que `count()` sobre um
 * conjunto sem match nunca lança e nunca soma além do que deveria.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getHomeIndicators } = await import('../queries/home-indicators');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ReportingHomeInt';
const CNPJ_JOBS = '91000041000101';
const CNPJ_VERIFIED = ['91000041000102', '91000041000103', '91000041000104'];
const CNPJ_UNVERIFIED = '91000041000105';
const ALL_CNPJS = [CNPJ_JOBS, ...CNPJ_VERIFIED, CNPJ_UNVERIFIED];

async function cleanup(): Promise<void> {
  await prisma.job.deleteMany({ where: { company: { cnpj: { in: ALL_CNPJS } } } });
  await prisma.company.deleteMany({ where: { cnpj: { in: ALL_CNPJS } } });
  await prisma.candidateProfile.deleteMany({ where: { person: { fullName: { startsWith: NAME_PREFIX } } } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('USP-041/T2 — getHomeIndicators (integração)', () => {
  let baseline: Awaited<ReturnType<typeof getHomeIndicators>>;

  beforeAll(async () => {
    await cleanup();

    // Baseline capturado ANTES de semear os dados desta suíte (delta-based).
    baseline = await getHomeIndicators();

    const author = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Author`, status: 'ATIVO' },
      select: { id: true },
    });

    const jobsCompany = await prisma.company.create({
      data: {
        cnpj: CNPJ_JOBS,
        razaoSocial: `${NAME_PREFIX} Jobs Ltda`,
        nomeFantasia: `${NAME_PREFIX} Jobs`,
        setor: 'Tecnologia',
        isVerified: false,
        createdBy: author.id,
      },
      select: { id: true },
    });

    // 6 vagas ACTIVE (contam) + 2 DRAFT (não contam) — MP4.
    await prisma.job.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        companyId: jobsCompany.id,
        authorPersonId: author.id,
        title: `${NAME_PREFIX} Vaga ACTIVE ${i + 1}`,
        status: 'ACTIVE' as const,
      })),
    });
    await prisma.job.createMany({
      data: Array.from({ length: 2 }, (_, i) => ({
        companyId: jobsCompany.id,
        authorPersonId: author.id,
        title: `${NAME_PREFIX} Vaga DRAFT ${i + 1}`,
        status: 'DRAFT' as const,
      })),
    });

    // 7 candidatos com perfil ACTIVE (contam) + 1 DRAFT (não conta) — MP1.
    for (let i = 0; i < 7; i += 1) {
      const p = await prisma.person.create({
        data: { fullName: `${NAME_PREFIX} Candidate Active ${i + 1}`, status: 'ATIVO' },
        select: { id: true },
      });
      await prisma.candidateProfile.create({
        data: { personId: p.id, publicationStatus: 'ACTIVE' },
      });
    }
    const draftCandidate = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Candidate Draft`, status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.candidateProfile.create({
      data: { personId: draftCandidate.id, publicationStatus: 'DRAFT' },
    });

    // 3 empresas verificadas (contam) + 1 não verificada (não conta) — MP2.
    for (const cnpj of CNPJ_VERIFIED) {
      await prisma.company.create({
        data: {
          cnpj,
          razaoSocial: `${NAME_PREFIX} Verificada ${cnpj}`,
          nomeFantasia: `${NAME_PREFIX} Verificada`,
          setor: 'Serviços',
          isVerified: true,
          createdBy: author.id,
        },
      });
    }
    await prisma.company.create({
      data: {
        cnpj: CNPJ_UNVERIFIED,
        razaoSocial: `${NAME_PREFIX} Não Verificada`,
        nomeFantasia: `${NAME_PREFIX} Não Verificada`,
        setor: 'Serviços',
        isVerified: false,
        createdBy: author.id,
      },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('E-001: soma exatamente os 6 jobs ACTIVE / 7 candidatos ACTIVE / 3 empresas verificadas semeados (DRAFT/não-verificada não entram)', async () => {
    const after = await getHomeIndicators();

    expect(after.activeJobs - baseline.activeJobs).toBe(6);
    expect(after.activeCandidates - baseline.activeCandidates).toBe(7);
    expect(after.verifiedCompanies - baseline.verifiedCompanies).toBe(3);
  });

  it('baseline: count() sobre um conjunto sem match nunca lança e retorna inteiros >= 0', async () => {
    await expect(getHomeIndicators()).resolves.toMatchObject({
      activeJobs: expect.any(Number),
      activeCandidates: expect.any(Number),
      verifiedCompanies: expect.any(Number),
    });
    const result = await getHomeIndicators();
    expect(result.activeJobs).toBeGreaterThanOrEqual(0);
    expect(result.activeCandidates).toBeGreaterThanOrEqual(0);
    expect(result.verifiedCompanies).toBeGreaterThanOrEqual(0);
  });

  it('REL41-MN-01 (negativo): o retorno é só 3 inteiros — sem nome/CNPJ/id de pessoa ou empresa no payload', async () => {
    const result = await getHomeIndicators();

    // Barreira estrutural: exatamente estas 3 chaves, todas numéricas. Uma
    // mutação que trocasse `count` por `findMany({ select: { fullName: true } } )`
    // quebraria esta forma (chave extra / tipo não-numérico).
    expect(Object.keys(result).sort()).toEqual(['activeCandidates', 'activeJobs', 'verifiedCompanies']);
    expect(typeof result.activeJobs).toBe('number');
    expect(typeof result.activeCandidates).toBe('number');
    expect(typeof result.verifiedCompanies).toBe('number');

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(NAME_PREFIX);
    expect(serialized).not.toContain(CNPJ_JOBS);
    for (const cnpj of CNPJ_VERIFIED) {
      expect(serialized).not.toContain(cnpj);
    }
  });
});
