import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RedefinirSenhaPage from './page';

/**
 * Testes da página de redefinição de senha (USP-005 — #72): o branch sem token
 * (link inválido/incompleto → orienta a solicitar de novo) e o branch com token
 * (renderiza o formulário). O formulário client é stubado para isolar a lógica
 * de roteamento da página do `searchParams`.
 */
vi.mock('@/modules/identity', () => ({
  PasswordResetForm: ({ token }: { token: string }) => (
    <div data-testid="reset-form" data-token={token} />
  ),
}));

describe('RedefinirSenhaPage', () => {
  it('sem token na URL → exibe erro e link "Solicitar novo link", sem o formulário', async () => {
    const ui = await RedefinirSenhaPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByRole('alert')).toHaveTextContent('Link inválido ou incompleto');
    expect(screen.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute(
      'href',
      '/recuperar-senha',
    );
    expect(screen.queryByTestId('reset-form')).not.toBeInTheDocument();
  });

  it('com token na URL → renderiza o formulário com o token e sem alerta de erro', async () => {
    const ui = await RedefinirSenhaPage({
      searchParams: Promise.resolve({ token_hash: 'abc-123' }),
    });
    render(ui);

    const form = screen.getByTestId('reset-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute('data-token', 'abc-123');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
