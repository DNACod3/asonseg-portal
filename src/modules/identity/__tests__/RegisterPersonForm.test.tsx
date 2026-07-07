import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do RegisterPersonForm (USP-001 / restyle Fase 1, T2). Cobre a
 * preservação de comportamento após a troca para os primitivos do Design
 * System (AD-014): render dos campos/papéis, gate de CAPTCHA fail-closed
 * (U1-MN-02) e ausência de checkbox/campos de perfil (U1-MN-03). A Server
 * Action (`registerPerson`) e o widget Turnstile são mockados; o schema Zod é
 * o real.
 */

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess('captcha-tok')}>
      resolver-captcha
    </button>
  ),
}));

const actionState = vi.hoisted(() => ({ registerPerson: vi.fn() }));
vi.mock('../actions/registerPerson', () => ({
  registerPerson: (...a: unknown[]) => actionState.registerPerson(...a),
}));

const { RegisterPersonForm } = await import('../components/RegisterPersonForm');

const VALID_CPF = '529.982.247-25';

beforeEach(() => {
  vi.clearAllMocks();
  actionState.registerPerson.mockResolvedValue({
    ok: true,
    data: { personId: 'p-1', role: 'CANDIDATE' },
  });
});

function fillValidFields() {
  fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Maria da Silva' } });
  fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: VALID_CPF } });
  fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: 'maria@example.com' } });
  fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: 'senha1234' } });
  fireEvent.click(screen.getByRole('radio', { name: /Candidato\(a\)/ }));
}

describe('identity/RegisterPersonForm', () => {
  it('renderiza labels, inputs e as 3 opções de papel com os primitivos do DS', () => {
    render(<RegisterPersonForm siteKey="site-key" onSuccess={vi.fn()} />);

    expect(screen.getByLabelText(/Nome completo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^CPF/)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Candidato\(a\)/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Prestador\(a\) de Serviços/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Cliente/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
  });

  it('U1-MN-03: não renderiza checkbox nem campos de perfil (escolaridade/currículo/telefone/nascimento)', () => {
    render(<RegisterPersonForm siteKey="site-key" onSuccess={vi.fn()} />);

    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByLabelText(/escolaridade|currículo|telefone|nascimento/i)).toBeNull();
  });

  it('U1-MN-02: submit sem CAPTCHA resolvido NÃO chama registerPerson e mostra a mensagem do gate', async () => {
    render(<RegisterPersonForm siteKey="site-key" onSuccess={vi.fn()} />);
    fillValidFields();

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    // RHF+Zod bloqueiam a submissão antes do onSubmit (captchaToken vazio ->
    // 'CAPTCHA obrigatório'); o gate client (`if (!captchaToken)`) é a segunda
    // linha de defesa para o caso de o Zod passar sem o token. Ambos preservam
    // o must-not U1-MN-02: sem CAPTCHA resolvido, registerPerson nunca é chamado.
    expect(await screen.findByText('CAPTCHA obrigatório')).toBeInTheDocument();
    expect(actionState.registerPerson).not.toHaveBeenCalled();
  });

  it('submit com CAPTCHA resolvido e dados válidos chama registerPerson e dispara onSuccess', async () => {
    const onSuccess = vi.fn();
    render(<RegisterPersonForm siteKey="site-key" onSuccess={onSuccess} />);
    fillValidFields();
    fireEvent.click(screen.getByRole('button', { name: 'resolver-captcha' }));

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(actionState.registerPerson).toHaveBeenCalledTimes(1));
    expect(actionState.registerPerson).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Maria da Silva',
        cpf: '52998224725',
        email: 'maria@example.com',
        role: 'CANDIDATE',
        captchaToken: 'captcha-tok',
      }),
    );
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith({ personId: 'p-1', role: 'CANDIDATE' }),
    );
  });

  it('action falha após CAPTCHA resolvido → exibe a mensagem de erro do servidor', async () => {
    actionState.registerPerson.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Não foi possível concluir o cadastro.' },
    });
    render(<RegisterPersonForm siteKey="site-key" onSuccess={vi.fn()} />);
    fillValidFields();
    fireEvent.click(screen.getByRole('button', { name: 'resolver-captcha' }));

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Não foi possível concluir o cadastro.')).toBeInTheDocument();
  });
});
