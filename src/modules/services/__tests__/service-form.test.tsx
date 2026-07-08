// ServiceForm — seletor PF/Empresa (AC-029-1), validação client e sub-fluxo de
// sugestão de categoria. RTL + jsdom. Server Actions mockadas — o que se testa
// é o encadeamento de UI, não a lógica das actions (coberta em
// submit-service.int.test.ts / upload-service-photo.int.test.ts).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({
  submitServiceForModeration: vi.fn(),
  createServiceDraft: vi.fn(),
  uploadServicePhoto: vi.fn(),
  suggestTaxonomy: vi.fn(),
}));

vi.mock('../actions/submit-service-for-moderation', () => ({
  submitServiceForModeration: (...a: unknown[]) => actions.submitServiceForModeration(...a),
}));
vi.mock('../actions/create-service-draft', () => ({
  createServiceDraft: (...a: unknown[]) => actions.createServiceDraft(...a),
}));
vi.mock('../actions/upload-service-photo', () => ({
  uploadServicePhoto: (...a: unknown[]) => actions.uploadServicePhoto(...a),
}));
vi.mock('@/modules/moderation/actions/suggest-taxonomy', () => ({
  suggestTaxonomy: (...a: unknown[]) => actions.suggestTaxonomy(...a),
}));

const { ServiceForm } = await import('../components/service-form');

const UUID_CATEGORY = '22222222-2222-2222-2222-222222222222';
const UUID_REGION = '33333333-3333-3333-3333-333333333333';
const UUID_COMPANY = '44444444-4444-4444-4444-444444444444';

const categories = [{ id: UUID_CATEGORY, name: 'Jardinagem' }];
const regions = [{ id: UUID_REGION, name: 'Centro' }];
const companies = [{ id: UUID_COMPANY, nomeFantasia: 'Verde Ltda' }];

beforeEach(() => {
  vi.clearAllMocks();
  actions.suggestTaxonomy.mockResolvedValue({ ok: true, data: { id: 'new-cat-1' } });
});

