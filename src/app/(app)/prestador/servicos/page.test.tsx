import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota do painel de gestão de serviços (USP-032 / T032-5):
 * só uma Pessoa com papel `PROVIDER` ativo acessa; qualquer outra recebe 404
 * — mesmo padrão de `prestador/servicos/nova/page.test.tsx`.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  listProviderServices: vi.fn(),
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
  listProviderServices: (...a: unknown[]) => guardState.listProviderServices(...a),
  viewProviderServiceRow: (row: unknown) => row,
  ServiceManagementList: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="service-management-list">{rows.length} serviço(s)</div>
  ),
}));

const { default: GestaoServicosPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.listProviderServices.mockResolvedValue([]);
});

describe('GestaoServicosPage — gate de rota (SVC029-MN-02)', () => {
  it('sem papel PROVIDER → 404, e nada é carregado', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-1', roles: ['CANDIDATE'] });

    await expect(GestaoServicosPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.listProviderServices).not.toHaveBeenCalled();
  });

  it('com papel PROVIDER → lista os serviços do próprio prestador', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-2', roles: ['PROVIDER'] });
    guardState.listProviderServices.mockResolvedValue([{ id: 's-1' }, { id: 's-2' }]);

    const ui = await GestaoServicosPage();
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(guardState.listProviderServices).toHaveBeenCalledWith('p-2');
    expect(screen.getByTestId('service-management-list')).toHaveTextContent('2 serviço(s)');
  });
});
