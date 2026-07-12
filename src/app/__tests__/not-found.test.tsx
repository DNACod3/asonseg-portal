import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-059 — 404 global PT-BR com casca pública (PUB3-1..4).
 * `usePathname` mockado porque `SiteHeader` compõe `PublicNav` (Client
 * Component) — mesmo padrão de `site-header.test.tsx`.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/rota-que-nao-existe',
}));

const { default: NotFound } = await import('../not-found');

describe('NotFound — 404 PT-BR com casca pública (PUB3-1..4)', () => {
  it('renderiza título e mensagem em PT-BR (PUB3-1)', () => {
    render(<NotFound />);
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
    expect(
      screen.getByText('A página que você procura não existe ou foi movida.'),
    ).toBeInTheDocument();
  });

  it('monta a casca pública: header + único <main> + footer (PUB3-2)', () => {
    render(<NotFound />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('exibe um link "Voltar para a home" apontando para "/" (PUB3-3)', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: 'Voltar para a home' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
