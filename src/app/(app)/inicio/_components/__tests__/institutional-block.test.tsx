import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CurrentPerson } from '@/modules/identity';

/**
 * USP-067 — T16 / PNL-05/06/07, **PNL-MN-03**. Testa `loadInstitutionalPanel`
 * + `InstitutionalBlock` juntos, com os módulos de leitura mockados.
 */

const moderationState = vi.hoisted(() => ({ viewModerationQueue: vi.fn() }));
vi.mock('@/modules/moderation', async () => {
  const actual = await vi.importActual<typeof import('@/modules/moderation')>('@/modules/moderation');
  return { ...actual, viewModerationQueue: (...a: unknown[]) => moderationState.viewModerationQueue(...a) };
});

const reportingState = vi.hoisted(() => ({
  reportReferrals: vi.fn(),
  countActivePersons: vi.fn(),
  getHomeIndicators: vi.fn(),
}));
vi.mock('@/modules/reporting', async () => {
  const actual = await vi.importActual<typeof import('@/modules/reporting')>('@/modules/reporting');
  return {
    ...actual,
    reportReferrals: (...a: unknown[]) => reportingState.reportReferrals(...a),
    countActivePersons: (...a: unknown[]) => reportingState.countActivePersons(...a),
    getHomeIndicators: (...a: unknown[]) => reportingState.getHomeIndicators(...a),
  };
});

const referralsState = vi.hoisted(() => ({
  listRecentReferrals: vi.fn(),
  canRegisterReferralResult: vi.fn(),
}));
vi.mock('@/modules/referrals', async () => {
  const actual = await vi.importActual<typeof import('@/modules/referrals')>('@/modules/referrals');
  return {
    ...actual,
    listRecentReferrals: (...a: unknown[]) => referralsState.listRecentReferrals(...a),
    canRegisterReferralResult: (...a: unknown[]) => referralsState.canRegisterReferralResult(...a),
  };
});

const { loadInstitutionalPanel } = await import('../../_loaders/institutional');
const { InstitutionalBlock } = await import('../institutional-block');

function person(roles: string[]): CurrentPerson {
  return {
    id: 'p-inst',
    supabaseUserId: 'su-inst',
    fullName: 'Pessoa Institucional',
    status: 'ATIVO',
    primeiroAcesso: false,
    roles,
    phone: null,
    fullAddress: null,
  };
}

const QUEUE_ITEM = (overrides: Partial<Record<string, unknown>> = {}) => ({
  contentKind: 'JOB',
  contentId: 'content-1',
  title: 'Vaga em análise',
  authorName: 'Autor X',
  submittedAt: new Date('2026-07-01T10:00:00Z'),
  companyUnverified: false,
  companyId: 'c-1',
  ...overrides,
});

const REFERRAL_ROW = (id = 'ref-1') => ({
  id,
  jobId: 'job-1',
  jobTitle: 'Vaga Y',
  companyName: 'Empresa Y',
  referredPersonName: 'Pessoa Encaminhada',
  result: null,
  createdAt: new Date('2026-08-01T10:00:00Z'),
});

beforeEach(() => {
  vi.clearAllMocks();
  moderationState.viewModerationQueue.mockResolvedValue([QUEUE_ITEM()]);
  reportingState.reportReferrals.mockResolvedValue({ totalCreated: 5, outcome: { withoutResult: 2 } });
  reportingState.countActivePersons.mockResolvedValue(120);
  reportingState.getHomeIndicators.mockResolvedValue({ activeJobs: 0, activeCandidates: 0, verifiedCompanies: 30 });
  referralsState.listRecentReferrals.mockResolvedValue([REFERRAL_ROW()]);
  referralsState.canRegisterReferralResult.mockResolvedValue(true);
});

