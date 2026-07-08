import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota da superfície de conteúdo publicado (USP-018 / INACT-06 /
 * INACT-MN-03): só Pessoa com delegação de `INACTIVATE_PUBLISHED_CONTENT` acessa;
 * quem não tem recebe 404 — a rota não revela sua existência. `requireActivePerson`,
 * `canManagePublishedContent` e `listActivePublishedJobs` são mockados; a listagem
 * NÃO pode ser chamada quando o gate barra (confinamento — nada vaza antes do 404).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canManagePublishedContent: vi.fn(),
  listActivePublishedJobs: vi.fn(),
  notFoundCalled: false,
}));

/** `notFound()` do Next lança para abortar o render; replicamos esse contrato. */
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

vi.mock('@/modules/moderation', () => ({
  canManagePublishedContent: (...a: unknown[]) => guardState.canManagePublishedContent(...a),
  PublishedContentManager: ({ items }: { items: Array<{ contentId: string }> }) => (
    <div data-testid="published-content-manager">{items.length} item(ns)</div>
  ),
}));

vi.mock('@/modules/jobs', () => ({
  listActivePublishedJobs: (...a: unknown[]) => guardState.listActivePublishedJobs(...a),
}));

vi.mock('@/shared/lib/time', () => ({
  formatSaoPaulo: () => '08/07/2026 às 10:00',
}));

const { default: ConteudoPublicadoPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('ConteudoPublicadoPage — gate de rota (INACT-MN-03)', () => {
  it('logado mas sem permissão → 404, e o conteúdo NÃO é carregado', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-sem-permissao' });
    guardState.canManagePublishedContent.mockResolvedValue(false);

    await expect(ConteudoPublicadoPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.listActivePublishedJobs).not.toHaveBeenCalled();
  });

  it('com permissão → renderiza a superfície com as vagas publicadas', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coordenador' });
    guardState.canManagePublishedContent.mockResolvedValue(true);
    guardState.listActivePublishedJobs.mockResolvedValue({
      items: [
        { id: 'job-1', title: 'Vaga A', companyName: 'Empresa A', areaName: 'TI', publishedAt: new Date() },
        { id: 'job-2', title: 'Vaga B', companyName: 'Empresa B', areaName: 'Vendas', publishedAt: null },
      ],
    });

    const ui = await ConteudoPublicadoPage();
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('published-content-manager')).toHaveTextContent('2 item(ns)');
  });
});
