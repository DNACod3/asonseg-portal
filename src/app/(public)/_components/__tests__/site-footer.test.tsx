import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteFooter } from '../site-footer';

/**
 * USP-046 — SiteFooter (T1, CASCA-08..11).
 */
describe('SiteFooter — landmark + marca + colunas (CASCA-08)', () => {
  it('renderiza o landmark <footer> com o bloco de marca', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('ASONSEG')).toBeInTheDocument();
    expect(screen.getByText(/Portal de Vagas da Ação Social/)).toBeInTheDocument();
  });
});

describe('SiteFooter — links reais, sem href="#" (CASCA-09)', () => {
  it('cada link de navegação aponta para uma rota real existente', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'Buscar Vagas' })).toHaveAttribute('href', '/vagas');
    expect(screen.getByRole('link', { name: 'Criar Perfil' })).toHaveAttribute('href', '/cadastro');
    expect(screen.getByRole('link', { name: 'Buscar Serviços' })).toHaveAttribute('href', '/servicos');
  });

  it('nenhum link usa href="#"', () => {
    render(<SiteFooter />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).not.toBe('#');
    }
  });
});

describe('SiteFooter — itens institucionais como não-links "em breve" (CASCA-10)', () => {
  it('itens sem rota real não são âncoras e ficam marcados "(em breve)"', () => {
    render(<SiteFooter />);
    expect(screen.queryByRole('link', { name: /Sobre a ASONSEG/ })).not.toBeInTheDocument();
    const item = screen.getByText(/Sobre a ASONSEG/);
    expect(item.closest('a')).toBeNull();
    expect(screen.getAllByText('(em breve)').length).toBeGreaterThan(0);
  });
});

describe('SiteFooter — copyright/tagline (CASCA-11)', () => {
  it('exibe o copyright e a tagline da comunidade', () => {
    render(<SiteFooter />);
    expect(screen.getByText(/© 2026 ASONSEG/)).toBeInTheDocument();
    expect(screen.getByText(/Canasvieiras\/SC/)).toBeInTheDocument();
  });
});
