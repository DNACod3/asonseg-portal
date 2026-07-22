import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-061 — APP-SHELL-01, -03, -04; ângulo composition-root de MN-03.
 *
 * `requireActivePerson` é mockado (sessão); `describeActiveRoles` e
 * `AppShell` permanecem reais — já cobertos exaustivamente por
 * `identity/__tests__/roles.test.ts` e `_components/__tests__/app-shell.test.tsx`.
 * Padrão espelha `inicio/page.test.tsx` (`vi.mock('@/modules/identity')`).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
}));

vi.mock('@/modules/identity', async () => {
  const rolesDomain = await vi.importActual<typeof import('@/modules/identity/domain/roles')>(
    '@/modules/identity/domain/roles',
  );
  return {
    describeActiveRoles: rolesDomain.describeActiveRoles,
    requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
    SignOutForm: () => <button type="button">Sair</button>,
  };
});

const { default: AppLayout } = await import('./layout');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppLayout (app) — composition-root da casca', () => {
  it('APP-SHELL-01/03: monta a AppShell com o fullName e o rótulo de papel da sessão, envolvendo {children}', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana Candidata',
      roles: ['CANDIDATE'],
    });

    const ui = await AppLayout({ children: <main data-testid="page-content">página</main> });
    render(ui);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Ana Candidata')).toBeInTheDocument();
    expect(screen.getByText('Candidato(a)')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('APP-SHELL-04: Pessoa com roles=[] — a AppShell recebe roleLabel vazio (linha de papel omitida)', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-zero',
      fullName: 'Pessoa Sem Papel',
      roles: [],
    });

    const ui = await AppLayout({ children: <main>página</main> });
    render(ui);

    expect(screen.getByText('Pessoa Sem Papel')).toBeInTheDocument();
    expect(screen.queryByText('Candidato(a)')).not.toBeInTheDocument();
  });

  it('chama requireActivePerson() sem argumentos (herda o redirect a /trocar-senha no 1º acesso)', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana',
      roles: ['CANDIDATE'],
    });

    await AppLayout({ children: <main>página</main> });

    expect(guardState.requireActivePerson).toHaveBeenCalledWith();
  });
});
