import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do diálogo de remoção de responsável (USP-014 / #137). Cobre:
 * abrir o diálogo, submissão sem motivo (motivo é opcional) disparando a action +
 * refresh, tratamento do bloqueio do último responsável (PRECONDITION_FAILED) e
 * o redirecionamento da auto-remoção (selfRemoved → router.push). A Server Action
 * e o router são mockados; o schema Zod é o real.
 */

const actionState = vi.hoisted(() => ({ removerResponsavel: vi.fn() }));
const routerState = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock('../actions/remove-responsible', () => ({
  removerResponsavel: (...a: unknown[]) => actionState.removerResponsavel(...a),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerState.refresh, push: routerState.push }),
}));

const { RemoveResponsibleDialog } = await import('../components/remove-responsible-dialog');

const GRANT_ID = '11111111-1111-4111-8111-111111111111';

function renderDialog(isSelf = false) {
  return render(<RemoveResponsibleDialog grantId={GRANT_ID} nome="Bruno Co-resp" isSelf={isSelf} />);
}

const openDialog = () => fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
const confirmBtn = () => screen.getByRole('button', { name: 'Confirmar remoção' });

beforeEach(() => {
  vi.clearAllMocks();
  actionState.removerResponsavel.mockResolvedValue({ ok: true, data: { selfRemoved: false } });
});

describe('RemoveResponsibleDialog', () => {
  it('abre o diálogo de confirmação ao clicar no gatilho', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Remover Bruno Co-resp da gestão\?/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo \(opcional\)/)).toBeInTheDocument();
  });

  it('confirma sem motivo (opcional) → chama a action com { grantId } e dá refresh', async () => {
    renderDialog();
    openDialog();
    fireEvent.click(confirmBtn());

    await waitFor(() => expect(actionState.removerResponsavel).toHaveBeenCalledTimes(1));
    expect(actionState.removerResponsavel).toHaveBeenCalledWith(
      expect.objectContaining({ grantId: GRANT_ID }),
    );
    await waitFor(() => expect(routerState.refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('bloqueio do último responsável (PRECONDITION_FAILED) → mostra a mensagem e mantém aberto', async () => {
    actionState.removerResponsavel.mockResolvedValue({
      ok: false,
      error: {
        code: 'PRECONDITION_FAILED',
        message: 'Designe outro responsável antes de remover o último responsável ativo.',
      },
    });
    renderDialog();
    openDialog();
    fireEvent.click(confirmBtn());

    expect(await screen.findByText(/Designe outro responsável antes/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(routerState.refresh).not.toHaveBeenCalled();
  });

  it('auto-remoção (selfRemoved) → redireciona em vez de refresh', async () => {
    actionState.removerResponsavel.mockResolvedValue({ ok: true, data: { selfRemoved: true } });
    renderDialog(true);
    openDialog();
    expect(screen.getByText(/Remover você mesmo da gestão\?/)).toBeInTheDocument();
    fireEvent.click(confirmBtn());

    await waitFor(() => expect(routerState.push).toHaveBeenCalledWith('/empresa'));
    expect(routerState.refresh).not.toHaveBeenCalled();
  });
});
