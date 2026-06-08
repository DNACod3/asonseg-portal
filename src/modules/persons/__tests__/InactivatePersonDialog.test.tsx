import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do diálogo de inativação (USP-007 / #86). Cobre: abrir o diálogo,
 * exigência do motivo (Zod real), submissão válida disparando a action + refresh,
 * e o tratamento do bloqueio de único responsável de Empresa (PRECONDITION_FAILED).
 * A Server Action e o router são mockados; o schema Zod é o real.
 */

const actionState = vi.hoisted(() => ({ inactivatePerson: vi.fn() }));
const routerState = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('../actions/inactivate-person', () => ({
  inactivatePerson: (...a: unknown[]) => actionState.inactivatePerson(...a),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerState.refresh }),
}));

const { InactivatePersonDialog } = await import('../components/inactivate-person-dialog');

const PERSON_ID = '11111111-1111-4111-8111-111111111111';

function renderDialog() {
  return render(<InactivatePersonDialog personId={PERSON_ID} personName="Maria da Silva" />);
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Inativar Pessoa' }));
}

const confirmBtn = () => screen.getByRole('button', { name: 'Confirmar inativação' });

beforeEach(() => {
  vi.clearAllMocks();
  actionState.inactivatePerson.mockResolvedValue({
    ok: true,
    data: { personId: PERSON_ID, status: 'INATIVO' },
  });
});

describe('InactivatePersonDialog', () => {
  it('abre o diálogo de confirmação ao clicar no gatilho', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Inativar Maria da Silva?')).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo da inativação/)).toBeInTheDocument();
  });

  it('motivo vazio/curto → erro de validação e NÃO chama a action', async () => {
    renderDialog();
    openDialog();
    fireEvent.click(confirmBtn());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.inactivatePerson).not.toHaveBeenCalled();
  });

  it('motivo válido → chama a action com { personId, reason } e dá refresh no sucesso', async () => {
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText(/Motivo da inativação/), {
      target: { value: 'Desligamento do voluntário ao fim do projeto.' },
    });
    fireEvent.click(confirmBtn());

    await waitFor(() => expect(actionState.inactivatePerson).toHaveBeenCalledTimes(1));
    expect(actionState.inactivatePerson).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: PERSON_ID,
        reason: 'Desligamento do voluntário ao fim do projeto.',
      }),
    );
    await waitFor(() => expect(routerState.refresh).toHaveBeenCalled());
    // Diálogo fecha no sucesso.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('bloqueio de único responsável (PRECONDITION_FAILED) → mostra a mensagem e mantém o diálogo aberto', async () => {
    actionState.inactivatePerson.mockResolvedValue({
      ok: false,
      error: {
        code: 'PRECONDITION_FAILED',
        message:
          'Esta Pessoa é a única responsável por: Padaria do Zé. Designe outro responsável ativo antes de inativá-la.',
      },
    });
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText(/Motivo da inativação/), {
      target: { value: 'Saída do responsável da Empresa.' },
    });
    fireEvent.click(confirmBtn());

    expect(await screen.findByText(/única responsável por: Padaria do Zé/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(routerState.refresh).not.toHaveBeenCalled();
  });
});
