import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';

/**
 * Fundação de Design System da Fase 1 — T13 (DS-18/DS-19/DS-20). Prova de
 * paridade: a página de login renderiza com os primitivos (`FormCard`,
 * `FormHeader`, `Input`, `Label`, `Button`) e preserva os fluxos existentes
 * (RHF+Zod, `loginAction`, mensagem única anti-enumeração, navegação de
 * `redirectTo`, links "Esqueci minha senha"/"Criar conta") — só o estilo
 * muda (spec.md P1 "Prova de paridade na tela de login").
 */

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

const loginActionMock = vi.fn();
vi.mock('@/modules/identity/actions/login', () => ({
  loginAction: (...args: unknown[]) => loginActionMock(...args),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    refreshMock.mockClear();
    loginActionMock.mockReset();
  });

  it('renderiza FormHeader + FormCard envolvendo o LoginForm com os campos e o botão (DS-18)', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: 'Entrar no ASONSEG' })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('preserva os links "Esqueci minha senha" e "Criar conta" (DS-19)', () => {
    render(<LoginPage />);
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute(
      'href',
      '/recuperar-senha',
    );
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro');
  });

  it('validação Zod client-side: e-mail inválido exibe erro sem chamar loginAction (DS-19)', async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail inválido');
    expect(loginActionMock).not.toHaveBeenCalled();
  });

  it('erro do servidor exibe a mensagem única anti-enumeração vinda da action (DS-19)', async () => {
    loginActionMock.mockResolvedValue({
      ok: false,
      error: { message: 'Credenciais inválidas. Verifique e tente novamente.' },
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Credenciais inválidas. Verifique e tente novamente.'),
    ).toBeInTheDocument();
  });

  it('sucesso navega para redirectTo via router.replace + refresh (DS-19)', async () => {
    loginActionMock.mockResolvedValue({ ok: true, data: { redirectTo: '/inicio' } });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/inicio'));
    expect(refreshMock).toHaveBeenCalled();
  });
});
