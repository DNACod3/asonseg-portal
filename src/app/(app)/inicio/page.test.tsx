import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-067 — T17 / PNL-00, **PNL-MN-04**.
 *
 * SPEC_DEVIATION (justificado, não enfraquecimento — Notas para o
 * Implementer #4 de tasks.md): o contrato antigo do hub-de-atalhos
 * (USP-049/USP-061 — `buildHubLinks`/"Minha conta"/"Meus papéis"/
 * "Institucional") é substituído pelo painel por papel. Os testes HUB-01..07
 * daquele contrato (asserções sobre `/candidato`, `/perfil`,
 * `/consentimentos` como links do hub) não se aplicam mais — a navegação
 * para essas rotas segue disponível via a casca `(app)` (sidebar/bottom nav,
 * AD-027/AD-028/USP-061), não recriada aqui. Este arquivo cobre o NOVO
 * contrato: composição por papel (ordem `ALL_ROLE_LABELS`), gate de acesso
 * institucional (PNL-MN-04), e papel-zero.
 *
 * Todos os 5 loaders são mockados (o teste de composição não re-exercita a
 * lógica interna de cada loader — já coberta pelos testes dedicados de
 * cada bloco, T12-T16).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canAccessModerationQueue: vi.fn(),
}));

vi.mock('@/modules/identity', async () => {
  const actual = await vi.importActual<typeof import('@/modules/identity')>('@/modules/identity');
  return {
    ...actual,
    requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
  };
});

vi.mock('@/modules/moderation', async () => {
  const actual = await vi.importActual<typeof import('@/modules/moderation')>('@/modules/moderation');
  return {
    ...actual,
    canAccessModerationQueue: (...a: unknown[]) => guardState.canAccessModerationQueue(...a),
  };
});

const loaderState = vi.hoisted(() => ({
  loadCandidatePanel: vi.fn(),
  loadProviderPanel: vi.fn(),
  loadClientPanel: vi.fn(),
  loadCompanyPanel: vi.fn(),
  loadInstitutionalPanel: vi.fn(),
}));
vi.mock('./_loaders/candidate', () => ({
  loadCandidatePanel: (...a: unknown[]) => loaderState.loadCandidatePanel(...a),
}));
vi.mock('./_loaders/provider', () => ({
  loadProviderPanel: (...a: unknown[]) => loaderState.loadProviderPanel(...a),
}));
vi.mock('./_loaders/client', () => ({
  loadClientPanel: (...a: unknown[]) => loaderState.loadClientPanel(...a),
}));
vi.mock('./_loaders/company', () => ({
  loadCompanyPanel: (...a: unknown[]) => loaderState.loadCompanyPanel(...a),
}));
vi.mock('./_loaders/institutional', () => ({
  loadInstitutionalPanel: (...a: unknown[]) => loaderState.loadInstitutionalPanel(...a),
}));

const { default: InicioPage } = await import('./page');

const EMPTY_KPI_DATA = { kpis: [], quickActions: [] };

beforeEach(() => {
  vi.clearAllMocks();
  guardState.canAccessModerationQueue.mockResolvedValue(false);
  loaderState.loadCandidatePanel.mockResolvedValue({
    ...EMPTY_KPI_DATA,
    matchingJobs: [],
    matchingJobsTotal: 0,
    applications: [],
    applicationsTotal: 0,
  });
  loaderState.loadProviderPanel.mockResolvedValue({
    ...EMPTY_KPI_DATA,
    interests: [],
    interestsTotal: 0,
    services: [],
    servicesTotal: 0,
  });
  loaderState.loadClientPanel.mockResolvedValue({
    ...EMPTY_KPI_DATA,
    categoryCounters: [],
    requestedServices: [],
    requestedServicesTotal: 0,
  });
  loaderState.loadCompanyPanel.mockResolvedValue({
    hasActiveCompany: false,
    ...EMPTY_KPI_DATA,
    jobs: [],
    jobsTotal: 0,
    recentApplications: [],
    recentApplicationsTotal: 0,
  });
  loaderState.loadInstitutionalPanel.mockResolvedValue({
    canModerate: false,
    canRegisterReferralResult: false,
    ...EMPTY_KPI_DATA,
    queue: [],
    queueTotal: 0,
    referrals: [],
    referralsTotal: 0,
  });
});

