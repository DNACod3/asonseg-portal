import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action createJobDraft (USP-020 / #164).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — rascunho persiste em DRAFT (E-003), gate de responsável
 * ativo (P-006), dedup exata via índice parcial (P-003), auditoria JOB_DRAFT_SAVED.
 * Mocks: next/headers (IP/UA), session (pessoa autenticada).
 */

vi.mock('next/headers', () => ({
  headers: vi
    .fn()
    .mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { createJobDraft } = await import('../actions/create-job-draft');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11222333000181';
const AREA_NAME = 'Atendimento Int Draft';

skipIfNoDb('createJobDraft — integração', () => {
  let ownerId = '';
  let strangerId = '';
  let companyId = '';
  let areaId = '';

  function personFixture(id: string): CurrentPerson {
    return {
      id,
      supabaseUserId: '00000000-0000-0000-0000-000000000001',
      fullName: 'Pessoa Int',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['COMPANY_RESPONSIBLE'],
      phone: null,
      fullAddress: null,
    };
  }

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
    const area = await prisma.jobArea.upsert({
      where: { name: AREA_NAME },
      update: {},
      create: { name: AREA_NAME },
      select: { id: true },
    });
    areaId = area.id;

    const owner = await prisma.person.create({
      data: { fullName: 'Dono Vagas Int', status: 'ATIVO' },
      select: { id: true },
    });
    ownerId = owner.id;
    const stranger = await prisma.person.create({
      data: { fullName: 'Estranho Vagas Int', status: 'ATIVO' },
      select: { id: true },
    });
    strangerId = stranger.id;
  });

  beforeEach(async () => {
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Padaria Vagas Ltda',
        nomeFantasia: 'Padaria Vagas',
        setor: 'Alimentação',
        createdBy: ownerId,
      },
      select: { id: true },
    });
    companyId = company.id;
    await prisma.personCompanyGrant.create({
      data: {
        personId: ownerId,
        companyId,
        grantType: 'RESPONSIBLE',
        grantedBy: ownerId,
        status: 'ACTIVE',
      },
    });
    mockPerson = personFixture(ownerId);
  });

  afterAll(async () => {
    await cleanupCompany();
    await prisma.person.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
    await prisma.jobArea.deleteMany({ where: { name: AREA_NAME } });
  });

  it('E-003: persiste rascunho em DRAFT só com título, sem moderação (AC-020-4)', async () => {
    const result = await createJobDraft({ companyId, title: 'Rascunho de vaga' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('DRAFT');

    const job = await prisma.job.findUnique({
      where: { id: result.data.jobId },
      select: { status: true, companyId: true, authorPersonId: true, title: true },
    });
    expect(job).toMatchObject({
      status: 'DRAFT',
      companyId,
      authorPersonId: ownerId,
      title: 'Rascunho de vaga',
    });
  });

  it('E-003: grava auditoria JOB_DRAFT_SAVED (não passa pela FSM)', async () => {
    const result = await createJobDraft({ companyId, title: 'Rascunho auditado' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_DRAFT_SAVED', entityType: 'job', entityId: result.data.jobId },
      orderBy: { occurredAt: 'desc' },
      select: { after: true },
    });
    expect(entry).not.toBeNull();
    expect((entry?.after as Record<string, unknown>)?.status).toBe('DRAFT');
  });

  it('P-006: nega FORBIDDEN quando a Pessoa não é responsável ativo, sem persistir', async () => {
    mockPerson = personFixture(strangerId);
    const result = await createJobDraft({ companyId, title: 'Tentativa invasor' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    const count = await prisma.job.count({ where: { companyId } });
    expect(count).toBe(0);
  });

  it('P-003: rejeita CONFLICT na 2ª vaga viva idêntica (título+Empresa+área)', async () => {
    const input = { companyId, areaId, title: 'Atendente de balcão' };
    const first = await createJobDraft(input);
    expect(first.ok).toBe(true);

    const second = await createJobDraft(input);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
  });
});
