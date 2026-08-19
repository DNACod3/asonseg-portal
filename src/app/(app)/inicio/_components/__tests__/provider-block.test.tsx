import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CurrentPerson } from '@/modules/identity';

/**
 * USP-067 — T13 / PNL-02, PNL-MN-06. Testa `loadProviderPanel` +
 * `ProviderBlock` juntos, com os módulos de leitura mockados.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const servicesState = vi.hoisted(() => ({
  listProviderInterests: vi.fn(),
  listProviderServices: vi.fn(),
  submitServiceForModeration: vi.fn(),
}));
vi.mock('@/modules/services', async () => {
  const actual = await vi.importActual<typeof import('@/modules/services')>('@/modules/services');
  return {
    ...actual,
    listProviderInterests: (...a: unknown[]) => servicesState.listProviderInterests(...a),
    listProviderServices: (...a: unknown[]) => servicesState.listProviderServices(...a),
    submitServiceForModeration: (...a: unknown[]) => servicesState.submitServiceForModeration(...a),
  };
});

const personsState = vi.hoisted(() => ({ getProviderProfileStatus: vi.fn() }));
vi.mock('@/modules/persons', async () => {
  const actual = await vi.importActual<typeof import('@/modules/persons')>('@/modules/persons');
  return {
    ...actual,
    getProviderProfileStatus: (...a: unknown[]) => personsState.getProviderProfileStatus(...a),
  };
});

const { loadProviderPanel } = await import('../../_loaders/provider');
const { ProviderBlock } = await import('../provider-block');

const PERSON: CurrentPerson = {
  id: 'p-prov',
  supabaseUserId: 'su-prov',
  fullName: 'Carlos Prestador',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['PROVIDER'],
  phone: null,
  fullAddress: null,
};

const INTEREST_VIEW = (id: string, interestedAt: Date) => ({
  interestId: id,
  clientName: `Cliente ${id}`,
  contact: { phone: '48999990000', email: 'cliente@example.com' },
  interestedAt,
  service: { id: 'svc-1', title: 'Serviço X' },
});

const SERVICE_ROW = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'svc-1',
  title: 'Serviço X',
  status: 'ACTIVE',
  publishedAt: new Date('2026-07-01T10:00:00Z'),
  lastStatusChangeAt: new Date('2026-07-01T10:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  const now = new Date();
  servicesState.listProviderInterests.mockResolvedValue({
    ok: true,
    data: { interests: [INTEREST_VIEW('int-1', now)], total: 1, page: 1, pageSize: 20 },
  });
  servicesState.listProviderServices.mockResolvedValue([SERVICE_ROW()]);
  personsState.getProviderProfileStatus.mockResolvedValue('ACTIVE');
});

describe('loadProviderPanel + ProviderBlock (T13)', () => {
  it('renderiza os 4 KPIs e os 2 cards com as ações certas (PNL-02-1/2/3)', async () => {
    const data = await loadProviderPanel(PERSON);
    render(<ProviderBlock data={data} />);

    expect(data.kpis[0]).toEqual({ label: 'Pessoas interessadas', value: 1, tone: 'primary' });
    expect(screen.getByText('Publicado')).toBeInTheDocument(); // profile status
    expect(screen.getByText('Cliente int-1')).toBeInTheDocument();
    expect(screen.getAllByText('Serviço X').length).toBeGreaterThan(0);
    expect(screen.getByText('Ativo')).toBeInTheDocument(); // badge do status ACTIVE
    expect(screen.getAllByRole('link', { name: 'Ver detalhes' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Ver interessados' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/prestador/servicos/svc-1/editar',
    );
  });

  it('PNL-MN-06: card "interessados" NÃO tem ação "marcar respondido"', async () => {
    const data = await loadProviderPanel(PERSON);
    render(<ProviderBlock data={data} />);

    expect(screen.queryByText(/marcar respondido/i)).not.toBeInTheDocument();
  });

  it('serviço AWAITING_ADJUSTMENTS: mostra "Corrigir e reenviar" (P1.2-3)', async () => {
    servicesState.listProviderServices.mockResolvedValue([
      SERVICE_ROW({ id: 'svc-2', title: 'Serviço em ajustes', status: 'AWAITING_ADJUSTMENTS' }),
    ]);
    const data = await loadProviderPanel(PERSON);
    render(<ProviderBlock data={data} />);

    expect(screen.getByRole('button', { name: 'Corrigir e reenviar' })).toBeInTheDocument();
  });

  it('listProviderInterests chamado exatamente 1 vez por render (audit-on-read, risco documentado no design)', async () => {
    await loadProviderPanel(PERSON);
    expect(servicesState.listProviderInterests).toHaveBeenCalledTimes(1);
  });

  it('listProviderInterests ok:false → card vazio, sem derrubar o bloco', async () => {
    servicesState.listProviderInterests.mockResolvedValue({
      ok: false,
      error: { code: 'INTERNAL', message: 'erro' },
    });
    const data = await loadProviderPanel(PERSON);
    render(<ProviderBlock data={data} />);

    expect(data.interests).toEqual([]);
    expect(data.interestsTotal).toBe(0);
    expect(screen.getByText('Serviço X')).toBeInTheDocument(); // resto do bloco intacto
  });

  it('fallback por dimensão: listProviderServices falhando não derruba o bloco', async () => {
    servicesState.listProviderServices.mockRejectedValue(new Error('db indisponível'));
    const data = await loadProviderPanel(PERSON);
    render(<ProviderBlock data={data} />);

    expect(data.services).toEqual([]);
    expect(screen.getByText('Cliente int-1')).toBeInTheDocument();
  });
});
