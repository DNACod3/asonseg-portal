import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `archiveJob` (USP-023 / T4 / E-003 / AC-023-3 / P-006).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: arquivar ACTIVE→ARCHIVED + JOB_ARCHIVED (sai da busca pública); terminalidade
 * (ARCHIVED→ACTIVE via transitionContent → INVALID_TRANSITION, must-not P-006, negative
 * test); candidaturas preservadas (sem exclusão física); não-responsável → FORBIDDEN.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { archiveJob } = await import('../actions/archive-job');
const { transitionContent, ContentKind, ContentStatus } = await import('@/modules/moderation');
const { searchJobs } = await import('../queries/search-jobs');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000250';
const ACTOR = '00000000-0000-0000-0000-0000000000cc';

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Responsável Archive Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['COMPANY_RESPONSIBLE'],
    phone: null,
    fullAddress: null,
  };
}

function futureDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

skipIfNoDb('archiveJob — integração (USP-023)', () => {
  let ownerId = '';
  let strangerId = '';
  let candidateId = '';
  let companyId = '';

  async function cleanupCompany() {
    const stale = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (stale) {
      await prisma.application.deleteMany({ where: { job: { companyId: stale.id } } });
      await prisma.job.deleteMany({ where: { companyId: stale.id } });
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }
  }

  beforeAll(async () => {
    await cleanupCompany();
    const owner = await prisma.person.create({ data: { fullName: 'Dono Archive Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const stranger = await prisma.person.create({ data: { fullName: 'Estranho Archive Int', status: 'ATIVO' }, select: { id: true } });
    strangerId = stranger.id;
    const candidate = await prisma.person.create({ data: { fullName: 'Candidato Archive Int', status: 'ATIVO' }, select: { id: true } });
    candidateId = candidate.id;
  });

  beforeEach(async () => {
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Archive Int Ltda',
        nomeFantasia: 'Archive Int',
        setor: 'Comércio',
        createdBy: ownerId,
        isVerified: true,
      },
      select: { id: true },
    });
    companyId = company.id;
    await prisma.personCompanyGrant.create({
      data: { personId: ownerId, companyId, grantType: 'RESPONSIBLE', grantedBy: ownerId, status: 'ACTIVE' },
    });
    mockPerson = personFixture(ownerId);
  });

  afterAll(async () => {
    await cleanupCompany();
    await prisma.person.deleteMany({ where: { id: { in: [ownerId, strangerId, candidateId] } } });
  });

  async function createJob(status: 'ACTIVE' | 'ARCHIVED') {
    return prisma.job.create({
      data: {
        companyId,
        authorPersonId: ownerId,
        title: 'Vaga Archive Int',
        status,
        validUntil: futureDate(30),
        // HYG-01: espelha a invariante de produção (publishedAt na 1ª ativação, schema.prisma:501)
        // para que a vaga ACTIVE ordene no topo da página 1 mesmo sob volume acumulado.
        ...(status === 'ACTIVE' ? { publishedAt: new Date() } : {}),
      },
      select: { id: true },
    });
  }

  it('AC-023-3: arquiva vaga ACTIVE → ARCHIVED, grava JOB_ARCHIVED e sai da busca pública', async () => {
    const job = await createJob('ACTIVE');
    expect((await searchJobs({}, null)).items.map((i) => i.id)).toContain(job.id);

    const res = await archiveJob({ jobId: job.id });
    expect(res).toMatchObject({ ok: true, data: { jobId: job.id, status: 'ARCHIVED' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ARCHIVED');

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_ARCHIVED', entityId: job.id },
      select: { after: true },
    });
    expect(entry).not.toBeNull();

    expect((await searchJobs({}, null)).items.map((i) => i.id)).not.toContain(job.id);
  });

  it('P-006 (must-not, negativo): vaga ARCHIVED não pode ser reativada — transitionContent(ARCHIVED→ACTIVE) recusa com INVALID_TRANSITION', async () => {
    const job = await createJob('ARCHIVED');

    const res = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: job.id,
      to: ContentStatus.ACTIVE,
      trigger: 'AUTHOR_ACTION',
      actorPersonId: ACTOR,
    });

    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ARCHIVED');
  });

  it('candidaturas são preservadas ao arquivar (sem exclusão física)', async () => {
    const job = await createJob('ACTIVE');
    const application = await prisma.application.create({
      data: { candidatePersonId: candidateId, jobId: job.id },
      select: { id: true },
    });

    const res = await archiveJob({ jobId: job.id });
    expect(res.ok).toBe(true);

    const stillThere = await prisma.application.findUnique({ where: { id: application.id } });
    expect(stillThere).not.toBeNull();
  });

  it('P-005/D-005: não-responsável não pode arquivar — FORBIDDEN sem escrita', async () => {
    const job = await createJob('ACTIVE');
    mockPerson = personFixture(strangerId);

    const res = await archiveJob({ jobId: job.id });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE');
  });

  it('vaga inexistente → NOT_FOUND', async () => {
    const res = await archiveJob({ jobId: '00000000-0000-0000-0000-000000000000' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});
