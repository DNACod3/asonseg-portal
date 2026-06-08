import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do diálogo de reativação (USP-045). Cobre: abrir o diálogo,
 * exigência do motivo (Zod real), submissão válida disparando a action + refresh,
 * e tratamento de erro do servidor (FORBIDDEN, rank insuficiente).
 */

const actionState = vi.hoisted(() => ({ reactivatePerson: vi.fn() }));
const routerState = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('../actions/reactivate-person', () => ({
  reactivatePerson: (...a: unknown[]) => actionState.reactivatePerson(...a),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerState.refresh }),
}));

const { ReactivatePersonDialog } = await import('../components/reactivate-person-dialog');

const PERSON_ID = '22222222-2222-4222-8222-222222222222';

function renderDialog() {
  return render(<ReactivatePersonDialog personId={PERSON_ID} personName="João da Silva" />);
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Reativar Pessoa' }));
}

const confirmBtn = () => screen.getByRole('button', { name: 'Confirmar reativação' });

beforeEach(() => {
  vi.clearAllMocks();
  actionState.reactivatePerson.mockResolvedValue({
    ok: true,
    data: { personId: PERSON_ID, status: 'ATIVO', grantsRevoked: 2 },
  });
});

describe('ReactivatePersonDialog', () => {
  it('abre o diálogo ao clicar no gatilho', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Reativar João da Silva?')).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo da reativação/)).toBeInTheDocument();
  });

  it('mostra aviso de zeragem de grants na abertura (E-003 / D-002)', () => {
    renderDialog();
    openDialog();
    expect(screen.getByText(/todos os papéis e permissões anteriores serão removidos/i)).toBeInTheDocument();
  });

  it('motivo vazio/curto → erro de validação e NÃO chama a action', async () => {
    renderDialog();
    openDialog();
    fireEvent.click(confirmBtn());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.reactivatePerson).not.toHaveBeenCalled();
  });

  it('motivo válido → chama a action com { personId, reason } e dá refresh no sucesso', async () => {
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText(/Motivo da reativação/), {
      target: { value: 'Reativação do voluntário — inativação por engano.' },
    });
    fireEvent.click(confirmBtn());

    await waitFor(() => expect(actionState.reactivatePerson).toHaveBeenCalledTimes(1));
    expect(actionState.reactivatePerson).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: PERSON_ID,
        reason: 'Reativação do voluntário — inativação por engano.',
      }),
    );
    await waitFor(() => expect(routerState.refresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('FORBIDDEN (rank insuficiente) → mostra a mensagem e mantém o diálogo aberto', async () => {
    actionState.reactivatePerson.mockResolvedValue({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message:
          'Você não pode reativar uma Pessoa que foi inativada por alguém com permissão superior à sua. Acione a diretoria.',
      },
    });
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText(/Motivo da reativação/), {
      target: { value: 'Tentativa de reativação sem rank suficiente.' },
    });
    fireEvent.click(confirmBtn());

    expect(
      await screen.findByText(/Acione a diretoria/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(routerState.refresh).not.toHaveBeenCalled();
  });

  it('fecha o diálogo com Cancelar e limpa o formulário', () => {
    renderDialog();
    openDialog();
    fireEvent.change(screen.getByLabelText(/Motivo da reativação/), {
      target: { value: 'Motivo qualquer.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