describe('ServiceForm — seletor PF vs Empresa (AC-029-1)', () => {
  it('lista só as Empresas representadas + opção PF, com aviso de exposição de nome para PF', () => {
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    const select = screen.getByLabelText(/publicar como/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toEqual(['Pessoa física (meu nome)', 'Em nome de Verde Ltda']);
    expect(screen.getByText(/seu nome fica visível publicamente/i)).toBeInTheDocument();
  });

  it('ao escolher a Empresa, o aviso de exposição de nome (PF) some', () => {
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    fireEvent.change(screen.getByLabelText(/publicar como/i), { target: { value: UUID_COMPANY } });
    expect(screen.queryByText(/seu nome fica visível publicamente/i)).not.toBeInTheDocument();
  });

  it('sem nenhuma Empresa representada, só a opção PF aparece', () => {
    render(<ServiceForm companies={[]} categories={categories} regions={regions} />);

    const select = screen.getByLabelText(/publicar como/i) as HTMLSelectElement;
    expect(Array.from(select.options)).toHaveLength(1);
  });
});

describe('ServiceForm — sugerir nova categoria', () => {
  it('selecionar "Outro / sugerir nova categoria" revela o input de texto livre', () => {
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    expect(screen.queryByLabelText(/nome da nova categoria/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^categoria$/i), { target: { value: '__suggest__' } });
    expect(screen.getByLabelText(/nome da nova categoria/i)).toBeInTheDocument();
  });

  it('submeter sugestão invoca suggestTaxonomy({kind:SERVICE_CATEGORY,name}) e exibe feedback', async () => {
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    fireEvent.change(screen.getByLabelText(/^categoria$/i), { target: { value: '__suggest__' } });
    fireEvent.change(screen.getByLabelText(/nome da nova categoria/i), { target: { value: 'Pintura' } });
    fireEvent.click(screen.getByRole('button', { name: /sugerir categoria/i }));

    await waitFor(() =>
      expect(actions.suggestTaxonomy).toHaveBeenCalledWith({ kind: 'SERVICE_CATEGORY', name: 'Pintura' }),
    );
    await waitFor(() => expect(screen.getByText(/enviada para aprovação/i)).toBeInTheDocument());
  });
});

describe('ServiceForm — campos e submit (AC-029-3)', () => {
  it('todos os campos esperados renderizam', () => {
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    expect(screen.getByLabelText(/publicar como/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/título do serviço/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^categoria$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^descrição$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/valor mínimo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/valor máximo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^unidade$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^região$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/disponibilidade/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fotos do trabalho/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar rascunho/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar para moderação/i })).toBeInTheDocument();
  });

  it('submit com dados válidos como PF chama submitServiceForModeration sem companyId', async () => {
    actions.submitServiceForModeration.mockResolvedValue({ ok: true, data: { serviceId: 's-1' } });
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    fireEvent.change(screen.getByLabelText(/título do serviço/i), { target: { value: 'Jardinagem residencial' } });
    fireEvent.change(screen.getByLabelText(/^categoria$/i), { target: { value: UUID_CATEGORY } });
    fireEvent.change(screen.getByLabelText(/^descrição$/i), { target: { value: 'Descrição válida.' } });
    fireEvent.change(screen.getByLabelText(/valor mínimo/i), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText(/valor máximo/i), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText(/^unidade$/i), { target: { value: 'por serviço' } });
    fireEvent.change(screen.getByLabelText(/^região$/i), { target: { value: UUID_REGION } });
    fireEvent.change(screen.getByLabelText(/disponibilidade/i), { target: { value: 'Seg a sex, 8h-17h' } });

    fireEvent.click(screen.getByRole('button', { name: /enviar para moderação/i }));

    await waitFor(() => expect(actions.submitServiceForModeration).toHaveBeenCalledTimes(1));
    const payload = actions.submitServiceForModeration.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      title: 'Jardinagem residencial',
      categoryId: UUID_CATEGORY,
      description: 'Descrição válida.',
      priceUnit: 'por serviço',
      regionId: UUID_REGION,
      availabilityDescription: 'Seg a sex, 8h-17h',
      photoStoragePaths: [],
    });
    expect(payload.companyId).toBeFalsy();
  });

  it('"Salvar rascunho" chama createServiceDraft só com título', async () => {
    actions.createServiceDraft.mockResolvedValue({ ok: true, data: { serviceId: 's-2' } });
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    fireEvent.change(screen.getByLabelText(/título do serviço/i), { target: { value: 'Rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar rascunho/i }));

    await waitFor(() => expect(actions.createServiceDraft).toHaveBeenCalledTimes(1));
    const payload = actions.createServiceDraft.mock.calls[0]?.[0];
    expect(payload).toMatchObject({ title: 'Rascunho' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Rascunho salvo.'));
  });
});

describe('ServiceForm — upload de fotos (AC-029-4)', () => {
  function makeFile(name: string): File {
    return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' });
  }

  it('upload de foto válida chama uploadServicePhoto e lista o storagePath retornado', async () => {
    actions.uploadServicePhoto.mockResolvedValue({ ok: true, data: { storagePath: 'p-1/foto.jpg' } });
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    const input = screen.getByLabelText(/fotos do trabalho/i);
    fireEvent.change(input, { target: { files: [makeFile('foto.jpg')] } });

    await waitFor(() => expect(actions.uploadServicePhoto).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('p-1/foto.jpg')).toBeInTheDocument());
  });

  it('recusa selecionar mais de 3 fotos de uma vez (client-side, SVC029-MN-04)', () => {
    render(<ServiceForm companies={companies} categories={categories} regions={regions} />);

    const input = screen.getByLabelText(/fotos do trabalho/i);
    fireEvent.change(input, {
      target: { files: [makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg'), makeFile('d.jpg')] },
    });

    expect(screen.getByText(/no máximo 3 fotos/i)).toBeInTheDocument();
    expect(actions.uploadServicePhoto).not.toHaveBeenCalled();
  });
});
