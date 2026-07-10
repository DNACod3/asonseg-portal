import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-046 — SiteHeader (T3, CASCA-01/04/15). `usePathname` mockado porque
 * `SiteHeader` compõe `PublicNav` (Client Component, T2).
 */
const navState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

const { SiteHeader } = await import('../site-header');

describe('SiteHeader — landmark + marca (CASCA-01)', () => {
  beforeEach(() => {
    navState.pathname = '/';
  });

  it('renderiza o landmark <header>', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('a marca (ASONSEG) linka para "/"', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /ASONSEG/ })).toHaveAttribute('href', '/');
  });
});

describe('SiteHeader — compõe o PublicNav (CASCA-02)', () => {
  it('renderiza os itens de navegação primária dentro do header', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vagas' })).toHaveAttribute('href', '/vagas');
    expect(screen.getByRole('link', { name: 'Serviços' })).toHaveAttribute('href', '/servicos');
  });
});

describe('SiteHeader — ações Entrar/Cadastrar via Button asChild (CASCA-04)', () => {
  it('Entrar linka para /login e Cadastrar para /cadastro, como âncoras', () => {
    render(<SiteHeader />);
    const entrar = screen.getByRole('link', { name: 'Entrar' });
    const cadastrar = screen.getByRole('link', { name: 'Cadastrar' });
    expect(entrar).toHaveAttribute('href', '/login');
    expect(cadastrar).toHaveAttribute('href', '/cadastro');
    expect(entrar.tagName).toBe('A');
    expect(cadastrar.tagName).toBe('A');
  });
});
