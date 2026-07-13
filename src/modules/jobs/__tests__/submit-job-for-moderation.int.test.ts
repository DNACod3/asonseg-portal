import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da Server Action submitJobForModeration (USP-020 / #164).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres + FSM (transitionContent via container) — submissão válida
 * → IN_MODERATION vinculada à Empresa (E-001), auditoria CONTENT_SUBMITTED_TO_MODERATION
 * (L-004), validação de fronteira (E-004/E-005/L-003), gate de responsável (P-006/D-005),
 * dedup (P-003) e concorrência otimista (ADR-0011 R3).
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
const { submitJobForModeration } = await import('../actions/submit-job-for-moderation');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000161';
const AREA_NAME = 'Atendimento Int Submit';

/** Data (yyyy-MM-dd) deslocada `days` dias de hoje. */
function dateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

skipIfNoDb('submitJobForModeration — integração', () => {
  let ownerId = '';
  let strangerId = '';
  let pendingId = '';
  let companyId = '';
  let areaId = '';
  let regionId = '';

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

  function fullInput(overrides: Record<string, unknown> = {}) {
    return {
      companyId,
      title: 'Atendente de balcão',
      areaId,
      description: 'Atendimento ao cliente no balcão.',
      requirements: 'Ensino médio completo.',
      workRegime: 'CLT',
      contractType: 'CLT',
      regionId,
      location: 'São Paulo - SP',
      validUntil: dateStr(30),
      ...overrides,
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

    const region = await prisma.region.upsert({
      where: { name: 'Centro Int Submit' },
      update: {},
      create: { name: 'Centro Int Submit', cityName: 'Florianópolis' },
      select: { id: true },
    });
    regionId = region.id;

    const owner = await prisma.person.create({
      data: { fullName: 'Dono Submit Int', status: 'ATIVO' },
      select: { id: true },
    });
    ownerId = owner.id;
    const stranger = await prisma.person.create({
      data: { fullName: 'Estranho Submit Int', status: 'ATIVO' },
      select: { id: true },
    });
    strangerId = stranger.id;
    const pending = await prisma.person.create({
      data: { fullName: 'Pendente Submit Int', status: 'ATIVO' },
      select: { id: true },
    });
    pendingId = pending.id;
  });

  beforeEach(async () => {
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Mercado Submit Ltda',
        nomeFantasia: 'Mercado Submit',
        setor: 'Comércio',
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
    // Vínculo apenas PENDING — não autoriza (P-006).
    await prisma.personCompanyGrant.create({
      data: {
        personId: pendingId,
        companyId,
        grantType: 'RESPONSIBLE',
        grantedBy: ownerId,
        status: 'PENDING',
        pendingAt: new Date(),
      },
    });
    mockPerson = personFixture(ownerId);
  });

  afterAll(async () => {
    await cleanupCompany();
    await prisma.person.deleteMany({ where: { id: { in: [ownerId, strangerId, pendingId] } } });
    await prisma.jobArea.deleteMany({ where: { name: AREA_NAME } });
    // HYG-09/HYG-11: remove a Region própria deste arquivo (a jobArea já era
    // limpa) — evita poluir o select de região dos dropdowns públicos (PUB-6).
    await prisma.region.deleteMany({ where: { name: 'Centro Int Submit' } });
    expect(await prisma.region.count({ where: { name: 'Centro Int Submit' } })).toBe(0);
  });

  it('E-001: submissão válida → IN_MODERATION vinculada à Empresa e ao autor', async () => {
    const result = await submitJobForModeration(fullInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe('IN_MODERATION');

    const job = await prisma.job.findUnique({
      where: { id: result.data.jobId },
      select: { status: true, companyId: true, authorPersonId: true },
    });
    expect(job).toMatchObject({
      status: 'IN_MODERATION',
      companyId,
      authorPersonId: ownerId,
    });
  });

  it('L-004: grava CONTENT_SUBMITTED_TO_MODERATION (append-only) na submissão', async () => {
    const result = await submitJobForModeration(fullInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = await prisma.auditLog.findFirst({
      where: {
        action: 'CONTENT_SUBMITTED_TO_MODERATION',
        entityType: 'JOB',
        entityId: result.data.jobId,
      },
      orderBy: { occurredAt: 'desc' },
      select: { after: true },
    });
    expect(entry).not.toBeNull();
    expect((entry?.after as Record<string, unknown>)?.status).toBe('IN_MODERATION');
  });

  it('E-004: validade passada → VALIDATION', async () => {
    const result = await submitJobForModeration(fullInput({ validUntil: dateStr(-5) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('E-005/P-005: validade excede 180 dias → VALIDATION', async () => {
    const result = await submitJobForModeration(fullInput({ validUntil: dateStr(200) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it.each(['title', 'areaId', 'description', 'requirements', 'workRegime', 'location', 'validUntil'])(
    'L-003: campo obrigatório ausente "%s" → VALIDATION',
    async (campo) => {
      const input = fullInput();
      delete (input as Record<string, unknown>)[campo];
      const result = await submitJobForModeration(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    },
  );

  it('P-006/D-005: não-responsável → FORBIDDEN, sem persistir', async () => {
    mockPerson = personFixture(strangerId);
    const result = await submitJobForModeration(fullInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');

    const count = await prisma.job.count({ where: { companyId } });
    expect(count).toBe(0);
  });

  it('P-006: vínculo apenas PENDING não autoriza → FORBIDDEN', async () => {
    mockPerson = personFixture(pendingId);
    const result = await submitJobForModeration(fullInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('FORBIDDEN');
  });

  it('P-003: 2ª vaga viva idêntica → CONFLICT', async () => {
    const first = await submitJobForModeration(fullInput());
    expect(first.ok).toBe(true);

    const second = await submitJobForModeration(fullInput());
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
  });

  it('P-003 (concorrência): submit paralelo do mesmo rascunho — 1 transição, 2ª INVALID_TRANSITION', async () => {
    const draft = await prisma.job.create({
      data: {
        companyId,
        authorPersonId: ownerId,
        title: 'Rascunho concorrente',
        areaId,
        description: 'x',
        requirements: 'y',
        workRegime: 'CLT',
        location: 'SP',
        validUntil: new Date(dateStr(30)),
        status: 'DRAFT',
      },
      select: { id: true },
    });

    const [a, b] = await Promise.all([
      submitJobForModeration({ jobId: draft.id }),
      submitJobForModeration({ jobId: draft.id }),
    ]);

    const oks = [a, b].filter((r) => r.ok).length;
    const invalids = [a, b].filter((r) => !r.ok && r.error.code === 'INVALID_TRANSITION').length;
    expect(oks).toBe(1);
    expect(invalids).toBe(1);

    const job = await prisma.job.findUnique({
      where: { id: draft.id },
      select: { status: true },
    });
    expect(job?.status).toBe('IN_MODERATION');
  });
});
