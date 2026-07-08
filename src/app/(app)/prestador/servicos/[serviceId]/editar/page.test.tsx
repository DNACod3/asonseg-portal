import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota da edição de serviço (USP-032 / T032-5 / SVC032-MN-02):
 * só o dono (autor OU responsável ativo da Empresa) acessa; qualquer outra
 * Pessoa recebe 404 — mesmo padrão de `empresa/[empresaId]/vagas/[jobId]/editar`.
 * Serviço não-ACTIVE mostra aviso em vez do formulário.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  requireServiceOwner: vi.fn(),
  serviceFindUnique: vi.fn(),
  listServiceCategories: vi.fn(),
  listActiveRegions: vi.fn(),
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
  requireServiceOwner: (...a: unknown[]) => guardState.requireServiceOwner(...a),
  listServiceCategories: (...a: unknown[]) => guardState.listServiceCategories(...a),
  ServiceEditForm: ({ serviceId }: { serviceId: string }) => (
    <div data-testid="service-edit-form">{serviceId}</div>
  ),
}));

vi.mock('@/modules/jobs', () => ({
  listActiveRegions: (...a: unknown[]) => guardState.listActiveRegions(...a),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    service: { findUnique: (...a: unknown[]) => guardState.serviceFindUnique(...a) },
  },
}));

const { default: EditarServicoPage } = await import('./page');

const SERVICE_ID = '22222222-2222-2222-2222-222222222222';
const params = Promise.resolve({ serviceId: SERVICE_ID });

const SERVICE_ACTIVE = {
  title: 'Jardinagem residencial',
  categoryId: 'cat-1',
  description: 'desc',
  priceMin: null,
  priceMax: null,
  priceUnit: null,
  regionId: 'region-1',
  availabilityDescription: 'disponibilidade',
  status: 'ACTIVE',
};

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.listServiceCategories.mockResolvedValue([]);
  guardState.listActiveRegions.mockResolvedValue([]);
});

describe('EditarServicoPage — gate de rota (SVC032-MN-02)', () => {
  it('não-dono → 404, e o serviço NÃO é carregado', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho' });
    guardState.requireServiceOwner.mockResolvedValue({ ok: false, companyId: null });

    await expect(EditarServicoPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.serviceFindUnique).not.toHaveBeenCalled();
  });

  it('dono + serviço ACTIVE → renderiza o formulário de edição', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.requireServiceOwner.mockResolvedValue({ ok: true, companyId: null });
    guardState.serviceFindUnique.mockResolvedValue(SERVICE_ACTIVE);

    const ui = await EditarServicoPage({ params });
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('service-edit-form')).toHaveTextContent(SERVICE_ID);
  });

  it('dono + serviço não-ACTIVE → mostra aviso em vez do formulário', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.requireServiceOwner.mockResolvedValue({ ok: true, companyId: null });
    guardState.serviceFindUnique.mockResolvedValue({ ...SERVICE_ACTIVE, status: 'PAUSED' });

    const ui = await EditarServicoPage({ params });
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.queryByTestId('service-edit-form')).not.toBeInTheDocument();
    expect(screen.getByText(/não pode ser editado/i)).toBeInTheDocument();
  });
});
