import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do LoginForm (USP-004 — T-07 / H1, Fase 6 — hardening, AC-H1-4).
 * Cobre o caminho feliz (sem CAPTCHA) e o CAPTCHA adaptativo: o widget Turnstile
 * só aparece depois que a Server Action sinaliza `error.code === 'CAPTCHA_REQUIRED'`,
 * e o retry reenvia com o token resolvido. `loginAction`, `useRouter` e o widget
 * Turnstile são mockados; o schema Zod é o real.
 */

const routerState = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const actionState = vi.hoisted(() => ({ loginAction: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerState.replace, refresh: routerState.refresh }),
}));

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess('captcha-tok')}>
      resolver-captcha
    </button>
  ),
}));

vi.mock('../actions/login', () => ({
  loginAction: (...a: unknown[]) => actionState.loginAction(...a),
}));

const { LoginForm } = await import('../components/LoginForm');

beforeEach(() => {
  vi.clearAllMocks();
});

function fillValidFields() {
  fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: 'senha1234' } });
}

describe('identity/LoginForm', () => {
  // RF-MN-01 (ORQ-3): sem GET fallback — o navegador nunca deve poder submeter
  // e-mail/senha como query string. `method="post"` garante que um submit nativo
  // (JS lento/pré-hidratação) usa o corpo da requisição, nunca a URL.
  it('RF-MN-01: o <form> declara method="post" (sem fallback GET)', () => {
    const { container } = render(<LoginForm siteKey="site-key" />);
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('method', 'post');
  });

  it('caminho feliz: sem CAPTCHA_REQUIRED, o widget Turnstile nunca é renderizado', () => {
    render(<LoginForm siteKey="site-key" />);
    expect(screen.queryByRole('button', { name: 'resolver-captcha' })).toBeNull();
  });

  it('login OK (sem CAPTCHA) → chama loginAction sem captchaToken e redireciona', async () => {
    actionState.loginAction.mockResolvedValue({
      ok: true,
      data: { redirectTo: '/inicio', primeiroAcesso: false },
    });
    render(<LoginForm siteKey="site-key" />);
    fillValidFields();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(actionState.loginAction).toHaveBeenCalledTimes(1));
    expect(actionState.loginAction).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'maria@example.com', senha: 'senha1234' }),
    );
    await waitFor(() => expect(routerState.replace).toHaveBeenCalledWith('/inicio'));
  });

  it('AC-H1-4: CAPTCHA_REQUIRED → exibe o widget Turnstile e o retry reenvia com o token', async () => {
    actionState.loginAction
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'CAPTCHA_REQUIRED', message: 'Confirme que você não é um robô e tente novamente.' },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { redirectTo: '/inicio', primeiroAcesso: false },
      });
    render(<LoginForm siteKey="site-key" />);
    fillValidFields();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Confirme que você não é um robô e tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'resolver-captcha' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'resolver-captcha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(actionState.loginAction).toHaveBeenCalledTimes(2));
    expect(actionState.loginAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ captchaToken: 'captcha-tok' }),
    );
    await waitFor(() => expect(routerState.replace).toHaveBeenCalledWith('/inicio'));
  });

  it('erro do servidor que não é CAPTCHA_REQUIRED não renderiza o widget', async () => {
    actionState.loginAction.mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Credenciais inválidas. Verifique e tente novamente.' },
    });
    render(<LoginForm siteKey="site-key" />);
    fillValidFields();

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(
      await screen.findByText('Credenciais inválidas. Verifique e tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'resolver-captcha' })).toBeNull();
  });
});
