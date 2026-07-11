import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * USP-046 — PublicNav (T2, CASCA-02/03/05/06/07/15).
 * `usePathname` mockado (padrão do repo: mock hoisted + import após o mock).
 */
const navState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

const { PublicNav, isActive } = await import('../public-nav');

describe('isActive — helper puro de active-state (CASCA-03)', () => {
  it('raiz "/" casa só exatamente (não por prefixo vazio)', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/', '/vagas')).toBe(false);
  });

  it('demais itens casam por rota exata ou prefixo de seção', () => {
    expect(isActive('/vagas', '/vagas')).toBe(true);
    expect(isActive('/vagas', '/vagas/123')).toBe(true);
    expect(isActive('/servicos', '/servicos/x')).toBe(true);
  });

  it('nenhum item casa fora da nav (edge case)', () => {
    expect(isActive('/vagas', '/servicos')).toBe(false);
    expect(isActive('/vagas', '/vagas-outra-coisa')).toBe(false);
  });
});

describe('PublicNav — active-state renderizado (CASCA-03)', () => {
  beforeEach(() => {
    navState.pathname = '/';
  });

  it('marca "Início" ativo (aria-current) na raiz; demais sem aria-current', () => {
    render(<PublicNav />);
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Vagas' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Serviços' })).not.toHaveAttribute('aria-current');
  });

  it('marca "Vagas" ativo em /vagas/123 (match por prefixo de seção)', () => {
    navState.pathname = '/vagas/123';
    render(<PublicNav />);
    expect(screen.getByRole('link', { name: 'Vagas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
  });

  it('marca "Serviços" ativo em /servicos/x (match por prefixo de seção)', () => {
    navState.pathname = '/servicos/x';
    render(<PublicNav />);
    expect(screen.getByRole('link', { name: 'Serviços' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('PublicNav — <nav aria-label> (CASCA-07)', () => {
  it('o <nav> tem aria-label "Navegação principal"', () => {
    render(<PublicNav />);
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });
});

describe('PublicNav — menu mobile acessível (CASCA-06)', () => {
  beforeEach(() => {
    navState.pathname = '/';
  });

  it('alterna aria-expanded e a exibição do painel ao clicar no botão', () => {
    render(<PublicNav />);
    const button = screen.getByRole('button', { name: /menu de navegação/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'public-mobile-menu');
    expect(document.getElementById('public-mobile-menu')).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('public-mobile-menu')).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('public-mobile-menu')).not.toBeInTheDocument();
  });

  it('seam: aceita items customizados sem quebrar a mecânica', () => {
    render(<PublicNav items={[{ label: 'Custom', href: '/custom' }]} />);
    expect(screen.getByRole('link', { name: 'Custom' })).toHaveAttribute('href', '/custom');
    expect(screen.queryByRole('link', { name: 'Início' })).not.toBeInTheDocument();
  });
});
