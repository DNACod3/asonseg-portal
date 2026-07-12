// Fiação do botão Enviar/Reenviar para moderação em CompanyJobActions (USP-054 /
// EMP-2 / T7). RTL + jsdom; a Server Action é mockada — o que se testa é o
// encadeamento de UI (rótulo por status, chamada, refresh, erro inline), não a
// lógica de `submitJobForModeration` (já coberta em submit-job-for-moderation.int.test.ts).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentStatus } from '@/modules/moderation';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({
  submitJobForModeration: vi.fn(),
  pauseJob: vi.fn(),
  unpauseJob: vi.fn(),
  archiveJob: vi.fn(),
  extendJobValidity: vi.fn(),
}));

vi.mock('../actions/submit-job-for-moderation', () => ({
  submitJobForModeration: (...a: unknown[]) => actions.submitJobForModeration(...a),
}));
vi.mock('../actions/pause-job', () => ({ pauseJob: (...a: unknown[]) => actions.pauseJob(...a) }));
vi.mock('../actions/unpause-job', () => ({ unpauseJob: (...a: unknown[]) => actions.unpauseJob(...a) }));
vi.mock('../actions/archive-job', () => ({ archiveJob: (...a: unknown[]) => actions.archiveJob(...a) }));
vi.mock('../actions/extend-job-validity', () => ({
  extendJobValidity: (...a: unknown[]) => actions.extendJobValidity(...a),
}));

const { CompanyJobActions } = await import('../components/company-job-actions');

const NO_ACTIONS = {
  canEdit: false,
  canSubmit: false,
  canPause: false,
  canUnpause: false,
  canArchive: false,
  canExtend: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CompanyJobActions — Enviar/Reenviar para moderação (USP-054/EMP-2)', () => {
  it('USP054-01: status DRAFT com canSubmit → botão "Enviar para moderação"', () => {
    render(
      <CompanyJobActions jobId="job-1" status={ContentStatus.DRAFT} actions={{ ...NO_ACTIONS, canSubmit: true }} />,
    );
    expect(screen.getByRole('button', { name: 'Enviar para moderação' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reenviar/i })).not.toBeInTheDocument();
  });

  it('USP054-02: status AWAITING_ADJUSTMENTS com canSubmit → botão "Reenviar para moderação"', () => {
    render(
      <CompanyJobActions
        jobId="job-2"
        status={ContentStatus.AWAITING_ADJUSTMENTS}
        actions={{ ...NO_ACTIONS, canSubmit: true }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reenviar para moderação' })).toBeInTheDocument();
  });

  it('USP054-06: canSubmit=false → nenhum botão de enviar/reenviar (terminais/ACTIVE/em fila)', () => {
    render(<CompanyJobActions jobId="job-3" status={ContentStatus.ACTIVE} actions={NO_ACTIONS} />);
    expect(screen.queryByRole('button', { name: /moderação/i })).not.toBeInTheDocument();
  });

  it('USP054-04: clicar em "Enviar para moderação" chama submitJobForModeration({jobId}) e faz refresh no sucesso', async () => {
    actions.submitJobForModeration.mockResolvedValue({ ok: true, data: { jobId: 'job-1', status: 'IN_MODERATION' } });
    render(<CompanyJobActions jobId="job-1" status={ContentStatus.DRAFT} actions={{ ...NO_ACTIONS, canSubmit: true }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar para moderação' }));

    await waitFor(() => expect(actions.submitJobForModeration).toHaveBeenCalledWith({ jobId: 'job-1' }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it('falha (ex.: FORBIDDEN) exibe a mensagem de erro inline, sem refresh', async () => {
    actions.submitJobForModeration.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Você não é responsável ativo desta Empresa.' },
    });
    render(<CompanyJobActions jobId="job-1" status={ContentStatus.DRAFT} actions={{ ...NO_ACTIONS, canSubmit: true }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar para moderação' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Você não é responsável ativo desta Empresa.'),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
