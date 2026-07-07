import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do formulário de cadastro assistido (USP-002 / #55). Cobre:
 * render, a exceção condicional (justificativa exigida ao marcar a flag),
 * submissão válida e tratamento de erro do servidor. A Server Action é mockada;
 * o schema Zod é o real.
 */

const actionState = vi.hoisted(() => ({ registerPersonByAssistant: vi.fn() }));

vi.mock('../actions/register-person-by-assistant', () => ({
  registerPersonByAssistant: (...a: unknown[]) => actionState.registerPersonByAssistant(...a),
}));

const { AssistedRegisterForm } = await import('../components/assisted-register-form');

const VALID_CPF = '529.982.247-25';
const VALID_JUSTIFICATION = 'Pessoa em situação de rua, sem nenhum documento de identificação.';

beforeEach(() => {
  vi.clearAllMocks();
  actionState.registerPersonByAssistant.mockResolvedValue({
    ok: true,
    data: { personId: 'p-1', cpfException: false },
  });
});

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Cadastrar Pessoa' }));

describe('AssistedRegisterForm', () => {
  it('renderiza nome, a marca de exceção, o campo CPF e o botão', () => {
    render(<AssistedRegisterForm />);
    expect(screen.getByLabelText(/Nome completo/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByLabelText(/^CPF/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar Pessoa' })).toBeInTheDocument();
  });

  it('ao marcar a exceção, esconde o CPF e mostra a justificativa', () => {
    render(<AssistedRegisterForm />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByLabelText(/^CPF/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Justificativa da exceção/)).toBeInTheDocument();
  });

  it('exceção marcada sem justificativa → erro e NÃO chama a action', async () => {
    render(<AssistedRegisterForm />);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'João Sem Doc' } });
    fireEvent.click(screen.getByRole('checkbox'));
    submit();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.registerPersonByAssistant).not.toHaveBeenCalled();
  });

  it('exceção com justificativa válida → chama a action e mostra sucesso', async () => {
    actionState.registerPersonByAssistant.mockResolvedValue({
      ok: true,
      data: { personId: 'p-2', cpfException: true },
    });
    render(<AssistedRegisterForm />);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'João Sem Doc' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(/Justificativa da exceção/), {
      target: { value: VALID_JUSTIFICATION },
    });
    submit();

    await waitFor(() => expect(actionState.registerPersonByAssistant).toHaveBeenCalledTimes(1));
    expect(actionState.registerPersonByAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'João Sem Doc', cpfException: true }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Pessoa cadastrada com sucesso');
  });

  it('happy path com CPF → chama a action com CPF normalizado', async () => {
    render(<AssistedRegisterForm />);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: VALID_CPF } });
    submit();

    await waitFor(() => expect(actionState.registerPersonByAssistant).toHaveBeenCalledTimes(1));
    expect(actionState.registerPersonByAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Maria da Silva', cpf: '52998224725', cpfException: false }),
    );
  });

  it('action falha → exibe a mensagem de erro e não mostra sucesso', async () => {
    actionState.registerPersonByAssistant.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'CPF já está cadastrado no portal.' },
    });
    render(<AssistedRegisterForm />);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Maria da Silva' } });
    fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: VALID_CPF } });
    submit();

    expect(await screen.findByText('CPF já está cadastrado no portal.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('U2-MN-02: não expõe nenhum campo de credencial/login no form assistido', () => {
    render(<AssistedRegisterForm />);
    expect(screen.queryByLabelText(/senha|password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/e-?mail/i)).not.toBeInTheDocument();
  });
});
