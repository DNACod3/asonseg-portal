// Estados de render do CTA "Cancelar manifestação" (USP-034 / AC-034-1). RTL +
// jsdom. A action `cancelInterest` é mockada — a lógica de negócio já é
// coberta em cancel-interest.int.test.ts; o que se testa aqui é o
// encadeamento de UI (cancelar → sucesso dispara router.refresh(); erro exibe
// error.message).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({ cancelInterest: vi.fn() }));
vi.mock('../actions/cancel-interest', () => ({
  cancelInterest: (...a: unknown[]) => actions.cancelInterest(...a),
}));

const { CancelInterestButton } = await import('../components/cancel-interest-button');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CancelInterestButton (USP-034 / AC-034-1)', () => {
  it('estado inicial: botão "Cancelar manifestação" habilitado, sem erro', () => {
    render(<CancelInterestButton interestId="int-1" />);
    const btn = screen.getByRole('button', { name: /cancelar manifestação/i });
    expect(btn).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sucesso: chama cancelInterest({ interestId }) e dispara router.refresh()', async () => {
    actions.cancelInterest.mockResolvedValue({ ok: true, data: { interestId: 'int-1', alreadyCancelled: false } });
    render(<CancelInterestButton interestId="int-1" />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar manifestação/i }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(actions.cancelInterest).toHaveBeenCalledWith({ interestId: 'int-1' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro: exibe error.message e não navega', async () => {
    actions.cancelInterest.mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Manifestação de interesse não encontrada.' },
    });
    render(<CancelInterestButton interestId="int-1" />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar manifestação/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Manifestação de interesse não encontrada.'),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
