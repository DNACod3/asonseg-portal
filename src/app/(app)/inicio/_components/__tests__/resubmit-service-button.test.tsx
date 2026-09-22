import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * USP-067 (PR 297 review) — cobre os branches interativos de
 * `ResubmitServiceButton` (happy path, error path, pending state), hoje só
 * exercitados indiretamente via `provider-block.test.tsx` (só a presença do
 * botão via `getByRole('button', { name: 'Corrigir e reenviar' })` — o mock
 * de `submitServiceForModeration` naquele arquivo mira o barrel
 * `@/modules/services`, que o componente NÃO usa, então o clique nunca era
 * exercitado de fato).
 *
 * Mocka a Server Action pelo mesmo caminho de deep-import que o componente
 * usa (`@/modules/services/actions/submit-service-for-moderation` —
 * carve-out documentado no próprio `resubmit-service-button.tsx` /
 * `no-deep-module-imports`), nunca o barrel `@/modules/services` — evita
 * puxar um módulo pesado não medido para o grafo de cobertura v8 (lição
 * coverage-gate-branch-loading-drop).
 */

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const submitServiceForModerationMock = vi.fn();
vi.mock('@/modules/services/actions/submit-service-for-moderation', () => ({
  submitServiceForModeration: (...args: unknown[]) => submitServiceForModerationMock(...args),
}));

const { ResubmitServiceButton } = await import('../resubmit-service-button');

beforeEach(() => {
  refreshMock.mockClear();
  submitServiceForModerationMock.mockReset();
});

describe('ResubmitServiceButton (PNL-02, P1.2-3)', () => {
  it('happy path: click → submitServiceForModeration ok:true → router.refresh() chamado', async () => {
    submitServiceForModerationMock.mockResolvedValue({
      ok: true,
      data: { serviceId: 'svc-1', status: 'IN_MODERATION' },
    });
    render(<ResubmitServiceButton serviceId="svc-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir e reenviar' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(submitServiceForModerationMock).toHaveBeenCalledWith({ serviceId: 'svc-1' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('error path: submitServiceForModeration ok:false → mensagem em role="alert", router.refresh() NÃO chamado', async () => {
    submitServiceForModerationMock.mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_TRANSITION', message: 'Serviço não pode ser reenviado neste estado.' },
    });
    render(<ResubmitServiceButton serviceId="svc-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir e reenviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Serviço não pode ser reenviado neste estado.',
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('pending state: durante a transição o botão fica desabilitado com o texto "Reenviando…"', async () => {
    let resolveAction!: (value: { ok: true; data: { serviceId: string; status: string } }) => void;
    submitServiceForModerationMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    render(<ResubmitServiceButton serviceId="svc-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir e reenviar' }));

    const pendingButton = await screen.findByRole('button', { name: 'Reenviando…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true, data: { serviceId: 'svc-1', status: 'IN_MODERATION' } });

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });
});
