import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Teste de integração de `listProviderServices` (F6, review PR #284). Requer
 * Postgres local (`supabase start`). O `where: { authorPersonId }` só era
 * validado por "a query foi chamada com o id certo" no page test — este teste
 * prova o escopo real contra o DB.
 *
 * Cobre: serviço do próprio prestador aparece na lista; serviço de **outro**
 * `authorPersonId` não vaza (AC-F6-1).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listProviderServices } = await import('../queries/list-provider-services');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('listProviderServices — integração (F6)', () => {
  let authorAId = '';
  let authorBId = '';
  let serviceAId = '';
  let serviceBId = '';

  beforeAll(async () => {
    const [authorA, authorB] = await Promise.all([
      prisma.person.create({
        data: { fullName: 'ListProviderServices Int Prestador A', status: 'ATIVO' },
        select: { id: true },
      }),
      prisma.person.create({
        data: { fullName: 'ListProviderServices Int Prestador B', status: 'ATIVO' },
        select: { id: true },
      }),
    ]);
    authorAId = authorA.id;
    authorBId = authorB.id;

    const [serviceA, serviceB] = await Promise.all([
      prisma.service.create({
        data: { authorPersonId: authorAId, title: 'ListProviderServices Int Serviço A', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
      prisma.service.create({
        data: { authorPersonId: authorBId, title: 'ListProviderServices Int Serviço B', status: 'ACTIVE', publishedAt: new Date() },
        select: { id: true },
      }),
    ]);
    serviceAId = serviceA.id;
    serviceBId = serviceB.id;
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { authorPersonId: { in: [authorAId, authorBId] } } });
    await prisma.person.deleteMany({ where: { id: { in: [authorAId, authorBId] } } });
  });

  it('AC-F6-1: inclui o serviço do autor A e exclui o serviço do autor B', async () => {
    const rows = await listProviderServices(authorAId);
    const ids = rows.map((r) => r.id);

    expect(ids).toContain(serviceAId);
    expect(ids).not.toContain(serviceBId);
  });
});
