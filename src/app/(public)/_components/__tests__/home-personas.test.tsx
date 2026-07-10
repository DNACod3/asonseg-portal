import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomePersonas } from '../home-personas';

/**
 * USP-047 (T4, HOME-07). RTL do `HomePersonas`: os 2 cards, as features e os
 * CTAs apontando para os seams (defaults `/cadastro`).
 */
describe('HomePersonas — seção Para Quem (HOME-07)', () => {
  it('renderiza a overline, o <h2> e os 2 títulos de persona', () => {
    render(<HomePersonas />);
    expect(screen.getByText('Para Quem')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Uma plataforma, duas perspectivas' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sou Candidato' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sou Empresa' })).toBeInTheDocument();
  });

  it('renderiza as 4 features de cada persona', () => {
    render(<HomePersonas />);
    expect(screen.getByText('Busque vagas com filtros avançados')).toBeInTheDocument();
    expect(screen.getByText('Receba notificações de vagas compatíveis')).toBeInTheDocument();
    expect(screen.getByText('Publique vagas com requisitos e benefícios')).toBeInTheDocument();
    expect(screen.getByText('Gerencie suas vagas publicadas')).toBeInTheDocument();
  });

  it('os CTAs usam os defaults de seam (/cadastro)', () => {
    render(<HomePersonas />);
    expect(screen.getByRole('link', { name: 'Criar Meu Perfil' })).toHaveAttribute('href', '/cadastro');
    expect(screen.getByRole('link', { name: 'Cadastrar Empresa' })).toHaveAttribute('href', '/cadastro');
  });

  it('aceita as seams candidatoHref/empresaHref customizadas', () => {
    render(<HomePersonas candidatoHref="/cadastro/candidato" empresaHref="/cadastro/empresa" />);
    expect(screen.getByRole('link', { name: 'Criar Meu Perfil' })).toHaveAttribute(
      'href',
      '/cadastro/candidato',
    );
    expect(screen.getByRole('link', { name: 'Cadastrar Empresa' })).toHaveAttribute(
      'href',
      '/cadastro/empresa',
    );
  });
});
