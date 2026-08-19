import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardRow } from '../dashboard-row';

/** USP-067 — T11 / PNL-00. */
describe('DashboardRow', () => {
  it('renderiza título, subtítulo, meta e ações', () => {
    render(
      <DashboardRow
        title="Vaga de Auxiliar Administrativo"
        subtitle="Empresa X"
        meta={['Candidatou-se em 01/07/2026', 'Ativa']}
        actions={<button type="button">Ver detalhes</button>}
      />,
    );

    expect(screen.getByText('Vaga de Auxiliar Administrativo')).toBeInTheDocument();
    expect(screen.getByText('Empresa X')).toBeInTheDocument();
    expect(screen.getByText('Candidatou-se em 01/07/2026')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver detalhes' })).toBeInTheDocument();
  });

  it('mark/subtitle/meta/actions são opcionais — renderiza só o título', () => {
    render(<DashboardRow title="Só título" />);
    expect(screen.getByText('Só título')).toBeInTheDocument();
  });
});
