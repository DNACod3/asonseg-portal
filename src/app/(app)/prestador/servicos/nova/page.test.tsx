import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota de publicação de serviço (USP-029 / T029-8): só uma
 * Pessoa com papel `PROVIDER` ativo acessa; qualquer outra recebe 404 — mesmo
 * padrão de `empresa/[empresaId]/vagas/nova/page.tsx` (P-006/D-005). A lista de
 * Empresas representadas (AC-029-1) só é carregada após o gate passar.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  grantFindMany: vi.fn(),
  listServiceCategories: vi.fn(),
  listActiveRegions: vi.fn(),
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

vi.mock('@/modules/services', () => ({
  ServiceForm: ({ companies }: { companies: { id: string; nomeFantasia: string }[] }) => (
    <div data-testid="service-form">{companies.map((c) => c.nomeFantasia).join(',')}</div>
  ),
  listServiceCategories: (...a: unknown[]) => guardState.listServiceCategories(...a),
}));

vi.mock('@/modules/jobs', () => ({
  listActiveRegions: (...a: unknown[]) => guardState.listActiveRegions(...a),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    personCompanyGrant: { findMany: (...a: unknown[]) => guardState.grantFindMany(...a) },
  },
}));

const { default: PublicarServicoPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.grantFindMany.mockResolvedValue([]);
  guardState.listServiceCategories.mockResolvedValue([]);
  guardState.listActiveRegions.mockResolvedValue([]);
});

describe('PublicarServicoPage — gate de rota (SVC029-MN-02)', () => {
  it('sem papel PROVIDER → 404, e nada é carregado', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-1', roles: ['CANDIDATE'] });

    await expect(PublicarServicoPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.grantFindMany).not.toHaveBeenCalled();
  });

  it('com papel PROVIDER → renderiza o formulário', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-2', roles: ['PROVIDER'] });

    const ui = await PublicarServicoPage();
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('service-form')).toBeInTheDocument();
  });

  it('AC-029-1: lista só as Empresas das quais a Pessoa é responsável ativo', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-3', roles: ['PROVIDER'] });
    guardState.grantFindMany.mockResolvedValue([
      { company: { id: 'co-1', nomeFantasia: 'Jardim Verde' } },
    ]);

    const ui = await PublicarServicoPage();
    render(ui);

    expect(guardState.grantFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          personId: 'p-3',
          grantType: 'RESPONSIBLE',
          status: 'ACTIVE',
          revokedAt: null,
        }),
      }),
    );
    expect(screen.getByTestId('service-form')).toHaveTextContent('Jardim Verde');
  });
});
