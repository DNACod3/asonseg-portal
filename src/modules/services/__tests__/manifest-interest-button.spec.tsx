// Estados de render do CTA "Entrar em contato" (USP-033 / AC-033-1/4). RTL +
// jsdom. A action `manifestInterest` é mockada — a lógica de negócio já é
// coberta em manifest-interest.int.test.ts; o que se testa aqui é o
// encadeamento de UI (submit → sucesso dispara router.refresh(); CONSENT_REQUIRED
// exibe o termo + checkbox; outro erro exibe error.message).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const actions = vi.hoisted(() => ({ manifestInterest: vi.fn() }));
vi.mock('../actions/manifest-interest', () => ({
  manifestInterest: (...a: unknown[]) => actions.manifestInterest(...a),
}));

const { ManifestInterestButton } = await import('../components/manifest-interest-button');

const TERM = { humanName: 'Contratação de serviços', body: 'Corpo do termo de teste.' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ManifestInterestButton (USP-033 / AC-033-1/4)', () => {
  it('estado inicial: botão "Entrar em contato" habilitado, sem termo', () => {
    render(<ManifestInterestButton serviceId="svc-1" consentTerm={TERM} />);
    expect(screen.getByRole('button', { name: /entrar em contato/i })).toBeEnabled();
    expect(screen.queryByText(TERM.body)).not.toBeInTheDocument();
  });

  it('sucesso: chama manifestInterest({ serviceId }) e dispara router.refresh()', async () => {
    actions.manifestInterest.mockResolvedValue({
      ok: true,
      data: { interestId: 'int-1', providerContact: { displayName: 'X', phone: null, email: null } },
    });
    render(<ManifestInterestButton serviceId="svc-1" consentTerm={TERM} />);

    fireEvent.click(screen.getByRole('button', { name: /entrar em contato/i }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(actions.manifestInterest).toHaveBeenCalledWith({ serviceId: 'svc-1', consentAccepted: undefined });
  });

  it('@ac-033-4 CONSENT_REQUIRED: exibe o termo + checkbox; aceite reenvia consentAccepted:true', async () => {
    actions.manifestInterest.mockResolvedValueOnce({
      ok: false,
      error: { code: 'CONSENT_REQUIRED', message: 'Consentimento necessário.' },
    });
    render(<ManifestInterestButton serviceId="svc-1" consentTerm={TERM} />);

    fireEvent.click(screen.getByRole('button', { name: /entrar em contato/i }));
    await waitFor(() => expect(screen.getByText(TERM.body)).toBeInTheDocument());

    const acceptButton = screen.getByRole('button', { name: /aceitar e entrar em contato/i });
    expect(acceptButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(acceptButton).toBeEnabled();

    actions.manifestInterest.mockResolvedValueOnce({
      ok: true,
      data: { interestId: 'int-1', providerContact: { displayName: 'X', phone: null, email: null } },
    });
    fireEvent.click(acceptButton);

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(actions.manifestInterest).toHaveBeenLastCalledWith({ serviceId: 'svc-1', consentAccepted: true });
  });

  it('erro genérico: exibe error.message e não navega', async () => {
    actions.manifestInterest.mockResolvedValue({
      ok: false,
      error: { code: 'PRECONDITION_FAILED', message: 'Este serviço não está mais disponível.' },
    });
    render(<ManifestInterestButton serviceId="svc-1" consentTerm={TERM} />);

    fireEvent.click(screen.getByRole('button', { name: /entrar em contato/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Este serviço não está mais disponível.'),
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
