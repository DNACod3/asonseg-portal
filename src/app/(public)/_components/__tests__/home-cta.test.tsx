import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeCta } from '../home-cta';

/**
 * USP-047 (T6, HOME-09). RTL do `HomeCta`: `<h2>` e os 2 CTAs com `href` dos
 * seams (defaults `/cadastro`).
 */
describe('HomeCta — faixa de CTA final (HOME-09)', () => {
  it('renderiza o <h2>', () => {
    render(<HomeCta />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Faça parte dessa iniciativa social' }),
    ).toBeInTheDocument();
  });

  it('os 2 CTAs usam os defaults de seam (/cadastro)', () => {
    render(<HomeCta />);
    expect(screen.getByRole('link', { name: 'Cadastrar como Candidato' })).toHaveAttribute(
      'href',
      '/cadastro',
    );
    expect(screen.getByRole('link', { name: 'Cadastrar como Empresa' })).toHaveAttribute(
      'href',
      '/cadastro',
    );
  });

  it('aceita as seams candidatoHref/empresaHref customizadas', () => {
    render(<HomeCta candidatoHref="/cadastro/candidato" empresaHref="/cadastro/empresa" />);
    expect(screen.getByRole('link', { name: 'Cadastrar como Candidato' })).toHaveAttribute(
      'href',
      '/cadastro/candidato',
    );
    expect(screen.getByRole('link', { name: 'Cadastrar como Empresa' })).toHaveAttribute(
      'href',
      '/cadastro/empresa',
    );
  });

  it('a seção usa classes token para o fundo (sem hex cru)', () => {
    const { container } = render(<HomeCta />);
    const section = container.querySelector('section');
    expect(section?.className).toMatch(/from-primary/);
    expect(section?.className).toMatch(/to-secondary/);
    expect(section?.className ?? '').not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
