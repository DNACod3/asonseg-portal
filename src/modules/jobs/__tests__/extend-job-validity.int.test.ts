import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `extendJobValidity` (USP-023 / T5 / E-004 / AC-023-4).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: prorroga ACTIVE com data futura → validUntil novo, status permanece ACTIVE
 * (sem transição/re-moderação), JOB_VALIDITY_EXTENDED com before/after; data
 * passada/>180d → VALIDATION; 3 prorrogações seguidas OK (P-002 N/A);
 * não-responsável → FORBIDDEN; vaga não-ACTIVE → CONFLICT.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { extendJobValidity } = await import('../actions/extend-job-validity');
const { hojeSaoPaulo } = await import('@/shared/lib/time');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000260';

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Responsável Extend Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['COMPANY_RESPONSIBLE'],
    phone: null,
    fullAddress: null,
  };
}

/**
 * `days` a partir do dia-calendário de São Paulo, ancorado em `hojeSaoPaulo()` +
 * `setUTCDate` — imune ao fuso do runner (L-006); necessário aqui porque o teste
 * de teto usa um offset próximo da borda (200 dias > MAX_VALIDADE_DIAS).
 */
function dateStr(days: number): string {
  const d = hojeSaoPaulo();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

skipIfNoDb('extendJobValidity — integração (USP-023)', () => {
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
    const owner = await prisma.person.create({ data: { fullName: 'Dono Extend Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const stranger = await prisma.person.create({ data: { fullName: 'Estranho Extend Int', status: 'ATIVO' }, select: { id: true } });
    strangerId = stranger.id;
  });

  beforeEach(async () => {
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Extend Int Ltda',
        nomeFantasia: 'Extend Int',
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

  async function createJob(status: 'ACTIVE' | 'PAUSED', validUntil = new Date(dateStr(10))) {
    return prisma.job.create({
      data: { companyId, authorPersonId: ownerId, title: 'Vaga Extend Int', status, validUntil },
      select: { id: true },
    });
  }

  it('AC-023-4: prorroga vaga ACTIVE com data futura — validUntil novo, status permanece ACTIVE, grava JOB_VALIDITY_EXTENDED', async () => {
    const job = await createJob('ACTIVE');
    const novaData = dateStr(60);

    const res = await extendJobValidity({ jobId: job.id, validUntil: novaData });
    expect(res).toMatchObject({ ok: true, data: { jobId: job.id, validUntil: novaData } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, validUntil: true } });
    expect(row?.status).toBe('ACTIVE'); // sem transição/re-moderação

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_VALIDITY_EXTENDED', entityId: job.id },
      select: { before: true, after: true },
    });
    expect(entry).not.toBeNull();
    expect(entry?.after).toMatchObject({ validUntil: expect.any(String) });
  });

  it('data no passado → VALIDATION', async () => {
    const job = await createJob('ACTIVE');
    const res = await extendJobValidity({ jobId: job.id, validUntil: dateStr(-5) });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('data acima de 180 dias → VALIDATION', async () => {
    const job = await createJob('ACTIVE');
    const res = await extendJobValidity({ jobId: job.id, validUntil: dateStr(200) });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('P-002 N/A: 3 prorrogações seguidas são todas aceitas (sem teto de quantidade)', async () => {
    const job = await createJob('ACTIVE');

    const r1 = await extendJobValidity({ jobId: job.id, validUntil: dateStr(20) });
    const r2 = await extendJobValidity({ jobId: job.id, validUntil: dateStr(40) });
    const r3 = await extendJobValidity({ jobId: job.id, validUntil: dateStr(60) });

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { validUntil: true } });
    expect(row?.validUntil?.toISOString().slice(0, 10)).toBe(dateStr(60));
  });

  it('P-005/D-005: não-responsável não pode prorrogar — FORBIDDEN', async () => {
    const job = await createJob('ACTIVE');
    mockPerson = personFixture(strangerId);

    const res = await extendJobValidity({ jobId: job.id, validUntil: dateStr(60) });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('vaga não-ACTIVE (PAUSED) → CONFLICT, sem escrita', async () => {
    const job = await createJob('PAUSED');
    const original = (await prisma.job.findUnique({ where: { id: job.id }, select: { validUntil: true } }))?.validUntil;

    const res = await extendJobValidity({ jobId: job.id, validUntil: dateStr(60) });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { validUntil: true } });
    expect(row?.validUntil?.toISOString()).toBe(original?.toISOString());
  });

  it('vaga inexistente → NOT_FOUND', async () => {
    const res = await extendJobValidity({ jobId: '00000000-0000-0000-0000-000000000000', validUntil: dateStr(30) });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});
