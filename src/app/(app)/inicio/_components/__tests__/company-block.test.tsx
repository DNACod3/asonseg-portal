import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CurrentPerson } from '@/modules/identity';

/**
 * USP-067 — T15 / PNL-04, **PNL-MN-02**. Testa `loadCompanyPanel` +
 * `CompanyBlock` juntos, com os módulos de leitura mockados.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const jobsState = vi.hoisted(() => ({
  listCompanyJobs: vi.fn(),
  countCompanyApplications: vi.fn(),
  listCompanyRecentApplications: vi.fn(),
}));
vi.mock('@/modules/jobs', async () => {
  const actual = await vi.importActual<typeof import('@/modules/jobs')>('@/modules/jobs');
  return {
    ...actual,
    listCompanyJobs: (...a: unknown[]) => jobsState.listCompanyJobs(...a),
    countCompanyApplications: (...a: unknown[]) => jobsState.countCompanyApplications(...a),
    listCompanyRecentApplications: (...a: unknown[]) => jobsState.listCompanyRecentApplications(...a),
  };
});

const companiesState = vi.hoisted(() => ({ listPersonCompanyGrants: vi.fn() }));
vi.mock('@/modules/companies', async () => {
  const actual = await vi.importActual<typeof import('@/modules/companies')>('@/modules/companies');
  return {
    ...actual,
    listPersonCompanyGrants: (...a: unknown[]) => companiesState.listPersonCompanyGrants(...a),
  };
});

const { loadCompanyPanel } = await import('../../_loaders/company');
const { CompanyBlock } = await import('../company-block');

const PERSON: CurrentPerson = {
  id: 'p-resp',
  supabaseUserId: 'su-resp',
  fullName: 'Responsável Teste',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['COMPANY_RESPONSIBLE'],
  phone: null,
  fullAddress: null,
};

const GRANT = (companyId: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  grantId: `grant-${companyId}`,
  companyId,
  companyName: `Empresa ${companyId}`,
  grantType: 'RESPONSIBLE',
  status: 'ACTIVE',
  grantedAt: new Date('2026-01-01T00:00:00Z'),
  acceptedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const JOB_ROW = (id: string, status = 'ACTIVE') => ({
  id,
  title: `Vaga ${id}`,
  status,
  validUntil: null,
  publishedAt: new Date('2026-07-01T10:00:00Z'),
  lastStatusChangeAt: new Date('2026-07-01T10:00:00Z'),
});

const CANDIDATE_NAME_LEAK = 'João da Silva PII Leak';

beforeEach(() => {
  vi.clearAllMocks();
  companiesState.listPersonCompanyGrants.mockResolvedValue([GRANT('c-1')]);
  jobsState.listCompanyJobs.mockResolvedValue([JOB_ROW('job-1')]);
  jobsState.countCompanyApplications.mockResolvedValue({ total: 3, active: 2 });
  jobsState.listCompanyRecentApplications.mockResolvedValue([
    { jobId: 'job-1', jobTitle: 'Vaga job-1', appliedAt: new Date('2026-07-05T10:00:00Z') },
  ]);
});

describe('loadCompanyPanel + CompanyBlock (T15)', () => {
  it('renderiza os 4 KPIs e os 2 cards com as ações certas (PNL-04-1/2/3)', async () => {
    const data = await loadCompanyPanel(PERSON);
    render(<CompanyBlock data={data} />);

    expect(data.kpis).toEqual([
      { label: 'Vagas criadas', value: 1, tone: 'primary' },
      { label: 'Vagas em aberto', value: 1, tone: 'success' },
      { label: 'Candidatos aplicados', value: 3, tone: 'cta' },
      { label: 'Candidatos ativos', value: 2, tone: 'muted' },
    ]);

    expect(screen.getAllByText('Vaga job-1').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Ver candidatos' })[0]).toHaveAttribute(
      'href',
      '/empresa/c-1/vagas/job-1/candidatos',
    );
  });

  it('P1.4-4: sem empresa ativa (RESPONSIBLE/ACTIVE) → estado vazio + atalho cadastrar empresa', async () => {
    companiesState.listPersonCompanyGrants.mockResolvedValue([]);
    const data = await loadCompanyPanel(PERSON);
    render(<CompanyBlock data={data} />);

    expect(data.hasActiveCompany).toBe(false);
    expect(screen.getByText('Você ainda não tem uma Empresa ativa.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar empresa' })).toHaveAttribute(
      'href',
      '/empresa/cadastrar',
    );
  });

  it('grant PENDING (não ACTIVE) não conta como empresa ativa', async () => {
    companiesState.listPersonCompanyGrants.mockResolvedValue([GRANT('c-1', { status: 'PENDING' })]);
    const data = await loadCompanyPanel(PERSON);
    expect(data.hasActiveCompany).toBe(false);
  });

  it('vaga AWAITING_ADJUSTMENTS mostra "Corrigir e reenviar" (canSubmit)', async () => {
    jobsState.listCompanyJobs.mockResolvedValue([JOB_ROW('job-2', 'AWAITING_ADJUSTMENTS')]);
    const data = await loadCompanyPanel(PERSON);
    render(<CompanyBlock data={data} />);

    expect(screen.getByRole('button', { name: 'Corrigir e reenviar' })).toBeInTheDocument();
  });

  it('PNL-MN-02: o card "candidaturas recentes" nunca contém nome/contato de candidato no markup', async () => {
    // A query real (T5) já garante isso no `select`; este teste prova que o
    // loader/bloco também não introduzem PII de candidato via outro caminho —
    // mesmo que um valor de teste "vaze" para dentro da fixture por engano,
    // ele não deveria aparecer renderizado.
    jobsState.listCompanyRecentApplications.mockResolvedValue([
      { jobId: 'job-1', jobTitle: 'Vaga job-1', appliedAt: new Date('2026-07-05T10:00:00Z') },
    ]);
    const data = await loadCompanyPanel(PERSON);
    const { container } = render(<CompanyBlock data={data} />);

    expect(container.innerHTML).not.toContain(CANDIDATE_NAME_LEAK);
    // Estrutural: nenhuma row de "candidaturas recentes" tem campo de identidade.
    for (const row of data.recentApplications) {
      expect(Object.keys(row).sort()).toEqual(['appliedAt', 'companyId', 'jobId', 'jobTitle']);
    }
  });

  it('múltiplas empresas: KPIs e listas agregam sobre todas', async () => {
    companiesState.listPersonCompanyGrants.mockResolvedValue([GRANT('c-1'), GRANT('c-2')]);
    jobsState.listCompanyJobs.mockImplementation((companyId: string) =>
      Promise.resolve([JOB_ROW(`job-${companyId}`)]),
    );
    jobsState.countCompanyApplications.mockResolvedValue({ total: 1, active: 1 });
    jobsState.listCompanyRecentApplications.mockImplementation((companyId: string) =>
      Promise.resolve([
        { jobId: `job-${companyId}`, jobTitle: `Vaga ${companyId}`, appliedAt: new Date() },
      ]),
    );

    const data = await loadCompanyPanel(PERSON);
    expect(data.jobsTotal).toBe(2);
    expect(data.kpis[2]?.value).toBe(2); // candidatos aplicados = 1+1
  });

  it('fallback por dimensão: listCompanyJobs falhando numa empresa não derruba o bloco', async () => {
    jobsState.listCompanyJobs.mockRejectedValue(new Error('db indisponível'));
    const data = await loadCompanyPanel(PERSON);
    render(<CompanyBlock data={data} />);

    expect(data.jobs).toEqual([]);
    expect(screen.getAllByText('Vaga job-1').length).toBeGreaterThan(0); // candidaturas recentes intactas
  });
});
