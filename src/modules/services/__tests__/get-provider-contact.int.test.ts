import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Testes de integração de `getProviderContactForService` (USP-033 — AC-033-5 /
 * SVC033-MN-01). Requer Postgres local (`supabase start`).
 *
 * Cobre: cliente COM manifestação ativa → contato completo; cliente SEM
 * manifestação (ou com manifestação cancelada) → `null` — e o sensor de
 * não-vazamento (o payload serializado nunca contém telefone/e-mail quando
 * `null` é retornado).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getProviderContactForService } = await import('../queries/get-provider-contact');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

const PHONE_SENSOR = '11999998888';
const EMAIL_SENSOR = 'prestador-contato-int@example.com';

skipIfNoDb('getProviderContactForService — integração', () => {
  let authorId = '';
  let serviceId = '';
  let clientWithInterestId = '';
  let clientWithoutInterestId = '';
  let clientCancelledId = '';

  async function cleanup() {
    const stalePeople = await prisma.person.findMany({
      where: { fullName: { startsWith: 'Contato Int' } },
      select: { id: true },
    });
    if (stalePeople.length > 0) {
      const ids = stalePeople.map((p) => p.id);
      await prisma.serviceInterest.deleteMany({ where: { OR: [{ clientPersonId: { in: ids } }, { service: { authorPersonId: { in: ids } } }] } });
      await prisma.service.deleteMany({ where: { authorPersonId: { in: ids } } });
      await prisma.person.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    await cleanup();

    const author = await prisma.person.create({
      data: {
        fullName: 'Contato Int Prestador',
        status: 'ATIVO',
        phone: PHONE_SENSOR,
        emailLogin: EMAIL_SENSOR,
      },
      select: { id: true },
    });
    authorId = author.id;

    const service = await prisma.service.create({
      data: { authorPersonId: authorId, title: 'Serviço Contato Int', status: 'ACTIVE', publishedAt: new Date() },
      select: { id: true },
    });
    serviceId = service.id;

    const [withInterest, withoutInterest, cancelled] = await Promise.all([
      prisma.person.create({ data: { fullName: 'Contato Int Cliente Ativo', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Contato Int Cliente SemInteresse', status: 'ATIVO' }, select: { id: true } }),
      prisma.person.create({ data: { fullName: 'Contato Int Cliente Cancelado', status: 'ATIVO' }, select: { id: true } }),
    ]);
    clientWithInterestId = withInterest.id;
    clientWithoutInterestId = withoutInterest.id;
    clientCancelledId = cancelled.id;

    await prisma.serviceInterest.create({
      data: { serviceId, clientPersonId: clientWithInterestId },
    });
    await prisma.serviceInterest.create({
      data: { serviceId, clientPersonId: clientCancelledId, cancelledAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  it('@ac-033-5 cliente com interesse ativo → contato completo', async () => {
    const contact = await getProviderContactForService(serviceId, clientWithInterestId);
    expect(contact).toEqual({
      displayName: 'Contato Int Prestador',
      phone: PHONE_SENSOR,
      email: EMAIL_SENSOR,
    });
  });

  it('SVC033-MN-01: cliente sem manifestação → null, sem vazar contato', async () => {
    const contact = await getProviderContactForService(serviceId, clientWithoutInterestId);
    expect(contact).toBeNull();
  });

  it('SVC033-MN-01: cliente com manifestação CANCELADA → null, sem vazar contato', async () => {
    const contact = await getProviderContactForService(serviceId, clientCancelledId);
    expect(contact).toBeNull();
  });

  it('serviço inexistente → null', async () => {
    const contact = await getProviderContactForService(
      '00000000-0000-0000-0000-000000000000',
      clientWithInterestId,
    );
    expect(contact).toBeNull();
  });
});
