import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * USP-049 — PERFIL-01, PERFIL-02, PERFIL-03, PERFIL-MN-01.
 *
 * `requireActivePerson`/`viewPersonForSelf` são mockados; `ALL_ROLE_LABELS`
 * (puro) permanece real.
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  viewPersonForSelf: vi.fn(),
  notFoundCalled: false,
}));

class NotFoundError extends Error {}

vi.mock('next/navigation', () => ({
  notFound: () => {
    guardState.notFoundCalled = true;
    throw new NotFoundError('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/modules/identity', async () => {
  const roles = await vi.importActual<typeof import('@/modules/identity/domain/roles')>(
    '@/modules/identity/domain/roles',
  );
  return {
    ALL_ROLE_LABELS: roles.ALL_ROLE_LABELS,
    requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
    SignOutForm: () => <button type="button">Sair</button>,
  };
});

vi.mock('@/modules/persons', () => ({
  viewPersonForSelf: (...a: unknown[]) => guardState.viewPersonForSelf(...a),
}));

const { default: PerfilPage } = await import('./page');

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.requireActivePerson.mockResolvedValue({ id: 'person-1', fullName: 'Maria' });
});

describe('PerfilPage — PERFIL-01/02/03', () => {
  it('exibe nome, e-mail, CPF mascarado e papéis rotulados PT-BR (sem placeholder de dev)', async () => {
    guardState.viewPersonForSelf.mockResolvedValue({
      fullName: 'Maria da Silva',
      emailLogin: 'maria@example.com',
      cpfMasked: '***.***.***-09',
      roles: ['CANDIDATE', 'SOCIAL_ASSISTANT'],
    });

    const ui = await PerfilPage();
    render(ui);

    expect(screen.getByText('Maria da Silva')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    expect(screen.getByText('***.***.***-09')).toBeInTheDocument();
    expect(screen.getByText('Candidato(a)')).toBeInTheDocument();
    expect(screen.getByText('Assistente social')).toBeInTheDocument();
    expect(screen.queryByText(/[Pp]laceholder/)).not.toBeInTheDocument();
  });

  it('PERFIL-02: contém atalhos para /perfil/papeis e /consentimentos + logout', async () => {
    guardState.viewPersonForSelf.mockResolvedValue({
      fullName: 'Maria',
      emailLogin: 'maria@example.com',
      cpfMasked: '***.***.***-09',
      roles: [],
    });

    const ui = await PerfilPage();
    render(ui);

    expect(screen.getByRole('link', { name: 'Ativar um papel' })).toHaveAttribute(
      'href',
      '/perfil/papeis',
    );
    expect(screen.getByRole('link', { name: 'Meus consentimentos' })).toHaveAttribute(
      'href',
      '/consentimentos',
    );
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('PERFIL-MN-01: resolve os dados usando apenas person.id da sessão (nenhum parâmetro de terceiro)', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'person-XYZ', fullName: 'Alguém' });
    guardState.viewPersonForSelf.mockResolvedValue({
      fullName: 'Alguém',
      emailLogin: 'alguem@example.com',
      cpfMasked: '***.***.***-00',
      roles: [],
    });

    await PerfilPage();

    expect(guardState.viewPersonForSelf).toHaveBeenCalledWith('person-XYZ');
    expect(guardState.viewPersonForSelf).toHaveBeenCalledTimes(1);
  });

  it('sem nenhum papel ativo → mensagem em vez de lista vazia silenciosa', async () => {
    guardState.viewPersonForSelf.mockResolvedValue({
      fullName: 'Sem Papel',
      emailLogin: 'x@example.com',
      cpfMasked: '***.***.***-**',
      roles: [],
    });

    const ui = await PerfilPage();
    render(ui);

    expect(screen.getByText('Nenhum papel ativo ainda.')).toBeInTheDocument();
  });

  it('viewPersonForSelf retorna null (corrida rara) → 404, nunca renderiza dado de outra Pessoa', async () => {
    guardState.viewPersonForSelf.mockResolvedValue(null);

    await expect(PerfilPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });
});
