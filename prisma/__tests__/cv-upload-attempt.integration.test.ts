import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Integração contra o Postgres local (Supabase CLI) — USP-040 / CVE-07 (T2).
 *
 * Cobre a tabela `cv_upload_attempts` (rate limit durável de upload de CV,
 * espelha `auth_attempts`): insert, contagem por `personId`/janela de tempo, e
 * `onDelete: Cascade` quando a Pessoa dona das tentativas é removida. Pulado
 * quando não há `DATABASE_URL` (mesmo padrão dos demais `*.integration.test.ts`).
 */
const { prisma } = await import('@/shared/lib/prisma');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('USP-040 / CVE-07 — tabela cv_upload_attempts (integração)', () => {
  let personId = '';

  beforeAll(async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Candidato CvUploadAttempt Int', status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
  });

  afterAll(async () => {
    await prisma.cvUploadAttempt.deleteMany({ where: { personId } });
    await prisma.person.deleteMany({ where: { id: personId } });
  });

  it('insere uma tentativa vinculada à Pessoa', async () => {
    const attempt = await prisma.cvUploadAttempt.create({ data: { personId } });
    expect(attempt.personId).toBe(personId);
    expect(attempt.createdAt).toBeInstanceOf(Date);
  });

  it('conta tentativas por personId dentro de uma janela de tempo', async () => {
    await prisma.cvUploadAttempt.deleteMany({ where: { personId } });
    const now = new Date();
    await prisma.cvUploadAttempt.createMany({
      data: [{ personId }, { personId }, { personId }],
    });
    const windowStart = new Date(now.getTime() - 60_000);
    const count = await prisma.cvUploadAttempt.count({
      where: { personId, createdAt: { gte: windowStart } },
    });
    expect(count).toBe(3);
  });

  it('onDelete: Cascade — remover a Pessoa remove suas tentativas de upload', async () => {
    const cascadePerson = await prisma.person.create({
      data: { fullName: 'Candidato Cascade Int', status: 'ATIVO' },
      select: { id: true },
    });
    await prisma.cvUploadAttempt.create({ data: { personId: cascadePerson.id } });

    await prisma.person.delete({ where: { id: cascadePerson.id } });

    const remaining = await prisma.cvUploadAttempt.count({
      where: { personId: cascadePerson.id },
    });
    expect(remaining).toBe(0);
  });
});
