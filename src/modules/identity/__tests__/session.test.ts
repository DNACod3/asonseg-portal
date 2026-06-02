import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Testes do gate de sessão autoritativo (USP-004 — T-08, ADR-0030):
 * `getCurrentPerson()` (revalidação por request, sem redirect) e
 * `requireActivePerson()` (confinamento de rota `(app)/*` com redirect).
 * Supabase Auth e Prisma são mockados.
 */

const supaState = vi.hoisted(() => ({ getUser: vi.fn() }));
const prismaState = vi.hoisted(() => ({ findUnique: vi.fn() }));
const navState = vi.hoisted(() => ({ redirected: [] as string[] }));

/** `redirect()` do Next lança para abortar o render; replicamos esse contrato. */
class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    navState.redirected.push(to);
    throw new RedirectError(to);
  },
}));

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: (...a: unknown[]) => supaState.getUser(...a) },
  }),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { person: { findUnique: (...a: unknown[]) => prismaState.findUnique(...a) } },
}));

const { getCurrentPerson, requireActivePerson } = await import('../server/session');

const ACTIVE_PERSON = {
  id: 'person-1',
  fullName: 'Maria Ativa',
  status: 'ATIVO' as const,
  supabaseUserId: 'user-1',
  credential: { primeiroAcesso: false },
  roleGrants: [{ role: 'CANDIDATO' }, { role: 'PRESTADOR' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  navState.redirected = [];
  supaState.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  prismaState.findUnique.mockResolvedValue(ACTIVE_PERSON);
});

describe('getCurrentPerson', () => {
  it('sem sessão (getUser null) → null, não consulta o banco', async () => {
    supaState.getUser.mockResolvedValue({ data: { user: null } });
    expect(await getCurrentPerson()).toBeNull();
    expect(prismaState.findUnique).not.toHaveBeenCalled();
  });

  it('Pessoa inexistente → null', async () => {
    prismaState.findUnique.mockResolvedValue(null);
    expect(await getCurrentPerson()).toBeNull();
  });

  it('Pessoa INATIVA → null (sessão não confere mais acesso — ADR-0030)', async () => {
    prismaState.findUnique.mockResolvedValue({ ...ACTIVE_PERSON, status: 'INATIVO' });
    expect(await getCurrentPerson()).toBeNull();
  });

  it('Pessoa sem supabaseUserId → null (edge defensivo)', async () => {
    prismaState.findUnique.mockResolvedValue({ ...ACTIVE_PERSON, supabaseUserId: null });
    expect(await getCurrentPerson()).toBeNull();
  });

  it('Pessoa ATIVA → CurrentPerson com papéis mapeados e primeiroAcesso', async () => {
    const person = await getCurrentPerson();
    expect(person).toEqual({
      id: 'person-1',
      supabaseUserId: 'user-1',
      fullName: 'Maria Ativa',
      status: 'ATIVO',
      primeiroAcesso: false,
      roles: ['CANDIDATO', 'PRESTADOR'],
    });
  });

  it('credential ausente → primeiroAcesso=false (default seguro)', async () => {
    prismaState.findUnique.mockResolvedValue({ ...ACTIVE_PERSON, credential: null });
    const person = await getCurrentPerson();
    expect(person?.primeiroAcesso).toBe(false);
  });

  it('limita roleGrants com take (paginação defensiva no hot path)', async () => {
    await getCurrentPerson();
    const arg = prismaState.findUnique.mock.calls[0]?.[0] as {
      select: { roleGrants: { take: number; where: unknown } };
    };
    expect(arg.select.roleGrants.take).toBeGreaterThan(0);
    expect(arg.select.roleGrants.where).toEqual({ status: 'ACTIVE' });
  });
});

describe('requireActivePerson', () => {
  it('não autenticado → redirect("/login")', async () => {
    supaState.getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireActivePerson()).rejects.toThrow('REDIRECT:/login');
    expect(navState.redirected).toEqual(['/login']);
  });

  it('Pessoa INATIVA → redirect("/login")', async () => {
    prismaState.findUnique.mockResolvedValue({ ...ACTIVE_PERSON, status: 'INATIVO' });
    await expect(requireActivePerson()).rejects.toThrow('REDIRECT:/login');
    expect(navState.redirected).toEqual(['/login']);
  });

  it('1º acesso → redirect("/trocar-senha")', async () => {
    prismaState.findUnique.mockResolvedValue({
      ...ACTIVE_PERSON,
      credential: { primeiroAcesso: true },
    });
    await expect(requireActivePerson()).rejects.toThrow('REDIRECT:/trocar-senha');
    expect(navState.redirected).toEqual(['/trocar-senha']);
  });

  it('1º acesso + allowFirstAccess → retorna a Pessoa sem redirecionar', async () => {
    prismaState.findUnique.mockResolvedValue({
      ...ACTIVE_PERSON,
      credential: { primeiroAcesso: true },
    });
    const person = await requireActivePerson({ allowFirstAccess: true });
    expect(person.id).toBe('person-1');
    expect(navState.redirected).toEqual([]);
  });

  it('Pessoa ATIVA fora do 1º acesso → retorna a Pessoa sem redirecionar', async () => {
    const person = await requireActivePerson();
    expect(person.id).toBe('person-1');
    expect(person.roles).toEqual(['CANDIDATO', 'PRESTADOR']);
    expect(navState.redirected).toEqual([]);
  });
});
