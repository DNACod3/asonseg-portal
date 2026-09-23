import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * Teste de integração de `getCandidateProfileStatus` (USP-067 — T1 / PNL-01,
 * A-04). Requer Postgres local (`supabase start`).
 *
 * Cobre: status presente (`publicationStatus` lido via `select` explícito) e
 * ausente (Pessoa sem `CandidateProfile` → `null`).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getCandidateProfileStatus } = await import('../queries/get-candidate-profile-status');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('getCandidateProfileStatus — integração (T1)', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await prisma.candidateProfile.deleteMany({ where: { personId: id } });
      await prisma.person.deleteMany({ where: { id } });
    }
    createdIds.length = 0;
  });

  it('Pessoa com CandidateProfile: retorna o publicationStatus', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Candidata Teste', status: 'ATIVO' } });
    await prisma.candidateProfile.create({
      data: { personId: id, publicationStatus: 'ACTIVE' },
    });
    createdIds.push(id);

    const status = await getCandidateProfileStatus(id);
    expect(status).toBe('ACTIVE');
  });

  it('Pessoa sem CandidateProfile: retorna null', async () => {
    const id = crypto.randomUUID();
    await prisma.person.create({ data: { id, fullName: 'Pessoa Sem Perfil', status: 'ATIVO' } });
    createdIds.push(id);

    const status = await getCandidateProfileStatus(id);
    expect(status).toBeNull();
  });
});
