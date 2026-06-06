import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota da fila de verificação de reivindicações (USP-003 /
 * L-004): quem não é aprovador recebe 404 (a rota não revela sua existência) e a
 * lista nem chega a ser consultada; o aprovador vê a fila. `requireActivePerson`
 * e a query são mockados; `canApproveCredentialClaim` é a regra real (P-005).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  listPendingCredentialClaims: vi.fn(),
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

vi.mock('@/shared/lib/time', () => ({
  formatSaoPaulo: () => '01/06/2026 às 10:00',
}));

// Mantém a regra de autorização REAL (domínio puro, sem IO); só o IO é mockado.
vi.mock('@/modules/identity', async () => {
  const domain = await vi.importActual<typeof import('@/modules/identity/domain/credential-claim')>(
    '@/modules/identity/domain/credential-claim',
  );
  return {
    canApproveCredentialClaim: domain.canApproveCredentialClaim,
    requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
    listPendingCredentialClaims: (...a: unknown[]) => guardState.listPendingCredentialClaims(...a),
    CredentialClaimReview: ({ items }: { items: { id: string }[] }) => (
      <div data-testid="review">{items.length} pendente(s)</div>
    ),
  };
});

const { default: ReivindicacoesPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('ReivindicacoesPage — gate de rota (L-004)', () => {
  it('não-aprovador → 404, e a fila NÃO é consultada', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-1',
      fullName: 'Voluntário',
      roles: ['VOLUNTEER'],
    });

    await expect(ReivindicacoesPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.listPendingCredentialClaims).not.toHaveBeenCalled();
  });

  it('aprovador (assistente social) → renderiza a fila com os pendentes', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'op-1',
      fullName: 'Assistente Social',
      roles: ['SOCIAL_ASSISTANT'],
    });
    guardState.listPendingCredentialClaims.mockResolvedValue([
      {
        id: 'c-1',
        personId: 'p-2',
        fullName: 'Maria Pré-cadastrada',
        requestedEmail: 'maria@example.com',
        verificationMethod: 'AS_CONFIRMATION',
        requestedAt: new Date('2026-06-01T13:00:00Z'),
      },
    ]);

    const ui = await ReivindicacoesPage();
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(guardState.listPendingCredentialClaims).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Reivindicações de credencial' })).toBeInTheDocument();
    expect(screen.getByTestId('review')).toHaveTextContent('1 pendente(s)');
  });
});
