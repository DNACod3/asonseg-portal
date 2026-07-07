// Sub-fluxo "Outro / sugerir nova área" do JobForm (USP-019 / T7 / SUGG-07).
// RTL + jsdom. As Server Actions de publicação/rascunho e a de sugestão são
// mockadas — o que se testa é o encadeamento de UI, não a lógica das actions
// (já coberta em suggest-taxonomy.int.test.ts).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({
  submitJobForModeration: vi.fn(),
  createJobDraft: vi.fn(),
  suggestTaxonomy: vi.fn(),
}));

vi.mock('../actions/submit-job-for-moderation', () => ({
  submitJobForModeration: (...a: unknown[]) => actions.submitJobForModeration(...a),
}));
vi.mock('../actions/create-job-draft', () => ({
  createJobDraft: (...a: unknown[]) => actions.createJobDraft(...a),
}));
vi.mock('@/modules/moderation/actions/suggest-taxonomy', () => ({
  suggestTaxonomy: (...a: unknown[]) => actions.suggestTaxonomy(...a),
}));

const { JobForm } = await import('../components/job-form');

const jobAreas = [{ id: 'area-1', name: 'Comércio' }];
const regions = [{ id: 'region-1', name: 'Centro' }];

beforeEach(() => {
  vi.clearAllMocks();
  actions.suggestTaxonomy.mockResolvedValue({ ok: true, data: { id: 'new-area-1' } });
});

describe('JobForm — sugerir nova área (USP-019)', () => {
  it('selecionar "Outro / sugerir nova área" revela o input de texto livre', () => {
    render(<JobForm companyId="company-1" jobAreas={jobAreas} regions={regions} />);

    expect(screen.queryByPlaceholderText(/jardinagem/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/área de atuação/i), { target: { value: '__suggest__' } });
    expect(screen.getByPlaceholderText(/jardinagem/i)).toBeInTheDocument();
  });

  it('submeter com "Jardinagem" invoca suggestTaxonomy({kind:JOB_AREA,name}) e exibe o feedback de pendência', async () => {
    render(<JobForm companyId="company-1" jobAreas={jobAreas} regions={regions} />);

    fireEvent.change(screen.getByLabelText(/área de atuação/i), { target: { value: '__suggest__' } });
    fireEvent.change(screen.getByPlaceholderText(/jardinagem/i), { target: { value: 'Jardinagem' } });
    fireEvent.click(screen.getByRole('button', { name: /sugerir área/i }));

    await waitFor(() =>
      expect(actions.suggestTaxonomy).toHaveBeenCalledWith({ kind: 'JOB_AREA', name: 'Jardinagem' }),
    );
    await waitFor(() => expect(screen.getByText(/enviada para aprovação/i)).toBeInTheDocument());
  });

  it('CONFLICT (duplicata): mostra a mensagem de erro sem travar o formulário', async () => {
    actions.suggestTaxonomy.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Essa área já existe ou já foi sugerida.' },
    });
    render(<JobForm companyId="company-1" jobAreas={jobAreas} regions={regions} />);

    fireEvent.change(screen.getByLabelText(/área de atuação/i), { target: { value: '__suggest__' } });
    fireEvent.change(screen.getByPlaceholderText(/jardinagem/i), { target: { value: 'Comércio' } });
    fireEvent.click(screen.getByRole('button', { name: /sugerir área/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Essa área já existe ou já foi sugerida.'),
    );
  });

  it('não altera o submit de publicação da vaga (areaId continua exigido)', () => {
    render(<JobForm companyId="company-1" jobAreas={jobAreas} regions={regions} />);
    // O botão de publicar segue presente e intacto; sugerir é um sub-fluxo à parte.
    expect(screen.getByRole('button', { name: /enviar para moderação/i })).toBeInTheDocument();
  });
});
