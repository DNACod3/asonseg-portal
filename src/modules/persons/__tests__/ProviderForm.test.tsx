import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * UI do cadastro de prestador (USP-010 / #116). Cobre os facts: copy P-004
 * ("agora você OFERECE serviços"), submit bloqueado sem aceite de consentimento
 * (P-003), ausência de campo de CNPJ + CTA de MEI que navega ao fluxo USP-012
 * (E-002/ADR-0031), placeholder de foto desabilitado (GAP-B) e o caminho feliz.
 * Actions e router mockados.
 */

const routerState = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const actions = vi.hoisted(() => ({
  activateAdditionalRole: vi.fn(),
  activateProviderRole: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerState.push, refresh: routerState.refresh }),
}));
vi.mock('@/modules/identity/actions/activate-additional-role', () => ({
  activateAdditionalRole: (...a: unknown[]) => actions.activateAdditionalRole(...a),
}));
vi.mock('../actions/activate-provider-role', () => ({
  activateProviderRole: (...a: unknown[]) => actions.activateProviderRole(...a),
}));

const { ProviderForm } = await import('../components/provider-form');

const baseProps = {
  regions: [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Florianópolis' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'São José' },
  ],
  term: { version: 'v1.0', contentHash: 'hash', body: 'TERMO: oferta de serviços — texto.' },
  alreadyProvider: false,
  missingFields: [] as const,
  initialStatus: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  actions.activateAdditionalRole.mockResolvedValue({ ok: true, data: { role: 'PROVIDER' } });
  actions.activateProviderRole.mockResolvedValue({
    ok: true,
    data: { personId: 'p1', publicationStatus: 'DRAFT' },
  });
});

describe('USP-010 #116 — ProviderForm', () => {
  it('P-004: exibe copy "agora você OFERECE serviços" distinguindo de contratar/cliente', () => {
    render(<ProviderForm {...baseProps} />);
    expect(screen.getByText(/agora você OFERECE serviços/i)).toBeInTheDocument();
    expect(screen.getByText(/contrata/i)).toBeInTheDocument();
  });

  it('P-003: desabilita o envio até o aceite do termo', () => {
    render(<ProviderForm {...baseProps} />);
    expect(screen.getByText(/TERMO: oferta de serviços/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ativar papel de prestador/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /ativar papel de prestador/i })).toBeEnabled();
  });

  it('AUTH6-4: renderiza o corpo do termo via TermMarkdown — sem sintaxe Markdown crua', () => {
    render(
      <ProviderForm
        {...baseProps}
        term={{ ...baseProps.term, body: '**Finalidade** do termo de oferta.' }}
      />,
    );
    expect(screen.getByText('Finalidade').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*Finalidade\*\*/)).not.toBeInTheDocument();
  });

  it('E-002/ADR-0031: NÃO possui campo de CNPJ e a CTA de MEI navega ao fluxo USP-012 (/empresa)', () => {
    render(<ProviderForm {...baseProps} />);
    expect(screen.queryByLabelText(/cnpj/i)).not.toBeInTheDocument();
    const meiCta = screen.getByRole('link', { name: /registrar meu MEI/i });
    expect(meiCta).toHaveAttribute('href', '/empresa');
  });

  it('GAP-B: placeholder de upload de foto está presente e desabilitado (diferido Fase 4)', () => {
    render(<ProviderForm {...baseProps} />);
    expect(screen.getByLabelText(/foto do perfil/i)).toBeDisabled();
  });

  it('caminho feliz: ativa papel + cria perfil e revela CTA "publicar primeiro serviço" (E-003)', async () => {
    render(<ProviderForm {...baseProps} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /ativar papel de prestador/i }));

    await waitFor(() => expect(actions.activateProviderRole).toHaveBeenCalled());
    expect(actions.activateAdditionalRole).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /publicar primeiro serviço/i })).toHaveAttribute(
        'href',
        '/prestador/servicos/nova',
      );
    });
  });

  it('exige campos de perfil faltantes (telefone) antes de ativar', async () => {
    render(<ProviderForm {...baseProps} missingFields={['phone']} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /ativar papel de prestador/i }));
    await waitFor(() => {
      expect(screen.getByText(/campo obrigatório para ativar este papel/i)).toBeInTheDocument();
    });
    expect(actions.activateProviderRole).not.toHaveBeenCalled();
  });

  it('prestador já ativo (alreadyProvider): não exige aceite de termo de novo', () => {
    render(<ProviderForm {...baseProps} alreadyProvider initialStatus="DRAFT" />);
    expect(screen.queryByText(/TERMO: oferta de serviços/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ativar papel de prestador/i })).toBeEnabled();
  });
});
