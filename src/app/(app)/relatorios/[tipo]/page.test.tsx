import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate de rota da página de relatório (USP-042 / T12 — REL42-MN-02/03/05).
 * Mesmo padrão de `pessoas/[id]/visao-consolidada/page.test.tsx`
 * (USP-039): guards e leituras mockados, `notFound()` verificado por
 * exceção. Cobre MN-02 (fila sem MODERATE_*), MN-03 (relatório sem guard) e
 * MN-05 (coordenador em `social` → containsPII=false).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  isReportTypeAuthorized: vi.fn(),
  buildReportRows: vi.fn(),
  canViewSocialReports: vi.fn(),
  findManyGrants: vi.fn(),
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
  listServiceCategories: (...a: unknown[]) => guardState.listServiceCategories(...a),
}));

vi.mock('@/modules/jobs', () => ({
  listActiveRegions: (...a: unknown[]) => guardState.listActiveRegions(...a),
}));

vi.mock('@/modules/reporting', () => ({
  REPORT_TYPES: ['jobs', 'applications', 'services', 'referrals', 'moderation_queue', 'social'],
  REPORT_TITLES: {
    jobs: 'Relatório de vagas (MP4)',
    applications: 'Relatório de candidaturas (MP6)',
    services: 'Relatório de serviços e manifestações (MP5/MP7)',
    referrals: 'Relatório de encaminhamentos (MP8/MP9)',
    moderation_queue: 'Relatório de fila de moderação (MP10/MP3)',
    social: 'Relatório social por região',
  },
  CONTENT_STATUS_LABELS: {
    DRAFT: 'Rascunho',
    IN_MODERATION: 'Em moderação',
    AWAITING_ADJUSTMENTS: 'Aguardando ajustes',
    ACTIVE: 'Ativo',
    REJECTED: 'Rejeitado',
    PAUSED: 'Pausado',
    EXPIRED: 'Expirado',
    ARCHIVED: 'Arquivado',
    INACTIVATED: 'Inativado',
  },
  canViewSocialReports: (...a: unknown[]) => guardState.canViewSocialReports(...a),
  isReportTypeAuthorized: (...a: unknown[]) => guardState.isReportTypeAuthorized(...a),
  buildReportRows: (...a: unknown[]) => guardState.buildReportRows(...a),
  getModerationGrants: (...a: unknown[]) => guardState.findManyGrants(...a),
  ReportView: (props: {
    title: string;
    rows: unknown[];
    containsPII: boolean;
    statusOptions?: { value: string; label: string }[];
    categoryOptions?: { value: string; label: string }[];
    regionOptions?: { value: string; label: string }[];
  }) => (
    <div data-testid="report-view">
      view:{props.title}:{props.rows.length}:{props.containsPII ? 'has-pii' : 'no-pii'}
      {props.statusOptions ? <span data-testid="status-options">{props.statusOptions.length}</span> : null}
      {props.categoryOptions ? <span data-testid="category-options">{props.categoryOptions.length}</span> : null}
      {props.regionOptions ? <span data-testid="region-options">{props.regionOptions.length}</span> : null}
    </div>
  ),
}));

const { default: RelatorioPage } = await import('./page');

