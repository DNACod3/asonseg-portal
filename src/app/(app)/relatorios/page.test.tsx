import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate + conteúdo do índice de relatórios (USP-042 / T12). Lista só os
 * `reportType`s que `isReportTypeAuthorized` libera para o viewer atual —
 * sem revelar os demais.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  isReportTypeAuthorized: vi.fn(),
  findManyGrants: vi.fn(),
}));

vi.mock('@/modules/identity', () => ({
  requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
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
  isReportTypeAuthorized: (...a: unknown[]) => guardState.isReportTypeAuthorized(...a),
  getModerationGrants: (...a: unknown[]) => guardState.findManyGrants(...a),
}));

const { default: RelatoriosIndexPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.findManyGrants.mockResolvedValue([]);
});

describe('RelatoriosIndexPage', () => {
  it('COORDINATOR (autorizado só para R1..R4) vê 4 links, NÃO vê fila nem social', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coord', roles: ['COORDINATOR'] });
    guardState.isReportTypeAuthorized.mockImplementation(
      (tipo: string) => tipo !== 'moderation_queue' && tipo !== 'social',
    );

    const ui = await RelatoriosIndexPage();
    render(ui);

    expect(screen.getByText('Relatório de vagas (MP4)')).toBeInTheDocument();
    expect(screen.getByText('Relatório de encaminhamentos (MP8/MP9)')).toBeInTheDocument();
    expect(screen.queryByText('Relatório de fila de moderação (MP10/MP3)')).not.toBeInTheDocument();
    expect(screen.queryByText('Relatório social por região')).not.toBeInTheDocument();
  });

  it('viewer sem NENHUM guard → lista vazia, sem revelar quais relatórios existem', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-vol', roles: ['VOLUNTEER'] });
    guardState.isReportTypeAuthorized.mockReturnValue(false);

    const ui = await RelatoriosIndexPage();
    render(ui);

    expect(screen.getByText('Nenhum relatório disponível para o seu papel.')).toBeInTheDocument();
  });

  it('BOARD vê todos os 6 relatórios', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-board', roles: ['BOARD'] });
    guardState.isReportTypeAuthorized.mockReturnValue(true);

    const ui = await RelatoriosIndexPage();
    render(ui);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
  });
});
