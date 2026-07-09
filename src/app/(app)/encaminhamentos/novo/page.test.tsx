import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate de rota da página de encaminhamento (USP-037 / T8, REF-MN-04 na rota).
 * Mesmo padrão de `moderacao/publicados/page.test.tsx`: só quem tem
 * `canReferPersonToJob` acessa — quem não tem recebe 404. `requireActivePerson`,
 * `canReferPersonToJob` e `ReferralForm` são mockados.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canReferPersonToJob: vi.fn(),
  notFoundCalled: false,
}));

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

vi.mock('@/modules/referrals', () => ({
  canReferPersonToJob: (...a: unknown[]) => guardState.canReferPersonToJob(...a),
  ReferralForm: ({ initialPersonId, initialJobId }: { initialPersonId?: string; initialJobId?: string }) => (
    <div data-testid="referral-form">
      form:{initialPersonId ?? 'none'}:{initialJobId ?? 'none'}
    </div>
  ),
}));

const { default: NovoEncaminhamentoPage } = await import('./page');

function makeSearchParams(params: { personId?: string; jobId?: string } = {}) {
  return { searchParams: Promise.resolve(params) };
}

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('NovoEncaminhamentoPage — gate de rota (REF-MN-04)', () => {
  it('viewer sem permissão → 404, sem renderizar o form', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho', roles: ['VOLUNTEER'] });
    guardState.canReferPersonToJob.mockResolvedValue(false);

    await expect(NovoEncaminhamentoPage(makeSearchParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });

  it('AS (SOCIAL_ASSISTANT) → renderiza o form', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['SOCIAL_ASSISTANT'] });
    guardState.canReferPersonToJob.mockResolvedValue(true);

    const ui = await NovoEncaminhamentoPage(makeSearchParams());
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('referral-form')).toHaveTextContent('form:none:none');
  });

  it('com permissão + querystring → pré-preenche personId/jobId no form', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coordenador', roles: ['COORDINATOR'] });
    guardState.canReferPersonToJob.mockResolvedValue(true);

    const ui = await NovoEncaminhamentoPage(
      makeSearchParams({ personId: 'pessoa-1', jobId: 'vaga-1' }),
    );
    render(ui);

    expect(screen.getByTestId('referral-form')).toHaveTextContent('form:pessoa-1:vaga-1');
  });
});
