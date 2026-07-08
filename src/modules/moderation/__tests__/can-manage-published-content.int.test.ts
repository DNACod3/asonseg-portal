import { describe, it, expect, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Teste de integração do guard `canManagePublishedContent` (USP-018 / T5 / INACT-06).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — coordenador (permissão inerente) e voluntário com
 * delegação ATIVA de `INACTIVATE_PUBLISHED_CONTENT` acessam; delegação revogada
 * e Pessoa sem nenhuma delegação NÃO acessam.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { canManagePublishedContent } = await import('../server/moderation-access');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function personFixture(id: string, roles: string[]): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Pessoa Guard Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('canManagePublishedContent — integração (USP-018 / T5)', () => {
  const personIds: string[] = [];

  async function makePerson(): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Guard Int', status: 'ATIVO' } });
    personIds.push(id);
    return id;
  }

  afterAll(async () => {
    await prisma.delegatedPermission.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  });

  it('coordenador acessa por permissão inerente (sem delegação)', async () => {
    const id = await makePerson();
    const person = personFixture(id, ['COORDINATOR']);
    expect(await canManagePublishedContent(person)).toBe(true);
  });

  it('voluntário com delegação ATIVA de INACTIVATE_PUBLISHED_CONTENT acessa', async () => {
    const id = await makePerson();
    const grantor = await makePerson();
    await prisma.delegatedPermission.create({
      data: { personId: id, permission: 'INACTIVATE_PUBLISHED_CONTENT', grantedBy: grantor },
    });
    const person = personFixture(id, ['VOLUNTEER']);
    expect(await canManagePublishedContent(person)).toBe(true);
  });

  it('voluntário com delegação REVOGADA não acessa', async () => {
    const id = await makePerson();
    const grantor = await makePerson();
    await prisma.delegatedPermission.create({
      data: {
        personId: id,
        permission: 'INACTIVATE_PUBLISHED_CONTENT',
        grantedBy: grantor,
        revokedAt: new Date(),
        revokedBy: grantor,
      },
    });
    const person = personFixture(id, ['VOLUNTEER']);
    expect(await canManagePublishedContent(person)).toBe(false);
  });

  it('Pessoa sem papel de coordenador e sem delegação não acessa', async () => {
    const id = await makePerson();
    const person = personFixture(id, ['CANDIDATE']);
    expect(await canManagePublishedContent(person)).toBe(false);
  });
});
