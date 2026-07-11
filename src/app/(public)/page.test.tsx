import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Teste de composição da home pública `/` (USP-047, T8 — HOME-10/11/12/13/
 * MN-03/MN-04; migrado da USP-041/T5). Server Component: `getHomeIndicators`
 * é mockada — o que se testa é a composição (ordem das seções, indicadores
 * embutidos, fallback, ausência de `<main>`, único `<h1>`), não a agregação
 * Prisma (coberta em `home-indicators.int.test.ts`).
 */

const guardState = vi.hoisted(() => ({
  getHomeIndicators: vi.fn(),
  searchJobs: vi.fn(),
}));

vi.mock('@/modules/reporting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/reporting')>();
  return {
    ...actual,
    getHomeIndicators: (...a: unknown[]) => guardState.getHomeIndicators(...a),
  };
});

vi.mock('@/modules/jobs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/jobs')>();
  return {
    ...actual,
    searchJobs: (...a: unknown[]) => guardState.searchJobs(...a),
  };
});

const { default: HomePage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.getHomeIndicators.mockResolvedValue({
    activeJobs: 47,
    activeCandidates: 12,
    verifiedCompanies: 8,
  });
  guardState.searchJobs.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
});

describe('HomePage — composição da landing (HOME-10)', () => {
  it('compõe as 5 seções na ordem hero → Como Funciona → Para Quem → Serviços → CTA final', async () => {
    const ui = await HomePage();
    render(ui);

    const headingTexts = screen
      .getAllByRole('heading', { level: 1 })
      .concat(screen.getAllByRole('heading', { level: 2 }))
      .map((h) => h.textContent ?? '');

    const heroIndex = headingTexts.findIndex((t) => /Conectando/.test(t));
    const howItWorksIndex = headingTexts.findIndex((t) => /Simples, rápido e gratuito/.test(t));
    const personasIndex = headingTexts.findIndex((t) => /Uma plataforma, duas perspectivas/.test(t));
    const servicesIndex = headingTexts.findIndex((t) => /Precisa de um profissional\?/.test(t));
    const ctaIndex = headingTexts.findIndex((t) => /Faça parte dessa iniciativa social/.test(t));

    expect(heroIndex).toBeGreaterThanOrEqual(0);
    expect(howItWorksIndex).toBeGreaterThan(heroIndex);
    expect(personasIndex).toBeGreaterThan(howItWorksIndex);
    expect(servicesIndex).toBeGreaterThan(personasIndex);
    expect(ctaIndex).toBeGreaterThan(servicesIndex);
  });

  it('não declara um segundo <main> (vem do layout, HOME-MN-04)', async () => {
    const ui = await HomePage();
    render(ui);
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('renderiza exatamente um <h1> (HOME-MN-04)', async () => {
    const ui = await HomePage();
    render(ui);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('HomePage — E-001 (indicadores anônimos, embutidos no hero)', () => {
  it('renderiza os 3 rótulos de indicador com os valores agregados, sem sessão', async () => {
    const ui = await HomePage();
    render(ui);

    expect(screen.getByTestId('home-indicators')).toBeInTheDocument();
    expect(screen.getByText('Vagas ativas')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('Candidatos')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Empresas verificadas')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('cold start (< limiar): mostra "Em breve" nos 3 indicadores, não 0 (REL41-MN-02)', async () => {
    guardState.getHomeIndicators.mockResolvedValue({
      activeJobs: 0,
      activeCandidates: 1,
      verifiedCompanies: 2,
    });

    const ui = await HomePage();
    render(ui);

    expect(screen.getAllByText('Em breve')).toHaveLength(3);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('HomePage — fallback (ADR-0026, edge case do spec)', () => {
  it('query de indicadores falha: a página carrega sem quebrar, indicadores caem para "Em breve"', async () => {
    guardState.getHomeIndicators.mockRejectedValue(new Error('db indisponível'));

    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByRole('heading', { level: 1, name: /Conectando talentos a oportunidades/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Em breve')).toHaveLength(3);
  });
});

/**
 * USP-048 (T3, NAV-02/NAV-MN-01). Destaque de vagas com dados reais
 * anonimizados no `page.tsx` (composition root). `nomeFantasia` no mock
 * abaixo é um campo extra só para discriminação do teste — o `JobListItem`
 * real nunca o carrega para o anônimo (`jobListSelect(false)`); serve para
 * matar um mutante que trocasse `displayName` por `nomeFantasia`.
 */
const jobItem = {
  id: 'job-123',
  title: 'Vaga Real Teste',
  area: 'Administrativa',
  region: 'Canasvieiras',
  educationLevel: null,
  contractType: 'CLT',
  workRegime: null,
  salary: null,
  publishedAt: new Date('2026-01-01'),
  company: {
    displayName: 'Empresa do setor de Comércio',
    isAnonymized: true,
    nomeFantasia: 'Comércio Real LTDA (NUNCA deve aparecer)',
  },
};

describe('HomePage — destaque de vagas com dados reais (USP-048 NAV-02/NAV-MN-01)', () => {
  it('renderiza o card com título/empresa (displayName anonimizado) e link ao detalhe real /vagas/{id}', async () => {
    guardState.searchJobs.mockResolvedValue({ items: [jobItem], page: 1, pageSize: 20, total: 1 });

    const ui = await HomePage();
    render(ui);

    expect(screen.getByText('Vaga Real Teste')).toBeInTheDocument();
    expect(screen.getByText('Empresa do setor de Comércio')).toBeInTheDocument();
    expect(screen.queryByText(/Comércio Real LTDA/)).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Vaga Real Teste/i });
    expect(link).toHaveAttribute('href', '/vagas/job-123');
  });

  it('chama searchJobs com { page: 1 } e viewer=null (anônimo) — NAV-MN-01 killable', async () => {
    guardState.searchJobs.mockResolvedValue({ items: [jobItem], page: 1, pageSize: 20, total: 1 });

    const ui = await HomePage();
    render(ui);

    expect(guardState.searchJobs).toHaveBeenCalledWith({ page: 1 }, null);
  });

  it('searchJobs rejeita: cai para o mock estático, home intacta (ADR-0026)', async () => {
    guardState.searchJobs.mockRejectedValue(new Error('db indisponível'));

    const ui = await HomePage();
    render(ui);

    expect(screen.getByText('Auxiliar Administrativo')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /Conectando talentos a oportunidades/i }),
    ).toBeInTheDocument();
  });

  it('searchJobs retorna vazio: cai para o mock estático (nunca lista vazia/quebrada)', async () => {
    guardState.searchJobs.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    const ui = await HomePage();
    render(ui);

    expect(screen.getByText('Auxiliar Administrativo')).toBeInTheDocument();
  });
});
