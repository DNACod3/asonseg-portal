import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Gate de rota da página do painel consolidado (USP-039 / T8). Mesmo padrão de
 * `pessoas/[id]/ficha-social/page.test.tsx` (USP-036): `requireActivePerson`,
 * `canViewConsolidatedPerson`, os 5 reads por-dimensão,
 * `viewPersonForSocialAssistant` e `ConsolidatedPersonPanel` são mockados.
 *
 * Cobre SOC-039-MN-02 (voluntário → 404, nenhum read/assembler chamado) e
 * SOC-039-MN-01 (coordenador → painel sem seção de ficha — o stub do painel
 * revela se `view.ficha` chegou nulo/populado, sem duplicar a cobertura do
 * componente real, já testada em `ConsolidatedPersonPanel.test.tsx`).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canViewConsolidatedPerson: vi.fn(),
  viewPersonForSocialAssistant: vi.fn(),
  listPersonApplications: vi.fn(),
  listPersonReferrals: vi.fn(),
  listProviderServices: vi.fn(),
  listPersonServiceInterests: vi.fn(),
  listPersonCompanyGrants: vi.fn(),
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

vi.mock('@/modules/jobs', () => ({
  listPersonApplications: (...a: unknown[]) => guardState.listPersonApplications(...a),
}));

vi.mock('@/modules/referrals', () => ({
  listPersonReferrals: (...a: unknown[]) => guardState.listPersonReferrals(...a),
}));

vi.mock('@/modules/services', () => ({
  listProviderServices: (...a: unknown[]) => guardState.listProviderServices(...a),
  listPersonServiceInterests: (...a: unknown[]) => guardState.listPersonServiceInterests(...a),
}));

vi.mock('@/modules/companies', () => ({
  listPersonCompanyGrants: (...a: unknown[]) => guardState.listPersonCompanyGrants(...a),
}));

vi.mock('@/modules/persons', () => ({
  canViewConsolidatedPerson: (...a: unknown[]) => guardState.canViewConsolidatedPerson(...a),
  viewPersonForSocialAssistant: (...a: unknown[]) => guardState.viewPersonForSocialAssistant(...a),
  ConsolidatedPersonPanel: ({ view }: { view: { ficha: unknown; person: { fullName: string } } }) => (
    <div data-testid="consolidated-panel">
      painel:{view.person.fullName}:{view.ficha != null ? 'ficha-presente' : 'ficha-ausente'}
    </div>
  ),
}));

const { default: VisaoConsolidadaPage } = await import('./page');

const PERSON_ID = '11111111-1111-4111-8111-111111111111';

function makeParams() {
  return { params: Promise.resolve({ id: PERSON_ID }) };
}

function stubDimensions() {
  guardState.listPersonApplications.mockResolvedValue([]);
  guardState.listPersonReferrals.mockResolvedValue([]);
  guardState.listProviderServices.mockResolvedValue([]);
  guardState.listPersonServiceInterests.mockResolvedValue([]);
  guardState.listPersonCompanyGrants.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('VisaoConsolidadaPage — gate de rota (SOC-039-MN-01/02)', () => {
  it('SOC-039-MN-02: viewer VOLUNTEER → 404, nenhum read/assembler é chamado', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-voluntario', roles: ['VOLUNTEER'] });
    guardState.canViewConsolidatedPerson.mockReturnValue(false);

    await expect(VisaoConsolidadaPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.listPersonApplications).not.toHaveBeenCalled();
    expect(guardState.listPersonReferrals).not.toHaveBeenCalled();
    expect(guardState.listProviderServices).not.toHaveBeenCalled();
    expect(guardState.listPersonServiceInterests).not.toHaveBeenCalled();
    expect(guardState.listPersonCompanyGrants).not.toHaveBeenCalled();
    expect(guardState.viewPersonForSocialAssistant).not.toHaveBeenCalled();
  });

  it('SOC-039-MN-01: viewer COORDINATOR → painel renderiza sem a seção da ficha', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-coord', roles: ['COORDINATOR'] });
    guardState.canViewConsolidatedPerson.mockReturnValue(true);
    stubDimensions();
    guardState.viewPersonForSocialAssistant.mockResolvedValue({
      person: { id: PERSON_ID, fullName: 'Pessoa Alvo', status: 'ATIVO', roles: [], inactivatedAt: null, inactivationReason: null },
      ficha: null,
      applications: [],
      referrals: [],
      servicesOffered: [],
      serviceInterests: [],
      companyGrants: [],
    });

    const ui = await VisaoConsolidadaPage(makeParams());
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('consolidated-panel')).toHaveTextContent('painel:Pessoa Alvo:ficha-ausente');
  });

  it('happy AS: viewer SOCIAL_ASSISTANT → painel completo com ficha', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['SOCIAL_ASSISTANT'] });
    guardState.canViewConsolidatedPerson.mockReturnValue(true);
    stubDimensions();
    guardState.viewPersonForSocialAssistant.mockResolvedValue({
      person: { id: PERSON_ID, fullName: 'Pessoa Alvo', status: 'ATIVO', roles: ['CANDIDATE'], inactivatedAt: null, inactivationReason: null },
      ficha: {
        personId: PERSON_ID,
        incomeBracket: 'UP_TO_1_MW',
        socialBenefit: null,
        housingSituation: null,
        familyComposition: null,
        updatedAt: null,
        updatedByPersonId: null,
      },
      applications: [],
      referrals: [],
      servicesOffered: [],
      serviceInterests: [],
      companyGrants: [],
    });

    const ui = await VisaoConsolidadaPage(makeParams());
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('consolidated-panel')).toHaveTextContent('painel:Pessoa Alvo:ficha-presente');
    expect(guardState.viewPersonForSocialAssistant).toHaveBeenCalledWith(
      PERSON_ID,
      { id: 'p-as', roles: ['SOCIAL_ASSISTANT'] },
      {
        applications: [],
        referrals: [],
        servicesOffered: [],
        serviceInterests: [],
        companyGrants: [],
      },
    );
  });

  it('Pessoa inexistente (assembler retorna null) → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-as', roles: ['SOCIAL_ASSISTANT'] });
    guardState.canViewConsolidatedPerson.mockReturnValue(true);
    stubDimensions();
    guardState.viewPersonForSocialAssistant.mockResolvedValue(null);

    await expect(VisaoConsolidadaPage(makeParams())).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });
});
