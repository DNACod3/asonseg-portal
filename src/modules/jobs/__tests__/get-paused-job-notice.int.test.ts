import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

/**
 * Testes de integração de `getPausedJobNotice` (USP-023 / T7 / P-003).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: vaga PAUSED + Empresa verificada ⇒ `{paused:true}`; vaga PAUSED de Empresa
 * NÃO verificada ⇒ `null` (defesa em profundidade, espelha o on-read do detalhe
 * público); demais status (ACTIVE/ARCHIVED/DRAFT) ⇒ `null`; vaga inexistente ⇒ `null`;
 * sem vazamento de PII (`select` só `id`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getPausedJobNotice } = await import('../queries/get-paused-job-notice');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ_VERIFIED = '11444777000280';
const CNPJ_UNVERIFIED = '11444777000281';

skipIfNoDb('getPausedJobNotice — integração (USP-023)', () => {
  let authorId = '';
  let verifiedCompanyId = '';
  let unverifiedCompanyId = '';

  async function cleanup() {
    await prisma.job.deleteMany({ where: { company: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } } } });
    await prisma.company.deleteMany({ where: { cnpj: { in: [CNPJ_VERIFIED, CNPJ_UNVERIFIED] } } });
  }

  beforeAll(async () => {
    await cleanup();
    const author = await prisma.person.create({ data: { fullName: 'Autor Paused Notice Int', status: 'ATIVO' }, select: { id: true } });
    authorId = author.id;
  });

  beforeEach(async () => {
    await cleanup();
    const verified = await prisma.company.create({
      data: {
        cnpj: CNPJ_VERIFIED,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Paused Notice Verificada Ltda',
        nomeFantasia: 'Paused Notice Verificada',
        setor: 'Comércio',
        createdBy: authorId,
        isVerified: true,
      },
      select: { id: true },
    });
    verifiedCompanyId = verified.id;
    const unverified = await prisma.company.create({
      data: {
        cnpj: CNPJ_UNVERIFIED,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Paused Notice Não Verificada Ltda',
        nomeFantasia: 'Paused Notice Não Verificada',
        setor: 'Comércio',
        createdBy: authorId,
        isVerified: false,
      },
      select: { id: true },
    });
    unverifiedCompanyId = unverified.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.person.deleteMany({ where: { id: authorId } });
  });

  async function createJob(companyId: string, status: 'PAUSED' | 'ACTIVE' | 'ARCHIVED' | 'DRAFT') {
    return prisma.job.create({
      data: { companyId, authorPersonId: authorId, title: 'Vaga Paused Notice Int', status },
      select: { id: true },
    });
  }

  it('P-003: vaga PAUSED de Empresa verificada → { paused: true }', async () => {
    const job = await createJob(verifiedCompanyId, 'PAUSED');
    const res = await getPausedJobNotice(job.id);
    expect(res).toEqual({ paused: true });
  });

  it('vaga PAUSED de Empresa NÃO verificada → null (defesa em profundidade)', async () => {
    const job = await createJob(unverifiedCompanyId, 'PAUSED');
    const res = await getPausedJobNotice(job.id);
    expect(res).toBeNull();
  });

  it.each(['ACTIVE', 'ARCHIVED', 'DRAFT'] as const)('vaga %s (não PAUSED) → null', async (status) => {
    const job = await createJob(verifiedCompanyId, status);
    const res = await getPausedJobNotice(job.id);
    expect(res).toBeNull();
  });

  it('vaga inexistente → null', async () => {
    const res = await getPausedJobNotice('00000000-0000-0000-0000-000000000000');
    expect(res).toBeNull();
  });
});
