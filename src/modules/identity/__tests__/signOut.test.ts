import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * USP-049 — LOGOUT-01, LOGOUT-02, LOGOUT-MN-01.
 *
 * `signOutAction`: gate de sessão (`getCurrentPerson`) → `supabase.auth.signOut()`
 * → `redirect('/login')`. Idempotente (sem sessão, ainda redireciona).
 * LOGOUT-MN-01: a sessão NÃO DEVE prosseguir a navegação sem antes encerrar
 * a sessão no provedor.
 */

const sessionState = vi.hoisted(() => ({ getCurrentPerson: vi.fn() }));
const supaState = vi.hoisted(() => ({ signOut: vi.fn() }));
const navState = vi.hoisted(() => ({ redirected: [] as string[], callOrder: [] as string[] }));

class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    navState.redirected.push(to);
    navState.callOrder.push('redirect');
    throw new RedirectError(to);
  },
}));

vi.mock('../server/session', () => ({
  getCurrentPerson: (...a: unknown[]) => sessionState.getCurrentPerson(...a),
}));

vi.mock('@/shared/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      signOut: (...a: unknown[]) => {
        navState.callOrder.push('signOut');
        return supaState.signOut(...a);
      },
    },
  }),
}));

const { signOutAction } = await import('../actions/signOut');

beforeEach(() => {
  vi.clearAllMocks();
  navState.redirected = [];
  navState.callOrder = [];
  sessionState.getCurrentPerson.mockResolvedValue({ id: 'person-1' });
  supaState.signOut.mockResolvedValue({ error: null });
});

describe('signOutAction', () => {
  it('happy path: chama getCurrentPerson (gate), supabase.auth.signOut e redireciona a /login (LOGOUT-01)', async () => {
    await expect(signOutAction()).rejects.toBeInstanceOf(RedirectError);
    expect(sessionState.getCurrentPerson).toHaveBeenCalledTimes(1);
    expect(supaState.signOut).toHaveBeenCalledTimes(1);
    expect(navState.redirected).toEqual(['/login']);
  });

  it('LOGOUT-MN-01: supabase.auth.signOut é invocado ANTES do redirect', async () => {
    await expect(signOutAction()).rejects.toBeInstanceOf(RedirectError);
    expect(navState.callOrder).toEqual(['signOut', 'redirect']);
  });

  it('idempotente: sem sessão ativa (getCurrentPerson → null), ainda redireciona a /login (LOGOUT-02)', async () => {
    sessionState.getCurrentPerson.mockResolvedValue(null);
    await expect(signOutAction()).rejects.toBeInstanceOf(RedirectError);
    expect(navState.redirected).toEqual(['/login']);
    expect(supaState.signOut).toHaveBeenCalledTimes(1);
  });
});
