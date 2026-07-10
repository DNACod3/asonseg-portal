import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeFeaturedJobs } from '../home-featured-jobs';

/**
 * USP-047 (T2, HOME-04). RTL do `HomeFeaturedJobs`: ≥2 cards de destaque com
 * título/empresa/tags do default estático (fiel ao protótipo L873-900).
 */
describe('HomeFeaturedJobs — cards de destaque de vaga (HOME-04)', () => {
  it('renderiza os 2 cards default com título e empresa', () => {
    render(<HomeFeaturedJobs />);
    expect(screen.getByText('Auxiliar Administrativo')).toBeInTheDocument();
    expect(screen.getByText('Supermercado Angeloni - CLT')).toBeInTheDocument();
    expect(screen.getByText('Técnico em Enfermagem')).toBeInTheDocument();
    expect(screen.getByText('Clínica São Lucas - CLT')).toBeInTheDocument();
  });

  it('renderiza as tags do primeiro card via Badge', () => {
    render(<HomeFeaturedJobs />);
    expect(screen.getByText('Administrativa')).toBeInTheDocument();
    expect(screen.getByText('CLT')).toBeInTheDocument();
  });

  it('aceita a seam jobs com um array customizado', () => {
    render(<HomeFeaturedJobs jobs={[{ title: 'Vaga Custom', company: 'Empresa X' }]} />);
    expect(screen.getByText('Vaga Custom')).toBeInTheDocument();
    expect(screen.getByText('Empresa X')).toBeInTheDocument();
    expect(screen.queryByText('Auxiliar Administrativo')).not.toBeInTheDocument();
  });
});
