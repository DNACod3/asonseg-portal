import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CurrentPerson } from '@/modules/identity';

// ApplyToJobButton/CancelApplicationButton chamam useRouter() — mesmo mock de
// `apply-to-job-button.spec.tsx` (o botão em si já é testado lá; aqui só
// precisamos que ele monte sem o invariant "app router not mounted").
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

/**
 * USP-067 — T12 / PNL-01. Testa `loadCandidatePanel` + `CandidateBlock`
 * juntos (loader → apresentacional), com os módulos de leitura mockados
 * (Test Coverage Matrix — "Loader + bloco por papel"). Cobre KPIs, os 2
 * cards com ações certas, e o fallback por dimensão (try/catch) quando uma
 * leitura falha.
 */

const jobsState = vi.hoisted(() => ({
  searchJobs: vi.fn(),
  listPersonApplications: vi.fn(),
}));
vi.mock('@/modules/jobs', async () => {
  const actual = await vi.importActual<typeof import('@/modules/jobs')>('@/modules/jobs');
  return {
    ...actual,
    searchJobs: (...a: unknown[]) => jobsState.searchJobs(...a),
    listPersonApplications: (...a: unknown[]) => jobsState.listPersonApplications(...a),
  };
});

const reportingState = vi.hoisted(() => ({ getHomeIndicators: vi.fn() }));
vi.mock('@/modules/reporting', () => ({
  getHomeIndicators: (...a: unknown[]) => reportingState.getHomeIndicators(...a),
}));

const personsState = vi.hoisted(() => ({
  getCandidateProfileStatus: vi.fn(),
  getCandidatePrimaryArea: vi.fn(),
}));
vi.mock('@/modules/persons', async () => {
  const actual = await vi.importActual<typeof import('@/modules/persons')>('@/modules/persons');
  return {
    ...actual,
    getCandidateProfileStatus: (...a: unknown[]) => personsState.getCandidateProfileStatus(...a),
    getCandidatePrimaryArea: (...a: unknown[]) => personsState.getCandidatePrimaryArea(...a),
  };
});

const { loadCandidatePanel } = await import('../../_loaders/candidate');
const { CandidateBlock } = await import('../candidate-block');

const PERSON: CurrentPerson = {
  id: 'p-cand',
  supabaseUserId: 'su-cand',
  fullName: 'Ana Candidata',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['CANDIDATE'],
  phone: null,
  fullAddress: null,
};

const JOB_ITEM = (id: string) => ({
  id,
  title: `Vaga ${id}`,
  area: null,
  region: null,
  educationLevel: null,
  contractType: null,
  workRegime: null,
  salary: null,
  publishedAt: null,
  company: { displayName: 'Empresa X', isAnonymized: false },
});

const APPLICATION_ROW = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'app-1',
  jobId: 'job-1',
  jobTitle: 'Vaga Aplicada',
  jobStatus: 'ACTIVE',
  companyName: 'Empresa Aplicada',
  appliedAt: new Date('2026-07-01T10:00:00Z'),
  cancelledAt: null,
  active: true,
  viaEncaminhamento: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  reportingState.getHomeIndicators.mockResolvedValue({ activeJobs: 247, activeCandidates: 0, verifiedCompanies: 0 });
  personsState.getCandidatePrimaryArea.mockResolvedValue(null);
  personsState.getCandidateProfileStatus.mockResolvedValue('ACTIVE');
  jobsState.searchJobs.mockResolvedValue({ items: [JOB_ITEM('job-a')], total: 1, page: 1, pageSize: 20 });
  jobsState.listPersonApplications.mockResolvedValue([APPLICATION_ROW()]);
});

describe('loadCandidatePanel + CandidateBlock (T12)', () => {
  it('renderiza os 4 KPIs e os 2 cards com as ações certas (PNL-01-1/2/3)', async () => {
    const data = await loadCandidatePanel(PERSON);
    render(<CandidateBlock data={data} />);

    expect(screen.getByText('247')).toBeInTheDocument();
    expect(screen.getByText('Vagas abertas no portal')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument(); // ACTIVE → CANDIDATE_STATUS_LABELS

    expect(screen.getByText('Vaga job-a')).toBeInTheDocument();
    const detailLinks = screen.getAllByRole('link', { name: 'Ver detalhes' });
    expect(detailLinks.some((link) => link.getAttribute('href') === '/vagas/job-a')).toBe(true);
    expect(screen.getByRole('button', { name: 'Candidatar-se' })).toBeInTheDocument();

    expect(screen.getByText('Vaga Aplicada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar candidatura' })).toBeInTheDocument();
  });

  it('candidatura histórica (cancelada) não mostra "Retirar candidatura"', async () => {
    jobsState.listPersonApplications.mockResolvedValue([
      APPLICATION_ROW({ active: false, cancelledAt: new Date('2026-06-01T10:00:00Z') }),
    ]);
    const data = await loadCandidatePanel(PERSON);
    render(<CandidateBlock data={data} />);

    expect(screen.queryByRole('button', { name: 'Cancelar candidatura' })).not.toBeInTheDocument();
  });

  it('sem CandidateProfile: status do currículo cai para "Não enviado"', async () => {
    personsState.getCandidateProfileStatus.mockResolvedValue(null);
    const data = await loadCandidatePanel(PERSON);
    render(<CandidateBlock data={data} />);

    expect(screen.getByText('Não enviado')).toBeInTheDocument();
  });

  it('fallback por dimensão: getHomeIndicators falhando não derruba o bloco (KPI cai para 0)', async () => {
    reportingState.getHomeIndicators.mockRejectedValue(new Error('db indisponível'));
    const data = await loadCandidatePanel(PERSON);
    render(<CandidateBlock data={data} />);

    expect(screen.getByText('Vagas abertas no portal')).toBeInTheDocument();
    expect(data.kpis[0]?.value).toBe(0);
    // As outras dimensões seguem intactas.
    expect(screen.getByText('Vaga Aplicada')).toBeInTheDocument();
  });

  it('fallback por dimensão: searchJobs falhando → card "vagas que combinam" cai para vazio, resto intacto', async () => {
    jobsState.searchJobs.mockRejectedValue(new Error('db indisponível'));
    const data = await loadCandidatePanel(PERSON);
    render(<CandidateBlock data={data} />);

    expect(data.matchingJobs).toEqual([]);
    expect(screen.getByText('Vaga Aplicada')).toBeInTheDocument();
  });

  it('A-03: sem área primária no CV, searchJobs é chamado sem areaId', async () => {
    personsState.getCandidatePrimaryArea.mockResolvedValue(null);
    await loadCandidatePanel(PERSON);
    expect(jobsState.searchJobs).toHaveBeenCalledWith({ page: 1 }, PERSON);
  });

  it('A-03: com área primária no CV, searchJobs filtra por ela', async () => {
    personsState.getCandidatePrimaryArea.mockResolvedValue('area-1');
    await loadCandidatePanel(PERSON);
    expect(jobsState.searchJobs).toHaveBeenCalledWith({ areaId: 'area-1', page: 1 }, PERSON);
  });
});
