import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate de rota da página da ficha socioeconômica (USP-036 / T8). Mesmo padrão
 * de `pessoas/[id]/page.tsx` (USP-007): só quem tem
 * `canManageSocioeconomicRecord` (SOCIAL_ASSISTANT/BOARD) acessa — SOC-036-MN-01
 * na rota. `requireActivePerson`, `canManageSocioeconomicRecord`,
 * `viewPersonForStaff`, `getSocioeconomicRecord` e o form são mockados.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canManageSocioeconomicRecord: vi.fn(),
  viewPersonForStaff: vi.fn(),
  getSocioeconomicRecord: vi.fn(),
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

vi.mock('@/modules/persons', () => ({
  canManageSocioeconomicRecord: (...a: unknown[]) => guardState.canManageSocioeconomicRecord(...a),
  viewPersonForStaff: (...a: unknown[]) => guardState.viewPersonForStaff(...a),
  getSocioeconomicRecord: (...a: unknown[]) => guardState.getSocioeconomicRecord(...a),
  SocioeconomicRecordForm: ({ personId }: { personId: string }) => (
    <div data-testid="socioeconomic-record-form">form:{personId}</div>
  ),
}));

const { default: FichaSocialPage } = await import('./page');

const PERSON_ID = '11111111-1111-4111-8111-111111111111';

function makeParams() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('FichaSocialPage — gate de rota (SOC-036-MN-01)', () => {
  it('viewer sem papel autorizado → 404, sem renderizar campos da ficha', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho', roles: ['COORDINATOR'] });
    guardState.canManageSocioeconomicRecord.mockReturnValue(false);

    await expect(FichaSocialPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.viewPersonForStaff).not.toHaveBeenCalled();
    expect(guardState.getSocioeconomicRecord).not.toHaveBeenCalled();
  });

  it('AS (SOCIAL_ASSISTANT) → renderiza o form com os dados da ficha', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['SOCIAL_ASSISTANT'] });
    guardState.canManageSocioeconomicRecord.mockReturnValue(true);
    guardState.viewPersonForStaff.mockResolvedValue({ id: PERSON_ID, fullName: 'Pessoa Alvo' });
    guardState.getSocioeconomicRecord.mockResolvedValue({
      ok: true,
      data: {
        personId: PERSON_ID,
        incomeBracket: 'UP_TO_1_MW',
        socialBenefit: null,
        housingSituation: null,
        familyComposition: null,
      },
    });

    const ui = await FichaSocialPage(makeParams());
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByText(/Pessoa Alvo/)).toBeInTheDocument();
    expect(screen.getByTestId('socioeconomic-record-form')).toHaveTextContent(`form:${PERSON_ID}`);
  });

  it('Pessoa inexistente → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['BOARD'] });
    guardState.canManageSocioeconomicRecord.mockReturnValue(true);
    guardState.viewPersonForStaff.mockResolvedValue(null);

    await expect(FichaSocialPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.getSocioeconomicRecord).not.toHaveBeenCalled();
  });

  it('getSocioeconomicRecord FORBIDDEN (defesa em profundidade) → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['BOARD'] });
    guardState.canManageSocioeconomicRecord.mockReturnValue(true);
    guardState.viewPersonForStaff.mockResolvedValue({ id: PERSON_ID, fullName: 'Pessoa Alvo' });
    guardState.getSocioeconomicRecord.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'negado' },
    });

    await expect(FichaSocialPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });
});
