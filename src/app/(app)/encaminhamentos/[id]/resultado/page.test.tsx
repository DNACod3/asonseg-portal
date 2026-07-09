import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate de rota da página de registro de resultado (USP-038 / T3, REF38-MN-02
 * na rota). Mesmo padrão de `encaminhamentos/novo/page.test.tsx`: só quem tem
 * `canRegisterReferralResult` acessa; `Referral` inexistente também é 404
 * (não vaza existência). `requireActivePerson`, `canRegisterReferralResult`,
 * `prisma.referral.findUnique`, `viewPersonForStaff` e `ResultForm` são mockados.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canRegisterReferralResult: vi.fn(),
  findUnique: vi.fn(),
  viewPersonForStaff: vi.fn(),
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
  canRegisterReferralResult: (...a: unknown[]) => guardState.canRegisterReferralResult(...a),
  ResultForm: ({ referralId }: { referralId: string }) => (
    <div data-testid="result-form">form:{referralId}</div>
  ),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { referral: { findUnique: (...a: unknown[]) => guardState.findUnique(...a) } },
}));

vi.mock('@/modules/persons', () => ({
  viewPersonForStaff: (...a: unknown[]) => guardState.viewPersonForStaff(...a),
}));

const { default: RegistrarResultadoPage } = await import('./page');

const REFERRAL_ID = '11111111-1111-4111-8111-111111111111';

function makeParams() {
  return { params: Promise.resolve({ id: REFERRAL_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('RegistrarResultadoPage — gate de rota (REF38-MN-02)', () => {
  it('viewer sem permissão → 404, sem consultar o Referral', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho', roles: ['VOLUNTEER'] });
    guardState.canRegisterReferralResult.mockResolvedValue(false);

    await expect(RegistrarResultadoPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.findUnique).not.toHaveBeenCalled();
  });

  it('AS (SOCIAL_ASSISTANT) → renderiza o form com o referralId', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['SOCIAL_ASSISTANT'] });
    guardState.canRegisterReferralResult.mockResolvedValue(true);
    guardState.findUnique.mockResolvedValue({
      result: null,
      resultObservation: null,
      personId: 'p-encaminhada',
      job: { title: 'Vaga X' },
    });
    guardState.viewPersonForStaff.mockResolvedValue({
      id: 'p-encaminhada',
      fullName: 'Pessoa Encaminhada',
      status: 'ATIVO',
      roles: ['CANDIDATE'],
      inactivatedAt: null,
      inactivationReason: null,
    });

    const ui = await RegistrarResultadoPage(makeParams());
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(guardState.viewPersonForStaff).toHaveBeenCalledWith('p-encaminhada');
    expect(screen.getByTestId('result-form')).toHaveTextContent(`form:${REFERRAL_ID}`);
    expect(screen.getByText(/Pessoa Encaminhada/)).toBeInTheDocument();
  });

  it('Referral inexistente → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coordenador', roles: ['COORDINATOR'] });
    guardState.canRegisterReferralResult.mockResolvedValue(true);
    guardState.findUnique.mockResolvedValue(null);

    await expect(RegistrarResultadoPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.viewPersonForStaff).not.toHaveBeenCalled();
  });

  it('Pessoa encaminhada inexistente (viewPersonForStaff null) → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coordenador', roles: ['COORDINATOR'] });
    guardState.canRegisterReferralResult.mockResolvedValue(true);
    guardState.findUnique.mockResolvedValue({
      result: null,
      resultObservation: null,
      personId: 'p-inexistente',
      job: { title: 'Vaga X' },
    });
    guardState.viewPersonForStaff.mockResolvedValue(null);

    await expect(RegistrarResultadoPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });
});
