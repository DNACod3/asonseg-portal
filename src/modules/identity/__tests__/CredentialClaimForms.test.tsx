import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Testes de UI da reivindicação de credencial (USP-003 / #61). Cobre o formulário
 * público de solicitação e a fila interna de verificação. As Server Actions são
 * mockadas; os schemas Zod são os reais.
 */

const actionState = vi.hoisted(() => ({
  requestCredentialClaim: vi.fn(),
  verifyCredentialClaim: vi.fn(),
}));

vi.mock('../actions/request-credential-claim', () => ({
  requestCredentialClaim: (...a: unknown[]) => actionState.requestCredentialClaim(...a),
}));
vi.mock('../actions/verify-credential-claim', () => ({
  verifyCredentialClaim: (...a: unknown[]) => actionState.verifyCredentialClaim(...a),
}));

// Mock do widget Turnstile (ADR-0014): um botão que entrega o token via onSuccess
// ao clicar — sem rede nem o SDK do Cloudflare.
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => onSuccess('captcha-tok')}>
      resolver-captcha
    </button>
  ),
}));

const { CredentialClaimForm } = await import('../components/credential-claim-form');
const { CredentialClaimReview } = await import('../components/credential-claim-review');

const VALID_CPF = '529.982.247-25';
const SITE_KEY = '1x00000000000000000000AA';

/** Simula a resolução do CAPTCHA clicando no widget mockado. */
function resolveCaptcha() {
  fireEvent.click(screen.getByRole('button', { name: 'resolver-captcha' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CredentialClaimForm (solicitação pública)', () => {
  it('renderiza CPF, identificador alternativo, e-mail e meio de verificação', () => {
    render(<CredentialClaimForm siteKey={SITE_KEY} />);
    expect(screen.getByLabelText(/^CPF/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Identificador alternativo/)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-mail desejado/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Meio de verificação preferido/)).toBeInTheDocument();
  });

  it('submissão válida + CAPTCHA → chama a action com CPF normalizado e mostra a resposta genérica', async () => {
    actionState.requestCredentialClaim.mockResolvedValue({
      ok: true,
      data: { message: 'Recebemos sua solicitação.' },
    });
    render(<CredentialClaimForm siteKey={SITE_KEY} />);
    fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: VALID_CPF } });
    fireEvent.change(screen.getByLabelText(/E-mail desejado/), {
      target: { value: 'maria@example.com' },
    });
    resolveCaptcha();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar reivindicação' }));

    await waitFor(() => expect(actionState.requestCredentialClaim).toHaveBeenCalledTimes(1));
    expect(actionState.requestCredentialClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        cpf: '52998224725',
        requestedEmail: 'maria@example.com',
        captchaToken: 'captcha-tok',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Recebemos sua solicitação.');
  });

  it('sem CAPTCHA resolvido → não chama a action', async () => {
    render(<CredentialClaimForm siteKey={SITE_KEY} />);
    fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: VALID_CPF } });
    fireEvent.change(screen.getByLabelText(/E-mail desejado/), {
      target: { value: 'maria@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar reivindicação' }));

    expect(await screen.findByText(/CAPTCHA/)).toBeInTheDocument();
    expect(actionState.requestCredentialClaim).not.toHaveBeenCalled();
  });

  it('sem CPF nem identificador → erro de validação, não chama a action', async () => {
    render(<CredentialClaimForm siteKey={SITE_KEY} />);
    fireEvent.change(screen.getByLabelText(/E-mail desejado/), {
      target: { value: 'x@example.com' },
    });
    resolveCaptcha();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar reivindicação' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(actionState.requestCredentialClaim).not.toHaveBeenCalled();
  });

  it('action falha (e-mail em uso) → exibe a mensagem de erro', async () => {
    actionState.requestCredentialClaim.mockResolvedValue({
      ok: false,
      error: { code: 'CONFLICT', message: 'Este e-mail já está em uso. Faça login ou informe outro e-mail.' },
    });
    render(<CredentialClaimForm siteKey={SITE_KEY} />);
    fireEvent.change(screen.getByLabelText(/^CPF/), { target: { value: VALID_CPF } });
    fireEvent.change(screen.getByLabelText(/E-mail desejado/), {
      target: { value: 'maria@example.com' },
    });
    resolveCaptcha();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar reivindicação' }));

    expect(await screen.findByText(/já está em uso/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('CredentialClaimReview (fila de verificação)', () => {
  const CLAIM_ID = '11111111-1111-1111-1111-111111111111';
  const items = [
    {
      id: CLAIM_ID,
      personId: 'p-1',
      fullName: 'Maria Pré-cadastrada',
      requestedEmail: 'maria@example.com',
      verificationMethod: 'AS_CONFIRMATION' as const,
      requestedAtLabel: '01/06/2026 às 10:00',
    },
  ];

  it('lista a solicitação pendente com nome e e-mail', () => {
    render(<CredentialClaimReview items={items} />);
    expect(screen.getByText('Maria Pré-cadastrada')).toBeInTheDocument();
    expect(screen.getByText(/maria@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar e ativar' })).toBeInTheDocument();
  });

  it('confirmar → chama a action com o meio selecionado e remove o item da fila', async () => {
    actionState.verifyCredentialClaim.mockResolvedValue({
      ok: true,
      data: { personId: 'p-1', claimId: CLAIM_ID },
    });
    render(<CredentialClaimReview items={items} />);

    fireEvent.change(screen.getByLabelText(/Meio de verificação utilizado/), {
      target: { value: 'IN_PERSON' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e ativar' }));

    await waitFor(() => expect(actionState.verifyCredentialClaim).toHaveBeenCalledTimes(1));
    expect(actionState.verifyCredentialClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      verificationMethod: 'IN_PERSON',
    });
    expect(await screen.findByText(/processada/)).toBeInTheDocument();
  });

  it('action falha → mantém o item e exibe o erro', async () => {
    actionState.verifyCredentialClaim.mockResolvedValue({
      ok: false,
      error: { code: 'PRECONDITION_FAILED', message: 'Esta solicitação já foi processada.' },
    });
    render(<CredentialClaimReview items={items} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e ativar' }));

    expect(await screen.findByText('Esta solicitação já foi processada.')).toBeInTheDocument();
    expect(screen.getByText('Maria Pré-cadastrada')).toBeInTheDocument();
  });

  it('fila vazia → estado vazio', () => {
    render(<CredentialClaimReview items={[]} />);
    expect(screen.getByText(/Não há reivindicações de credencial pendentes/)).toBeInTheDocument();
  });
});
