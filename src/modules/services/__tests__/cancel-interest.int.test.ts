import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `cancelInterest` (USP-034 — AC-034-1..3). Requer
 * Postgres local (`supabase start`) e `DATABASE_URL` no env. Cobre a matriz
 * obrigatória de Server Action (happy · idempotência · Zod · unauth ·
 * not-found/terceiro · **concorrência**) e os must-nots SVC034-MN-01
 * (cancelar de terceiro → NOT_FOUND, sem efeito) e SVC034-MN-02 (consent/papel
 * seguem ativos após cancelar — permitindo re-manifestar).
 */

vi.mock('@/modules/identity/server/session', () => ({
  getCurrentPerson: vi.fn(async () => mockPerson),
  requireActivePerson: vi.fn(async () => mockPerson),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.9', 'user-agent': 'vitest/int' })),
}));

let mockPerson: CurrentPerson | null = null;

const { prisma } = await import('@/shared/lib/prisma');
const { cancelInterest } = await import('../actions/cancel-interest');
const { manifestInterest } = await import('../actions/manifest-interest');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function personOf(id: string, fullName: string): CurrentPerson {
  return {
    id,
    supabaseUserId: id,
    fullName,
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: [],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('cancelInterest — integração', () => {
  let authorId = '';
  let serviceId = '';

  let clientAId = ''; // dona da manifestação "happy"/recandidatura
  let clientBId = ''; // terceiro (SVC034-MN-01)
  let clientRaceId = ''; // corrida

  let interestHappyId = '';
  let interestOfAId = ''; // manifestação de A que B tentará cancelar (SVC034-MN-01)
  let interestAlreadyCancelledId = ''; // já cancelada previamente (AC-034-3)
  let interestRaceId = ''; // manifestação da corrida

  async function cleanup() {
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Cancel Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      const ids = stalePeople.map((p) => p.id);
      await prisma.outbox.deleteMany({});
      await prisma.serviceInterest.deleteMany({
        where: { OR: [{ clientPersonId: { in: ids } }, { service: { authorPersonId: { in: ids } } }] },
      });
      await prisma.service.deleteMany({ where: { authorPersonId: { in: ids } } });
      await prisma.clientProfile.deleteMany({ where: { personId: { in: ids } } });
      await prisma.personRoleGrant.deleteMany({ where: { personId: { in: ids } } });
      await prisma.consent.deleteMany({ where: { personId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  async function clientWithActiveInterest(fullName: string) {
    const p = await prisma.person.create({ data: { fullName, status: 'ATIVO' }, select: { id: true } });
    await prisma.consent.createMany({
      data: [
        { personId: p.id, purpose: 'PORTAL_ACCESS', termVersion: 'v1.0', termContentHash: 'cancel-int-hash' },
        { personId: p.id, purpose: 'SERVICE_HIRING', termVersion: 'v1.0', termContentHash: 'cancel-int-hash' },
      ],
    });
    await prisma.personRoleGrant.create({ data: { personId: p.id, role: 'CLIENT', status: 'ACTIVE' } });
    await prisma.clientProfile.create({ data: { personId: p.id } });
    return p.id;
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: { fullName: 'Cancel Int Autor', status: 'ATIVO', emailLogin: 'cancel-int-autor@example.com' },
      select: { id: true },
    });
    authorId = author.id;

    const service = await prisma.service.create({
      data: { authorPersonId: authorId, title: 'Serviço Cancel Int', status: 'ACTIVE', publishedAt: new Date() },
      select: { id: true },
    });
    serviceId = service.id;

    clientAId = await clientWithActiveInterest('Cancel Int Cliente A');
    clientBId = await clientWithActiveInterest('Cancel Int Cliente B');
    clientRaceId = await clientWithActiveInterest('Cancel Int Cliente Corrida');

    const happy = await prisma.serviceInterest.create({
      data: { serviceId, clientPersonId: clientAId },
      select: { id: true },
    });
    interestHappyId = happy.id;
    interestOfAId = interestHappyId;

    const alreadyCancelled = await prisma.serviceInterest.create({
      data: { serviceId, clientPersonId: clientBId, cancelledAt: new Date() },
      select: { id: true },
    });
    interestAlreadyCancelledId = alreadyCancelled.id;

    const race = await prisma.serviceInterest.create({
      data: { serviceId, clientPersonId: clientRaceId },
      select: { id: true },
    });
    interestRaceId = race.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('@ac-034-e1 Zod: interestId inválido → VALIDATION', async () => {
    mockPerson = personOf(clientAId, 'Cancel Int Cliente A');
    const res = await cancelInterest({ interestId: 'not-a-uuid' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  });

  it('@ac-034-e2 unauth: sem sessão → UNAUTHENTICATED', async () => {
    mockPerson = null;
    const res = await cancelInterest({ interestId: interestHappyId });
    expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('@svc034-mn-01 ClienteB cancela manifestação da ClienteA → NOT_FOUND, sem efeito', async () => {
    mockPerson = personOf(clientBId, 'Cancel Int Cliente B');
    const res = await cancelInterest({ interestId: interestOfAId });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const stillActive = await prisma.serviceInterest.findUnique({
      where: { id: interestOfAId },
      select: { cancelledAt: true },
    });
    expect(stillActive?.cancelledAt).toBeNull();

    const auditCount = await prisma.auditLog.count({
      where: { action: 'INTEREST_CANCELLED', entityId: interestOfAId },
    });
    expect(auditCount).toBe(0);
  });

  it('@ac-034-3 (1/2) cancelar manifestação já cancelada → ok idempotente, sem alterar cancelledAt nem auditar', async () => {
    const before = await prisma.serviceInterest.findUnique({
      where: { id: interestAlreadyCancelledId },
      select: { cancelledAt: true },
    });
    const auditBefore = await prisma.auditLog.count({
      where: { action: 'INTEREST_CANCELLED', entityId: interestAlreadyCancelledId },
    });

    mockPerson = personOf(clientBId, 'Cancel Int Cliente B');
    const res = await cancelInterest({ interestId: interestAlreadyCancelledId });
    expect(res).toMatchObject({ ok: true, data: { interestId: interestAlreadyCancelledId, alreadyCancelled: true } });

    const after = await prisma.serviceInterest.findUnique({
      where: { id: interestAlreadyCancelledId },
      select: { cancelledAt: true },
    });
    expect(after?.cancelledAt?.toISOString()).toBe(before?.cancelledAt?.toISOString());

    const auditAfter = await prisma.auditLog.count({
      where: { action: 'INTEREST_CANCELLED', entityId: interestAlreadyCancelledId },
    });
    expect(auditAfter).toBe(auditBefore); // nenhum evento espúrio (AC-034-3)
  });

  it('@ac-034-1 happy: preenche cancelledAt, audita e cai da contagem ativa', async () => {
    mockPerson = personOf(clientAId, 'Cancel Int Cliente A');
    const res = await cancelInterest({ interestId: interestHappyId });
    expect(res).toMatchObject({ ok: true, data: { interestId: interestHappyId, alreadyCancelled: false } });

    const interest = await prisma.serviceInterest.findUnique({
      where: { id: interestHappyId },
      select: { cancelledAt: true },
    });
    expect(interest?.cancelledAt).not.toBeNull();

    const activeCount = await prisma.serviceInterest.count({
      where: { serviceId, clientPersonId: clientAId, cancelledAt: null },
    });
    expect(activeCount).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'INTEREST_CANCELLED', actorPersonId: clientAId, entityId: interestHappyId },
      select: { id: true },
    });
    expect(audit).not.toBeNull();

    // AC-034-2 (interação USP-035): a manifestação cancelada some de qualquer
    // leitura "ativa" escopada ao prestador (mesmo `where` que listProviderInterests usará).
    const activeForAuthor = await prisma.serviceInterest.findMany({
      where: { service: { authorPersonId: authorId }, cancelledAt: null },
      select: { id: true },
    });
    expect(activeForAuthor.map((r) => r.id)).not.toContain(interestHappyId);
  });

  it('@ac-034-3 (2/2) cancelar 2x a mesma manifestação → 2º também ok idempotente, 1 evento de auditoria', async () => {
    mockPerson = personOf(clientAId, 'Cancel Int Cliente A');
    const res = await cancelInterest({ interestId: interestHappyId });
    expect(res).toMatchObject({ ok: true, data: { interestId: interestHappyId, alreadyCancelled: true } });

    const auditCount = await prisma.auditLog.count({
      where: { action: 'INTEREST_CANCELLED', entityId: interestHappyId },
    });
    expect(auditCount).toBe(1);
  });

  it('@svc034-mn-02 consent SERVICE_HIRING + papel CLIENT seguem ativos após cancelar; re-manifestar funciona', async () => {
    const consent = await prisma.consent.findFirst({
      where: { personId: clientAId, purpose: 'SERVICE_HIRING', revokedAt: null },
    });
    expect(consent).not.toBeNull();
    const grant = await prisma.personRoleGrant.findFirst({
      where: { personId: clientAId, role: 'CLIENT', status: 'ACTIVE' },
    });
    expect(grant).not.toBeNull();

    mockPerson = personOf(clientAId, 'Cancel Int Cliente A');
    const res = await manifestInterest({ serviceId });
    expect(res).toMatchObject({ ok: true });

    const activeCount = await prisma.serviceInterest.count({
      where: { serviceId, clientPersonId: clientAId, cancelledAt: null },
    });
    expect(activeCount).toBe(1);
  });

  it('corrida: dois cancelamentos concorrentes da mesma manifestação → ambos ok, 1 evento de auditoria', async () => {
    mockPerson = personOf(clientRaceId, 'Cancel Int Cliente Corrida');
    const results = await Promise.all([
      cancelInterest({ interestId: interestRaceId }),
      cancelInterest({ interestId: interestRaceId }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);

    const auditCount = await prisma.auditLog.count({
      where: { action: 'INTEREST_CANCELLED', entityId: interestRaceId },
    });
    expect(auditCount).toBe(1);
  });
});
