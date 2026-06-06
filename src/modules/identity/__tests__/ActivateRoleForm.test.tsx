import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI de ativação de papel adicional (USP-006 / #79). Cobre: render só dos campos
 * faltantes (E-001), exibição do termo da finalidade (P-004), aceite obrigatório,
 * validação client-side e os dois desfechos da action (sucesso → redireciona;
 * erro → mensagem). A action e o router são mockados.
 */

const routerState = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const actionState = vi.hoisted(() => ({ activateAdditionalRole: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerState.push, refresh: routerState.refresh }),
}));

vi.mock('../actions/activate-additional-role', () => ({
  activateAdditionalRole: (...a: unknown[]) => actionState.activateAdditionalRole(...a),
}));

const { ActivateRoleForm } = await import('../components/activate-role-form');

const candidate = {
  role: 'CANDIDATE' as const,
  label: 'Candidato(a)',
  purposeHumanName: 'Candidatura a vagas',
  purposeDescription: 'Candidatar-se a vagas e ter o perfil avaliado.',
  missingFields: ['phone', 'fullAddress'] as const,
  term: { version: 'v1.0', contentHash: 'hash-cand', body: 'TERMO: candidatura a vagas — texto.' },
};

beforeEach(() => {
  vi.clearAllMocks();
  actionState.activateAdditionalRole.mockResolvedValue({
    ok: true,
    data: { role: 'CANDIDATE', status: 'ACTIVE', nextStep: '/perfil' },
  });
});

describe('ActivateRoleForm', () => {
  it('sem papéis ativáveis → mensagem e nenhum formulário', () => {
    render(<ActivateRoleForm options={[]} />);
    expect(screen.getByText(/já possui todos os papéis públicos/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar papel' })).not.toBeInTheDocument();
  });

  it('opção única auto-selecionada: mostra só os campos faltantes e o termo da finalidade (E-001/P-004)', () => {
    render(<ActivateRoleForm options={[candidate]} />);
    expect(screen.getByLabelText(/Telefone/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Endereço completo/)).toBeInTheDocument();
    expect(screen.getByText(/TERMO: candidatura a vagas/)).toBeInTheDocument();
    // Aceite obrigatório: botão desabilitado até marcar o aceite.
    expect(screen.getByRole('button', { name: 'Ativar papel' })).toBeDisabled();
  });

  it('campos faltantes não preenchidos → validação client-side e NÃO chama a action', async () => {
    render(<ActivateRoleForm options={[candidate]} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Ativar papel' }));

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(actionState.activateAdditionalRole).not.toHaveBeenCalled();
  });

  it('válido → chama a action com o payload correto e redireciona ao próximo passo (E-004)', async () => {
    render(<ActivateRoleForm options={[candidate]} />);
    fireEvent.change(screen.getByLabelText(/Telefone/), { target: { value: '11999990000' } });
    fireEvent.change(screen.getByLabelText(/Endereço completo/), { target: { value: 'Rua X, 123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Ativar papel' }));

    await waitFor(() =>
      expect(actionState.activateAdditionalRole).toHaveBeenCalledWith({
        role: 'CANDIDATE',
        termVersion: 'v1.0',
        termContentHash: 'hash-cand',
        acceptTerm: true,
        profile: { phone: '11999990000', fullAddress: 'Rua X, 123' },
      }),
    );
    await waitFor(() => expect(routerState.push).toHaveBeenCalledWith('/perfil'));
  });

  it('action falha → exibe a mensagem de erro e não redireciona', async () => {
    actionState.activateAdditionalRole.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Você já possui o papel Candidato(a) ativo.' },
    });
    render(<ActivateRoleForm options={[candidate]} />);
    fireEvent.change(screen.getByLabelText(/Telefone/), { target: { value: '11999990000' } });
    fireEvent.change(screen.getByLabelText(/Endereço completo/), { target: { value: 'Rua X, 123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Ativar papel' }));

    expect(await screen.findByText('Você já possui o papel Candidato(a) ativo.')).toBeInTheDocument();
    expect(routerState.push).not.toHaveBeenCalled();
  });
});
