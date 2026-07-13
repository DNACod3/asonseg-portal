// JobEditForm — modos active-edit (USP-023, existente) e draft-edit (USP-054/EMP-2,
// novo). RTL + jsdom; as Server Actions são mockadas — o que se testa é o
// encadeamento de UI por modo (USP054-03/USP054-MN-02 na borda da UI: draft-edit
// nunca chama submitJobForModeration).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({
  editJob: vi.fn(),
  submitJobForModeration: vi.fn(),
  updateJobDraft: vi.fn(),
}));

vi.mock('../actions/edit-job', () => ({ editJob: (...a: unknown[]) => actions.editJob(...a) }));
vi.mock('../actions/submit-job-for-moderation', () => ({
  submitJobForModeration: (...a: unknown[]) => actions.submitJobForModeration(...a),
}));
vi.mock('../actions/update-job-draft', () => ({
  updateJobDraft: (...a: unknown[]) => actions.updateJobDraft(...a),
}));

const { JobEditForm } = await import('../components/job-edit-form');

const jobAreas = [{ id: 'area-1', name: 'Comércio' }];
const regions = [{ id: 'region-1', name: 'Centro' }];

const AREA_ID = '11111111-1111-1111-1111-111111111111';
const REGION_ID = '22222222-2222-2222-2222-222222222222';

function baseInitialValues(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Atendente de balcão',
    areaId: AREA_ID,
    description: 'Atendimento ao cliente.',
    requirements: 'Ensino médio completo.',
    workRegime: 'CLT',
    location: 'São Paulo - SP',
    benefits: '',
    salary: '',
    contractType: 'CLT',
    regionId: REGION_ID,
    educationLevelRequired: '',
    salaryMin: '',
    salaryMax: '',
    salaryVisible: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('JobEditForm — mode="active-edit" (USP-023, default, comportamento existente)', () => {
  it('NÃO renderiza o campo de validade (validUntil é fora de escopo em active-edit)', () => {
    render(
      <JobEditForm jobId="job-1" jobAreas={jobAreas} regions={regions} initialValues={baseInitialValues()} />,
    );
    expect(screen.queryByLabelText(/validade da vaga/i)).not.toBeInTheDocument();
  });

  it('submit: encadeia editJob → submitJobForModeration e mostra a mensagem de moderação', async () => {
    actions.editJob.mockResolvedValue({ ok: true, data: { jobId: 'job-1', status: 'DRAFT' } });
    actions.submitJobForModeration.mockResolvedValue({ ok: true, data: { jobId: 'job-1', status: 'IN_MODERATION' } });

    render(
      <JobEditForm jobId="job-1" jobAreas={jobAreas} regions={regions} initialValues={baseInitialValues()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /salvar e enviar para moderação/i }));

    await waitFor(() => expect(actions.editJob).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1' })));
    await waitFor(() => expect(actions.submitJobForModeration).toHaveBeenCalledWith({ jobId: 'job-1' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/enviada para moderação/i));
    expect(actions.updateJobDraft).not.toHaveBeenCalled();
  });

  it('editJob falha → mostra erro e NÃO encadeia submitJobForModeration', async () => {
    actions.editJob.mockResolvedValue({ ok: false, error: { code: 'CONFLICT', message: 'Só é possível editar uma vaga ativa.' } });

    render(
      <JobEditForm jobId="job-1" jobAreas={jobAreas} regions={regions} initialValues={baseInitialValues()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /salvar e enviar para moderação/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Só é possível editar uma vaga ativa.'));
    expect(actions.submitJobForModeration).not.toHaveBeenCalled();
  });
});

describe('JobEditForm — mode="draft-edit" (USP-054/EMP-2, novo)', () => {
  function futureIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  it('renderiza o campo de validade (D-1 — evita beco de validade vencida)', () => {
    render(
      <JobEditForm
        jobId="job-1"
        jobAreas={jobAreas}
        regions={regions}
        mode="draft-edit"
        initialValues={baseInitialValues({ validUntil: futureIso(30) })}
      />,
    );
    expect(screen.getByLabelText(/validade da vaga/i)).toBeInTheDocument();
  });

  it('USP054-03/MN-02: submit chama updateJobDraft APENAS — nunca submitJobForModeration', async () => {
    actions.updateJobDraft.mockResolvedValue({ ok: true, data: { jobId: 'job-1', status: 'DRAFT' } });

    render(
      <JobEditForm
        jobId="job-1"
        jobAreas={jobAreas}
        regions={regions}
        mode="draft-edit"
        initialValues={baseInitialValues({ validUntil: futureIso(30) })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /salvar rascunho/i }));

    await waitFor(() => expect(actions.updateJobDraft).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1' })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Rascunho salvo.'));
    expect(actions.submitJobForModeration).not.toHaveBeenCalled();
    expect(actions.editJob).not.toHaveBeenCalled();
  });

  it('updateJobDraft falha (ex.: CONFLICT) → mostra erro inline', async () => {
    actions.updateJobDraft.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Só é possível editar uma vaga em rascunho ou aguardando ajustes.' },
    });

    render(
      <JobEditForm
        jobId="job-1"
        jobAreas={jobAreas}
        regions={regions}
        mode="draft-edit"
        initialValues={baseInitialValues({ validUntil: futureIso(30) })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /salvar rascunho/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Só é possível editar uma vaga em rascunho ou aguardando ajustes.'),
    );
  });
});
