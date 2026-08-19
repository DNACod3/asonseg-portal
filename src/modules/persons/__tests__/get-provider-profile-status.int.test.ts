import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Teste de integração de `getProviderProfileStatus` (USP-067 — T2 / PNL-02,
 * A-04). Requer Postgres local (`supabase start`).
 *
 * Cobre: status presente e ausente (Pessoa sem `ProviderProfile` → `null`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getProviderProfileStatus } = await import('../queries/get-provider-profile-status');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('getProviderProfileStatus — integração (T2)', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await prisma.providerProfile.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
    createdIds.length = 0;
  });

  it('Pessoa com ProviderProfile: retorna o publicationStatus', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Prestador Teste', status: 'ATIVO' } });
    await prisma.providerProfile.create({
      data: { personId: id, publicationStatus: 'DRAFT' },
    });
    createdIds.push(id);

    const status = await getProviderProfileStatus(id);
    expect(status).toBe('DRAFT');
  });

  it('Pessoa sem ProviderProfile: retorna null', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Sem Perfil PJ', status: 'ATIVO' } });
    createdIds.push(id);

    const status = await getProviderProfileStatus(id);
    expect(status).toBeNull();
  });
});
