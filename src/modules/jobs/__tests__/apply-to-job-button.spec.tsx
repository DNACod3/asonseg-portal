// Estados de render do CTA "Candidatar-se" (USP-025 / CAN-025-06). RTL + jsdom.
// A action `applyToJob` é mockada — a lógica de negócio já é coberta em
// apply-to-job.int.test.ts; o que se testa aqui é o encadeamento de UI
// (candidatar → sucesso dispara router.refresh(); erro exibe error.message).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({ applyToJob: vi.fn() }));
vi.mock('../actions/apply-to-job', () => ({
  applyToJob: (...a: unknown[]) => actions.applyToJob(...a),
}));

const { ApplyToJobButton } = await import('../components/apply-to-job-button');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApplyToJobButton (USP-025 / CAN-025-06)', () => {
  it('estado inicial: botão "Candidatar-se" habilitado, sem erro', () => {
    render(<ApplyToJobButton jobId="job-1" />);
    const btn = screen.getByRole('button', { name: /candidatar-se/i });
    expect(btn).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sucesso: chama applyToJob({ jobId }) e dispara router.refresh()', async () => {
    actions.applyToJob.mockResolvedValue({ ok: true, data: { applicationId: 'app-1' } });
    render(<ApplyToJobButton jobId="job-1" />);

    fireEvent.click(screen.getByRole('button', { name: /candidatar-se/i }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(actions.applyToJob).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('erro: exibe error.message e não navega', async () => {
    actions.applyToJob.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Você já se candidatou a esta vaga.' },
    });
    render(<ApplyToJobButton jobId="job-1" />);

    fireEvent.click(screen.getByRole('button', { name: /candidatar-se/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Você já se candidatou a esta vaga.'),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
