import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI do formulário de adição de responsável (USP-013, restyle Fase 2).
 * Cobre o gate de privacidade (P-001): o sucesso NÃO expõe identidade do alvo
 * (mensagem neutra) e a chamada preservada de `adicionarResponsavel` com o
 * payload correto (sem PII de retorno).
 */

const actionState = vi.hoisted(() => ({ adicionarResponsavel: vi.fn() }));

vi.mock('../actions/add-responsible', () => ({
  adicionarResponsavel: (...a: unknown[]) => actionState.adicionarResponsavel(...a),
}));

const { AddResponsibleForm } = await import('../components/add-responsible-form');

const EMPRESA_ID = '11111111-1111-4111-8111-111111111111';

function renderForm() {
  return render(<AddResponsibleForm empresaId={EMPRESA_ID} />);
}

const preencherEEnviar = (valor: string) => {
  fireEvent.change(screen.getByLabelText(/cpf ou e-mail/i), { target: { value: valor } });
  fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  actionState.adicionarResponsavel.mockResolvedValue({ ok: true, data: { status: 'PENDING' } });
});

describe('AddResponsibleForm (USP-013, restyle Fase 2)', () => {
  it('EMP055-09: CPF mal formatado exibe mensagem de campo canônica e NÃO chama a action', async () => {
    renderForm();
    preencherEEnviar('123');

    expect(
      await screen.findByText('CPF inválido (formato ou dígito verificador)'),
    ).toBeInTheDocument();
    // Dá tempo pro handler (async, via RHF) rodar antes de afirmar a ausência da chamada.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(actionState.adicionarResponsavel).not.toHaveBeenCalled();
  });

  it('EMP055-10: e-mail mal formatado exibe "E-mail inválido" e NÃO chama a action', async () => {
    renderForm();
    preencherEEnviar('fulano@');

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(actionState.adicionarResponsavel).not.toHaveBeenCalled();
  });

  it('renderiza o campo e o botão de envio usando os primitivos do DS', () => {
    renderForm();
    expect(screen.getByLabelText(/cpf ou e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar convite/i })).toBeInTheDocument();
  });

  it('chama adicionarResponsavel com {empresaId, cpfOuEmail}', async () => {
    renderForm();
    preencherEEnviar('fulano@example.com');

    await waitFor(() => expect(actionState.adicionarResponsavel).toHaveBeenCalledTimes(1));
    expect(actionState.adicionarResponsavel).toHaveBeenCalledWith({
      empresaId: EMPRESA_ID,
      cpfOuEmail: 'fulano@example.com',
    });
  });

  it('U13-MN-01: sucesso exibe mensagem NEUTRA — sem nome/identidade do alvo', async () => {
    renderForm();
    preencherEEnviar('fulano@example.com');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Convite enviado. O vínculo ficará pendente até a pessoa aceitar.');
    expect(status).not.toHaveTextContent('fulano@example.com');
    expect(status.textContent).not.toMatch(/fulano/i);
  });

  it('exibe a mensagem de erro do servidor (ex.: FORBIDDEN)', async () => {
    actionState.adicionarResponsavel.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Você não é responsável ativo desta Empresa.' },
    });
    renderForm();
    preencherEEnviar('fulano@example.com');

    expect(await screen.findByText(/não é responsável ativo/i)).toBeInTheDocument();
  });
});
