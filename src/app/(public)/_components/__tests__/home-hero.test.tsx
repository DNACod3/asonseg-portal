import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeHero } from '../home-hero';

/**
 * USP-047 (T7, HOME-01/02/03/04/05). RTL do `HomeHero`: 1 `<h1>` com
 * "talentos", subtítulo, os 2 CTAs com hrefs default, `role="search"`
 * presente, ≥2 cards de destaque, e o embed do `HomeIndicatorsView`
 * (`data-testid="home-indicators"`).
 */
const INDICATORS = { activeJobs: 47, activeCandidates: 12, verifiedCompanies: 8 };

describe('HomeHero — hero fiel ao protótipo (HOME-01/02/05)', () => {
  it('renderiza um único <h1> com "talentos" e o subtítulo', () => {
    render(<HomeHero indicators={INDICATORS} />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Conectando talentos a oportunidades na comunidade');
    expect(
      screen.getByText(/Portal de vagas da Paróquia Nossa Senhora de Guadalupe/i),
    ).toBeInTheDocument();
  });

  it('renderiza os CTAs Buscar Vagas/Publicar Vaga com os defaults de seam', () => {
    render(<HomeHero indicators={INDICATORS} />);
    expect(screen.getByRole('link', { name: 'Buscar Vagas' })).toHaveAttribute('href', '/vagas');
    expect(screen.getByRole('link', { name: 'Publicar Vaga' })).toHaveAttribute('href', '/cadastro');
  });

  it('renderiza o form de busca (HomeSearch, role="search")', () => {
    render(<HomeHero indicators={INDICATORS} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('renderiza ≥2 cards de destaque de vaga (HomeFeaturedJobs)', () => {
    render(<HomeHero indicators={INDICATORS} />);
    expect(screen.getByText('Auxiliar Administrativo')).toBeInTheDocument();
    expect(screen.getByText('Técnico em Enfermagem')).toBeInTheDocument();
  });

  it('embute o HomeIndicatorsView real com os indicadores recebidos (HOME-05/HOME-MN-03)', () => {
    render(<HomeHero indicators={INDICATORS} />);
    expect(screen.getByTestId('home-indicators')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('Vagas ativas')).toBeInTheDocument();
  });

  it('respeita as seams verVagasHref/publicarVagaHref quando customizadas', () => {
    render(
      <HomeHero
        indicators={INDICATORS}
        verVagasHref="/vagas-integradas"
        publicarVagaHref="/cadastro/empresa"
      />,
    );
    expect(screen.getByRole('link', { name: 'Buscar Vagas' })).toHaveAttribute(
      'href',
      '/vagas-integradas',
    );
    expect(screen.getByRole('link', { name: 'Publicar Vaga' })).toHaveAttribute(
      'href',
      '/cadastro/empresa',
    );
  });
});
