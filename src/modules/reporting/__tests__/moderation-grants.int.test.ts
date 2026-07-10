import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integração de `getModerationGrants` (extraído de 3 call sites duplicados —
 * `relatorios/page.tsx`, `relatorios/[tipo]/page.tsx`, `exportReport` —
 * PR#286). Requer Postgres local. Mesmo padrão de isolamento de
 * `report-jobs.int.test.ts`: prefixo de nome + cleanup em `beforeAll`/`afterAll`.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { getModerationGrants } = await import('../queries/moderation-grants');

const hasDb = Boolean(process.env.DATABASE_URL);

const NAME_PREFIX = 'ModerationGrantsInt';

async function cleanup(): Promise<void> {
  await prisma.delegatedPermission.deleteMany({ where: { person: { fullName: { startsWith: NAME_PREFIX } } } });
  await prisma.person.deleteMany({ where: { fullName: { startsWith: NAME_PREFIX } } });
}

describe.skipIf(!hasDb)('getModerationGrants (integração)', () => {
  let personId: string;

  beforeAll(async () => {
    await cleanup();
    const person = await prisma.person.create({
      data: { fullName: `${NAME_PREFIX} Volunteer`, status: 'ATIVO' },
      select: { id: true },
    });
    personId = person.id;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('sem nenhum DelegatedPermission → []', async () => {
    await expect(getModerationGrants(personId)).resolves.toEqual([]);
  });

  it('só retorna MODERATE_JOB/CV/SERVICE ativos — permissão fora da lista e grant revogado ficam de fora', async () => {
    await prisma.delegatedPermission.create({
      data: { personId, permission: 'MODERATE_JOB', grantedBy: personId },
    });
    await prisma.delegatedPermission.create({
      data: { personId, permission: 'MODERATE_CV', grantedBy: personId },
    });
    // Revogado — não deve aparecer no resultado.
    await prisma.delegatedPermission.create({
      data: {
        personId,
        permission: 'MODERATE_SERVICE',
        grantedBy: personId,
        revokedAt: new Date(),
        revokedBy: personId,
      },
    });

    const grants = await getModerationGrants(personId);
    const permissions = grants.map((g) => g.permission).sort();

    expect(permissions).toEqual(['MODERATE_CV', 'MODERATE_JOB']);
    expect(grants.every((g) => g.revokedAt === null)).toBe(true);
  });
});
