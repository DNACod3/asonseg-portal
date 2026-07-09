import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI do formulário de registro de resultado (USP-038 / T3, AC-038-1..3). Cobre:
 * render dos 4 valores + observação, seleção e submit. O caminho de
 * persistência/auditoria é coberto pelo teste de integração de
 * `registerReferralResult` — aqui só a UI.
 */

const actions = vi.hoisted(() => ({ registerReferralResult: vi.fn() }));

vi.mock('../../actions/register-referral-result', () => ({
  registerReferralResult: (...a: unknown[]) => actions.registerReferralResult(...a),
}));

const { ResultForm } = await import('../result-form');

const REFERRAL_ID = '00000000-0000-4000-8000-000000000003';

beforeEach(() => {
  vi.clearAllMocks();
  actions.registerReferralResult.mockResolvedValue({ ok: true, data: { referralId: REFERRAL_ID } });
});

describe('USP-038 T3 — ResultForm', () => {
  it('@ac-038-2 renderiza os 4 valores possíveis + observação', () => {
    render(<ResultForm referralId={REFERRAL_ID} />);
    const select = screen.getByLabelText(/resultado/i);
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels).toEqual(
      expect.arrayContaining(['Contratado', 'Não selecionado', 'Em análise', 'Sem resposta']),
    );
    expect(screen.getByLabelText(/observação/i)).toBeInTheDocument();
  });

  it('pré-preenche com initialResult/initialObservation quando fornecidos (re-registro — EC-4)', () => {
    render(<ResultForm referralId={REFERRAL_ID} initialResult="UNDER_REVIEW" initialObservation="Aguardando retorno." />);
    expect(screen.getByLabelText(/resultado/i)).toHaveValue('UNDER_REVIEW');
    expect(screen.getByLabelText(/observação/i)).toHaveValue('Aguardando retorno.');
  });

  it('submit sem selecionar resultado mostra erro de validação e não chama a action', async () => {
    render(<ResultForm referralId={REFERRAL_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /salvar resultado/i }));

    await waitFor(() => {
      expect(screen.getByText(/selecione um resultado válido/i)).toBeInTheDocument();
    });
    expect(actions.registerReferralResult).not.toHaveBeenCalled();
  });

  it('submit válido chama a action com referralId/result e exibe confirmação de sucesso', async () => {
    render(<ResultForm referralId={REFERRAL_ID} />);
    fireEvent.change(screen.getByLabelText(/resultado/i), { target: { value: 'HIRED' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar resultado/i }));

    await waitFor(() => {
      expect(actions.registerReferralResult).toHaveBeenCalledWith(
        expect.objectContaining({ referralId: REFERRAL_ID, result: 'HIRED' }),
      );
    });
    expect(await screen.findByText(/resultado registrado com sucesso/i)).toBeInTheDocument();
  });

  it('erro do servidor é exibido e nenhuma confirmação de sucesso aparece', async () => {
    actions.registerReferralResult.mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Encaminhamento não encontrado.' },
    });
    render(<ResultForm referralId={REFERRAL_ID} />);
    fireEvent.change(screen.getByLabelText(/resultado/i), { target: { value: 'HIRED' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar resultado/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/encaminhamento não encontrado/i);
    expect(screen.queryByText(/resultado registrado com sucesso/i)).not.toBeInTheDocument();
  });
});