describe('loadInstitutionalPanel + InstitutionalBlock (T16)', () => {
  it('COORDINATOR com canModerate=true: KPIs completos + ações de fila + registrar resultado (PNL-05)', async () => {
    const data = await loadInstitutionalPanel(person(['COORDINATOR']), ['COORDINATOR'], true);
    render(<InstitutionalBlock data={data} />);

    expect(data.kpis.map((k) => k.label)).toEqual([
      'Moderações pendentes',
      'Vagas na fila',
      'Currículos na fila',
      'Encaminhamentos no mês',
    ]);
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/moderacao');
    expect(screen.getByRole('link', { name: 'Ver fila completa' })).toHaveAttribute('href', '/moderacao');
    expect(screen.getByRole('link', { name: 'Registrar resultado' })).toHaveAttribute(
      'href',
      '/encaminhamentos/ref-1/resultado',
    );
  });

  it('PNL-MN-03: SOCIAL_ASSISTANT com canModerate=false — sem botão de decisão nem link para /moderacao', async () => {
    referralsState.canRegisterReferralResult.mockResolvedValue(true);
    const data = await loadInstitutionalPanel(person(['SOCIAL_ASSISTANT']), ['SOCIAL_ASSISTANT'], false);
    const { container } = render(<InstitutionalBlock data={data} />);

    expect(screen.queryByRole('link', { name: 'Revisar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver fila completa' })).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/href="\/moderacao"/);
    expect(data.kpis.map((k) => k.label)).toEqual([
      'Moderações pendentes',
      'Encaminhamentos no mês',
      'Aguardando resultado',
    ]);
    // A-13: sem KPI "cadastros assistidos no mês".
    expect(data.kpis.map((k) => k.label)).not.toContain('Cadastros assistidos no mês');
  });

  it('BOARD: KPIs read-only (pessoas/empresas ativas) e sem ação de encaminhamento quando canRegisterReferralResult=false', async () => {
    referralsState.canRegisterReferralResult.mockResolvedValue(false);
    const data = await loadInstitutionalPanel(person(['BOARD']), ['BOARD'], false);
    render(<InstitutionalBlock data={data} />);

    expect(data.kpis.map((k) => k.label)).toEqual([
      'Moderações pendentes',
      'Encaminhamentos no mês',
      'Pessoas ativas',
      'Empresas ativas',
    ]);
    expect(screen.queryByRole('link', { name: 'Registrar resultado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Revisar' })).not.toBeInTheDocument();
  });

  it('voluntário puro delegado (sem papel institucional, canModerate=true): só fila, sem encaminhamentos', async () => {
    const data = await loadInstitutionalPanel(person(['VOLUNTEER']), ['VOLUNTEER'], true);
    render(<InstitutionalBlock data={data} />);

    expect(data.kpis.map((k) => k.label)).toEqual(['Moderações pendentes', 'Vagas na fila', 'Currículos na fila']);
    expect(data.referrals).toEqual([]);
    expect(referralsState.listRecentReferrals).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Revisar' })).toBeInTheDocument();
  });

  it('item com companyUnverified: mostra "Validar empresa" (canModerate=true)', async () => {
    moderationState.viewModerationQueue.mockResolvedValue([QUEUE_ITEM({ companyUnverified: true })]);
    const data = await loadInstitutionalPanel(person(['COORDINATOR']), ['COORDINATOR'], true);
    render(<InstitutionalBlock data={data} />);

    expect(screen.getByRole('link', { name: 'Validar empresa' })).toBeInTheDocument();
  });

  it('fallback por dimensão: viewModerationQueue falhando não derruba o bloco', async () => {
    moderationState.viewModerationQueue.mockRejectedValue(new Error('db indisponível'));
    const data = await loadInstitutionalPanel(person(['COORDINATOR']), ['COORDINATOR'], true);
    render(<InstitutionalBlock data={data} />);

    expect(data.queue).toEqual([]);
    expect(data.kpis[0]).toEqual({ label: 'Moderações pendentes', value: 0, tone: 'cta' });
    expect(screen.getByText('Pessoa Encaminhada')).toBeInTheDocument();
  });

  it('PNL-MN-04 (regressão pós-Verifier): nenhuma linha de "Encaminhamentos recentes" linka a /encaminhamentos/[id] nu (rota inexistente) — só /resultado quando permitido', async () => {
    // canRegisterReferralResult=true: "Registrar resultado" (rota real) deve
    // aparecer, mas o `href` bare `/encaminhamentos/ref-1"` (sem `/resultado`)
    // nunca — essa rota não tem `page.tsx` (só `.../resultado` e `.../novo`).
    referralsState.canRegisterReferralResult.mockResolvedValue(true);
    const withAction = await loadInstitutionalPanel(person(['COORDINATOR']), ['COORDINATOR'], true);
    const { container: withActionContainer, unmount } = render(<InstitutionalBlock data={withAction} />);
    expect(screen.queryByRole('link', { name: 'Ver detalhes' })).not.toBeInTheDocument();
    expect(withActionContainer.innerHTML).not.toMatch(/href="\/encaminhamentos\/ref-1"/);
    expect(withActionContainer.innerHTML).toMatch(/href="\/encaminhamentos\/ref-1\/resultado"/);
    unmount();

    // canRegisterReferralResult=false (ex.: BOARD): nem esse link — a linha
    // não tem NENHUMA ação de encaminhamento (read-only completo).
    referralsState.canRegisterReferralResult.mockResolvedValue(false);
    const readOnly = await loadInstitutionalPanel(person(['BOARD']), ['BOARD'], false);
    const { container: readOnlyContainer } = render(<InstitutionalBlock data={readOnly} />);
    expect(screen.queryByRole('link', { name: 'Ver detalhes' })).not.toBeInTheDocument();
    expect(readOnlyContainer.innerHTML).not.toMatch(/href="\/encaminhamentos\/ref-1"/);
    expect(readOnlyContainer.innerHTML).not.toMatch(/href="\/encaminhamentos\/ref-1\/resultado"/);
  });
});
