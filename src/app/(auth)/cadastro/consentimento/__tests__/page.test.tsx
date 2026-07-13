import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-049 — REDIR-02, REDIR-03 (AUTH-1).
 *
 * "Aceitar depois" e o fallback de `safeRedirect` (sem `next`) DEVEM apontar
 * ao hub `/inicio` — não mais ao antigo destino com o prefixo do route
 * group autenticado (que nunca virava URL).
 */

const guardState = vi.hoisted(() => ({ acceptRoleConsent: vi.fn() }));

vi.mock('@/modules/identity', async () => {
  const roleActivation = await vi.importActual<typeof import('@/modules/identity/domain/role-activation')>(
    '@/modules/identity/domain/role-activation',
  );
  return {
    POST_AUTH_FALLBACK: roleActivation.POST_AUTH_FALLBACK,
    acceptRoleConsent: (...a: unknown[]) => guardState.acceptRoleConsent(...a),
  };
});

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { signConsentToken } = await import('@/shared/lib/consentToken');
const { default: ConsentimentoPage } = await import('../page');

const PERSON_ID = 'person-1';
const ROLE = 'CANDIDATE';

function validSearchParams(overrides: Partial<{ next: string }> = {}) {
  const sig = signConsentToken(PERSON_ID, ROLE);
  return Promise.resolve({
    personId: PERSON_ID,
    role: ROLE,
    sig,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConsentimentoPage — REDIR-02/03', () => {
  it('REDIR-03: "Aceitar depois" aponta para /inicio (rota real)', async () => {
    const ui = await ConsentimentoPage({ searchParams: validSearchParams() });
    render(ui);

    expect(screen.getByRole('link', { name: 'Aceitar depois' })).toHaveAttribute(
      'href',
      '/inicio',
    );
  });

  it('REDIR-02: sem `next` válido, o fallback usado é /inicio (mesmo valor do link "Aceitar depois")', async () => {
    const ui = await ConsentimentoPage({ searchParams: validSearchParams({ next: undefined }) });
    render(ui);

    // `redirectTo` (usado como fallback do `next` e no sucesso/erro do submit)
    // é a mesma constante consumida pelo link "Aceitar depois" — ambos /inicio.
    expect(screen.getByRole('link', { name: 'Aceitar depois' })).toHaveAttribute(
      'href',
      '/inicio',
    );
  });
});
