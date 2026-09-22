import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * USP-067 (PR 297 review) — cobre os branches interativos de
 * `ResubmitJobButton` (happy path, error path, pending state), hoje só
 * exercitados indiretamente via `company-block.test.tsx` (só a presença do
 * botão via `getByRole('button', { name: 'Corrigir e reenviar' })`).
 *
 * Mocka a Server Action pelo mesmo caminho de deep-import que o componente
 * usa (`@/modules/jobs/actions/submit-job-for-moderation` — carve-out
 * documentado no próprio `resubmit-job-button.tsx` / `no-deep-module-imports`),
 * nunca o barrel `@/modules/jobs` — evita puxar um módulo pesado não medido
 * para o grafo de cobertura v8 (lição coverage-gate-branch-loading-drop).
 */

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const submitJobForModerationMock = vi.fn();
vi.mock('@/modules/jobs/actions/submit-job-for-moderation', () => ({
  submitJobForModeration: (...args: unknown[]) => submitJobForModerationMock(...args),
}));

const { ResubmitJobButton } = await import('../resubmit-job-button');

beforeEach(() => {
  refreshMock.mockClear();
  submitJobForModerationMock.mockReset();
});

describe('ResubmitJobButton (PNL-04, P1.4-2)', () => {
  it('happy path: click → submitJobForModeration ok:true → router.refresh() chamado', async () => {
    submitJobForModerationMock.mockResolvedValue({
      ok: true,
      data: { jobId: 'job-1', status: 'IN_MODERATION' },
    });
    render(<ResubmitJobButton jobId="job-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir e reenviar' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(submitJobForModerationMock).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('error path: submitJobForModeration ok:false → mensagem em role="alert", router.refresh() NÃO chamado', async () => {
    submitJobForModerationMock.mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_TRANSITION', message: 'Vaga não pode ser reenviada neste estado.' },
    });
    render(<ResubmitJobButton jobId="job-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir e reenviar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Vaga não pode ser reenviada neste estado.',
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('pending state: durante a transição o botão fica desabilitado com o texto "Reenviando…"', async () => {
    let resolveAction!: (value: { ok: true; data: { jobId: string; status: string } }) => void;
    submitJobForModerationMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    render(<ResubmitJobButton jobId="job-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Corrigir e reenviar' }));

    const pendingButton = await screen.findByRole('button', { name: 'Reenviando…' });
    expect(pendingButton).toBeDisabled();

    resolveAction({ ok: true, data: { jobId: 'job-1', status: 'IN_MODERATION' } });

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });
});
