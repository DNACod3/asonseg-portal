// Estados de render do CTA "Cancelar candidatura" (USP-026 / CAN-026-03). RTL +
// jsdom. A action `cancelApplication` é mockada — a lógica de negócio já é
// coberta em cancel-application.int.test.ts; o que se testa aqui é o
// encadeamento de UI (cancelar → sucesso dispara router.refresh(); erro exibe
// error.message).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({ cancelApplication: vi.fn() }));
vi.mock('../actions/cancel-application', () => ({
  cancelApplication: (...a: unknown[]) => actions.cancelApplication(...a),
}));

const { CancelApplicationButton } = await import('../components/cancel-application-button');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CancelApplicationButton (USP-026 / CAN-026-03)', () => {
  it('estado inicial: botão "Cancelar candidatura" habilitado, sem erro', () => {
    render(<CancelApplicationButton applicationId="app-1" />);
    const btn = screen.getByRole('button', { name: /cancelar candidatura/i });
    expect(btn).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sucesso: chama cancelApplication({ applicationId }) e dispara router.refresh()', async () => {
    actions.cancelApplication.mockResolvedValue({ ok: true, data: { applicationId: 'app-1' } });
    render(<CancelApplicationButton applicationId="app-1" />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar candidatura/i }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(actions.cancelApplication).toHaveBeenCalledWith({ applicationId: 'app-1' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro: exibe error.message e não navega', async () => {
    actions.cancelApplication.mockResolvedValue({
      ok: false,
      error: { code: 'PRECONDITION_FAILED', message: 'Candidatura já cancelada.' },
    });
    render(<CancelApplicationButton applicationId="app-1" />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar candidatura/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Candidatura já cancelada.'),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
