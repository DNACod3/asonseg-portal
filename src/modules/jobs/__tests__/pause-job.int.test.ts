import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `pauseJob`/`unpauseJob` (USP-023 / T3 / E-002 / AC-023-2).
 * Requer Postgres local (`supabase start`).
 *
 * Real: Prisma/Postgres + `transitionContent` (FSM) + gate `requireActiveResponsible`.
 * Cobre: pausar ACTIVE→PAUSED + JOB_PAUSED (some da busca pública); despausar
 * PAUSED→ACTIVE + JOB_UNPAUSED sem re-moderação (volta à busca); não-responsável →
 * FORBIDDEN (P-005); pausar/despausar vaga fora do estado esperado → INVALID_TRANSITION;
 * concorrência (2 pausas simultâneas — só uma casa).
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { pauseJob } = await import('../actions/pause-job');
const { unpauseJob } = await import('../actions/unpause-job');
const { searchJobs } = await import('../queries/search-jobs');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000240';

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Responsável Int',
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

skipIfNoDb('pauseJob / unpauseJob — integração (USP-023)', () => {
  let ownerId = '';
  let strangerId = '';
  let companyId = '';

  async function cleanupCompany() {
    const stale = await prisma.company.findUnique({ where: { cnpj: CNPJ }, select: { id: true } });
    if (stale) {
      await prisma.job.deleteMany({ where: { companyId: stale.id } });
      await prisma.personCompanyGrant.deleteMany({ where: { companyId: stale.id } });
      await prisma.company.delete({ where: { id: stale.id } });
    }
  }

  beforeAll(async () => {
    await cleanupCompany();
    const owner = await prisma.person.create({ data: { fullName: 'Dono Pause Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const stranger = await prisma.person.create({ data: { fullName: 'Estranho Pause Int', status: 'ATIVO' }, select: { id: true } });
    strangerId = stranger.id;
  });

  beforeEach(async () => {
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Pause Int Ltda',
        nomeFantasia: 'Pause Int',
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
    await prisma.person.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
  });

  async function createJob(status: 'ACTIVE' | 'PAUSED' | 'DRAFT') {
    return prisma.job.create({
      data: {
        companyId,
        authorPersonId: ownerId,
        title: 'Vaga Pause Int',
        status,
        validUntil: futureDate(30),
        // HYG-01: espelha a invariante de produção (publishedAt na 1ª ativação, schema.prisma:501).
        // PAUSED também recebe (a vaga já foi ativada antes de pausar) para que o ramo
        // despausa→ACTIVE ordene no topo da página 1 de forma determinística sob volume.
        ...(status === 'ACTIVE' || status === 'PAUSED' ? { publishedAt: new Date() } : {}),
      },
      select: { id: true },
    });
  }

  it('AC-023-2: pausa vaga ACTIVE → PAUSED, grava JOB_PAUSED e some da busca pública', async () => {
    const job = await createJob('ACTIVE');
    expect((await searchJobs({}, null)).items.map((i) => i.id)).toContain(job.id);

    const res = await pauseJob({ jobId: job.id });
    expect(res).toMatchObject({ ok: true, data: { jobId: job.id, status: 'PAUSED' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('PAUSED');

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_PAUSED', entityId: job.id },
      select: { after: true },
    });
    expect(entry).not.toBeNull();

    expect((await searchJobs({}, null)).items.map((i) => i.id)).not.toContain(job.id);
  });

  it('AC-023-2: despausa vaga PAUSED → ACTIVE, grava JOB_UNPAUSED sem re-moderação e volta à busca', async () => {
    const job = await createJob('PAUSED');

    const res = await unpauseJob({ jobId: job.id });
    expect(res).toMatchObject({ ok: true, data: { jobId: job.id, status: 'ACTIVE' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE'); // NÃO passa por IN_MODERATION — sem re-moderação

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_UNPAUSED', entityId: job.id },
      select: { after: true },
    });
    expect(entry).not.toBeNull();

    expect((await searchJobs({}, null)).items.map((i) => i.id)).toContain(job.id);
  });

  it('P-005/D-005: não-responsável não pode pausar nem despausar — FORBIDDEN sem escrita', async () => {
    const active = await createJob('ACTIVE');
    const paused = await createJob('PAUSED');
    mockPerson = personFixture(strangerId);

    const resPause = await pauseJob({ jobId: active.id });
    expect(resPause).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect((await prisma.job.findUnique({ where: { id: active.id }, select: { status: true } }))?.status).toBe('ACTIVE');

    const resUnpause = await unpauseJob({ jobId: paused.id });
    expect(resUnpause).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect((await prisma.job.findUnique({ where: { id: paused.id }, select: { status: true } }))?.status).toBe('PAUSED');
  });

  it('pausar vaga que não está ACTIVE (já DRAFT) → INVALID_TRANSITION', async () => {
    const draft = await createJob('DRAFT');
    const res = await pauseJob({ jobId: draft.id });
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('despausar vaga que não está PAUSED (já ACTIVE) → INVALID_TRANSITION', async () => {
    const active = await createJob('ACTIVE');
    const res = await unpauseJob({ jobId: active.id });
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('vaga inexistente → NOT_FOUND', async () => {
    const res = await pauseJob({ jobId: '00000000-0000-0000-0000-000000000000' });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('concorrência: 2 pausas simultâneas da mesma vaga — só uma casa (count===1)', async () => {
    const job = await createJob('ACTIVE');

    const [a, b] = await Promise.all([pauseJob({ jobId: job.id }), pauseJob({ jobId: job.id })]);
    const oks = [a, b].filter((r) => r.ok).length;
    const invalids = [a, b].filter((r) => !r.ok && r.error.code === 'INVALID_TRANSITION').length;
    expect(oks).toBe(1);
    expect(invalids).toBe(1);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('PAUSED');
  });
});
