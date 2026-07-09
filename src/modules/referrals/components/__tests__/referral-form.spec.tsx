import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI do formulário de encaminhamento (USP-037 / T8, AC-037-1..5). Cobre:
 * render dos campos, o toggle do campo condicional (resumo profissional —
 * REF-MN-03) e o submit. O caminho de persistência/auditoria é coberto pelo
 * teste de integração de `createReferral` — aqui só a UI.
 */

const actions = vi.hoisted(() => ({ createReferral: vi.fn() }));

// O form importa a action direto do arquivo `'use server'` via caminho relativo
// (não do barrel) — o mock segue o path (mesmo padrão de SocioeconomicRecordForm.test.tsx).
vi.mock('../../actions/create-referral', () => ({
  createReferral: (...a: unknown[]) => actions.createReferral(...a),
}));

const { ReferralForm } = await import('../referral-form');

const PERSON_ID = '00000000-0000-4000-8000-000000000001';
const JOB_ID = '00000000-0000-4000-8000-000000000002';

beforeEach(() => {
  vi.clearAllMocks();
  actions.createReferral.mockResolvedValue({
    ok: true,
    data: { referralId: 'ref-1', applicationId: 'app-1' },
  });
});

describe('USP-037 T8 — ReferralForm', () => {
  it('renderiza os campos de Pessoa, vaga e motivo (resumo oculto por padrão)', () => {
    render(<ReferralForm />);
    expect(screen.getByLabelText(/pessoa \(id\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vaga \(id\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/motivo do encaminhamento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pessoa não possui cv anexado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/resumo profissional/i)).not.toBeInTheDocument();
  });

  it('pré-preenche personId/jobId quando fornecidos', () => {
    render(<ReferralForm initialPersonId={PERSON_ID} initialJobId={JOB_ID} />);
    expect(screen.getByLabelText(/pessoa \(id\)/i)).toHaveValue(PERSON_ID);
    expect(screen.getByLabelText(/vaga \(id\)/i)).toHaveValue(JOB_ID);
  });

  it('REF-MN-03: marcar "Pessoa não possui CV anexado" exibe o campo resumo profissional', () => {
    render(<ReferralForm />);
    expect(screen.queryByLabelText(/resumo profissional/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/pessoa não possui cv anexado/i));

    expect(screen.getByLabelText(/resumo profissional/i)).toBeInTheDocument();
  });

  it('submit inválido (personId com uuid inválido) mostra erro de validação e não chama a action', async () => {
    render(<ReferralForm initialJobId={JOB_ID} />);
    fireEvent.change(screen.getByLabelText(/pessoa \(id\)/i), { target: { value: 'not-a-uuid' } });
    fireEvent.click(screen.getByRole('button', { name: /encaminhar/i }));

    await waitFor(() => {
      expect(screen.getByText(/pessoa inválida/i)).toBeInTheDocument();
    });
    expect(actions.createReferral).not.toHaveBeenCalled();
  });

  it('submit válido chama a action com personId/jobId e exibe confirmação de sucesso', async () => {
    render(<ReferralForm initialPersonId={PERSON_ID} initialJobId={JOB_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /encaminhar/i }));

    await waitFor(() => {
      expect(actions.createReferral).toHaveBeenCalledWith(
        expect.objectContaining({ personId: PERSON_ID, jobId: JOB_ID }),
      );
    });
    expect(await screen.findByText(/encaminhamento criado com sucesso/i)).toBeInTheDocument();
  });

  it('submit com "sem CV" marcado envia o resumo profissional preenchido', async () => {
    render(<ReferralForm initialPersonId={PERSON_ID} initialJobId={JOB_ID} />);
    fireEvent.click(screen.getByLabelText(/pessoa não possui cv anexado/i));
    fireEvent.change(screen.getByLabelText(/resumo profissional/i), {
      target: { value: 'Experiência em vendas.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /encaminhar/i }));

    await waitFor(() => {
      expect(actions.createReferral).toHaveBeenCalledWith(
        expect.objectContaining({ professionalSummary: 'Experiência em vendas.' }),
      );
    });
  });

  it('erro do servidor é exibido e nenhuma confirmação de sucesso aparece', async () => {
    actions.createReferral.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Esta Pessoa já possui uma candidatura ativa para esta vaga.' },
    });
    render(<ReferralForm initialPersonId={PERSON_ID} initialJobId={JOB_ID} />);
    fireEvent.click(screen.getByRole('button', { name: /encaminhar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/já possui uma candidatura ativa/i);
    expect(screen.queryByText(/encaminhamento criado com sucesso/i)).not.toBeInTheDocument();
  });
});
