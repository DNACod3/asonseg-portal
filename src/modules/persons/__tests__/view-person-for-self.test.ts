import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * USP-049 — PERFIL-01, PERFIL-03, PERFIL-MN-01 (unit — Prisma mockado).
 *
 * `viewPersonForSelf` serializa nome/e-mail/CPF-mascarado/papéis do titular;
 * a integração (`view-person-for-self.int.test.ts`) cobre a consulta real
 * (`status=ACTIVE`) e a resolução exclusiva pelo id passado.
 */

const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...a: unknown[]) => prismaState.findUnique(...a) } },
}));

const { viewPersonForSelf } = await import('../views/view-person-for-self');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('viewPersonForSelf', () => {
  it('happy path: serializa nome, e-mail, CPF mascarado e papéis ativos', async () => {
    prismaState.findUnique.mockResolvedValue({
      fullName: 'Maria da Silva',
      emailLogin: 'maria@example.com',
      cpf: '12345678909',
      roleGrants: [{ role: 'CANDIDATE' }, { role: 'PROVIDER' }],
    });

    const view = await viewPersonForSelf('person-1');

    expect(view).toEqual({
      fullName: 'Maria da Silva',
      emailLogin: 'maria@example.com',
      cpfMasked: '***.***.***-09',
      roles: ['CANDIDATE', 'PROVIDER'],
    });
    expect(prismaState.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'person-1' } }),
    );
  });

  it('consulta os roleGrants filtrando status=ACTIVE (PERFIL-03)', async () => {
    prismaState.findUnique.mockResolvedValue({
      fullName: 'X',
      emailLogin: 'x@example.com',
      cpf: '12345678909',
      roleGrants: [],
    });

    await viewPersonForSelf('person-1');

    const callArg = prismaState.findUnique.mock.calls[0]?.[0];
    expect(callArg.select.roleGrants.where).toEqual({ status: 'ACTIVE' });
  });

  it('Pessoa inexistente → null', async () => {
    prismaState.findUnique.mockResolvedValue(null);
    expect(await viewPersonForSelf('nao-existe')).toBeNull();
  });

  it('e-mail/CPF ausentes (nullable no schema) não quebram a serialização', async () => {
    prismaState.findUnique.mockResolvedValue({
      fullName: 'Sem Contato',
      emailLogin: null,
      cpf: null,
      roleGrants: [],
    });

    const view = await viewPersonForSelf('person-2');

    expect(view?.emailLogin).toBe('');
    expect(view?.cpfMasked).toBe('***.***.***-**');
    expect(view?.roles).toEqual([]);
  });
});
