import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeServices } from '../home-services';

/**
 * USP-047 (T5, HOME-08). RTL do `HomeServices`: overline, `<h2>`, as 3
 * categorias linkando `servicosHref` (default `/servicos`) e o CTA final.
 */
describe('HomeServices — destaque de Serviços (HOME-08)', () => {
  it('renderiza a overline e o <h2>', () => {
    render(<HomeServices />);
    expect(screen.getByText('Serviços')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Precisa de um profissional?' }),
    ).toBeInTheDocument();
  });

  it('renderiza as 3 categorias com título', () => {
    render(<HomeServices />);
    expect(screen.getByRole('heading', { level: 3, name: 'Serviços Domésticos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Reparos e Manutenção' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Área Externa' })).toBeInTheDocument();
  });

  it('as 3 categorias e o CTA linkam para o default /servicos', () => {
    render(<HomeServices />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(4);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/servicos'));
    expect(screen.getByRole('link', { name: /Ver Todos os Serviços/i })).toHaveAttribute(
      'href',
      '/servicos',
    );
  });

  it('aceita a seam servicosHref customizada', () => {
    render(<HomeServices servicosHref="/servicos-integrados" />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => expect(link).toHaveAttribute('href', '/servicos-integrados'));
  });
});
