import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../app-header';

/**
 * USP-061 — APP-SHELL-01, -02, -03, -04, -05.
 *
 * `AppHeader` é o header persistente da casca `(app)`: marca→/inicio,
 * identidade (nome + papel) e "Sair" (via SignOutForm). Server Component
 * apresentacional — props já resolvidos pelo composition-root.
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

  it('APP-SHELL-03: exibe fullName e o rótulo de papel quando roleLabel é não-vazio', () => {
    render(<AppHeader personName="Ana Candidata" roleLabel="Candidato(a) · Diretoria" />);
    expect(screen.getByText('Ana Candidata')).toBeInTheDocument();
    // Verifica diretamente o nó do rótulo (data-testid estável), não só o texto solto no DOM.
    expect(screen.getByTestId('app-header-role-label')).toHaveTextContent(
      'Candidato(a) · Diretoria',
    );
  });

  it('APP-SHELL-04: omite a linha de papel quando roleLabel é string vazia (sem placeholder)', () => {
    render(<AppHeader personName="Pessoa Sem Papel" roleLabel="" />);
    expect(screen.getByText('Pessoa Sem Papel')).toBeInTheDocument();
    // Verifica a AUSÊNCIA do nó do rótulo diretamente (não um proxy de texto) —
    // mata o mutante que troca `{roleLabel && <span>…}` por `<span>{roleLabel}</span>`
    // incondicional (o span existiria vazio, mas nunca deveria existir no DOM).
    expect(screen.queryByTestId('app-header-role-label')).not.toBeInTheDocument();
  });

  it('APP-SHELL-05: renderiza o controle "Sair" (SignOutForm)', () => {
    render(<AppHeader personName="Ana Candidata" roleLabel="Candidato(a)" />);
    const sair = screen.getByRole('button', { name: 'Sair' });
    expect(sair).toBeInTheDocument();
    expect(sair.closest('form')).not.toBeNull();
  });

  it('seam headerNav: quando `nav` é passado, é renderizado dentro do header', () => {
    render(
      <AppHeader
        personName="Ana Candidata"
        roleLabel="Candidato(a)"
        nav={<nav data-testid="desktop-menu">menu</nav>}
      />,
    );
    const slot = screen.getByTestId('desktop-menu');
    expect(slot).toBeInTheDocument();
    expect(screen.getByRole('banner')).toContainElement(slot);
  });

  it('seam headerNav: quando `nav` é omitido, nenhum buraco visual/erro (só a chrome padrão)', () => {
    render(<AppHeader personName="Ana Candidata" roleLabel="Candidato(a)" />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});
