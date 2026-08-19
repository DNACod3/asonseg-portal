import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração de `listRecentReferrals` (USP-067 — T7 / PNL-05/06/07,
 * A-10). Requer Postgres local (`supabase start`).
 *
 * Feed **org-wide** (não escopado a uma Pessoa) — usa `createdAt` no futuro
 * distante para garantir que os encaminhamentos de fixture sejam sempre os
 * mais recentes do banco, independente de outros dados/testes coexistindo.
 *
 * Cobre: `take 5`, `orderBy createdAt desc`, `result: null` = "aguardando".
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listRecentReferrals } = await import('../queries/list-recent-referrals');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000261';
const SETOR = 'Recent Referrals Int';
// Futuro distante — garante que estas fixtures sejam sempre as mais recentes
// do banco (`orderBy createdAt desc`), mesmo com outros dados coexistindo.
const BASE_DATE = new Date('2099-01-01T00:00:00Z');

skipIfNoDb('listRecentReferrals — integração (T7)', () => {
  let companyId = '';
  let authorId = '';
  let referrerId = '';
  let jobId = '';
  let referredPersonId = '';

  async function cleanup() {
    await prisma.referral.deleteMany({ where: { job: { company: { cnpj: CNPJ } } } });
    await prisma.job.deleteMany({ where: { company: { cnpj: CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: CNPJ } });
    await prisma.person.deleteMany({ where: { fullName: { startsWith: 'Recent Referrals Int' } } });
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Recent Referrals Int Autor', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const referrer = await prisma.person.create({
      data: { fullName: 'Recent Referrals Int Encaminhador', status: 'ATIVO' },
      select: { id: true },
    });
    referrerId = referrer.id;

    const referred = await prisma.person.create({
      data: { fullName: 'Recent Referrals Int Encaminhado', status: 'ATIVO' },
      select: { id: true },
    });
    referredPersonId = referred.id;

    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        razaoSocial: 'Recent Referrals Int Ltda',
        nomeFantasia: 'Recent Referrals Int',
        setor: SETOR,
        isVerified: true,
        createdBy: authorId,
      },
      select: { id: true },
    });
    companyId = company.id;

    const job = await prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Recent Referrals Int', status: 'ACTIVE' },
      select: { id: true },
    });
    jobId = job.id;

    // 6 encaminhamentos com datas crescentes — só as 5 mais recentes devem voltar.
    await prisma.referral.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        personId: referredPersonId,
        jobId,
        referrerPersonId: referrerId,
        createdAt: new Date(BASE_DATE.getTime() + i * 60_000),
        result: i === 5 ? 'HIRED' : null,
      })),
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('take 5, ordenado createdAt desc, com jobTitle/companyName/referredPersonName resolvidos', async () => {
    const rows = await listRecentReferrals();
    expect(rows.length).toBeGreaterThanOrEqual(5);

    const ours = rows.filter((r) => r.jobId === jobId);
    expect(ours).toHaveLength(5);

    const dates = ours.map((r) => r.createdAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));

    // A mais recente das 6 fixtures (i=5, result HIRED) deve estar no topo.
    expect(ours[0]?.result).toBe('HIRED');
    expect(ours[0]?.jobTitle).toBe('Vaga Recent Referrals Int');
    expect(ours[0]?.companyName).toBe('Recent Referrals Int');
    expect(ours[0]?.referredPersonName).toBe('Recent Referrals Int Encaminhado');
  });

  it('result: null representa "aguardando" (i=0..4 não têm resultado)', async () => {
    const rows = await listRecentReferrals();
    const ours = rows.filter((r) => r.jobId === jobId);
    const awaiting = ours.filter((r) => r.result === null);
    expect(awaiting.length).toBeGreaterThan(0);
  });
});
