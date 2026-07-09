import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração de `listProviderInterests` (USP-035 — AC-035-1/2).
 * Requer Postgres local (`supabase start`). Cobre ownership (SVC035-MN-01),
 * exclusão de canceladas (SVC035-MN-03), não-vazamento de PII (SVC035-MN-02),
 * serviço não-ativo com manifestação ativa ainda aparece (§D4) e a auditoria
 * `SENSITIVE_FIELD_VIEWED` por cliente exibido.
 */

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-real-ip': '10.0.0.7', 'user-agent': 'vitest/int' })),
}));

const { prisma } = await import('@/shared/lib/prisma');
const { listProviderInterests } = await import('../queries/list-provider-interests');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const CPF_SENSOR = '52998224725'; // CPF válido (algoritmo) usado só como sensor de vazamento
const ENDERECO_SENSOR = 'Rua Sensível Manifestações Int, 999';

function viewerFor(personId: string): CurrentPerson {
  return {
    id: personId,
    supabaseUserId: '00000000-0000-0000-0000-0000000000aa',
    fullName: 'Prestador Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles: ['PROVIDER'],
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('listProviderInterests — integração', () => {
  let authorAId = '';
  let authorBId = '';
  let serviceAId = ''; // ACTIVE do autor A
  let servicePausedAId = ''; // PAUSED do autor A, com manifestação ativa (§D4)
  let serviceBId = ''; // ACTIVE do autor B (isolamento — SVC035-MN-01)

  let clientWithSensorId = '';
  let clientCancelledId = '';
  let clientOnBId = '';

  async function cleanup() {
    await prisma.serviceInterest.deleteMany({
      where: { service: { authorPersonId: { in: [authorAId, authorBId].filter(Boolean) } } },
    });
    await prisma.service.deleteMany({ where: { authorPersonId: { in: [authorAId, authorBId].filter(Boolean) } } });
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Manifestacoes Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      await prisma.person.deleteMany({ where: { id: { in: stalePeople.map((p) => p.id) } } });
    }
  }

  beforeAll(async () => {
    await cleanup();

    const [authorA, authorB] = await Promise.all([
      prisma.person.create({ data: { fullName: 'Manifestacoes Int Prestador A', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Manifestacoes Int Prestador B', status: 'ATIVO' }, select: { id: true } }),
    ]);
    authorAId = authorA.id;
    authorBId = authorB.id;

    const [serviceA, servicePausedA, serviceB] = await Promise.all([
      prisma.service.create({
        data: { authorPersonId: authorAId, title: 'Manifestacoes Int Serviço A', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
      prisma.service.create({
        data: { authorPersonId: authorAId, title: 'Manifestacoes Int Serviço A Pausado', status: 'PAUSED', publishedAt: new Date() },
        select: { id: true },
      }),
      prisma.service.create({
        data: { authorPersonId: authorBId, title: 'Manifestacoes Int Serviço B', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
    ]);
    serviceAId = serviceA.id;
    servicePausedAId = servicePausedA.id;
    serviceBId = serviceB.id;

    const [clientWithSensor, clientCancelled, clientOnB] = await Promise.all([
      prisma.person.create({
        data: {
          fullName: 'Manifestacoes Int Cliente Sensor',
          status: 'ATIVO',
          emailLogin: `sensor.manifestacoes.int.${Date.now()}@example.com`,
          phone: '11977776666',
          cpf: CPF_SENSOR,
          fullAddress: ENDERECO_SENSOR,
          birthDate: new Date('1990-01-01'),
        },
        select: { id: true },
      }),
      prisma.person.create({ data: { fullName: 'Manifestacoes Int Cliente Cancelado', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Manifestacoes Int Cliente NoB', status: 'ATIVO' }, select: { id: true } }),
    ]);
    clientWithSensorId = clientWithSensor.id;
    clientCancelledId = clientCancelled.id;
    clientOnBId = clientOnB.id;

    await prisma.serviceInterest.createMany({
      data: [
        { serviceId: serviceAId, clientPersonId: clientWithSensorId, interestedAt: new Date('2026-07-01T10:00:00Z') },
        {
          serviceId: serviceAId,
          clientPersonId: clientCancelledId,
          interestedAt: new Date('2026-07-01T09:00:00Z'),
          cancelledAt: new Date('2026-07-01T11:00:00Z'),
        },
        { serviceId: servicePausedAId, clientPersonId: clientWithSensorId, interestedAt: new Date('2026-07-01T08:00:00Z') },
        { serviceId: serviceBId, clientPersonId: clientOnBId, interestedAt: new Date('2026-07-01T10:00:00Z') },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('@ac-035-1 happy path: só manifestações ATIVAS dos serviços do prestador, ordenadas por interestedAt desc', async () => {
    const res = await listProviderInterests(viewerFor(authorAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.total).toBe(2); // 2 ativas do autor A (a cancelada não conta)
    expect(res.data.interests.map((i) => i.service.id)).toEqual([serviceAId, servicePausedAId]); // desc por interestedAt
  });

  it('@svc035-mn-01 prestador B não vê manifestações do serviço do prestador A', async () => {
    const res = await listProviderInterests(viewerFor(authorBId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.total).toBe(1);
    expect(res.data.interests.map((i) => i.service.id)).toEqual([serviceBId]);
    expect(res.data.interests.some((i) => i.clientName.includes('Sensor'))).toBe(false);
  });

  it('@svc035-mn-03 manifestação cancelada é excluída da lista', async () => {
    const res = await listProviderInterests(viewerFor(authorAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.interests.some((i) => i.clientName === 'Manifestacoes Int Cliente Cancelado')).toBe(false);
  });

  it('§D4: serviço PAUSED com manifestação ativa ainda aparece no inbox', async () => {
    const res = await listProviderInterests(viewerFor(authorAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.interests.some((i) => i.service.id === servicePausedAId)).toBe(true);
  });

  it('@svc035-mn-02 sensor: CPF e endereço do cliente NÃO aparecem no payload serializado', async () => {
    const res = await listProviderInterests(viewerFor(authorAId));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const serialized = JSON.stringify(res.data);
    expect(serialized).not.toContain(CPF_SENSOR);
    expect(serialized).not.toContain(ENDERECO_SENSOR);
  });

  it('registra SENSITIVE_FIELD_VIEWED por cliente exibido', async () => {
    const res = await listProviderInterests(viewerFor(authorAId));
    expect(res.ok).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SENSITIVE_FIELD_VIEWED', entityType: 'person', entityId: clientWithSensorId },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorPersonId).toBe(authorAId);
  });

  it('prestador sem manifestações → lista vazia, sem erro', async () => {
    const emptyAuthor = await prisma.person.create({
      data: { fullName: 'Manifestacoes Int Prestador Vazio', status: 'ATIVO' },
      select: { id: true },
    });
    const res = await listProviderInterests(viewerFor(emptyAuthor.id));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.interests).toEqual([]);
    expect(res.data.total).toBe(0);
    await prisma.person.delete({ where: { id: emptyAuthor.id } });
  });
});
