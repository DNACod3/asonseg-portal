import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração de `getMyActiveServiceInterest` (F7, review PR #284).
 * Requer Postgres local (`supabase start`). O `where: { …, cancelledAt: null }`
 * só era mockado no page test — este teste prova o filtro real contra o DB.
 *
 * Semeia um serviço ACTIVE + um client com **duas** manifestações para o
 * mesmo par (client, service): uma cancelada e uma ativa — o índice único
 * parcial `uq_service_interest_active` (só sobre `cancelled_at IS NULL`)
 * permite coexistirem. Cobre: retorna o id da ativa e nunca o da cancelada
 * (AC-F7-1/2); só cancelada → `null`.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getMyActiveServiceInterest } = await import('../queries/get-my-service-interest');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('getMyActiveServiceInterest — integração (F7)', () => {
  let authorId = '';
  let serviceId = '';
  let serviceOnlyCancelledId = '';
  let clientId = '';
  let activeInterestId = '';

  beforeAll(async () => {
    const author = await prisma.person.create({
      data: { fullName: 'GetMyServiceInterest Int Prestador', status: 'ATIVO' },
      select: { id: true },
    });
    authorId = author.id;

    const [service, serviceOnlyCancelled] = await Promise.all([
      prisma.service.create({
        data: { authorPersonId: authorId, title: 'GetMyServiceInterest Int Serviço', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
      prisma.service.create({
        data: { authorPersonId: authorId, title: 'GetMyServiceInterest Int Serviço Só Cancelada', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
    ]);
    serviceId = service.id;
    serviceOnlyCancelledId = serviceOnlyCancelled.id;

    const client = await prisma.person.create({
      data: { fullName: 'GetMyServiceInterest Int Cliente', status: 'ATIVO' },
      select: { id: true },
    });
    clientId = client.id;

    // Cancelada — coexiste com a ativa abaixo graças ao índice parcial.
    await prisma.serviceInterest.create({
      data: { serviceId, clientPersonId: clientId, cancelledAt: new Date() },
    });
    const active = await prisma.serviceInterest.create({
      data: { serviceId, clientPersonId: clientId, cancelledAt: null },
      select: { id: true },
    });
    activeInterestId = active.id;

    // Serviço/cliente só com interesse cancelado (caso extra → null).
    await prisma.serviceInterest.create({
      data: { serviceId: serviceOnlyCancelledId, clientPersonId: clientId, cancelledAt: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.serviceInterest.deleteMany({ where: { clientPersonId: clientId } });
    await prisma.service.deleteMany({ where: { authorPersonId: authorId } });
    await prisma.person.deleteMany({ where: { id: { in: [authorId, clientId] } } });
  });

  it('AC-F7-1/AC-F7-2: retorna o id da manifestação ATIVA e nunca o da CANCELADA', async () => {
    // A cancelada foi criada antes da ativa — se o filtro `cancelledAt:null`
    // fosse removido, `findFirst` (sem `orderBy`) tenderia a devolver a
    // cancelada (inserida primeiro): mata a mutação de remover o filtro.
    const result = await getMyActiveServiceInterest(serviceId, clientId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(activeInterestId);
  });

  it('só interesse cancelado para o par (client, service) → null', async () => {
    const result = await getMyActiveServiceInterest(serviceOnlyCancelledId, clientId);
    expect(result).toBeNull();
  });
});
