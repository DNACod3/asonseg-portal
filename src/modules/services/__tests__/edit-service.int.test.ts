import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `editService` (USP-032 / T032-2 / AC-032-1 / SVC032-MN-03).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: serviço ACTIVE → DRAFT com campos novos + SERVICE_EDITED_AFTER_APPROVAL
 * before/after; fluxo completo edit→submitServiceForModeration (força
 * re-moderação); ownership negado (não-dono) → FORBIDDEN sem escrita; serviço
 * não-ACTIVE → CONFLICT; serviço inexistente → NOT_FOUND; concorrência.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { editService } = await import('../actions/edit-service');
const { submitServiceForModeration } = await import('../actions/submit-service-for-moderation');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CATEGORY_NAME = 'Edit Service Int Categoria';
const REGION_NAME = 'Edit Service Int Região';

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Prestador Edit Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['PROVIDER'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('editService — integração (USP-032)', () => {
  let ownerId = '';
  let strangerId = '';
  let categoryId = '';
  let regionId = '';

  beforeAll(async () => {
    const owner = await prisma.person.create({ data: { fullName: 'Dono Edit Service Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const stranger = await prisma.person.create({ data: { fullName: 'Estranho Edit Service Int', status: 'ATIVO' }, select: { id: true } });
    strangerId = stranger.id;
    const category = await prisma.serviceCategory.upsert({
      where: { name: CATEGORY_NAME },
      update: {},
      create: { name: CATEGORY_NAME },
      select: { id: true },
    });
    categoryId = category.id;
    const region = await prisma.region.upsert({
      where: { name: REGION_NAME },
      update: {},
      create: { name: REGION_NAME, cityName: 'Florianópolis' },
      select: { id: true },
    });
    regionId = region.id;
  });

  // Slate limpo a cada teste: sem isso, a fixture reusa sempre o mesmo
  // (author_person_id, category_id, title) e colide com `service_dedup_alive`
  // (índice único parcial — o registro do teste anterior ainda está "vivo").
  beforeEach(async () => {
    await prisma.service.deleteMany({ where: { authorPersonId: { in: [ownerId, strangerId] } } });
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { authorPersonId: { in: [ownerId, strangerId] } } });
    await prisma.person.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
    await prisma.serviceCategory.deleteMany({ where: { name: CATEGORY_NAME } });
    await prisma.region.deleteMany({ where: { name: REGION_NAME } });
  });

  function fullFields(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Jardinagem residencial',
      categoryId,
      description: 'Poda e manutenção de jardins.',
      priceMin: 80,
      priceMax: 150,
      priceUnit: 'por serviço',
      regionId,
      availabilityDescription: 'Segunda a sexta.',
      ...overrides,
    };
  }

  async function createActiveService(publishedAt: Date | null = new Date(), authorPersonId = ownerId) {
    return prisma.service.create({
      data: {
        authorPersonId,
        title: 'Serviço Edit Int Original',
        categoryId,
        description: 'Descrição original.',
        priceMin: 50,
        priceMax: 100,
        priceUnit: 'por hora',
        regionId,
        availabilityDescription: 'Disponibilidade original.',
        status: 'ACTIVE',
        publishedAt,
      },
      select: { id: true },
    });
  }

  it('AC-032-1: edita serviço ACTIVE → DRAFT com campos novos, grava SERVICE_EDITED_AFTER_APPROVAL before/after', async () => {
    mockPerson = personFixture(ownerId);
    const service = await createActiveService();

    const res = await editService({ serviceId: service.id, ...fullFields({ title: 'Serviço Editado' }) });
    expect(res).toMatchObject({ ok: true, data: { serviceId: service.id, status: 'DRAFT' } });

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'DRAFT', title: 'Serviço Editado' });

    const entry = await prisma.auditLog.findFirst({
      where: { action: 'SERVICE_EDITED_AFTER_APPROVAL', entityId: service.id },
      select: { before: true, after: true, justification: true },
    });
    expect(entry).not.toBeNull();
    expect(entry?.before).toMatchObject({ status: 'ACTIVE', title: 'Serviço Edit Int Original' });
    expect(entry?.after).toMatchObject({ status: 'DRAFT', title: 'Serviço Editado' });
    // SERVICE_EDITED_AFTER_APPROVAL não exige justificativa (espelha JOB_EDITED_AFTER_APPROVAL).
    expect(entry?.justification).toBeNull();
  });

  it('AC-032-1/SVC032-MN-03: fluxo completo edit→submit força nova moderação (IN_MODERATION)', async () => {
    mockPerson = personFixture(ownerId);
    const original = new Date('2026-01-01T12:00:00.000Z');
    const service = await createActiveService(original);

    const editRes = await editService({ serviceId: service.id, ...fullFields({ title: 'Serviço Reeditado' }) });
    expect(editRes.ok).toBe(true);

    const submitRes = await submitServiceForModeration({ serviceId: service.id });
    expect(submitRes.ok).toBe(true);
    if (!submitRes.ok) return;
    expect(submitRes.data.status).toBe('IN_MODERATION');

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { status: true, title: true } });
    expect(row).toMatchObject({ status: 'IN_MODERATION', title: 'Serviço Reeditado' });
    expect(row?.status).not.toBe('ACTIVE'); // SVC032-MN-03: nunca fica ACTIVE após editar
  });

  it('SVC032-MN-02: não-dono não pode editar — FORBIDDEN sem escrita', async () => {
    const service = await createActiveService();
    mockPerson = personFixture(strangerId);

    const res = await editService({ serviceId: service.id, ...fullFields() });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE');
  });

  it('serviço não-ACTIVE (já DRAFT) → CONFLICT, sem escrita parcial', async () => {
    mockPerson = personFixture(ownerId);
    const service = await createActiveService();
    await prisma.service.update({ where: { id: service.id }, data: { status: 'DRAFT' } });

    const res = await editService({ serviceId: service.id, ...fullFields({ title: 'Não deveria salvar' }) });
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { title: true } });
    expect(row?.title).toBe('Serviço Edit Int Original');
  });

  it('serviço inexistente → NOT_FOUND', async () => {
    mockPerson = personFixture(ownerId);
    const res = await editService({
      serviceId: '00000000-0000-0000-0000-000000000000',
      ...fullFields(),
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('concorrência: 2 edições simultâneas do mesmo serviço — só uma casa (count===1)', async () => {
    mockPerson = personFixture(ownerId);
    const service = await createActiveService();

    const [a, b] = await Promise.all([
      editService({ serviceId: service.id, ...fullFields({ title: 'Edição A' }) }),
      editService({ serviceId: service.id, ...fullFields({ title: 'Edição B' }) }),
    ]);

    const oks = [a, b].filter((r) => r.ok).length;
    const conflicts = [a, b].filter((r) => !r.ok && r.error.code === 'CONFLICT').length;
    expect(oks).toBe(1);
    expect(conflicts).toBe(1);

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { status: true } });
    expect(row?.status).toBe('DRAFT');
  });
});
