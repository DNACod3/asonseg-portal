import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardCard } from '../dashboard-card';

/** USP-067 — T11 / PNL-00, A-11 / **PNL-MN-07**. */
describe('DashboardCard', () => {
  it('renderiza título, descrição e as linhas dadas', () => {
    render(
      <DashboardCard
        title="Minhas candidaturas"
        description="Últimas 5"
        rows={[<p key="a">Linha A</p>, <p key="b">Linha B</p>]}
      />,
    );

    expect(screen.getByText('Minhas candidaturas')).toBeInTheDocument();
    expect(screen.getByText('Últimas 5')).toBeInTheDocument();
    expect(screen.getByText('Linha A')).toBeInTheDocument();
    expect(screen.getByText('Linha B')).toBeInTheDocument();
  });

  it('estado vazio: sem rows renderiza "Nada por aqui ainda."', () => {
    render(<DashboardCard title="Minhas candidaturas" rows={[]} />);
    expect(screen.getByText('Nada por aqui ainda.')).toBeInTheDocument();
  });

  it('A-11: footHref presente → renderiza o link "ver lista completa"', () => {
    render(
      <DashboardCard
        title="Minhas candidaturas"
        rows={[<p key="a">Linha A</p>]}
        footHref="/candidato"
        footLabel="Ver todas"
        countHint="1 de 8"
      />,
    );

    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/candidato');
    expect(screen.getByText('1 de 8')).toBeInTheDocument();
  });

  it('A-11: footHref ausente → omite o link mas mantém o countHint', () => {
    render(
      <DashboardCard title="Minhas candidaturas" rows={[<p key="a">Linha A</p>]} countHint="1 de 8" />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('1 de 8')).toBeInTheDocument();
  });

  it('PNL-MN-07: dado mais de 5 rows, renderiza no máximo 5 (nunca a 6ª)', () => {
    const rows = Array.from({ length: 8 }, (_, i) => <p key={i}>Linha {i + 1}</p>);
    render(<DashboardCard title="Fila" rows={rows} />);

    for (let i = 1; i <= 5; i += 1) {
      expect(screen.getByText(`Linha ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('Linha 6')).not.toBeInTheDocument();
    expect(screen.queryByText('Linha 7')).not.toBeInTheDocument();
    expect(screen.queryByText('Linha 8')).not.toBeInTheDocument();
  });
});
