import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeHowItWorks } from '../home-how-it-works';

/**
 * USP-047 (T3, HOME-06). RTL do `HomeHowItWorks`: overline, `<h2>` e os 3
 * passos com os títulos do protótipo (L906-938).
 */
describe('HomeHowItWorks — seção Como Funciona (HOME-06)', () => {
  it('renderiza a overline e o <h2>', () => {
    render(<HomeHowItWorks />);
    expect(screen.getByText('Como Funciona')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Simples, rápido e gratuito' })).toBeInTheDocument();
  });

  it('renderiza os 3 passos com os títulos corretos', () => {
    render(<HomeHowItWorks />);
    expect(screen.getByRole('heading', { level: 3, name: 'Crie seu perfil' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Busque e filtre' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Conecte-se' })).toBeInTheDocument();
  });

  it('a seção tem nome acessível via aria-labelledby', () => {
    render(<HomeHowItWorks />);
    expect(screen.getByRole('region', { name: 'Simples, rápido e gratuito' })).toBeInTheDocument();
  });
});
