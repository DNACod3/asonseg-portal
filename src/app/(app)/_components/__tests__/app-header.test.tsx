import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AppHeader } from '../app-header';

/**
 * USP-061 — APP-SHELL-01, -02, -03, -04, -05.
 * Round 2 (USP-065) — PROF-01, -03, -06, PROF-MN-05: a identidade + o
 * "Sair" migraram para dentro do `ProfileMenu` (dropdown); o trigger de
 * perfil é sempre visível (nunca um beco sem saída) e "Sair" fica
 * alcançável ao abrir o menu.
 *
 * `AppHeader` é o header persistente da casca `(app)`: marca→/inicio e o
 * `ProfileMenu` (nome + papel, tema, "Sair" via SignOutForm). Server
 * Component apresentacional — props já resolvidos pelo composition-root.
 */
describe('AppHeader — APP-SHELL-01/02/03/04/05', () => {
  it('APP-SHELL-01: renderiza um header (landmark banner)', () => {
    render(<AppHeader personName="Ana Candidata" roleLabel="Candidato(a)" />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('APP-SHELL-02: a marca linka para /inicio', () => {
    render(<AppHeader personName="Ana Candidata" roleLabel="Candidato(a)" />);
    const brandLink = screen.getByRole('link', { name: /ASONSEG/ });
    expect(brandLink).toHaveAttribute('href', '/inicio');
  });

  it('APP-SHELL-03: o trigger de perfil está sempre presente; ao abrir, exibe fullName e o rótulo de papel', () => {
    render(<AppHeader personName="Ana Candidata" roleLabel="Candidato(a) · Diretoria" />);
    const trigger = screen.getByRole('button', { name: /menu de perfil/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    const panel = screen.getByRole('menu');
    expect(within(panel).getByText('Ana Candidata')).toBeInTheDocument();
    expect(screen.getByTestId('app-header-role-label')).toHaveTextContent(
      'Candidato(a) · Diretoria',
    );
  });

  it('APP-SHELL-04: omite a linha de papel quando roleLabel é string vazia (sem placeholder)', () => {
    render(<AppHeader personName="Pessoa Sem Papel" roleLabel="" />);
    fireEvent.click(screen.getByRole('button', { name: /menu de perfil/i }));
    expect(within(screen.getByRole('menu')).getByText('Pessoa Sem Papel')).toBeInTheDocument();
    // Verifica a AUSÊNCIA do nó do rótulo diretamente (não um proxy de texto) —
    // mata o mutante que troca `{roleLabel && <span>…}` por `<span>{roleLabel}</span>`
    // incondicional (o span existiria vazio, mas nunca deveria existir no DOM).
    expect(screen.queryByTestId('app-header-role-label')).not.toBeInTheDocument();
  });

  it('APP-SHELL-05/PROF-MN-05: o trigger de perfil é sempre visível; ao abrir, "Sair" (SignOutForm) fica alcançável', () => {
    render(<AppHeader personName="Ana Candidata" roleLabel="Candidato(a)" />);
    expect(screen.getByRole('button', { name: /menu de perfil/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /abrir menu de perfil/i }));
    const sair = screen.getByRole('button', { name: 'Sair' });
    expect(sair).toBeInTheDocument();
    expect(sair.closest('form')).not.toBeNull();
  });
});
