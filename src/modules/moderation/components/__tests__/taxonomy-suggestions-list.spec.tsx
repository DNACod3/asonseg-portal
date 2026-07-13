// Unit do componente cliente da fila de sugestões de taxonomia (USP-019 / T6 /
// SUGG-06) — estados e ramos de UI com as actions mockadas. RTL + jsdom.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const resolve = vi.hoisted(() => ({
  approveTaxonomySuggestion: vi.fn(),
  rejectTaxonomySuggestion: vi.fn(),
}));

vi.mock('../../actions/resolve-taxonomy-suggestion', () => ({
  approveTaxonomySuggestion: (...a: unknown[]) => resolve.approveTaxonomySuggestion(...a),
  rejectTaxonomySuggestion: (...a: unknown[]) => resolve.rejectTaxonomySuggestion(...a),
}));

const { TaxonomySuggestionsList } = await import('../taxonomy-suggestions-list');

const areaRow = {
  id: 'area-1',
  kind: 'JOB_AREA' as const,
  name: 'Jardinagem',
  suggestedByName: 'Maria da Silva',
  createdAtLabel: '01/06/2026 às 09:00',
};
const serviceRow = {
  id: 'svc-1',
  kind: 'SERVICE_CATEGORY' as const,
  name: 'Costura',
  suggestedByName: 'João Souza',
  createdAtLabel: '02/06/2026 às 10:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  resolve.approveTaxonomySuggestion.mockResolvedValue({ ok: true });
  resolve.rejectTaxonomySuggestion.mockResolvedValue({ ok: true });
});

describe('TaxonomySuggestionsList', () => {
  it('fila vazia: mensagem de "não há sugestões pendentes"', () => {
    render(<TaxonomySuggestionsList items={[]} />);
    expect(screen.getByText(/não há sugestões pendentes/i)).toBeInTheDocument();
  });

  it('renderiza N itens com o badge de kind correto e os dois botões por item', () => {
    render(<TaxonomySuggestionsList items={[areaRow, serviceRow]} />);

    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
    expect(screen.getByText('Costura')).toBeInTheDocument();
    expect(screen.getByText('Área')).toBeInTheDocument();
    expect(screen.getByText('Serviço')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /aprovar/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /rejeitar/i })).toHaveLength(2);
    expect(screen.getByText(/Maria da Silva/)).toBeInTheDocument();
  });

  it('autor nulo aparece como travessão', () => {
    render(<TaxonomySuggestionsList items={[{ ...areaRow, suggestedByName: null }]} />);
    expect(screen.getByText(/Sugerido por/)).toHaveTextContent('—');
  });

  it('clicar "Aprovar" invoca approveTaxonomySuggestion({kind,id}) e remove o item', async () => {
    render(<TaxonomySuggestionsList items={[areaRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() =>
      expect(resolve.approveTaxonomySuggestion).toHaveBeenCalledWith({ kind: 'JOB_AREA', id: 'area-1' }),
    );
    await waitFor(() => expect(screen.getByText(/sugestão\(ões\) processada\(s\)/i)).toBeInTheDocument());
  });

  it('[USP056-MN-05] clicar "Rejeitar" abre a confirmação e NÃO chama a action em 1 clique', () => {
    render(<TaxonomySuggestionsList items={[serviceRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /^rejeitar$/i }));

    expect(resolve.rejectTaxonomySuggestion).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /confirmar rejeição/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/descreva, se quiser/i)).toBeInTheDocument();
  });

  it('[MOD8-02] Confirmar com motivo chama rejectTaxonomySuggestion({kind,id,reason}) e remove o item', async () => {
    render(<TaxonomySuggestionsList items={[serviceRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /^rejeitar$/i }));
    fireEvent.change(screen.getByPlaceholderText(/descreva, se quiser/i), {
      target: { value: 'Duplicata de categoria já existente' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirmar rejeição/i }));

    await waitFor(() =>
      expect(resolve.rejectTaxonomySuggestion).toHaveBeenCalledWith({
        kind: 'SERVICE_CATEGORY',
        id: 'svc-1',
        reason: 'Duplicata de categoria já existente',
      }),
    );
    await waitFor(() => expect(screen.getByText(/sugestão\(ões\) processada\(s\)/i)).toBeInTheDocument());
  });

  it('[MOD8-02] Confirmar sem motivo chama rejectTaxonomySuggestion sem reason (opcional)', async () => {
    render(<TaxonomySuggestionsList items={[serviceRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /^rejeitar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar rejeição/i }));

    await waitFor(() =>
      expect(resolve.rejectTaxonomySuggestion).toHaveBeenCalledWith({
        kind: 'SERVICE_CATEGORY',
        id: 'svc-1',
      }),
    );
    const call = resolve.rejectTaxonomySuggestion.mock.calls[0]?.[0];
    expect(call).not.toHaveProperty('reason');
  });

  it('[MOD8-03] Cancelar fecha a confirmação sem chamar a action; item permanece na fila', () => {
    render(<TaxonomySuggestionsList items={[serviceRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /^rejeitar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(resolve.rejectTaxonomySuggestion).not.toHaveBeenCalled();
    expect(screen.getByText('Costura')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^rejeitar$/i })).toBeInTheDocument();
  });


  it('erro da Server Action: mostra o alerta e mantém o item na fila', async () => {
    resolve.approveTaxonomySuggestion.mockResolvedValue({ ok: false, error: { message: 'Já foi resolvida' } });
    render(<TaxonomySuggestionsList items={[areaRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Já foi resolvida'));
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
  });
});
