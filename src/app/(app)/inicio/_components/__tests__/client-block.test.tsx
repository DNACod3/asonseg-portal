import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CurrentPerson } from '@/modules/identity';

/** USP-067 — T14 / PNL-03, A-05, A-06. */

const servicesState = vi.hoisted(() => ({
  searchServices: vi.fn(),
  listServiceCategories: vi.fn(),
  countActiveServicesByCategory: vi.fn(),
  listPersonServiceInterests: vi.fn(),
}));
vi.mock('@/modules/services', async () => {
  const actual = await vi.importActual<typeof import('@/modules/services')>('@/modules/services');
  return {
    ...actual,
    searchServices: (...a: unknown[]) => servicesState.searchServices(...a),
    listServiceCategories: (...a: unknown[]) => servicesState.listServiceCategories(...a),
    countActiveServicesByCategory: (...a: unknown[]) => servicesState.countActiveServicesByCategory(...a),
    listPersonServiceInterests: (...a: unknown[]) => servicesState.listPersonServiceInterests(...a),
  };
});

const { loadClientPanel } = await import('../../_loaders/client');
const { ClientBlock } = await import('../client-block');

const PERSON: CurrentPerson = {
  id: 'p-client',
  supabaseUserId: 'su-client',
  fullName: 'Cliente Teste',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['CLIENT'],
  phone: null,
  fullAddress: null,
};

const INTEREST_ROW = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'int-1',
  serviceId: 'svc-1',
  serviceTitle: 'Serviço X',
  providerName: 'Prestador Y',
  interestedAt: new Date('2026-07-01T10:00:00Z'),
  cancelledAt: null,
  active: true,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  servicesState.searchServices.mockResolvedValue({ items: [], total: 42, page: 1, pageSize: 20 });
  servicesState.listServiceCategories.mockResolvedValue([{ id: 'cat-1', name: 'Elétrica' }]);
  servicesState.countActiveServicesByCategory.mockResolvedValue([
    { categoryId: 'cat-1', name: 'Elétrica', count: 4 },
  ]);
  servicesState.listPersonServiceInterests.mockResolvedValue([INTEREST_ROW()]);
});

describe('loadClientPanel + ClientBlock (T14)', () => {
  it('renderiza os 3 KPIs (sem "em andamento", A-05) e os 2 cards', async () => {
    const data = await loadClientPanel(PERSON);
    render(<ClientBlock data={data} />);

    expect(data.kpis).toHaveLength(3);
    expect(data.kpis.map((k) => k.label)).toEqual([
      'Serviços disponíveis',
      'Tipos de serviço',
      'Serviços solicitados',
    ]);
    expect(data.kpis.map((k) => k.label)).not.toContain('Em andamento');

    expect(screen.getByText('Elétrica')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Elétrica/ })).toHaveAttribute(
      'href',
      '/servicos?categoria=cat-1',
    );
    expect(screen.getByText('Serviço X')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes' })).toHaveAttribute('href', '/servicos/svc-1');
  });

  it('A-05: KPI "serviços solicitados" conta só manifestações ativas', async () => {
    servicesState.listPersonServiceInterests.mockResolvedValue([
      INTEREST_ROW({ id: 'int-1', active: true }),
      INTEREST_ROW({ id: 'int-2', active: false, cancelledAt: new Date() }),
    ]);
    const data = await loadClientPanel(PERSON);
    expect(data.kpis[2]).toEqual({ label: 'Serviços solicitados', value: 1, tone: 'success' });
  });

  it('fallback por dimensão: countActiveServicesByCategory falhando → CounterGrid vazio, resto intacto', async () => {
    servicesState.countActiveServicesByCategory.mockRejectedValue(new Error('db indisponível'));
    const data = await loadClientPanel(PERSON);
    render(<ClientBlock data={data} />);

    expect(data.categoryCounters).toEqual([]);
    expect(screen.getByText('Nada por aqui ainda.')).toBeInTheDocument();
    expect(screen.getByText('Serviço X')).toBeInTheDocument();
  });
});
