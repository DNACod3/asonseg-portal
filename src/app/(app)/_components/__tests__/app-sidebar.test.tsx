import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * USP-064 — SIDE-01, -02, -03, -04, -05, -06; SIDE-MN-01, -02, -03, -04, -05.
 * `usePathname` mockado (padrão do repo: mock hoisted + import após o mock,
 * molde `app-desktop-menu.test.tsx`/`public-nav.test.tsx`).
 */
const navState = vi.hoisted(() => ({ pathname: '/inicio' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

const { AppSidebar } = await import('../app-sidebar');
const { buildHubLinks, hubAccessFromRoles, EXISTING_HUB_ROUTES } = await import('@/modules/identity');

const FULL_ACCESS = {
  candidate: true,
  provider: true,
  companyResponsible: true,
  moderation: true,
  referral: true,
  assistedRegistration: true,
  credentialClaim: true,
  reports: true,
  permissions: true,
};

describe('AppSidebar — expandido/colapsado + persistência (SIDE-02/03)', () => {
  beforeEach(() => {
    navState.pathname = '/inicio';
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('expandida por padrão: mostra rótulos de link e títulos de grupo', () => {
    render(<AppSidebar groups={buildHubLinks(FULL_ACCESS)} />);
    expect(screen.getByText('Minha conta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meu perfil' })).toBeInTheDocument();
  });

  it('toggle recolhe a sidebar (rótulos/títulos somem) e grava localStorage', () => {
    render(<AppSidebar groups={buildHubLinks(FULL_ACCESS)} />);
    const toggle = screen.getByRole('button', { name: 'Recolher menu lateral' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText('Minha conta')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('asonseg:sidebar-collapsed')).toBe('true');
  });

  it('lê a preferência salva no localStorage ao montar (colapsada)', () => {
    window.localStorage.setItem('asonseg:sidebar-collapsed', 'true');
    render(<AppSidebar groups={buildHubLinks(FULL_ACCESS)} />);
    expect(screen.queryByText('Minha conta')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('degrada sem lançar quando localStorage está indisponível (default expandida)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage indisponível');
    });
    expect(() => render(<AppSidebar groups={buildHubLinks(FULL_ACCESS)} />)).not.toThrow();
    expect(screen.getByText('Minha conta')).toBeInTheDocument();
  });
});

describe('AppSidebar — grupos role-aware (SIDE-01)', () => {
  it('renderiza só os grupos passados, agrupados pelo título', () => {
    const access = { ...hubAccessFromRoles(['CANDIDATE']), moderation: false };
    render(<AppSidebar groups={buildHubLinks(access)} />);

    expect(screen.getByText('Minha conta')).toBeInTheDocument();
    expect(screen.getByText('Meus papéis')).toBeInTheDocument();
    expect(screen.queryByText('Institucional')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Área do candidato' })).toHaveAttribute(
      'href',
      '/candidato',
    );
  });
});

describe('AppSidebar — active-state por rota (SIDE-04)', () => {
  it('marca /perfil ativo em /perfil', () => {
    navState.pathname = '/perfil';
    render(<AppSidebar groups={buildHubLinks({ ...hubAccessFromRoles([]), moderation: false })} />);
    expect(screen.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it('caso aninhado: em /perfil/papeis, o link ativo é "Ativar um papel" (/perfil/papeis), não "Meu perfil" (/perfil)', () => {
    navState.pathname = '/perfil/papeis';
    render(<AppSidebar groups={buildHubLinks({ ...hubAccessFromRoles([]), moderation: false })} />);
    expect(screen.getByRole('link', { name: 'Ativar um papel' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Meu perfil' })).not.toHaveAttribute('aria-current');
  });

  it('pathname sem correspondência: nenhum link fica ativo', () => {
    navState.pathname = '/rota-nunca-mapeada';
    render(<AppSidebar groups={buildHubLinks({ ...hubAccessFromRoles([]), moderation: false })} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });
});

describe('AppSidebar — responsivo (SIDE-05)', () => {
  it('o wrapper tem hidden md:flex', () => {
    const { container } = render(<AppSidebar groups={buildHubLinks(FULL_ACCESS)} />);
    expect(container.firstElementChild?.className).toMatch(/\bhidden\b/);
    expect(container.firstElementChild?.className).toMatch(/\bmd:flex\b/);
  });
});

describe('AppSidebar — SIDE-MN-01 (negativo: nenhum link fora da allowlist)', () => {
  it('com groups de acesso total, todo href de âncora ∈ EXISTING_HUB_ROUTES', () => {
    render(<AppSidebar groups={buildHubLinks(FULL_ACCESS)} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href && (EXISTING_HUB_ROUTES as readonly string[]).includes(href)).toBe(true);
    }
  });
});

describe('AppSidebar — SIDE-MN-02 (negativo: sem grupo/link sem permissão)', () => {
  it('candidate-only → sem grupo Institucional nem links de moderação/relatórios', () => {
    const access = { ...hubAccessFromRoles(['CANDIDATE']), moderation: false };
    render(<AppSidebar groups={buildHubLinks(access)} />);
    expect(screen.queryByText('Institucional')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fila de moderação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Relatórios' })).not.toBeInTheDocument();
  });
});

describe('AppSidebar — SIDE-MN-05 (negativo: colapsada mantém nome acessível)', () => {
  it('colapsada, cada link mantém um accessible name (aria-label/title)', () => {
    render(<AppSidebar groups={buildHubLinks(FULL_ACCESS)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recolher menu lateral' }));

    expect(screen.getByRole('link', { name: 'Meu perfil' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Área do candidato' })).toHaveAttribute(
      'title',
      'Área do candidato',
    );
  });
});
