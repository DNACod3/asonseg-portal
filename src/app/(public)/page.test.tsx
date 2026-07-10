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
}));

vi.mock('@/modules/reporting', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/reporting')>();
  return {
    ...actual,
    getHomeIndicators: (...a: unknown[]) => guardState.getHomeIndicators(...a),
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
