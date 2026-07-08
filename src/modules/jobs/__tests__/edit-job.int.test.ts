import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `editJob` (USP-023 / T6 / E-001 / E-005 / P-001 / AC-023-1).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: vaga ACTIVE → DRAFT com campos novos + JOB_EDITED_AFTER_APPROVAL before/after;
 * fluxo completo edit→submitJobForModeration→aprovar preserva published_at (E-005/D-006,
 * via adapter T1); não-responsável → FORBIDDEN; vaga não-ACTIVE → CONFLICT; concorrência
 * (2 edições simultâneas — só uma casa).
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { editJob } = await import('../actions/edit-job');
const { submitJobForModeration } = await import('../actions/submit-job-for-moderation');
const { transitionContent, ContentKind, ContentStatus } = await import('@/modules/moderation');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000270';
const ACTOR = '00000000-0000-0000-0000-0000000000dd';

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Responsável Edit Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['COMPANY_RESPONSIBLE'],
    phone: null,
    fullAddress: null,
  };
}

function dateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

skipIfNoDb('editJob — integração (USP-023)', () => {
  let ownerId = '';
  let strangerId = '';
  let companyId = '';
  let areaId = '';
  let regionId = '';

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
    const owner = await prisma.person.create({ data: { fullName: 'Dono Edit Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const stranger = await prisma.person.create({ data: { fullName: 'Estranho Edit Int', status: 'ATIVO' }, select: { id: true } });
    strangerId = stranger.id;
    const area = await prisma.jobArea.upsert({
      where: { name: 'Edit Int Área' },
      update: {},
      create: { name: 'Edit Int Área' },
      select: { id: true },
    });
    areaId = area.id;
    const region = await prisma.region.upsert({
      where: { name: 'Edit Int Região' },
      update: {},
      create: { name: 'Edit Int Região', cityName: 'Florianópolis' },
      select: { id: true },
    });
    regionId = region.id;
  });

  beforeEach(async () => {
    await cleanupCompany();
    const company = await prisma.company.create({
      data: {
        cnpj: CNPJ,
        type: 'SIMPLES_NACIONAL',
        razaoSocial: 'Edit Int Ltda',
        nomeFantasia: 'Edit Int',
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
    await prisma.jobArea.deleteMany({ where: { name: 'Edit Int Área' } });
    await prisma.region.deleteMany({ where: { name: 'Edit Int Região' } });
  });

  function fullFields(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Atendente de balcão',
      areaId,
      description: 'Atendimento ao cliente no balcão.',
      requirements: 'Ensino médio completo.',
      workRegime: 'CLT',
      location: 'São Paulo - SP',
      contractType: 'CLT',
      regionId,
      ...overrides,
    };
  }

  async function createActiveJob(publishedAt: Date | null = null) {
    return prisma.job.create({
      data: {
        companyId,
        authorPersonId: ownerId,
        title: 'Vaga Edit Int Original',
        areaId,
        description: 'Descrição original.',
        requirements: 'Requisitos originais.',
        workRegime: 'CLT',
        location: 'Original',
        contractType: 'CLT',
        regionId,
        validUntil: new Date(dateStr(30)),
        status: 'ACTIVE',
        publishedAt,
      },
      select: { id: true },
    });
  }

  it('AC-023-1: edita vaga ACTIVE → DRAFT com campos novos, grava JOB_EDITED_AFTER_APPROVAL before/after', async () => {
    const job = await createActiveJob();

    const res = await editJob({ jobId: job.id, ...fullFields({ title: 'Vaga Editada' }) });
    expect(res).toMatchObject({ ok: true, data: { jobId: job.id, status: 'DRAFT' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'DRAFT', title: 'Vaga Editada' });

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_EDITED_AFTER_APPROVAL', entityId: job.id },
      select: { before: true, after: true, justification: true },
    });
    expect(entry).not.toBeNull();
    expect(entry?.before).toMatchObject({ status: 'ACTIVE', title: 'Vaga Edit Int Original' });
    expect(entry?.after).toMatchObject({ status: 'DRAFT', title: 'Vaga Editada' });
    // E-001: editar não exige justificativa (removido de JUSTIFICATION_REQUIRED_EVENTS).
    expect(entry?.justification).toBeNull();
  });

  it('E-005/P-001/D-006: fluxo completo edit→submit→aprovar preserva o published_at original', async () => {
    const original = new Date('2026-01-01T12:00:00.000Z');
    const job = await createActiveJob(original);

    const editRes = await editJob({ jobId: job.id, ...fullFields({ title: 'Vaga Reeditada' }) });
    expect(editRes.ok).toBe(true);

    const submitRes = await submitJobForModeration({ jobId: job.id });
    expect(submitRes.ok).toBe(true);
    if (!submitRes.ok) return;
    expect(submitRes.data.status).toBe('IN_MODERATION');

    const approveRes = await transitionContent({
      contentKind: ContentKind.JOB,
      contentId: job.id,
      to: ContentStatus.ACTIVE,
      trigger: 'MODERATOR_ACTION',
      actorPersonId: ACTOR,
    });
    expect(approveRes.ok).toBe(true);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { publishedAt: true, status: true, title: true } });
    expect(row?.status).toBe('ACTIVE');
    expect(row?.title).toBe('Vaga Reeditada');
    expect(row?.publishedAt?.toISOString()).toBe(original.toISOString()); // preservado, não sobrescrito
  });

  it('P-005/D-005: não-responsável não pode editar — FORBIDDEN sem escrita', async () => {
    const job = await createActiveJob();
    mockPerson = personFixture(strangerId);

    const res = await editJob({ jobId: job.id, ...fullFields() });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE');
  });

  it('vaga não-ACTIVE (já DRAFT) → CONFLICT, sem escrita parcial', async () => {
    const job = await createActiveJob();
    await prisma.job.update({ where: { id: job.id }, data: { status: 'DRAFT' } });

    const res = await editJob({ jobId: job.id, ...fullFields({ title: 'Não deveria salvar' }) });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { title: true } });
    expect(row?.title).toBe('Vaga Edit Int Original');
  });

  it('vaga inexistente → NOT_FOUND', async () => {
    const res = await editJob({ jobId: '00000000-0000-0000-0000-000000000000', ...fullFields() });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('concorrência: 2 edições simultâneas da mesma vaga — só uma casa (count===1)', async () => {
    const job = await createActiveJob();

    const [a, b] = await Promise.all([
      editJob({ jobId: job.id, ...fullFields({ title: 'Edição A' }) }),
      editJob({ jobId: job.id, ...fullFields({ title: 'Edição B' }) }),
    ]);

    const oks = [a, b].filter((r) => r.ok).length;
    const conflicts = [a, b].filter((r) => !r.ok && r.error.code === 'CONFLICT').length;
    expect(oks).toBe(1);
    expect(conflicts).toBe(1);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('DRAFT');
  });
});