function makeParams(tipo: string) {
  return { params: Promise.resolve({ tipo }), searchParams: Promise.resolve({}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.findManyGrants.mockResolvedValue([]);
  guardState.listServiceCategories.mockResolvedValue([]);
  guardState.listActiveRegions.mockResolvedValue([]);
});

describe('RelatorioPage — gate de rota (REL42-MN-02/03/05)', () => {
  it('tipo desconhecido → 404 imediato (rota não existe)', async () => {
    await expect(RelatorioPage(makeParams('nao-existe'))).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });

  it('REL42-MN-03: VOLUNTEER em jobs sem guard → 404, buildReportRows NÃO chamado', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-vol', roles: ['VOLUNTEER'] });
    guardState.isReportTypeAuthorized.mockReturnValue(false);

    await expect(RelatorioPage(makeParams('jobs'))).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.buildReportRows).not.toHaveBeenCalled();
  });

  it('REL42-MN-02: VOLUNTEER sem MODERATE_* em moderation_queue → 404 (grants buscados antes de negar)', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-vol', roles: ['VOLUNTEER'] });
    guardState.isReportTypeAuthorized.mockReturnValue(false);
    guardState.findManyGrants.mockResolvedValue([]);

    await expect(RelatorioPage(makeParams('moderation_queue'))).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.findManyGrants).toHaveBeenCalled();
    expect(guardState.buildReportRows).not.toHaveBeenCalled();
  });

  it('happy COORDINATOR em jobs → renderiza ReportView com as linhas', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coord', roles: ['COORDINATOR'] });
    guardState.isReportTypeAuthorized.mockReturnValue(true);
    guardState.canViewSocialReports.mockReturnValue(false);
    guardState.buildReportRows.mockResolvedValue({
      columns: [{ key: 'status', label: 'Status' }],
      rows: [{ status: 'ACTIVE' }],
    });

    const ui = await RelatorioPage(makeParams('jobs'));
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('report-view')).toHaveTextContent('view:Relatório de vagas (MP4):1:no-pii');
  });

  it('REL42-MN-05: COORDINATOR em social → containsPII=false (versão stripped, sem checkbox de ciência)', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coord', roles: ['COORDINATOR'] });
    guardState.isReportTypeAuthorized.mockReturnValue(true);
    guardState.canViewSocialReports.mockReturnValue(false);
    guardState.buildReportRows.mockResolvedValue({
      columns: [{ key: 'regionName', label: 'Região' }],
      rows: [{ regionName: 'Centro' }],
    });

    const ui = await RelatorioPage(makeParams('social'));
    render(ui);

    expect(screen.getByTestId('report-view')).toHaveTextContent(
      'view:Relatório social por região:1:no-pii',
    );
  });

  it('SOCIAL_ASSISTANT em social → containsPII=true (versão full)', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['SOCIAL_ASSISTANT'] });
    guardState.isReportTypeAuthorized.mockReturnValue(true);
    guardState.canViewSocialReports.mockReturnValue(true);
    guardState.buildReportRows.mockResolvedValue({ columns: [], rows: [] });

    const ui = await RelatorioPage(makeParams('social'));
    render(ui);

    expect(screen.getByTestId('report-view')).toHaveTextContent('has-pii');
  });

  it('buildReportRows retorna null (defesa em profundidade) → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coord', roles: ['COORDINATOR'] });
    guardState.isReportTypeAuthorized.mockReturnValue(true);
    guardState.buildReportRows.mockResolvedValue(null);

    await expect(RelatorioPage(makeParams('social'))).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });
});

describe('RelatorioPage — opções de filtro por reportType (USP-058/REL-5, USP058-05..08/MN-04)', () => {
  beforeEach(() => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coord', roles: ['COORDINATOR'] });
    guardState.isReportTypeAuthorized.mockReturnValue(true);
    guardState.canViewSocialReports.mockReturnValue(false);
    guardState.buildReportRows.mockResolvedValue({ columns: [], rows: [] });
  });

  it("USP058-05: tipo='jobs' → passa statusOptions com os 9 valores de CONTENT_STATUS_LABELS", async () => {
    const ui = await RelatorioPage(makeParams('jobs'));
    render(ui);

    expect(screen.getByTestId('status-options')).toHaveTextContent('9');
    expect(screen.queryByTestId('category-options')).not.toBeInTheDocument();
    expect(screen.queryByTestId('region-options')).not.toBeInTheDocument();
  });

  it("USP058-06: tipo='services' → passa categoryOptions de listServiceCategories()", async () => {
    guardState.listServiceCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Elétrica' },
      { id: 'cat-2', name: 'Jardinagem' },
    ]);

    const ui = await RelatorioPage(makeParams('services'));
    render(ui);

    expect(guardState.listServiceCategories).toHaveBeenCalled();
    expect(screen.getByTestId('category-options')).toHaveTextContent('2');
    expect(screen.queryByTestId('status-options')).not.toBeInTheDocument();
    expect(screen.queryByTestId('region-options')).not.toBeInTheDocument();
  });

  it("USP058-07: tipo='social' → passa regionOptions de listActiveRegions()", async () => {
    guardState.listActiveRegions.mockResolvedValue([{ id: 'reg-1', name: 'Centro' }]);

    const ui = await RelatorioPage(makeParams('social'));
    render(ui);

    expect(guardState.listActiveRegions).toHaveBeenCalled();
    expect(screen.getByTestId('region-options')).toHaveTextContent('1');
    expect(screen.queryByTestId('status-options')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-options')).not.toBeInTheDocument();
  });

  it.each(['applications', 'referrals', 'moderation_queue'])(
    'USP058-08/MN-04: tipo=%s → nenhuma opção extra (só período), nenhuma query de opção chamada',
    async (tipo) => {
      const ui = await RelatorioPage(makeParams(tipo));
      render(ui);

      expect(screen.queryByTestId('status-options')).not.toBeInTheDocument();
      expect(screen.queryByTestId('category-options')).not.toBeInTheDocument();
      expect(screen.queryByTestId('region-options')).not.toBeInTheDocument();
      expect(guardState.listServiceCategories).not.toHaveBeenCalled();
      expect(guardState.listActiveRegions).not.toHaveBeenCalled();
    },
  );
});
