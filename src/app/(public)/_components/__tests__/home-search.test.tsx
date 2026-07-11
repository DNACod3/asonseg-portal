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
 * USP-048 (T5, NAV-01). Este bloco verifica só o **contrato estático GET**
 * do form (mesma asserção de HOME-03 acima, repetida aqui para deixar
 * explícito que o contrato vale também com termo preenchido/vazio) — RTL
 * não navega de fato, então não confirma o round-trip completo
 * (`/vagas` consumindo `?q=` ou o card de categoria chegando em
 * `/servicos?categoria=…`). Essa confirmação viva agora é do E2E
 * `e2e/home/navegacao-integrada.spec.ts` (round-trip real contra o servidor
 * Next.js, achando a lacuna apontada na revisão da PR #289 — mesmo padrão de
 * promoção skeleton→E2E de L-007).
 */
describe('HomeSearch — contrato estático GET /vagas preservado com termo/vazio (USP-048 NAV-01)', () => {
  it('com termo preenchido, o form permanece GET /vagas (name="q")', () => {
    render(<HomeSearch />);
    const input = screen.getByRole('searchbox', { name: /buscar vagas/i });
    fireEvent.change(input, { target: { value: 'eletricista' } });

    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/vagas');
    expect(input).toHaveAttribute('name', 'q');
  });

  it('com termo vazio, o form ainda declara GET /vagas (sem exigir preenchimento)', () => {
    render(<HomeSearch />);
    const input = screen.getByRole('searchbox', { name: /buscar vagas/i });

    const form = screen.getByRole('search');
    expect(input).toHaveValue('');
    expect(form).toHaveAttribute('action', '/vagas');
    expect(form).toHaveAttribute('method', 'get');
  });
});
