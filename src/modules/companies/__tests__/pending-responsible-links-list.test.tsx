import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI da lista de convites pendentes de responsável (USP-013, restyle
 * Fase 2). Cobre: render de itens, aceite chama `aceitarVinculoResponsavel` e
 * remove o item da lista (filtro otimista), e o estado vazio.
 */

const actionState = vi.hoisted(() => ({ aceitarVinculoResponsavel: vi.fn() }));

vi.mock('../actions/accept-responsible-link', () => ({
  aceitarVinculoResponsavel: (...a: unknown[]) => actionState.aceitarVinculoResponsavel(...a),
}));

const { PendingResponsibleLinksList } = await import('../components/pending-responsible-links-list');

const ITEMS = [
  { empresaId: 'e-1', empresaNome: 'Padaria Aurora', pendingAtLabel: '01/01/2026' },
  { empresaId: 'e-2', empresaNome: 'Mercado Central', pendingAtLabel: '02/01/2026' },
];

beforeEach(() => {
  vi.clearAllMocks();
  actionState.aceitarVinculoResponsavel.mockResolvedValue({ ok: true, data: { status: 'ACTIVE' } });
});

describe('PendingResponsibleLinksList (USP-013, restyle Fase 2)', () => {
  it('renderiza um item por convite pendente', () => {
    render(<PendingResponsibleLinksList items={ITEMS} />);
    expect(screen.getByText('Padaria Aurora')).toBeInTheDocument();
    expect(screen.getByText('Mercado Central')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /aceitar vínculo/i })).toHaveLength(2);
  });

  it('aceitar chama aceitarVinculoResponsavel({empresaId}) e remove o item aceito', async () => {
    render(<PendingResponsibleLinksList items={ITEMS} />);
    const botoes = screen.getAllByRole('button', { name: /aceitar vínculo/i });
    fireEvent.click(botoes[0]!);

    await waitFor(() => expect(actionState.aceitarVinculoResponsavel).toHaveBeenCalledWith({ empresaId: 'e-1' }));
    await waitFor(() => expect(screen.queryByText('Padaria Aurora')).not.toBeInTheDocument());
    expect(screen.getByText('Mercado Central')).toBeInTheDocument();
  });

  it('estado vazio (sem itens) renderiza mensagem de status', () => {
    render(<PendingResponsibleLinksList items={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Você não tem convites de vínculo pendentes.');
  });

  it('erro no aceite exibe mensagem por item e mantém o item na lista', async () => {
    actionState.aceitarVinculoResponsavel.mockResolvedValue({
      ok: false,
      error: { code: 'PRECONDITION_FAILED', message: 'Convite já expirado.' },
    });
    render(<PendingResponsibleLinksList items={ITEMS} />);
    const botoes = screen.getAllByRole('button', { name: /aceitar vínculo/i });
    fireEvent.click(botoes[0]!);

    expect(await screen.findByText(/convite já expirado/i)).toBeInTheDocument();
    expect(screen.getByText('Padaria Aurora')).toBeInTheDocument();
  });
});
