import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota da fila de sugestões de taxonomia (USP-019 / SUGG-06 /
 * SUGG-MN-02): só Pessoa com delegação de `APPROVE_CATEGORY_SUGGESTION` acessa;
 * quem não tem recebe 404 — a rota não revela sua existência. `requireActivePerson`,
 * `canApproveTaxonomySuggestions` e `listTaxonomySuggestions` são mockados; a listagem
 * NÃO pode ser chamada quando o gate barra (confinamento — nada vaza antes do 404).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canApproveTaxonomySuggestions: vi.fn(),
  listTaxonomySuggestions: vi.fn(),
  notFoundCalled: false,
}));

/** `notFound()` do Next lança para abortar o render; replicamos esse contrato. */
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

vi.mock('@/modules/moderation', () => ({
  canApproveTaxonomySuggestions: (...a: unknown[]) => guardState.canApproveTaxonomySuggestions(...a),
  listTaxonomySuggestions: (...a: unknown[]) => guardState.listTaxonomySuggestions(...a),
  TaxonomySuggestionsList: ({ items }: { items: Array<{ id: string }> }) => (
    <div data-testid="taxonomy-suggestions-list">{items.length} sugestão(ões)</div>
  ),
}));

vi.mock('@/shared/lib/time', () => ({
  formatSaoPaulo: () => '08/07/2026 às 10:00',
}));

const { default: SugestoesPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('SugestoesPage — gate de rota (SUGG-MN-02)', () => {
  it('logado mas sem permissão → 404, e as sugestões NÃO são carregadas', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-sem-permissao' });
    guardState.canApproveTaxonomySuggestions.mockResolvedValue(false);

    await expect(SugestoesPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.listTaxonomySuggestions).not.toHaveBeenCalled();
  });

  it('com permissão → renderiza a fila com as sugestões pendentes', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coordenador' });
    guardState.canApproveTaxonomySuggestions.mockResolvedValue(true);
    guardState.listTaxonomySuggestions.mockResolvedValue([
      { id: 's-1', kind: 'JOB_AREA', name: 'Logística', suggestedByName: 'Ana', createdAt: new Date() },
      { id: 's-2', kind: 'SERVICE_CATEGORY', name: 'Jardinagem', suggestedByName: 'Bia', createdAt: new Date() },
    ]);

    const ui = await SugestoesPage();
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('taxonomy-suggestions-list')).toHaveTextContent('2 sugestão(ões)');
  });
});
