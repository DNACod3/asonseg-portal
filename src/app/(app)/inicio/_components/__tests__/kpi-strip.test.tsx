import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiStrip } from '../kpi-strip';

/** USP-067 — T10 / PNL-00. */
describe('KpiStrip', () => {
  it('renderiza label e valor de cada item', () => {
    render(
      <KpiStrip
        items={[
          { label: 'Vagas abertas', value: 12, tone: 'primary' },
          { label: 'Minhas candidaturas', value: 3, tone: 'success' },
        ]}
      />,
    );

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Vagas abertas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Minhas candidaturas')).toBeInTheDocument();
  });

  it('aplica a classe de cor correspondente ao tone', () => {
    render(<KpiStrip items={[{ label: 'Serviços', value: 5, tone: 'cta' }]} />);
    expect(screen.getByText('5')).toHaveClass('text-cta');
  });

  it('tone ausente usa "primary" como default', () => {
    render(<KpiStrip items={[{ label: 'Serviços', value: 5 }]} />);
    expect(screen.getByText('5')).toHaveClass('text-primary');
  });

  it('sem itens: não renderiza nada', () => {
    const { container } = render(<KpiStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
