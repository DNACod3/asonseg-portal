import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do formulário de troca de senha no 1º acesso (USP-004 — T-09,
 * AC-004-5). Cobre render, validação client-side (RHF + Zod) e os dois desfechos
 * da Server Action (sucesso → redireciona; erro → mensagem). A action e o router
 * são mockados; o schema Zod é o real.
 */

const routerState = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const actionState = vi.hoisted(() => ({ changePasswordFirstAccess: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerState.replace, refresh: routerState.refresh }),
}));

vi.mock('../actions/changePassword', () => ({
  changePasswordFirstAccess: (...a: unknown[]) => actionState.changePasswordFirstAccess(...a),
}));

const { ChangePasswordForm } = await import('../components/ChangePasswordForm');

const VALID = 'novaSenha123';

beforeEach(() => {
  vi.clearAllMocks();
  actionState.changePasswordFirstAccess.mockResolvedValue({ ok: true, data: { redirectTo: '/inicio' } });
});

function fill(senhaNova: string, confirmar: string) {
  fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: senhaNova } });
  fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: confirmar } });
}

describe('ChangePasswordForm', () => {
  it('renderiza os campos e o botão', () => {
    render(<ChangePasswordForm />);
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar nova senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument();
  });

  it('senha fraca → erro de validação e NÃO chama a action', async () => {
    render(<ChangePasswordForm />);
    fill('abc', 'abc');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.changePasswordFirstAccess).not.toHaveBeenCalled();
  });

  it('confirmação diferente → erro de validação e NÃO chama a action', async () => {
    render(<ChangePasswordForm />);
    fill(VALID, 'outraSenha123');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.changePasswordFirstAccess).not.toHaveBeenCalled();
  });

  it('válido → chama a action e redireciona para o destino retornado', async () => {
    render(<ChangePasswordForm />);
    fill(VALID, VALID);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() =>
      expect(actionState.changePasswordFirstAccess).toHaveBeenCalledWith({
        senhaNova: VALID,
        confirmar: VALID,
      }),
    );
    await waitFor(() => expect(routerState.replace).toHaveBeenCalledWith('/inicio'));
    expect(routerState.refresh).toHaveBeenCalled();
  });

  it('action falha → exibe a mensagem de erro e não redireciona', async () => {
    actionState.changePasswordFirstAccess.mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL', message: 'Não foi possível trocar a senha.' },
    });
    render(<ChangePasswordForm />);
    fill(VALID, VALID);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByText('Não foi possível trocar a senha.')).toBeInTheDocument();
    expect(routerState.replace).not.toHaveBeenCalled();
  });
});
