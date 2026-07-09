import { describe, it, expect, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Teste de integração dos guards de rota `canReferPersonToJob` e
 * `canRegisterReferralResult` (USP-037/038 / REF-MN-04 / REF38-MN-02 na rota).
 * Requer Postgres local (`supabase start`) e DATABASE_URL no env.
 *
 * Espelha `can-manage-published-content.int.test.ts` (moderation): papel
 * inerente (SOCIAL_ASSISTANT — único papel com ambas permissões na
 * ROLE_PERMISSIONS, ao lado de COORDINATOR) e VOLUNTEER com delegação ATIVA
 * acessam; delegação revogada e Pessoa sem papel inerente e sem delegação
 * (CANDIDATE) não acessam.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { canReferPersonToJob, canRegisterReferralResult } = await import('../route-access');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

function personFixture(id: string, roles: string[]): CurrentPerson {
  return {
    id,
    supabaseUserId: crypto.randomUUID(),
    fullName: 'Pessoa Guard Referrals Int',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

skipIfNoDb('route-access (referrals) — integração (REF-MN-04 / REF38-MN-02)', () => {
  const personIds: string[] = [];

  async function makePerson(): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Guard Referrals Int', status: 'ATIVO' } });
    personIds.push(id);
    return id;
  }

  afterAll(async () => {
    await prisma.delegatedPermission.deleteMany({ where: { personId: { in: personIds } } });
    await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  });

  describe('canReferPersonToJob', () => {
    it('assistente social acessa por permissão inerente (sem delegação)', async () => {
      const id = await makePerson();
      const person = personFixture(id, ['SOCIAL_ASSISTANT']);
      expect(await canReferPersonToJob(person)).toBe(true);
    });

    it('voluntário com delegação ATIVA de REFER_PERSON_TO_JOB acessa', async () => {
      const id = await makePerson();
      const grantor = await makePerson();
      await prisma.delegatedPermission.create({
        data: { personId: id, permission: 'REFER_PERSON_TO_JOB', grantedBy: grantor },
      });
      const person = personFixture(id, ['VOLUNTEER']);
      expect(await canReferPersonToJob(person)).toBe(true);
    });

    it('voluntário com delegação REVOGADA não acessa', async () => {
      const id = await makePerson();
      const grantor = await makePerson();
      await prisma.delegatedPermission.create({
        data: {
          personId: id,
          permission: 'REFER_PERSON_TO_JOB',
          grantedBy: grantor,
          revokedAt: new Date(),
          revokedBy: grantor,
        },
      });
      const person = personFixture(id, ['VOLUNTEER']);
      expect(await canReferPersonToJob(person)).toBe(false);
    });

    it('candidato sem papel inerente e sem delegação não acessa', async () => {
      const id = await makePerson();
      const person = personFixture(id, ['CANDIDATE']);
      expect(await canReferPersonToJob(person)).toBe(false);
    });
  });

  describe('canRegisterReferralResult', () => {
    it('assistente social acessa por permissão inerente (sem delegação)', async () => {
      const id = await makePerson();
      const person = personFixture(id, ['SOCIAL_ASSISTANT']);
      expect(await canRegisterReferralResult(person)).toBe(true);
    });

    it('voluntário com delegação ATIVA de REGISTER_REFERRAL_RESULT acessa', async () => {
      const id = await makePerson();
      const grantor = await makePerson();
      await prisma.delegatedPermission.create({
        data: { personId: id, permission: 'REGISTER_REFERRAL_RESULT', grantedBy: grantor },
      });
      const person = personFixture(id, ['VOLUNTEER']);
      expect(await canRegisterReferralResult(person)).toBe(true);
    });

    it('voluntário com delegação REVOGADA não acessa', async () => {
      const id = await makePerson();
      const grantor = await makePerson();
      await prisma.delegatedPermission.create({
        data: {
          personId: id,
          permission: 'REGISTER_REFERRAL_RESULT',
          grantedBy: grantor,
          revokedAt: new Date(),
          revokedBy: grantor,
        },
      });
      const person = personFixture(id, ['VOLUNTEER']);
      expect(await canRegisterReferralResult(person)).toBe(false);
    });

    it('candidato sem papel inerente e sem delegação não acessa', async () => {
      const id = await makePerson();
      const person = personFixture(id, ['CANDIDATE']);
      expect(await canRegisterReferralResult(person)).toBe(false);
    });
  });
});
