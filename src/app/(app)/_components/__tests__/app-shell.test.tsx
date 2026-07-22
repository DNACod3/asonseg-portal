import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../app-shell';

/**
 * USP-061 — APP-SHELL-06, APP-SHELL-07, APP-SHELL-MN-01.
 * Round 2 (USP-064): `AppShell` vira flex-row — seam `sidebar` (substitui
 * `headerNav`) à esquerda + coluna `flex-1` com header/children/bottomNav.
 *
 * `AppShell` é o ponto de extensão único da casca: compõe `AppHeader` +
 * `{children}` + os seams `sidebar`/`bottomNav`. O must-not MN-01 garante que
 * nenhum caminho renderiza `children` sem o header persistente (marca + Sair)
 * — o beco sem saída do UAT (SOC-2/EMP-5). (O reframe do MN-01 para o Menu de
 * Perfil — USP-065 — é feito na task T4, quando o `AppHeader` passa a montar
 * o `ProfileMenu`; aqui o `AppHeader` real segue inalterado.)
 */
describe('AppShell — APP-SHELL-06/07', () => {
  it('APP-SHELL-07: sem seams injetados, renderiza só a chrome do header + children (sem buraco/erro)', () => {
    render(
      <AppShell personName="Ana Candidata" roleLabel="Candidato(a)">
        <main data-testid="page-content">conteúdo da página</main>
      </AppShell>,
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('APP-SHELL-06 (round 2, seam sidebar): sidebar injetada renderiza na casca, à esquerda do header', () => {
    const { container } = render(
      <AppShell
        personName="Ana Candidata"
        roleLabel="Candidato(a)"
        sidebar={<nav data-testid="sidebar">sidebar desktop</nav>}
      >
        <main>conteúdo</main>
      </AppShell>,
    );
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toBeInTheDocument();
    const header = screen.getByRole('banner');
    // A sidebar precede o header na árvore (posicionada à esquerda pelo flex-row).
    expect(
      sidebar.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.firstElementChild?.className).toMatch(/\bflex\b/);
  });

  it('APP-SHELL-06: bottomNav injetado renderiza na casca (após o conteúdo)', () => {
    render(
      <AppShell
        personName="Ana Candidata"
        roleLabel="Candidato(a)"
        bottomNav={<div data-testid="bottom-nav">barra inferior</div>}
      >
        <main>conteúdo</main>
      </AppShell>,
    );
    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
  });
});

describe('AppShell — APP-SHELL-MN-01 (must-not: sem beco sem saída)', () => {
  it('QUALQUER children renderizado SEMPRE vem acompanhado do header com marca→/inicio e "Sair" — nunca aparece sozinho', () => {
    const arbitraryChildrenCases: React.ReactNode[] = [
      <main key="a" data-testid="case-a">tela A</main>,
      <div key="b" data-testid="case-b">tela B sem main</div>,
      <>tela C texto solto</>,
    ];

    for (const children of arbitraryChildrenCases) {
      const { unmount } = render(
        <AppShell personName="Qualquer Pessoa" roleLabel="">
          {children}
        </AppShell>,
      );

      // O header persistente está sempre presente...
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
      // ...com a marca linkando de volta ao hub...
      const brandLink = screen.getByRole('link', { name: /ASONSEG/ });
      expect(brandLink).toHaveAttribute('href', '/inicio');
      // ...e com o controle "Sair" funcional — nunca uma tela sem saída.
      expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();

      unmount();
    }
  });
});
