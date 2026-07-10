import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Teste de componente da home pública `/` (USP-041 / T5 — E-001/E-002/
 * REL41-MN-01). Server Component: `getHomeIndicators` é mockada — o que se
 * testa é a composição (3 rótulos de indicador presentes, fallback em erro),
 * não a agregação Prisma (coberta em `home-indicators.int.test.ts`).
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

describe('HomePage — E-001 (indicadores anônimos)', () => {
  it('renderiza os 3 rótulos de indicador com os valores agregados, sem sessão', async () => {
    const ui = await HomePage();
    render(ui);

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

    expect(screen.getByRole('heading', { name: /Portal de Empregabilidade e Serviços/i })).toBeInTheDocument();
    expect(screen.getAllByText('Em breve')).toHaveLength(3);
  });
});
