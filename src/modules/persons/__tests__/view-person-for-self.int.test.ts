import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'node:crypto';

/**
 * USP-049 — PERFIL-03 (integração), PERFIL-MN-01 (negativo).
 *
 * Requer Postgres local (`supabase start`) e `DATABASE_URL` no env
 * (`npm run test:integration`). Sem mocks de Prisma — exercita a query real.
 */

const { prisma } = await import('@/shared/lib/prisma');
const { viewPersonForSelf } = await import('../views/view-person-for-self');

const skipIfNoDb = describe.skipIf(!process.env.DATABASE_URL);

skipIfNoDb('viewPersonForSelf — integração', () => {
  const createdIds: string[] = [];
  let cpfCounter = 0;

  /** CPF numérico de 11 dígitos, único por chamada (timestamp + contador). */
  function uniqueCpf(): string {
    cpfCounter += 1;
    return `${Date.now()}${cpfCounter}`.slice(-11).padStart(11, '0');
  }

  async function makePerson(opts: {
    fullName: string;
    email: string;
    cpf: string;
    roles?: { role: string; status: string }[];
  }): Promise<string> {
    const id = crypto.randomUUID();
    createdIds.push(id);
    await prisma.person.create({
      data: {
        id,
        fullName: opts.fullName,
        status: 'ATIVO',
        emailLogin: opts.email,
        cpf: opts.cpf,
        roleGrants: opts.roles
          ? { create: opts.roles.map((r) => ({ role: r.role as never, status: r.status as never })) }
          : undefined,
      },
    });
    return id;
  }

  afterEach(async () => {
    if (createdIds.length === 0) return;
    await prisma.personRoleGrant.deleteMany({ where: { personId: { in: createdIds } } });
    await prisma.person.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  });

  it('retorna só roleGrants com status=ACTIVE — um grant REVOKED não aparece (PERFIL-03)', async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const id = await makePerson({
      fullName: 'Titular Com Papéis',
      email: `titular-${suffix}@example.com`,
      cpf: uniqueCpf(),
      roles: [
        { role: 'CANDIDATE', status: 'ACTIVE' },
        { role: 'PROVIDER', status: 'REVOKED' },
      ],
    });

    const view = await viewPersonForSelf(id);

    expect(view).not.toBeNull();
    expect(view!.roles).toEqual(['CANDIDATE']);
    expect(view!.roles).not.toContain('PROVIDER');
  });

  it('PERFIL-MN-01: resolve exclusivamente pelo id passado — não vaza dados de outra Pessoa', async () => {
    const suffixA = crypto.randomUUID().slice(0, 8);
    const suffixB = crypto.randomUUID().slice(0, 8);
    const idA = await makePerson({
      fullName: 'Pessoa A',
      email: `pessoa-a-${suffixA}@example.com`,
      cpf: uniqueCpf(),
    });
    const idB = await makePerson({
      fullName: 'Pessoa B',
      email: `pessoa-b-${suffixB}@example.com`,
      cpf: uniqueCpf(),
    });

    const viewA = await viewPersonForSelf(idA);
    const viewB = await viewPersonForSelf(idB);

    expect(viewA?.fullName).toBe('Pessoa A');
    expect(viewA?.fullName).not.toBe(viewB?.fullName);
    expect(viewB?.fullName).toBe('Pessoa B');
  });
});
