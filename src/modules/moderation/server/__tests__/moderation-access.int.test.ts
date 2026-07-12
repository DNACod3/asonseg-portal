import { describe, it, expect, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Teste de integração de `listViewerModeratableKinds` (USP-056 / MOD-7 / T3).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Real: Prisma/Postgres — coordenador (permissão inerente) → todos os
 * ContentKind; voluntário com delegação ATIVA de moderação → só os tipos
 * habilitados por ela (AD-021: `revokedAt: null`); delegação REVOGADA não conta.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { listViewerModeratableKinds } = await import('../moderation-access');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function personFixture(id: string, roles: string[]): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Pessoa Moderatable Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('listViewerModeratableKinds — integração (USP-056/MOD-7/T3)', () => {
  const personIds: string[] = [];

  async function makePerson(): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Moderatable Int', status: 'ATIVO' } });
    personIds.push(id);
    return id;
  }

  afterAll(async () => {
    await prisma.delegatedPermission.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  });

  it('coordenador acessa todos os ContentKind (sem delegação)', async () => {
    const id = await makePerson();
    const person = personFixture(id, ['COORDINATOR']);
    const kinds = await listViewerModeratableKinds(person);
    expect(kinds.sort()).toEqual(['CANDIDATE_PROFILE', 'CV', 'JOB', 'SERVICE'].sort());
  });

  it('voluntário com delegação ATIVA de MODERATE_JOB → só [JOB]', async () => {
    const id = await makePerson();
    const grantor = await makePerson();
    await prisma.delegatedPermission.create({
      data: { personId: id, permission: 'MODERATE_JOB', grantedBy: grantor },
    });
    const person = personFixture(id, ['VOLUNTEER']);
    expect(await listViewerModeratableKinds(person)).toEqual(['JOB']);
  });

  it('voluntário com delegação REVOGADA de MODERATE_SERVICE não conta (AD-021)', async () => {
    const id = await makePerson();
    const grantor = await makePerson();
    await prisma.delegatedPermission.create({
      data: {
        personId: id,
        permission: 'MODERATE_SERVICE',
        grantedBy: grantor,
        revokedAt: new Date(),
        revokedBy: grantor,
      },
    });
    const person = personFixture(id, ['VOLUNTEER']);
    expect(await listViewerModeratableKinds(person)).toEqual([]);
  });

  it('Pessoa sem papel de coordenador e sem delegação → []', async () => {
    const id = await makePerson();
    const person = personFixture(id, ['CANDIDATE']);
    expect(await listViewerModeratableKinds(person)).toEqual([]);
  });
});
