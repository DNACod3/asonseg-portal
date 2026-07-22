import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * USP-061 — APP-SHELL-01, -03, -04; ângulo composition-root de MN-03.
 * USP-062 — BNAV-01; ângulo composition-root de BNAV-MN-02.
 * Round 2 — USP-064 (SIDE-01, ângulo composition-root de SIDE-MN-02,
 * substitui o `AppDesktopMenu` da USP-063 por `AppSidebar`); USP-065
 * (PROF-MN-05, reframe de APP-SHELL-MN-01: trigger de perfil sempre visível
 * + "Sair" alcançável ao abrir).
 *
 * `requireActivePerson` e `canAccessModerationQueue` são mockados (sessão +
 * guard ao vivo); `describeActiveRoles`, `hubAccessFromRoles`,
 * `buildHubLinks`, `selectPrimaryTabs` e os componentes de casca
 * (`AppShell`/`AppBottomNav`/`AppSidebar`/`AppHeader`/`ProfileMenu`)
 * permanecem reais — já cobertos exaustivamente pelos próprios testes
 * unitários/RTL. `usePathname` é mockado (os componentes de nav o usam para
 * active-state). Padrão espelha `inicio/page.test.tsx`
 * (`vi.mock('@/modules/identity')`).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canAccessModerationQueue: vi.fn(),
}));

const navState = vi.hoisted(() => ({ pathname: '/inicio' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

vi.mock('@/modules/identity', async () => {
  const rolesDomain = await vi.importActual<typeof import('@/modules/identity/domain/roles')>(
    '@/modules/identity/domain/roles',
  );
  const hubLinksDomain = await vi.importActual<typeof import('@/modules/identity/domain/hub-links')>(
    '@/modules/identity/domain/hub-links',
  );
  const appNavDomain = await vi.importActual<typeof import('@/modules/identity/domain/app-nav')>(
    '@/modules/identity/domain/app-nav',
  );
  return {
    describeActiveRoles: rolesDomain.describeActiveRoles,
    hubAccessFromRoles: hubLinksDomain.hubAccessFromRoles,
    buildHubLinks: hubLinksDomain.buildHubLinks,
    selectPrimaryTabs: appNavDomain.selectPrimaryTabs,
    pickActiveHref: appNavDomain.pickActiveHref,
    requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
    SignOutForm: () => <button type="button">Sair</button>,
  };
});

vi.mock('@/modules/moderation', () => ({
  canAccessModerationQueue: (...a: unknown[]) => guardState.canAccessModerationQueue(...a),
}));

const { default: AppLayout } = await import('./layout');

beforeEach(() => {
  vi.clearAllMocks();
  navState.pathname = '/inicio';
  guardState.canAccessModerationQueue.mockResolvedValue(false);
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
    // O rótulo de papel mora dentro do painel do ProfileMenu (USP-065) — abre
    // o menu antes de verificar o data-testid estável.
    fireEvent.click(screen.getByRole('button', { name: /menu de perfil/i }));
    expect(screen.getByTestId('app-header-role-label')).toHaveTextContent('Candidato(a)');
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
    // Verifica a AUSÊNCIA do nó do rótulo diretamente (não um proxy de texto) —
    // mata o mutante que remove a guarda `roleLabel &&` no ProfileMenu.
    fireEvent.click(screen.getByRole('button', { name: /menu de perfil/i }));
    expect(screen.queryByTestId('app-header-role-label')).not.toBeInTheDocument();
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

describe('AppLayout (app) — injeta sidebar/bottomNav role-aware (USP-062/064, BNAV-01/SIDE-01)', () => {
  it('Pessoa CANDIDATE: ambos os seams renderizam conteúdo role-aware (aba/link de /candidato)', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana Candidata',
      roles: ['CANDIDATE'],
    });

    const ui = await AppLayout({ children: <main>página</main> });
    render(ui);

    // bottomNav (AppBottomNav): aba "Candidato" sempre no DOM (md:hidden via CSS, não via unmount).
    expect(screen.getByRole('link', { name: 'Candidato' })).toHaveAttribute('href', '/candidato');

    // sidebar (AppSidebar): sempre visível (hidden md:flex via CSS, não disclosure) — link completo.
    expect(screen.getByRole('link', { name: 'Área do candidato' })).toHaveAttribute(
      'href',
      '/candidato',
    );
  });

  it('BNAV-MN-02/SIDE-MN-02 (negativo composição): Pessoa sem acesso a moderação — nenhum link/aba de /moderacao em nenhum dos dois seams', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana Candidata',
      roles: ['CANDIDATE'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await AppLayout({ children: <main>página</main> });
    render(ui);

    expect(screen.queryByRole('link', { name: /moderação/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fila de moderação' })).not.toBeInTheDocument();
  });

  it('regressão USP-061/PROF-MN-05: header (marca→/inicio) e o trigger de perfil seguem presentes; "Sair" alcançável ao abrir', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana Candidata',
      roles: ['CANDIDATE'],
    });

    const ui = await AppLayout({ children: <main>página</main> });
    render(ui);

    const brandLink = screen.getByRole('link', { name: /ASONSEG/ });
    expect(brandLink).toHaveAttribute('href', '/inicio');

    const trigger = screen.getByRole('button', { name: /menu de perfil/i });
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('canAccessModerationQueue é chamado com a Pessoa da sessão (guard ao vivo no composition-root)', async () => {
    const person = { id: 'p-mod', fullName: 'Ana', roles: ['COORDINATOR'] };
    guardState.requireActivePerson.mockResolvedValue(person);
    guardState.canAccessModerationQueue.mockResolvedValue(true);

    const ui = await AppLayout({ children: <main>página</main> });
    render(ui);

    expect(guardState.canAccessModerationQueue).toHaveBeenCalledWith(person);
    // moderation=true (COORDINATOR + guard ao vivo) → aba/link de /moderacao presente.
    expect(screen.getByRole('link', { name: 'Moderação' })).toHaveAttribute('href', '/moderacao');
  });
});
