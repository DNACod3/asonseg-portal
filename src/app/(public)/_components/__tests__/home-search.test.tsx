import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeSearch } from '../home-search';

/**
 * USP-047 (T1, HOME-03). RTL do `HomeSearch`: role `search`, input rotulado,
 * botão de submit e o seam `action` (default `/vagas`).
 */
describe('HomeSearch — form de busca do hero (HOME-03)', () => {
  it('renderiza um <form role="search"> com method="get" e action default /vagas', () => {
    render(<HomeSearch />);
    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/vagas');
  });

  it('o input tem name="q" e é rotulado (acessível por nome)', () => {
    render(<HomeSearch />);
    const input = screen.getByRole('searchbox', { name: /buscar vagas/i });
    expect(input).toHaveAttribute('name', 'q');
  });

  it('renderiza um botão de submit com texto discernível', () => {
    render(<HomeSearch />);
    const button = screen.getByRole('button', { name: /buscar/i });
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('aceita a seam action com um valor customizado', () => {
    render(<HomeSearch action="/busca-integrada" />);
    expect(screen.getByRole('search')).toHaveAttribute('action', '/busca-integrada');
  });
});
