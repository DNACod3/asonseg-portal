import { describe, it, expect, afterAll } from 'vitest';

/**
 * Teste de integração de `countActivePersons` (USP-067 — T8 / PNL-07, A-12).
 * Requer Postgres local (`supabase start`).
 *
 * Cobre: uma Pessoa `ATIVO` recém-criada incrementa a contagem; uma Pessoa
 * `INATIVO` não entra na contagem (delta antes/depois, robusto a dados
 * pré-existentes no banco).
 */

const { prisma } = await import('@/shared/lib/prisma');
const { countActivePersons } = await import('../queries/count-active-persons');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('countActivePersons — integração (T8)', () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    await prisma.person.deleteMany({ where: { id: { in: createdIds } } });
  });

  it('Pessoa ATIVO incrementa a contagem em 1', async () => {
    const before = await countActivePersons();

    const person = await prisma.person.create({
      data: { fullName: 'Count Active Persons Int Ativa', status: 'ATIVO' },
      select: { id: true },
    });
    createdIds.push(person.id);

    const after = await countActivePersons();
    expect(after).toBe(before + 1);
  });

  it('Pessoa INATIVO não entra na contagem', async () => {
    const before = await countActivePersons();

    const person = await prisma.person.create({
      data: { fullName: 'Count Active Persons Int Inativa', status: 'INATIVO' },
      select: { id: true },
    });
    createdIds.push(person.id);

    const after = await countActivePersons();
    expect(after).toBe(before);
  });
});
