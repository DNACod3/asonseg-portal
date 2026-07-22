import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-062 — BNAV-01, -03, -04, -05; BNAV-MN-01, -02.
 * `usePathname` mockado (padrão do repo: mock hoisted + import após o mock,
 * molde `public-nav.test.tsx`).
 */
const navState = vi.hoisted(() => ({ pathname: '/inicio' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

const { AppBottomNav } = await import('../app-bottom-nav');
const { selectPrimaryTabs } = await import('@/modules/identity/domain/app-nav');
const { buildHubLinks, hubAccessFromRoles, EXISTING_HUB_ROUTES } = await import(
  '@/modules/identity/domain/hub-links'
);

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

describe('AppBottomNav — render das abas (BNAV-01/04)', () => {
  beforeEach(() => {
    navState.pathname = '/inicio';
  });

  it('renderiza todas as abas passadas com ícone + rótulo', () => {
    const tabs = [
      { href: '/inicio', label: 'Início' },
      { href: '/perfil', label: 'Perfil' },
    ];
    render(<AppBottomNav tabs={tabs} />);
    const inicioLink = screen.getByRole('link', { name: 'Início' });
    const perfilLink = screen.getByRole('link', { name: 'Perfil' });
    expect(inicioLink).toHaveAttribute('href', '/inicio');
    expect(perfilLink).toHaveAttribute('href', '/perfil');
    expect(inicioLink.querySelector('svg')).toBeInTheDocument();
    expect(perfilLink.querySelector('svg')).toBeInTheDocument();
  });

  it('landmark <nav> com aria-label "Navegação principal"', () => {
    render(<AppBottomNav tabs={[{ href: '/inicio', label: 'Início' }]} />);
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });
});

describe('AppBottomNav — active-state por rota (BNAV-03)', () => {
  const tabs = [
    { href: '/inicio', label: 'Início' },
    { href: '/perfil', label: 'Perfil' },
    { href: '/candidato', label: 'Candidato' },
  ];

  it('marca a aba ativa correta e nenhuma outra', () => {
    navState.pathname = '/candidato';
    render(<AppBottomNav tabs={tabs} />);
    expect(screen.getByRole('link', { name: 'Candidato' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current');
  });

  it('pathname sem correspondência (rota profunda sem aba) → nenhuma aba ativa', () => {
    navState.pathname = '/relatorios';
    render(<AppBottomNav tabs={tabs} />);
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Candidato' })).not.toHaveAttribute('aria-current');
  });
});

describe('AppBottomNav — responsivo/reserva (BNAV-05)', () => {
  it('o <nav> tem md:hidden e existe um spacer aria-hidden com h-16 md:hidden', () => {
    const { container } = render(<AppBottomNav tabs={[{ href: '/inicio', label: 'Início' }]} />);
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(nav.className).toMatch(/\bmd:hidden\b/);

    const spacer = container.querySelector('[aria-hidden="true"].h-16');
    expect(spacer).not.toBeNull();
    expect(spacer?.className).toMatch(/\bmd:hidden\b/);
  });
});

describe('AppBottomNav — BNAV-MN-01 (negativo: nenhuma aba fora da allowlist)', () => {
  it('com tabs de selectPrimaryTabs(buildHubLinks(<acesso total>)), todo href renderizado ∈ EXISTING_HUB_ROUTES ∪ {/inicio}', () => {
    const allowlist = new Set<string>([...EXISTING_HUB_ROUTES, '/inicio']);
    const tabs = selectPrimaryTabs(buildHubLinks(FULL_ACCESS));
    render(<AppBottomNav tabs={tabs} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href && allowlist.has(href)).toBe(true);
    }
  });
});

describe('AppBottomNav — BNAV-MN-02 (negativo: sem aba de área sem permissão)', () => {
  it('com tabs de candidate-only, nenhuma âncora para /moderacao, /relatorios, etc.', () => {
    const access = { ...hubAccessFromRoles(['CANDIDATE']), moderation: false };
    const tabs = selectPrimaryTabs(buildHubLinks(access));
    render(<AppBottomNav tabs={tabs} />);
    expect(screen.queryByRole('link', { name: /moderação/i })).toBeNull();
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).not.toContain('/moderacao');
    expect(hrefs).not.toContain('/relatorios');
    expect(hrefs).not.toContain('/permissoes');
  });
});
