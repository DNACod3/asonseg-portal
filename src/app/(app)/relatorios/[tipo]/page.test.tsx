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

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { delegatedPermission: { findMany: (...a: unknown[]) => guardState.findManyGrants(...a) } },
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
  canViewSocialReports: (...a: unknown[]) => guardState.canViewSocialReports(...a),
  isReportTypeAuthorized: (...a: unknown[]) => guardState.isReportTypeAuthorized(...a),
  buildReportRows: (...a: unknown[]) => guardState.buildReportRows(...a),
  ReportView: (props: { title: string; rows: unknown[]; containsPII: boolean }) => (
    <div data-testid="report-view">
      view:{props.title}:{props.rows.length}:{props.containsPII ? 'has-pii' : 'no-pii'}
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
