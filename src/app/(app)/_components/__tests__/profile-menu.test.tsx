import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileMenu } from '../profile-menu';

/**
 * USP-065 — PROF-01, -02, -03, -04, -06; PROF-MN-01, -02, -03.
 * Molde: disclosure do `PublicNav`/`AppDesktopMenu` (`useState`,
 * `aria-expanded`/`aria-controls`, `fireEvent`).
 */
describe('ProfileMenu — trigger/disclosure (PROF-01/04)', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    window.localStorage.clear();
  });

  it('abre/fecha o painel ao clicar no trigger (aria-expanded + painel no DOM)', () => {
    render(<ProfileMenu personName="Ana Candidata" roleLabel="Candidato(a)" signOut={<button>Sair</button>} />);
    const trigger = screen.getByRole('button', { name: 'Abrir menu de perfil' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'profile-menu-panel');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(document.getElementById('profile-menu-panel')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Fechar menu de perfil' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(document.getElementById('profile-menu-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu de perfil' }));
    expect(document.getElementById('profile-menu-panel')).not.toBeInTheDocument();
  });

  it('avatar exibe a inicial do nome; some para "?" quando personName é vazio/whitespace', () => {
    const { rerender } = render(
      <ProfileMenu personName="Ana Candidata" roleLabel="" signOut={<button>Sair</button>} />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();

    rerender(<ProfileMenu personName="   " roleLabel="" signOut={<button>Sair</button>} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

describe('ProfileMenu — painel: nome + papel (PROF-01/06)', () => {
  it('exibe nome e papel ativo quando roleLabel é não-vazio', () => {
    render(
      <ProfileMenu personName="Ana Candidata" roleLabel="Candidato(a)" signOut={<button>Sair</button>} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de perfil' }));
    expect(screen.getByTestId('app-header-role-label')).toHaveTextContent('Candidato(a)');
  });

  it('PROF-06: omite o nó de papel quando roleLabel é string vazia (sem placeholder)', () => {
    render(<ProfileMenu personName="Pessoa Sem Papel" roleLabel="" signOut={<button>Sair</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de perfil' }));
    expect(screen.queryByTestId('app-header-role-label')).not.toBeInTheDocument();
  });
});

describe('ProfileMenu — controle de tema (PROF-02)', () => {
  it('alterna data-theme e grava localStorage["theme"] (reuso do ThemeToggle)', () => {
    document.documentElement.dataset.theme = 'light';
    render(<ProfileMenu personName="Ana Candidata" roleLabel="" signOut={<button>Sair</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de perfil' }));

    fireEvent.click(screen.getByRole('button', { name: /ativar tema escuro/i }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });
});

describe('ProfileMenu — Sair (PROF-03)', () => {
  it('renderiza a ação Sair injetada e fecha o painel ao acioná-la', () => {
    render(
      <ProfileMenu
        personName="Ana Candidata"
        roleLabel=""
        signOut={<button type="button">Sair</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de perfil' }));
    const sair = screen.getByRole('button', { name: 'Sair' });
    expect(sair).toBeInTheDocument();

    fireEvent.click(sair);
    expect(document.getElementById('profile-menu-panel')).not.toBeInTheDocument();
  });
});

describe('ProfileMenu — contrato ARIA de disclosure (round 2, fix 4)', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('Escape fecha o menu aberto e devolve o foco ao trigger', () => {
    render(<ProfileMenu personName="Ana Candidata" roleLabel="Candidato(a)" signOut={<button>Sair</button>} />);
    const trigger = screen.getByRole('button', { name: 'Abrir menu de perfil' });
    fireEvent.click(trigger);
    expect(document.getElementById('profile-menu-panel')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.getElementById('profile-menu-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menu de perfil' })).toHaveFocus();
  });

  it('clique fora do painel fecha o menu', () => {
    render(
      <div>
        <ProfileMenu personName="Ana Candidata" roleLabel="Candidato(a)" signOut={<button>Sair</button>} />
        <button type="button">Fora do menu</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de perfil' }));
    expect(document.getElementById('profile-menu-panel')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Fora do menu' }));

    expect(document.getElementById('profile-menu-panel')).not.toBeInTheDocument();
  });

  it('clique dentro do painel (ex.: no ThemeToggle) NÃO fecha o menu via listener de fora', () => {
    render(<ProfileMenu personName="Ana Candidata" roleLabel="Candidato(a)" signOut={<button>Sair</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de perfil' }));
    expect(document.getElementById('profile-menu-panel')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('app-header-role-label'));

    expect(document.getElementById('profile-menu-panel')).toBeInTheDocument();
  });

  it('registra os listeners de keydown/mousedown só enquanto o menu está aberto — sem vazar após fechar (mata mutantes: guard `if (!open) return` e cleanup do useEffect)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    render(
      <ProfileMenu personName="Ana Candidata" roleLabel="Candidato(a)" signOut={<button>Sair</button>} />,
    );

    // Fechado (mount inicial): nenhum listener de keydown/mousedown registrado.
    // Sem o guard `if (!open) return`, o efeito registraria os listeners mesmo
    // fechado — este assert mata esse mutante.
    expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(addSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function));

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de perfil' }));

    const keydownHandler = addSpy.mock.calls.find(([type]) => type === 'keydown')?.[1];
    const mousedownHandler = addSpy.mock.calls.find(([type]) => type === 'mousedown')?.[1];
    expect(keydownHandler).toBeDefined();
    expect(mousedownHandler).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu de perfil' }));

    // Fechar deve remover os MESMOS handlers registrados na abertura. Sem o
    // cleanup do useEffect, nenhum destes `removeEventListener` aconteceria
    // (listener vazaria) — este assert mata esse mutante.
    expect(removeSpy).toHaveBeenCalledWith('keydown', keydownHandler);
    expect(removeSpy).toHaveBeenCalledWith('mousedown', mousedownHandler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('ProfileMenu — PROF-MN-03 (negativo/static: sem import do barrel @/modules/identity)', () => {
  it('o arquivo profile-menu.tsx não importa de "@/modules/identity"', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/(app)/_components/profile-menu.tsx'),
      'utf-8',
    );
    expect(source).not.toMatch(/from\s+['"]@\/modules\/identity['"]/);
  });
});
