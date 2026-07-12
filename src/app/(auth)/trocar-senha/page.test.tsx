import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes da página `/trocar-senha` (AUTH-7 / RF-06 / RF-MN-05): a descrição só
 * afirma "primeiro acesso" quando a credencial de fato está em 1º acesso;
 * fora disso (ou sem sessão) usa a copy neutra — sem confinar o acesso
 * (ADR-0030). `getCurrentPerson` é mockado; `ChangePasswordForm` é stubado
 * para isolar a lógica de texto da página (mesmo padrão de
 * `redefinir-senha/page.test.tsx`).
 */

const identityState = vi.hoisted(() => ({ getCurrentPerson: vi.fn() }));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: (...a: unknown[]) => identityState.getCurrentPerson(...a),
  ChangePasswordForm: () => <div data-testid="change-password-form" />,
}));

const { default: TrocarSenhaPage } = await import('./page');

describe('TrocarSenhaPage (/trocar-senha)', () => {
  it('RF-06: primeiroAcesso=true → descrição contém "Este é seu primeiro acesso"', async () => {
    identityState.getCurrentPerson.mockResolvedValue({ primeiroAcesso: true });
    const ui = await TrocarSenhaPage();
    render(ui);

    expect(screen.getByText(/este é seu primeiro acesso/i)).toBeInTheDocument();
  });

  it('RF-MN-05: primeiroAcesso=false → NÃO afirma "primeiro acesso" (copy neutra)', async () => {
    identityState.getCurrentPerson.mockResolvedValue({ primeiroAcesso: false });
    const ui = await TrocarSenhaPage();
    render(ui);

    expect(screen.queryByText(/primeiro acesso/i)).not.toBeInTheDocument();
    expect(screen.getByText('Por segurança, escolha uma nova senha para continuar.')).toBeInTheDocument();
  });

  it('RF-MN-05: sem sessão (getCurrentPerson retorna null) → copy neutra, sem confinar', async () => {
    identityState.getCurrentPerson.mockResolvedValue(null);
    const ui = await TrocarSenhaPage();
    render(ui);

    expect(screen.queryByText(/primeiro acesso/i)).not.toBeInTheDocument();
    // A página segue renderizando o formulário — não redireciona/confina (ADR-0030).
    expect(screen.getByTestId('change-password-form')).toBeInTheDocument();
  });

  it('título "Defina sua nova senha" permanece em qualquer ramo', async () => {
    identityState.getCurrentPerson.mockResolvedValue({ primeiroAcesso: true });
    const ui = await TrocarSenhaPage();
    render(ui);

    expect(screen.getByText('Defina sua nova senha')).toBeInTheDocument();
  });
});
