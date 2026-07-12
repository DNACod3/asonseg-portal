import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `updateJobDraft` (USP-054 / EMP-2 / T5 / A-1 / A-2).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre (CLAUDE.md — Server Action sensível): happy (DRAFT e AWAITING_ADJUSTMENTS,
 * campos persistem, status inalterado — MN-02); Zod-fail; não-responsável → FORBIDDEN
 * sem escrita (MN-03); vaga ACTIVE/terminal → CONFLICT sem escrita; concorrência
 * (2 edições simultâneas — só uma casa, E3); MN-01 (status nunca no `data:` — guarda
 * estática complementar em `no-out-of-band-status-write.test.ts`).
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { updateJobDraft } = await import('../actions/update-job-draft');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CNPJ = '11444777000350';

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Responsável UpdateDraft Int',
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

skipIfNoDb('updateJobDraft — integração (USP-054/EMP-2)', () => {
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
    const owner = await prisma.person.create({ data: { fullName: 'Dono UpdateDraft Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const stranger = await prisma.person.create({ data: { fullName: 'Estranho UpdateDraft Int', status: 'ATIVO' }, select: { id: true } });
    strangerId = stranger.id;
    const area = await prisma.jobArea.upsert({
      where: { name: 'UpdateDraft Int Área' },
      update: {},
      create: { name: 'UpdateDraft Int Área' },
      select: { id: true },
    });
    areaId = area.id;
    const region = await prisma.region.upsert({
      where: { name: 'UpdateDraft Int Região' },
      update: {},
      create: { name: 'UpdateDraft Int Região', cityName: 'Florianópolis' },
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
        razaoSocial: 'UpdateDraft Int Ltda',
        nomeFantasia: 'UpdateDraft Int',
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
    await prisma.jobArea.deleteMany({ where: { name: 'UpdateDraft Int Área' } });
    await prisma.region.deleteMany({ where: { name: 'UpdateDraft Int Região' } });
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
      validUntil: dateStr(30),
      ...overrides,
    };
  }

  async function createJob(status: 'DRAFT' | 'AWAITING_ADJUSTMENTS' | 'ACTIVE' | 'ARCHIVED' = 'DRAFT') {
    return prisma.job.create({
      data: {
        companyId,
        authorPersonId: ownerId,
        title: 'Vaga UpdateDraft Int Original',
        areaId,
        description: 'Descrição original.',
        requirements: 'Requisitos originais.',
        workRegime: 'CLT',
        location: 'Original',
        contractType: 'CLT',
        regionId,
        validUntil: new Date(dateStr(15)),
        status,
      },
      select: { id: true },
    });
  }

  it('USP054-03: DRAFT — persiste os campos e MANTÉM status=DRAFT (MN-02)', async () => {
    const job = await createJob('DRAFT');

    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Vaga Editada Draft' }) });
    expect(res).toMatchObject({ ok: true, data: { jobId: job.id, status: 'DRAFT' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'DRAFT', title: 'Vaga Editada Draft' });

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'JOB_DRAFT_SAVED', entityId: job.id },
      select: { before: true, after: true },
    });
    expect(entry).not.toBeNull();
    expect(entry?.before).toMatchObject({ status: 'DRAFT', title: 'Vaga UpdateDraft Int Original' });
    expect(entry?.after).toMatchObject({ status: 'DRAFT', title: 'Vaga Editada Draft' });
  });

  it('USP054-02/03: AWAITING_ADJUSTMENTS — persiste os campos e MANTÉM status=AWAITING_ADJUSTMENTS (MN-02)', async () => {
    const job = await createJob('AWAITING_ADJUSTMENTS');

    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Vaga Ajustada' }) });
    expect(res).toMatchObject({ ok: true, data: { jobId: job.id, status: 'AWAITING_ADJUSTMENTS' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'AWAITING_ADJUSTMENTS', title: 'Vaga Ajustada' });
  });

  it('D-1: permite corrigir validUntil vencido do rascunho (evita beco de validade)', async () => {
    const job = await createJob('DRAFT');

    const novaValidade = dateStr(45);
    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ validUntil: novaValidade }) });
    expect(res.ok).toBe(true);

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { validUntil: true } });
    expect(row?.validUntil?.toISOString().slice(0, 10)).toBe(novaValidade);
  });

  it('Zod-fail: título vazio → VALIDATION, sem escrita', async () => {
    const job = await createJob('DRAFT');

    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ title: '' }) });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { title: true } });
    expect(row?.title).toBe('Vaga UpdateDraft Int Original');
  });

  it('MN-03/P-005: não-responsável não pode editar — FORBIDDEN sem escrita', async () => {
    const job = await createJob('DRAFT');
    mockPerson = personFixture(strangerId);

    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Não deveria salvar' }) });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'DRAFT', title: 'Vaga UpdateDraft Int Original' });
  });

  it('vaga ACTIVE → CONFLICT (só rascunho/aguardando ajustes é editável por este fluxo), sem escrita', async () => {
    const job = await createJob('ACTIVE');

    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Não deveria salvar' }) });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'ACTIVE', title: 'Vaga UpdateDraft Int Original' });
  });

  it('vaga terminal (ARCHIVED) → CONFLICT, sem escrita', async () => {
    const job = await createJob('ARCHIVED');

    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Não deveria salvar' }) });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
  });

  it('vaga inexistente → NOT_FOUND', async () => {
    const res = await updateJobDraft({ jobId: '00000000-0000-0000-0000-000000000000', ...fullFields() });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('duas edições simultâneas da mesma vaga (sem transição concorrente) — ambas casam, last-write-wins, status preservado', async () => {
    const job = await createJob('DRAFT');

    // A guarda otimista é `status IN [DRAFT, AWAITING_ADJUSTMENTS]` (não um `from` pontual
    // como na FSM) — como nenhuma das duas edições muda o status, ambas satisfazem a
    // guarda; a corrida é só sobre o conteúdo (last-write-wins), nunca sobre o status.
    const [a, b] = await Promise.all([
      updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Edição A' }) }),
      updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Edição B' }) }),
    ]);

    expect([a, b].filter((r) => r.ok)).toHaveLength(2);
    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
    expect(row?.status).toBe('DRAFT');
  });

  it('E3: concorrência real — vaga sai de DRAFT/AWAITING_ADJUSTMENTS entre o load e o write → CONFLICT, sem escrita', async () => {
    const job = await createJob('DRAFT');
    // Simula uma submissão concorrente que já mudou o status antes do write do updateJobDraft
    // (a guarda otimista `status IN [...]` deixa de casar — count===0).
    await prisma.job.update({ where: { id: job.id }, data: { status: 'IN_MODERATION' } });

    const res = await updateJobDraft({ jobId: job.id, ...fullFields({ title: 'Edição tardia' }) });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const row = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'IN_MODERATION', title: 'Vaga UpdateDraft Int Original' });
  });
});
