import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI da recuperação de senha (USP-005 — #72): formulário de
 * solicitação (mostra a mensagem genérica no sucesso) e formulário de definição
 * de nova senha (envia o token e redireciona; trata token inválido/expirado).
 * As actions e o router são mockados; os schemas Zod são os reais.
 */

const routerState = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const actionState = vi.hoisted(() => ({ requestPasswordReset: vi.fn(), resetPassword: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerState.replace, refresh: routerState.refresh }),
}));

vi.mock('../actions/request-password-reset', () => ({
  requestPasswordReset: (...a: unknown[]) => actionState.requestPasswordReset(...a),
}));
vi.mock('../actions/reset-password', () => ({
  resetPassword: (...a: unknown[]) => actionState.resetPassword(...a),
}));

const { PasswordResetRequestForm } = await import('../components/password-reset-request-form');
const { PasswordResetForm } = await import('../components/password-reset-form');

const GENERIC = 'Se houver uma conta associada a este e-mail, você receberá um link para redefinir a senha.';

beforeEach(() => {
  vi.clearAllMocks();
  actionState.requestPasswordReset.mockResolvedValue({ ok: true, data: { message: GENERIC } });
  actionState.resetPassword.mockResolvedValue({ ok: true, data: { redirectTo: '/login?redefinida=1' } });
});

describe('PasswordResetRequestForm', () => {
  it('e-mail válido → chama a action e exibe a confirmação genérica', async () => {
    render(<PasswordResetRequestForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'maria@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    await waitFor(() =>
      expect(actionState.requestPasswordReset).toHaveBeenCalledWith({ email: 'maria@example.com' }),
    );
    expect(await screen.findByText(GENERIC)).toBeInTheDocument();
    // O formulário some após o envio (mostra só a confirmação).
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
  });

  it('e-mail inválido → validação client-side, NÃO chama a action', async () => {
    render(<PasswordResetRequestForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'nao-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe('PasswordResetForm', () => {
  const VALID = 'novaSenha123';

  function fill(senhaNova: string, confirmar: string) {
    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: senhaNova } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: confirmar } });
  }

  it('válido → envia token + senha e redireciona para o login', async () => {
    render(<PasswordResetForm token="hashed-abc" />);
    fill(VALID, VALID);
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() =>
      expect(actionState.resetPassword).toHaveBeenCalledWith({
        token: 'hashed-abc',
        senhaNova: VALID,
        confirmar: VALID,
      }),
    );
    await waitFor(() => expect(routerState.replace).toHaveBeenCalledWith('/login?redefinida=1'));
  });

  it('senha fraca → validação client-side, NÃO chama a action', async () => {
    render(<PasswordResetForm token="hashed-abc" />);
    fill('fraca', 'fraca');
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.resetPassword).not.toHaveBeenCalled();
  });

  it('token inválido/expirado → exibe a mensagem de erro e não redireciona', async () => {
    actionState.resetPassword.mockResolvedValue({
      ok: false,
      error: { code: 'PRECONDITION_FAILED', message: 'Link inválido ou expirado. Solicite uma nova redefinição de senha.' },
    });
    render(<PasswordResetForm token="hashed-abc" />);
    fill(VALID, VALID);
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(
      await screen.findByText('Link inválido ou expirado. Solicite uma nova redefinição de senha.'),
    ).toBeInTheDocument();
    expect(routerState.replace).not.toHaveBeenCalled();
  });
});
