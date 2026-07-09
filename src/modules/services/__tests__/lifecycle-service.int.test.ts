import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `pauseService`/`resumeService`/`archiveService`
 * (USP-032 / T032-3 / AC-032-2/3/4). Requer Postgres local (`supabase start`).
 *
 * Real: Prisma/Postgres + `transitionContent` (FSM) + gate `requireServiceOwner`.
 * Cobre: pausar ACTIVE→PAUSED + SERVICE_PAUSED (some da busca pública); retomar
 * PAUSED→ACTIVE + SERVICE_UNPAUSED sem re-moderação (volta à busca, sem validade
 * automática); arquivar ACTIVE→ARCHIVED + SERVICE_ARCHIVED (terminal); não-dono →
 * FORBIDDEN (SVC032-MN-02); transições fora do estado esperado →
 * INVALID_TRANSITION; concorrência.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.1', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { pauseService } = await import('../actions/pause-service');
const { resumeService } = await import('../actions/resume-service');
const { archiveService } = await import('../actions/archive-service');
const { searchServices } = await import('../queries/search-services');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function personFixture(id: string): CurrentPerson {
  return {
    id,
    supabaseUserId: '00000000-0000-0000-0000-000000000001',
    fullName: 'Prestador Lifecycle Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['PROVIDER'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('pauseService / resumeService / archiveService — integração (USP-032)', () => {
  let ownerId = '';
  let strangerId = '';

  beforeAll(async () => {
    const owner = await prisma.person.create({ data: { fullName: 'Dono Lifecycle Int', status: 'ATIVO' }, select: { id: true } });
    ownerId = owner.id;
    const stranger = await prisma.person.create({ data: { fullName: 'Estranho Lifecycle Int', status: 'ATIVO' }, select: { id: true } });
    strangerId = stranger.id;
  });

  beforeEach(async () => {
    await prisma.service.deleteMany({ where: { authorPersonId: { in: [ownerId, strangerId] } } });
    mockPerson = personFixture(ownerId);
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { authorPersonId: { in: [ownerId, strangerId] } } });
    await prisma.person.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
  });

  async function createService(status: 'ACTIVE' | 'PAUSED' | 'DRAFT', title = 'Serviço Lifecycle Int') {
    return prisma.service.create({
      data: {
        authorPersonId: ownerId,
        title,
        status,
        publishedAt: status === 'ACTIVE' || status === 'PAUSED' ? new Date() : null,
      },
      select: { id: true },
    });
  }

  it('AC-032-2: pausa serviço ACTIVE → PAUSED, grava SERVICE_PAUSED e some da busca pública', async () => {
    const service = await createService('ACTIVE');
    expect((await searchServices({}, null)).items.map((i) => i.id)).toContain(service.id);

    const res = await pauseService({ serviceId: service.id });
    expect(res).toMatchObject({ ok: true, data: { serviceId: service.id, status: 'PAUSED' } });

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { status: true } });
    expect(row?.status).toBe('PAUSED');

    const entry = await prisma.auditLog.findFirst({ where: { action: 'SERVICE_PAUSED', entityId: service.id } });
    expect(entry).not.toBeNull();

    expect((await searchServices({}, null)).items.map((i) => i.id)).not.toContain(service.id);
  });

  it('AC-032-4: retoma serviço PAUSED → ACTIVE, grava SERVICE_UNPAUSED sem re-moderação e volta à busca', async () => {
    const service = await createService('PAUSED');

    const res = await resumeService({ serviceId: service.id });
    expect(res).toMatchObject({ ok: true, data: { serviceId: service.id, status: 'ACTIVE' } });

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { status: true } });
    expect(row?.status).toBe('ACTIVE'); // NÃO passa por IN_MODERATION — sem re-moderação

    const entry = await prisma.auditLog.findFirst({ where: { action: 'SERVICE_UNPAUSED', entityId: service.id } });
    expect(entry).not.toBeNull();

    expect((await searchServices({}, null)).items.map((i) => i.id)).toContain(service.id);
  });

  it('AC-032-3: arquiva serviço ACTIVE → ARCHIVED, grava SERVICE_ARCHIVED (terminal)', async () => {
    const service = await createService('ACTIVE');

    const res = await archiveService({ serviceId: service.id });
    expect(res).toMatchObject({ ok: true, data: { serviceId: service.id, status: 'ARCHIVED' } });

    const entry = await prisma.auditLog.findFirst({ where: { action: 'SERVICE_ARCHIVED', entityId: service.id } });
    expect(entry).not.toBeNull();

    // P-006-like: ARCHIVED não tem aresta de volta na FSM — reativação direta é recusada.
    const reactivate = await resumeService({ serviceId: service.id });
    expect(reactivate).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('SVC032-MN-02: não-dono não pode pausar/retomar/arquivar — FORBIDDEN sem escrita', async () => {
    const active = await createService('ACTIVE', 'Serviço Lifecycle Alheio Ativo');
    const paused = await createService('PAUSED', 'Serviço Lifecycle Alheio Pausado');
    mockPerson = personFixture(strangerId);

    const resPause = await pauseService({ serviceId: active.id });
    expect(resPause).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect((await prisma.service.findUnique({ where: { id: active.id }, select: { status: true } }))?.status).toBe('ACTIVE');

    const resResume = await resumeService({ serviceId: paused.id });
    expect(resResume).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect((await prisma.service.findUnique({ where: { id: paused.id }, select: { status: true } }))?.status).toBe('PAUSED');

    const resArchive = await archiveService({ serviceId: active.id });
    expect(resArchive).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('pausar serviço que não está ACTIVE (já DRAFT) → INVALID_TRANSITION', async () => {
    const draft = await createService('DRAFT');
    const res = await pauseService({ serviceId: draft.id });
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('retomar serviço que não está PAUSED (já ACTIVE) → INVALID_TRANSITION', async () => {
    const active = await createService('ACTIVE');
    const res = await resumeService({ serviceId: active.id });
    expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_TRANSITION' } });
  });

  it('serviço inexistente → FORBIDDEN (requireServiceOwner não distingue existência p/ o não-dono)', async () => {
    const res = await pauseService({ serviceId: '00000000-0000-0000-0000-000000000000' });
    expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('concorrência: 2 pausas simultâneas do mesmo serviço — só uma casa (count===1)', async () => {
    const service = await createService('ACTIVE');

    const [a, b] = await Promise.all([
      pauseService({ serviceId: service.id }),
      pauseService({ serviceId: service.id }),
    ]);
    const oks = [a, b].filter((r) => r.ok).length;
    const invalids = [a, b].filter((r) => !r.ok && r.error.code === 'INVALID_TRANSITION').length;
    expect(oks).toBe(1);
    expect(invalids).toBe(1);

    const row = await prisma.service.findUnique({ where: { id: service.id }, select: { status: true } });
    expect(row?.status).toBe('PAUSED');
  });
});
