import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-049 — HUB-01, HUB-02, HUB-03, HUB-04, HUB-07.
 * USP-061 — APP-SHELL-08, APP-SHELL-MN-02 (migração do logout p/ a casca).
 *
 * `requireActivePerson` e `canAccessModerationQueue` são mockados; `buildHubLinks`/
 * `hubAccessFromRoles` (puros) permanecem reais — já cobertos exaustivamente por
 * `identity/__tests__/hub-links.test.ts` (HUB-MN-01/02).
 *
 * SPEC_DEVIATION (com justificativa, Assumption A5 de USP-061/spec.md): o antigo
 * teste HUB-06 ("hub renderiza a opção de logout via SignOutForm") é substituído
 * pelo teste negativo MN-02 abaixo — o "Sair" migrou para a `AppShell`/`AppHeader`
 * (USP-061), fonte única de logout; o hub isolado NÃO deve mais renderizá-lo. O
 * mock de `SignOutForm` também é removido do `@/modules/identity` mockado abaixo,
 * pois `page.tsx` não a importa mais. Não é enfraquecimento silencioso: a
 * capacidade de logout é preservada (e reforçada — alcançável de toda rota
 * `(app)/*`), só a localização muda.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  canAccessModerationQueue: vi.fn(),
}));

vi.mock('@/modules/identity', async () => {
  const domain = await vi.importActual<typeof import('@/modules/identity/domain/hub-links')>(
    '@/modules/identity/domain/hub-links',
  );
  return {
    hubAccessFromRoles: domain.hubAccessFromRoles,
    buildHubLinks: domain.buildHubLinks,
    requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
  };
});

vi.mock('@/modules/moderation', () => ({
  canAccessModerationQueue: (...a: unknown[]) => guardState.canAccessModerationQueue(...a),
}));

const { default: HubPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.canAccessModerationQueue.mockResolvedValue(false);
});

describe('HubPage (/inicio)', () => {
  it('HUB-01/HUB-02: candidato vê saudação, /candidato e os links pessoais', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana Candidata',
      roles: ['CANDIDATE'],
    });

    const ui = await HubPage();
    render(ui);

    expect(screen.getByText('Olá, Ana Candidata')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Área do candidato/ })).toHaveAttribute(
      'href',
      '/candidato',
    );
    expect(screen.getByRole('link', { name: /Meu perfil/ })).toHaveAttribute('href', '/perfil');
    expect(screen.getByRole('link', { name: /Meus consentimentos/ })).toHaveAttribute(
      'href',
      '/consentimentos',
    );
  });

  it('APP-SHELL-MN-02: o render isolado do hub NÃO renderiza mais o próprio "Sair" (logout migrou para a casca — USP-061)', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana',
      roles: ['CANDIDATE'],
    });

    const ui = await HubPage();
    render(ui);

    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  });

  it('HUB-04: voluntário COM delegação de moderação vê /moderacao', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-vol',
      fullName: 'Vitor Voluntário',
      roles: ['VOLUNTEER'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(true);

    const ui = await HubPage();
    render(ui);

    expect(screen.getByRole('link', { name: /Fila de moderação/ })).toHaveAttribute(
      'href',
      '/moderacao',
    );
  });

  it('HUB-04: voluntário SEM delegação de moderação NÃO vê /moderacao (evita beco em notFound)', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-vol',
      fullName: 'Vitor Voluntário',
      roles: ['VOLUNTEER'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await HubPage();
    render(ui);

    expect(screen.queryByRole('link', { name: /Fila de moderação/ })).not.toBeInTheDocument();
    expect(guardState.canAccessModerationQueue).toHaveBeenCalledTimes(1);
  });

  it('HUB-02: papel-zero (sem papel público/institucional) ainda vê só os links pessoais fixos', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-zero',
      fullName: 'Pessoa Sem Papel',
      roles: [],
    });

    const ui = await HubPage();
    render(ui);

    expect(screen.getByRole('link', { name: /Meu perfil/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('moderation vem do guard ao vivo, não do papel puro: COORDINATOR sem canAccessModerationQueue=true NÃO vê /moderacao', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-coord',
      fullName: 'Carla Coordenadora',
      roles: ['COORDINATOR'],
    });
    guardState.canAccessModerationQueue.mockResolvedValue(false);

    const ui = await HubPage();
    render(ui);

    expect(screen.queryByRole('link', { name: /Fila de moderação/ })).not.toBeInTheDocument();
  });

  it('HUB-07: chama requireActivePerson() sem allowFirstAccess (herda o redirect a /trocar-senha no 1º acesso)', async () => {
    guardState.requireActivePerson.mockResolvedValue({
      id: 'p-cand',
      fullName: 'Ana',
      roles: ['CANDIDATE'],
    });

    await HubPage();

    expect(guardState.requireActivePerson).toHaveBeenCalledWith();
  });
});
