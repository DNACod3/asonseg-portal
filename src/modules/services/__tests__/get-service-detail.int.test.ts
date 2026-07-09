import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Testes de integração da query de detalhe público `getActiveServiceDetail`
 * (USP-031 / T031-1). Requer Postgres local (`supabase start`).
 *
 * Cobre: ACTIVE de prestador ativo → row completo sem contato (AC-031-1);
 * SVC031-MN-02: PAUSED/ARCHIVED/DRAFT/IN_MODERATION/prestador-inativado → null.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getActiveServiceDetail } = await import('../queries/get-service-detail');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);
const anon: CurrentPerson | null = null;

skipIfNoDb('getActiveServiceDetail — integração', () => {
  let activeAuthorId = '';
  let inactiveAuthorId = '';
  const serviceIds: string[] = [];

  beforeAll(async () => {
    const activeAuthor = await prisma.person.create({
      data: { fullName: 'Autor Detalhe Int', status: 'ATIVO' },
      select: { id: true },
    });
    activeAuthorId = activeAuthor.id;

    const inactiveAuthor = await prisma.person.create({
      data: { fullName: 'Autor Inativo Detalhe Int', status: 'ATIVO', inactivatedAt: new Date() },
      select: { id: true },
    });
    inactiveAuthorId = inactiveAuthor.id;
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await prisma.person.deleteMany({ where: { id: { in: [activeAuthorId, inactiveAuthorId] } } });
  });

  async function createService(
    status: 'DRAFT' | 'IN_MODERATION' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
    authorPersonId = activeAuthorId,
  ) {
    const s = await prisma.service.create({
      data: {
        authorPersonId,
        title: 'Serviço Detalhe Int',
        description: 'Descrição de teste.',
        priceMin: 100,
        priceMax: 200,
        priceUnit: 'por hora',
        availabilityDescription: 'Sempre disponível.',
        status,
        publishedAt: status === 'ACTIVE' || status === 'PAUSED' || status === 'ARCHIVED' ? new Date() : null,
      },
      select: { id: true },
    });
    serviceIds.push(s.id);
    return s.id;
  }

  it('AC-031-1: serviço ACTIVE de prestador ativo → row completo sem contato', async () => {
    const id = await createService('ACTIVE');
    const row = await getActiveServiceDetail(id, anon);
    expect(row).not.toBeNull();
    expect(row).toMatchObject({ id, title: 'Serviço Detalhe Int' });
    expect(JSON.stringify(row)).not.toMatch(/phone|emailLogin/i);
  });

  it.each(['DRAFT', 'IN_MODERATION', 'PAUSED', 'ARCHIVED'] as const)(
    'SVC031-MN-02: serviço %s não é exposto (retorna null)',
    async (status) => {
      const id = await createService(status);
      expect(await getActiveServiceDetail(id, anon)).toBeNull();
    },
  );

  it('SVC031-MN-02: serviço ACTIVE de prestador inativado → null', async () => {
    const id = await createService('ACTIVE', inactiveAuthorId);
    expect(await getActiveServiceDetail(id, anon)).toBeNull();
  });

  it('serviço inexistente → null', async () => {
    expect(await getActiveServiceDetail('00000000-0000-0000-0000-000000000000', anon)).toBeNull();
  });
});
