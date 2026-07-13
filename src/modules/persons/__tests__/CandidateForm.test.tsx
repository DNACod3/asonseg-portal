import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI do cadastro de candidato (USP-009 / #46). Cobre: render dos campos, aceite de
 * consentimento obrigatório (CAD-05 — submit bloqueado sem aceite), exibição de
 * erros de validação e o caminho feliz (ativa papel + cria perfil). Actions e
 * router mockados.
 */

const routerState = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const actions = vi.hoisted(() => ({
  activateAdditionalRole: vi.fn(),
  activateCandidateRole: vi.fn(),
  submitCandidateForModeration: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerState.push, refresh: routerState.refresh }),
}));
// O form importa a action direto do módulo `'use server'` (não do barrel), para
// não arrastar código server-only para o bundle do cliente — o mock segue o path.
vi.mock('@/modules/identity/actions/activate-additional-role', () => ({
  activateAdditionalRole: (...a: unknown[]) => actions.activateAdditionalRole(...a),
}));
vi.mock('../actions/activate-candidate-role', () => ({
  activateCandidateRole: (...a: unknown[]) => actions.activateCandidateRole(...a),
}));
vi.mock('../actions/submit-candidate-for-moderation', () => ({
  submitCandidateForModeration: (...a: unknown[]) => actions.submitCandidateForModeration(...a),
}));

const { CandidateForm } = await import('../components/candidate-form');

const baseProps = {
  jobAreas: [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Administração' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Tecnologia' },
  ],
  term: { version: 'v1.0', contentHash: 'hash', body: 'TERMO: candidatura a vagas — texto.' },
  alreadyCandidate: false,
  initialStatus: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  actions.activateAdditionalRole.mockResolvedValue({ ok: true, data: { role: 'CANDIDATE' } });
  actions.activateCandidateRole.mockResolvedValue({
    ok: true,
    data: { personId: 'p1', publicationStatus: 'DRAFT' },
  });
});

describe('USP-009 #46 — CandidateForm', () => {
  it('exibe o termo e desabilita o envio até o aceite (CAD-05)', () => {
    render(<CandidateForm {...baseProps} />);
    expect(screen.getByText(/TERMO: candidatura a vagas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar cadastro/i })).toBeDisabled();
  });

  it('AUTH6-4: renderiza o corpo do termo via TermMarkdown — sem sintaxe Markdown crua', () => {
    render(
      <CandidateForm
        {...baseProps}
        term={{ ...baseProps.term, body: '**Finalidade** do termo de candidatura.' }}
      />,
    );
    expect(screen.getByText('Finalidade').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*Finalidade\*\*/)).not.toBeInTheDocument();
  });

  it('habilita o envio ao marcar o aceite', () => {
    render(<CandidateForm {...baseProps} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /salvar cadastro/i })).toBeEnabled();
  });

  it('exibe erros de validação client-side (campos obrigatórios)', async () => {
    render(<CandidateForm {...baseProps} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /salvar cadastro/i }));
    await waitFor(() => {
      expect(screen.getByText(/selecione a escolaridade/i)).toBeInTheDocument();
    });
    expect(actions.activateCandidateRole).not.toHaveBeenCalled();
  });

  it('caminho feliz: ativa papel + cria perfil e revela "Enviar para moderação"', async () => {
    render(<CandidateForm {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/escolaridade/i), { target: { value: 'ENSINO_MEDIO' } });
    fireEvent.change(screen.getByLabelText(/área de interesse principal/i), {
      target: { value: '00000000-0000-0000-0000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '(11) 98888-7777' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /salvar cadastro/i }));

    await waitFor(() => expect(actions.activateCandidateRole).toHaveBeenCalled());
    expect(actions.activateAdditionalRole).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enviar para moderação/i })).toBeInTheDocument();
    });
  });

  it('candidato já ativo (initialStatus IN_MODERATION): mostra status, sem termo', () => {
    render(<CandidateForm {...baseProps} alreadyCandidate initialStatus="IN_MODERATION" />);
    expect(screen.queryByText(/TERMO: candidatura/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/em moderação/i);
  });

  it('PERF-MN-02 (UI): perfil ACTIVE não oferece "Enviar para moderação" e mostra aviso de perfil ativo', () => {
    render(<CandidateForm {...baseProps} alreadyCandidate initialStatus="ACTIVE" />);
    expect(screen.queryByRole('button', { name: /enviar para moderação/i })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/ativo/i);
  });

  it('PERF-03b: status sem ação definida (AWAITING_ADJUSTMENTS) não renderiza caixa de rascunho nem de moderação', () => {
    render(<CandidateForm {...baseProps} alreadyCandidate initialStatus="AWAITING_ADJUSTMENTS" />);
    expect(screen.queryByRole('button', { name: /enviar para moderação/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('PERF-04: com defaultValues, os campos abrem pré-preenchidos', () => {
    render(
      <CandidateForm
        {...baseProps}
        alreadyCandidate
        initialStatus="DRAFT"
        defaultValues={{
          educationLevel: 'ENSINO_MEDIO',
          primaryAreaOfInterestId: '00000000-0000-0000-0000-000000000002',
          phone: '11988887777',
          headline: 'Aux. administrativo',
          experienceText: '3 anos de experiência',
        }}
      />,
    );
    expect(screen.getByLabelText(/escolaridade/i)).toHaveValue('ENSINO_MEDIO');
    expect(screen.getByLabelText(/área de interesse principal/i)).toHaveValue(
      '00000000-0000-0000-0000-000000000002',
    );
    expect(screen.getByLabelText(/telefone/i)).toHaveValue('11988887777');
    expect(screen.getByLabelText(/resumo profissional/i)).toHaveValue('Aux. administrativo');
    expect(screen.getByLabelText(/experiência/i)).toHaveValue('3 anos de experiência');
  });
});
