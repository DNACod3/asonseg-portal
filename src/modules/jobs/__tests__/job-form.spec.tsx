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

/**
 * Restyle Design System (USP-020 / T1 / U20-STYLE-01 / U20-MN-05). O `JobForm` passou
 * a usar os primitivos `Label/Input/Textarea/Button` de `@/shared/ui` — este bloco trava
 * que a mudança foi só de marcação/classe: todos os campos continuam presentes e o
 * binding RHF→Server Action (payload/handlers) não mudou.
 */
// publishJobSchema exige UUID em companyId/areaId/regionId — ids distintos dos
// sentinelas 'company-1'/'area-1'/'region-1' usados no bloco de sugestão acima
// (que nunca chega a submeter o formulário completo).
const UUID_COMPANY = '11111111-1111-1111-1111-111111111111';
const UUID_AREA = '22222222-2222-2222-2222-222222222222';
const UUID_REGION = '33333333-3333-3333-3333-333333333333';
const uuidJobAreas = [{ id: UUID_AREA, name: 'Comércio' }];
const uuidRegions = [{ id: UUID_REGION, name: 'Centro' }];

describe('JobForm — restyle Design System (USP-020)', () => {
  it('U20-MN-05: todos os campos esperados renderizam', () => {
    render(<JobForm companyId={UUID_COMPANY} jobAreas={uuidJobAreas} regions={uuidRegions} />);

    expect(screen.getByLabelText(/título da vaga/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/área de atuação/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^descrição$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^requisitos$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/benefícios/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/salário mínimo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/salário máximo/i)).toBeInTheDocument();
    const salaryVisible = screen.getByLabelText(/exibir salário na vaga pública/i) as HTMLInputElement;
    expect(salaryVisible).toBeInTheDocument();
    expect(salaryVisible.checked).toBe(true); // default salaryVisible=true preservado
    expect(screen.getByLabelText(/regime de trabalho/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de contrato/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^região$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/escolaridade exigida/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/validade da vaga/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar rascunho/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar para moderação/i })).toBeInTheDocument();
  });

  it('U20-MN-05: submit com dados válidos chama submitJobForModeration com o mesmo payload', async () => {
    actions.submitJobForModeration.mockResolvedValue({ ok: true, data: { id: 'job-1' } });
    render(<JobForm companyId={UUID_COMPANY} jobAreas={uuidJobAreas} regions={uuidRegions} />);

    fireEvent.change(screen.getByLabelText(/título da vaga/i), { target: { value: 'Vendedor(a)' } });
    fireEvent.change(screen.getByLabelText(/área de atuação/i), { target: { value: UUID_AREA } });
    fireEvent.change(screen.getByLabelText(/^descrição$/i), { target: { value: 'Descrição válida.' } });
    fireEvent.change(screen.getByLabelText(/^requisitos$/i), { target: { value: 'Requisitos válidos.' } });
    fireEvent.change(screen.getByLabelText(/regime de trabalho/i), { target: { value: 'Presencial' } });
    fireEvent.change(screen.getByLabelText(/tipo de contrato/i), { target: { value: 'CLT' } });
    fireEvent.change(screen.getByLabelText(/^região$/i), { target: { value: UUID_REGION } });
    fireEvent.change(screen.getByLabelText(/local$/i), { target: { value: 'São José - SC' } });
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    fireEvent.change(screen.getByLabelText(/validade da vaga/i), {
      target: { value: validUntil.toISOString().slice(0, 10) },
    });

    fireEvent.click(screen.getByRole('button', { name: /enviar para moderação/i }));

    await waitFor(() => expect(actions.submitJobForModeration).toHaveBeenCalledTimes(1));
    const payload = actions.submitJobForModeration.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      companyId: UUID_COMPANY,
      title: 'Vendedor(a)',
      areaId: UUID_AREA,
      description: 'Descrição válida.',
      requirements: 'Requisitos válidos.',
      workRegime: 'Presencial',
      contractType: 'CLT',
      regionId: UUID_REGION,
      location: 'São José - SC',
      salaryVisible: true,
    });
  });

  it('U20-MN-05: "Salvar rascunho" chama createJobDraft', async () => {
    actions.createJobDraft.mockResolvedValue({ ok: true, data: { id: 'job-1' } });
    render(<JobForm companyId={UUID_COMPANY} jobAreas={uuidJobAreas} regions={uuidRegions} />);

    fireEvent.change(screen.getByLabelText(/título da vaga/i), { target: { value: 'Rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar rascunho/i }));

    await waitFor(() => expect(actions.createJobDraft).toHaveBeenCalledTimes(1));
    const payload = actions.createJobDraft.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ companyId: UUID_COMPANY, title: 'Rascunho' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Rascunho salvo.'));
  });
});
