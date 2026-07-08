import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota do painel "manifestações recebidas" (USP-035 / T2):
 * só uma Pessoa com papel `PROVIDER` ativo acessa; qualquer outra recebe 404
 * — mesmo padrão de `prestador/servicos/page.test.tsx` (L-008).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  listProviderInterests: vi.fn(),
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

vi.mock('@/modules/services', () => ({
  listProviderInterests: (...a: unknown[]) => guardState.listProviderInterests(...a),
  ProviderInterestsList: ({ items }: { items: unknown[] }) => (
    <div data-testid="provider-interests-list">{items.length} manifestação(ões)</div>
  ),
}));

const { default: ManifestacoesRecebidasPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.listProviderInterests.mockResolvedValue({
    ok: true,
    data: { interests: [], total: 0, page: 1, pageSize: 20 },
  });
});

describe('ManifestacoesRecebidasPage — gate de rota (SVC035 — L-008)', () => {
  it('sem papel PROVIDER → 404, e nada é carregado', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-1', roles: ['CLIENT'] });

    await expect(ManifestacoesRecebidasPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.listProviderInterests).not.toHaveBeenCalled();
  });

  it('com papel PROVIDER → lista as manifestações do próprio prestador', async () => {
    const viewer = { id: 'p-2', roles: ['PROVIDER'] };
    guardState.requireActivePerson.mockResolvedValue(viewer);
    guardState.listProviderInterests.mockResolvedValue({
      ok: true,
      data: {
        interests: [{ interestId: 'i-1' }, { interestId: 'i-2' }],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });

    const ui = await ManifestacoesRecebidasPage();
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(guardState.listProviderInterests).toHaveBeenCalledWith(viewer);
    expect(screen.getByTestId('provider-interests-list')).toHaveTextContent('2 manifestação(ões)');
    expect(screen.getByText(/2 manifestações ativas/i)).toBeInTheDocument();
  });

  it('resultado de erro da query → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-3', roles: ['PROVIDER'] });
    guardState.listProviderInterests.mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL', message: 'Erro interno.' },
    });

    await expect(ManifestacoesRecebidasPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });
});
