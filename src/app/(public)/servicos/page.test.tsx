import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes de componente da rota pública `/servicos` (USP-030 / T030-4).
 * Server Component: as dependências (searchServices/listServiceCategories/
 * listActiveRegions/getCurrentPerson) são mockadas — o que se testa é a
 * composição (disclaimer, lista/estado vazio, paginação), não a lógica de
 * busca (coberta em `search-services.int.test.ts`).
 */

const guardState = vi.hoisted(() => ({
  getCurrentPerson: vi.fn(),
  listServiceCategories: vi.fn(),
  listActiveRegions: vi.fn(),
  searchServices: vi.fn(),
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: (...a: unknown[]) => guardState.getCurrentPerson(...a),
}));

vi.mock('@/modules/jobs', () => ({
  listActiveRegions: (...a: unknown[]) => guardState.listActiveRegions(...a),
}));

vi.mock('@/modules/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/services')>();
  return {
    ...actual,
    listServiceCategories: (...a: unknown[]) => guardState.listServiceCategories(...a),
    searchServices: (...a: unknown[]) => guardState.searchServices(...a),
  };
});

const { default: ServicosPage } = await import('./page');

const SERVICE_ITEM = {
  id: 'service-1',
  title: 'Jardinagem residencial',
  categoryName: 'Jardinagem',
  regionName: 'Centro',
  price: { min: 80, max: 150, unit: 'por serviço' },
  providerDisplayName: 'João da Silva',
  coverPhotoUrl: null,
  publishedAt: new Date('2026-07-01T12:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  guardState.getCurrentPerson.mockResolvedValue(null);
  guardState.listServiceCategories.mockResolvedValue([]);
  guardState.listActiveRegions.mockResolvedValue([]);
  guardState.searchServices.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
});

describe('ServicosPage — disclaimer (AC-030-4)', () => {
  it('exibe o termo de isenção de responsabilidade da ASONSEG', async () => {
    const ui = await ServicosPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByText(/apenas plataforma de conexão/i)).toBeInTheDocument();
    expect(screen.getByText(/não presta, não intermedia financeiramente/i)).toBeInTheDocument();
  });
});

describe('ServicosPage — estado vazio', () => {
  it('sem resultados, mostra estado vazio sem erro', async () => {
    const ui = await ServicosPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getAllByText(/nenhum serviço encontrado/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/tente ajustar os filtros/i)).toBeInTheDocument();
  });
});

describe('ServicosPage — card sem contato', () => {
  it('renderiza o card do serviço sem telefone/e-mail (o View Model já não os carrega)', async () => {
    guardState.searchServices.mockResolvedValue({
      items: [SERVICE_ITEM],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    const ui = await ServicosPage({ searchParams: Promise.resolve({}) });
    const { container } = render(ui);

    expect(screen.getByText('Jardinagem residencial')).toBeInTheDocument();
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/@|\(\d{2}\)\s?\d{4,5}-\d{4}/);
  });
});
