import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate de rota da página de busca ativa de candidatos (USP-028 / T5). Mesmo
 * padrão de `empresa/[empresaId]/vagas/page.test.tsx` (USP-023): só o
 * responsável ATIVO da Empresa acessa; `requireActiveResponsible`,
 * `searchCandidates` e as queries de taxonomia são mockadas.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  requireActiveResponsible: vi.fn(),
  listApprovedJobAreas: vi.fn(),
  listActiveRegions: vi.fn(),
  searchCandidates: vi.fn(),
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
  requireActiveResponsible: (...a: unknown[]) => guardState.requireActiveResponsible(...a),
  listApprovedJobAreas: (...a: unknown[]) => guardState.listApprovedJobAreas(...a),
  listActiveRegions: (...a: unknown[]) => guardState.listActiveRegions(...a),
}));

vi.mock('@/modules/persons', () => ({
  searchCandidates: (...a: unknown[]) => guardState.searchCandidates(...a),
  CandidateSearchForm: () => <div data-testid="candidate-search-form" />,
  CandidateSearchList: ({ items }: { items: Array<{ candidatePersonId: string }> }) => (
    <div data-testid="candidate-search-list">{items.length} candidato(s)</div>
  ),
}));

const { default: CandidatosBuscaPage } = await import('./page');

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';

function makeParams() {
  return {
    params: Promise.resolve({ empresaId: EMPRESA_ID }),
    searchParams: Promise.resolve({}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.listApprovedJobAreas.mockResolvedValue([]);
  guardState.listActiveRegions.mockResolvedValue([]);
});

describe('CandidatosBuscaPage — gate de rota (USP028-08)', () => {
  it('não-responsável → 404, e a busca NÃO é executada', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho' });
    guardState.requireActiveResponsible.mockResolvedValue(false);

    await expect(CandidatosBuscaPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.searchCandidates).not.toHaveBeenCalled();
  });

  it('responsável ATIVO → renderiza filtros e lista com o total de candidatos', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.requireActiveResponsible.mockResolvedValue(true);
    guardState.searchCandidates.mockResolvedValue({
      ok: true,
      data: {
        items: [{ candidatePersonId: 'c-1' }, { candidatePersonId: 'c-2' }],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });

    const ui = await CandidatosBuscaPage(makeParams());
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('candidate-search-form')).toBeInTheDocument();
    expect(screen.getByText('2 candidatos encontrados')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-search-list')).toHaveTextContent('2 candidato(s)');
  });

  it('USP028-07: estado vazio (0 candidatos) renderiza sem erro', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.requireActiveResponsible.mockResolvedValue(true);
    guardState.searchCandidates.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, pageSize: 20 },
    });

    const ui = await CandidatosBuscaPage(makeParams());
    render(ui);

    expect(screen.getByText('Nenhum candidato encontrado')).toBeInTheDocument();
  });

  it('searchCandidates FORBIDDEN → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.requireActiveResponsible.mockResolvedValue(true);
    guardState.searchCandidates.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Você não tem permissão para buscar candidatos.' },
    });

    await expect(CandidatosBuscaPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });
});