describe('InicioPage (/inicio) — painel por papel (USP-067)', () => {
  it('PNL-00-1: saudação com o primeiro nome', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-1',
      fullName: 'Ana Beatriz Candidata',
      roles: ['CANDIDATE'],
    });

    const ui = await InicioPage();
    render(ui);

    expect(screen.getByText('Olá, Ana')).toBeInTheDocument();
  });

  it('PNL-00-2: papel composto renderiza os blocos na ordem de ALL_ROLE_LABELS', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-2',
      fullName: 'Multi Papel',
      roles: ['COMPANY_RESPONSIBLE', 'CANDIDATE', 'CLIENT', 'PROVIDER'],
    });

    const ui = await InicioPage();
    render(ui);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Candidato(a)', 'Prestador(a)', 'Cliente', 'Responsável de Empresa']);
    expect(loaderState.loadCandidatePanel).toHaveBeenCalledTimes(1);
    expect(loaderState.loadProviderPanel).toHaveBeenCalledTimes(1);
    expect(loaderState.loadClientPanel).toHaveBeenCalledTimes(1);
    expect(loaderState.loadCompanyPanel).toHaveBeenCalledTimes(1);
    expect(loaderState.loadInstitutionalPanel).not.toHaveBeenCalled();
  });

  it('PNL-MN-04: papel sem acesso institucional (nem role, nem canModerate) não chama o loader institucional nem renderiza o bloco', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-3',
      fullName: 'Candidata Só',
      roles: ['CANDIDATE'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await InicioPage();
    render(ui);

    expect(loaderState.loadInstitutionalPanel).not.toHaveBeenCalled();
    expect(screen.queryByText('Institucional')).not.toBeInTheDocument();
  });

  it('voluntário com delegação de moderação (canModerate=true, sem papel institucional): bloco institucional aparece', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-4',
      fullName: 'Vitor Voluntário',
      roles: ['VOLUNTEER'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(true);

    const ui = await InicioPage();
    render(ui);

    expect(loaderState.loadInstitutionalPanel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-4' }),
      ['VOLUNTEER'],
      true,
    );
    expect(screen.getByText('Institucional')).toBeInTheDocument();
  });

  it('COORDINATOR (papel institucional, canModerate=false do guard mockado): bloco institucional ainda aparece — a role já concede', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-5',
      fullName: 'Carla Coordenadora',
      roles: ['COORDINATOR'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await InicioPage();
    render(ui);

    expect(screen.getByText('Institucional')).toBeInTheDocument();
  });

  /**
   * PNL-00 AC5 / PNL-MN-04 (fix pós-Verifier): `institutional` SHALL derivar
   * **exatamente** de `hubAccessFromRoles(roles).reports` — não de uma cópia
   * local do role-set. `hubAccessFromRoles` NÃO é mockado neste arquivo (só
   * `requireActivePerson` é substituído em `@/modules/identity`); `page.tsx`
   * chama a implementação real. Estes 2 testes cobrem BOARD e
   * SOCIAL_ASSISTANT isoladamente (COORDINATOR já coberto acima) — os 3
   * papéis de `REPORTS_ROLES` (`identity/domain/hub-links.ts`). O
   * discrimination sensor do Verifier provou que remover `'BOARD'` de um
   * array local duplicado sobrevivia à suíte inteira; com a chamada direta +
   * estes testes, qualquer divergência futura entre o role-set do hub e o
   * do painel (nesta direção) derruba `page.test.tsx`.
   */
  it('BOARD (canModerate=false): bloco institucional aparece via hubAccessFromRoles(roles).reports real', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-5b',
      fullName: 'Beto Board',
      roles: ['BOARD'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await InicioPage();
    render(ui);

    expect(screen.getByText('Institucional')).toBeInTheDocument();
  });

  it('SOCIAL_ASSISTANT (canModerate=false): bloco institucional aparece via hubAccessFromRoles(roles).reports real', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-5c',
      fullName: 'Sara Assistente',
      roles: ['SOCIAL_ASSISTANT'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await InicioPage();
    render(ui);

    expect(screen.getByText('Institucional')).toBeInTheDocument();
  });

  it('papel público sem acesso a relatórios (ex.: PROVIDER puro, canModerate=false): bloco institucional NÃO aparece', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-5d',
      fullName: 'Paulo Prestador',
      roles: ['PROVIDER'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await InicioPage();
    render(ui);

    expect(screen.queryByText('Institucional')).not.toBeInTheDocument();
    expect(loaderState.loadInstitutionalPanel).not.toHaveBeenCalled();
  });

  it('PNL-00-6: papel-zero (sem papel público/institucional) renderiza saudação + estado coerente, sem quebrar', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-6',
      fullName: 'Pessoa Sem Papel',
      roles: [],
    });

    const ui = await InicioPage();
    render(ui);

    expect(screen.getByText('Olá, Pessoa')).toBeInTheDocument();
    expect(
      screen.getByText('Você ainda não tem nenhum papel ativo. Use o menu para ativar um papel ou gerenciar sua conta.'),
    ).toBeInTheDocument();
    expect(loaderState.loadCandidatePanel).not.toHaveBeenCalled();
    expect(loaderState.loadProviderPanel).not.toHaveBeenCalled();
    expect(loaderState.loadClientPanel).not.toHaveBeenCalled();
    expect(loaderState.loadCompanyPanel).not.toHaveBeenCalled();
    expect(loaderState.loadInstitutionalPanel).not.toHaveBeenCalled();
  });

  it('chama requireActivePerson() sem allowFirstAccess (herda o redirect a /trocar-senha no 1º acesso)', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-7',
      fullName: 'Ana',
      roles: ['CANDIDATE'],
    });

    await InicioPage();

    expect(guardState.requireActivePerson).toHaveBeenCalledWith();
  });
});
