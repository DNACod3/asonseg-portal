import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

/**
 * USP-048 (T5, NAV-01). Confirma o fluxo `showPage('vagas')` do protótipo:
 * o form é GET declarativo (sem handler client) — o termo digitado (ou
 * ausente) vai na querystring `?q=` do próprio navegador ao submeter para
 * `action="/vagas"`; nenhuma mudança de código, só a confirmação do
 * contrato estático (form GET + `name="q"`) com termo preenchido e vazio.
 */
describe('HomeSearch — busca preserva o termo para /vagas (USP-048 NAV-01)', () => {
  it('com termo preenchido, o form permanece GET /vagas (name="q") — o termo vai na querystring do próprio submit', () => {
    render(<HomeSearch />);
    const input = screen.getByRole('searchbox', { name: /buscar vagas/i });
    fireEvent.change(input, { target: { value: 'eletricista' } });

    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/vagas');
    expect(input).toHaveAttribute('name', 'q');
    expect(input).toHaveValue('eletricista');
  });

  it('com termo vazio, o form ainda navega para /vagas (todas ACTIVE, sem erro)', () => {
    render(<HomeSearch />);
    const input = screen.getByRole('searchbox', { name: /buscar vagas/i });

    const form = screen.getByRole('search');
    expect(input).toHaveValue('');
    expect(form).toHaveAttribute('action', '/vagas');
    expect(form).toHaveAttribute('method', 'get');
  });
});
