import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate de rota da página de candidatos da vaga (USP-027 / T4). `listJobApplicants`
 * já concentra ownership + auditoria (T3) — a página só reage ao `ActionResult`:
 * `!ok` (NOT_FOUND ou FORBIDDEN) vira `notFound()`, nunca revelando qual dos dois
 * ocorreu (mesmo padrão de `vagas/[jobId]/editar`). Mock de `requireActivePerson`
 * e `listJobApplicants`; `JobApplicantsList` mockado para isolar o gate da rota.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  listJobApplicants: vi.fn(),
  notFoundCalled: false,
}));

class NotFoundError extends Error {}

vi.mock('next/navigation', () => ({
  notFound: () => {
    guardState.notFoundCalled = true;
    throw new NotFoundError('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/modules/identity', () => ({
  requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
}));

vi.mock('@/modules/jobs', () => ({
  listJobApplicants: (...a: unknown[]) => guardState.listJobApplicants(...a),
  JobApplicantsList: ({ applicants }: { applicants: Array<{ candidatePersonId: string }> }) => (
    <div data-testid="job-applicants-list">{applicants.length} candidato(s)</div>
  ),
}));

const { default: VagaCandidatosPage } = await import('./page');

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
const JOB_ID = '22222222-2222-2222-2222-222222222222';
const params = Promise.resolve({ empresaId: EMPRESA_ID, jobId: JOB_ID });

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('VagaCandidatosPage — gate de rota (USP027-06/07)', () => {
  it('FORBIDDEN (outra Empresa/não-responsável) → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho' });
    guardState.listJobApplicants.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Você não é responsável por esta Empresa.' },
    });

    await expect(VagaCandidatosPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });

  it('NOT_FOUND (vaga inexistente) → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.listJobApplicants.mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Vaga não encontrada.' },
    });

    await expect(VagaCandidatosPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });

  it('responsável ATIVO → renderiza a lista com o total de candidaturas', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.listJobApplicants.mockResolvedValue({
      ok: true,
      data: {
        applicants: [{ candidatePersonId: 'c-1' }, { candidatePersonId: 'c-2' }],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });

    const ui = await VagaCandidatosPage({ params });
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByText('2 candidaturas ativas.')).toBeInTheDocument();
    expect(screen.getByTestId('job-applicants-list')).toHaveTextContent('2 candidato(s)');
  });

  it('USP027-08: estado vazio (0 candidaturas) renderiza sem erro', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.listJobApplicants.mockResolvedValue({
      ok: true,
      data: { applicants: [], total: 0, page: 1, pageSize: 20 },
    });

    const ui = await VagaCandidatosPage({ params });
    render(ui);

    expect(screen.getByText('0 candidaturas ativas.')).toBeInTheDocument();
    expect(screen.getByTestId('job-applicants-list')).toHaveTextContent('0 candidato(s)');
  });
});
