import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CounterGrid } from '../counter-grid';

/** USP-067 — T11 / PNL-03, A-06. */
describe('CounterGrid', () => {
  it('renderiza um link por contador, com valor/label/href', () => {
    render(
      <CounterGrid
        counters={[
          { value: 4, label: 'Elétrica', href: '/servicos?categoria=eletrica' },
          { value: 0, label: 'Encanamento', href: '/servicos?categoria=encanamento' },
        ]}
      />,
    );

    const eletrica = screen.getByRole('link', { name: /Elétrica/ });
    expect(eletrica).toHaveAttribute('href', '/servicos?categoria=eletrica');
    expect(screen.getByText('4')).toBeInTheDocument();

    const encanamento = screen.getByRole('link', { name: /Encanamento/ });
    expect(encanamento).toHaveAttribute('href', '/servicos?categoria=encanamento');
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('sem contadores: estado vazio', () => {
    render(<CounterGrid counters={[]} />);
    expect(screen.getByText('Nada por aqui ainda.')).toBeInTheDocument();
  });
});
