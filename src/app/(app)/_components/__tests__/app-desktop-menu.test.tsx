import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * USP-063 — DNAV-01, -02, -03, -04, -05; DNAV-MN-01, -02.
 * `usePathname` mockado (padrão do repo: mock hoisted + import após o mock,
 * molde `public-nav.test.tsx`).
 */
const navState = vi.hoisted(() => ({ pathname: '/inicio' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

const { AppDesktopMenu } = await import('../app-desktop-menu');
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

describe('AppDesktopMenu — toggle disclosure (DNAV-04)', () => {
  beforeEach(() => {
    navState.pathname = '/inicio';
  });

  it('abre/fecha o painel ao clicar no botão (aria-expanded + painel no DOM)', () => {
    render(<AppDesktopMenu groups={buildHubLinks(FULL_ACCESS)} />);
    const button = screen.getByRole('button', { name: /menu de navegação/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'app-menu-panel');
    expect(document.getElementById('app-menu-panel')).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('app-menu-panel')).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('app-menu-panel')).not.toBeInTheDocument();
  });

  it('fecha o painel ao clicar num link', () => {
    render(<AppDesktopMenu groups={buildHubLinks({ ...FULL_ACCESS })} />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    const link = screen.getByRole('link', { name: 'Meu perfil' });
    fireEvent.click(link);
    expect(document.getElementById('app-menu-panel')).not.toBeInTheDocument();
  });
});

describe('AppDesktopMenu — grupos role-aware (DNAV-01/02)', () => {
  it('renderiza só os grupos passados, agrupados pelo título', () => {
    const access = { ...hubAccessFromRoles(['CANDIDATE']), moderation: false };
    render(<AppDesktopMenu groups={buildHubLinks(access)} />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));

    expect(screen.getByText('Minha conta')).toBeInTheDocument();
    expect(screen.getByText('Meus papéis')).toBeInTheDocument();
    expect(screen.queryByText('Institucional')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Área do candidato' })).toHaveAttribute(
      'href',
      '/candidato',
    );
  });
});

describe('AppDesktopMenu — active-state por rota (DNAV-03)', () => {
  it('marca /perfil ativo em /perfil', () => {
    navState.pathname = '/perfil';
    render(<AppDesktopMenu groups={buildHubLinks({ ...hubAccessFromRoles([]), moderation: false })} />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it('caso aninhado: em /perfil/papeis, o link ativo é "Ativar um papel" (/perfil/papeis), não "Meu perfil" (/perfil)', () => {
    navState.pathname = '/perfil/papeis';
    render(<AppDesktopMenu groups={buildHubLinks({ ...hubAccessFromRoles([]), moderation: false })} />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.getByRole('link', { name: 'Ativar um papel' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Meu perfil' })).not.toHaveAttribute('aria-current');
  });
});

describe('AppDesktopMenu — responsivo (DNAV-05)', () => {
  it('o wrapper tem hidden md:block', () => {
    const { container } = render(<AppDesktopMenu groups={buildHubLinks(FULL_ACCESS)} />);
    expect(container.firstElementChild?.className).toMatch(/\bhidden\b/);
    expect(container.firstElementChild?.className).toMatch(/\bmd:block\b/);
  });
});

describe('AppDesktopMenu — DNAV-MN-01 (negativo: nenhum link fora da allowlist)', () => {
  it('com groups de acesso total, todo href de âncora ∈ EXISTING_HUB_ROUTES', () => {
    render(<AppDesktopMenu groups={buildHubLinks(FULL_ACCESS)} />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href && (EXISTING_HUB_ROUTES as readonly string[]).includes(href)).toBe(true);
    }
  });
});

describe('AppDesktopMenu — DNAV-MN-02 (negativo: sem grupo/link sem permissão)', () => {
  it('candidate-only → sem grupo Institucional nem links de moderação/relatórios', () => {
    const access = { ...hubAccessFromRoles(['CANDIDATE']), moderation: false };
    render(<AppDesktopMenu groups={buildHubLinks(access)} />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.queryByText('Institucional')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fila de moderação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Relatórios' })).not.toBeInTheDocument();
  });
});
