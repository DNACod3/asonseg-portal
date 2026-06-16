import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota da edição de Empresa (USP-015 / P-004): só um
 * responsável ATIVO acessa; qualquer outra Pessoa recebe 404 (a rota não revela a
 * existência da Empresa — defesa em profundidade) e os dados nem chegam a ser
 * carregados. `requireActivePerson` e o Prisma são mockados; a Server Action
 * `editarEmpresa` reconfirma a permissão à parte (coberta nos testes de integração).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  grantFindFirst: vi.fn(),
  companyFindUnique: vi.fn(),
  notFoundCalled: false,
}));

/** `notFound()` do Next lança para abortar o render; replicamos esse contrato. */
class NotFoundError extends Error {}

vi.mock('next/navigation', () => ({
  notFound: () => {
    guardState.notFoundCalled = true;
    throw new NotFoundError('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/modules/identity', () => ({
  requireActivePerson: (...a: unknown[]) => guardState.requireActivePerson(...a),
}));

vi.mock('@/modules/companies', () => ({
  EditCompanyForm: ({ empresa }: { empresa: { nomeFantasia: string } }) => (
    <div data-testid="edit-form">{empresa.nomeFantasia}</div>
  ),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    personCompanyGrant: { findFirst: (...a: unknown[]) => guardState.grantFindFirst(...a) },
    company: { findUnique: (...a: unknown[]) => guardState.companyFindUnique(...a) },
  },
}));

const { default: EditarEmpresaPage } = await import('./page');

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
const params = Promise.resolve({ empresaId: EMPRESA_ID });

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('EditarEmpresaPage — gate de rota (P-004)', () => {
  it('não-responsável → 404, e a Empresa NÃO é carregada', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho' });
    guardState.grantFindFirst.mockResolvedValue(null); // sem grant ativo

    await expect(EditarEmpresaPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.companyFindUnique).not.toHaveBeenCalled();
  });

  it('responsável ATIVO mas Empresa inexistente → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.grantFindFirst.mockResolvedValue({ id: 'g-1' });
    guardState.companyFindUnique.mockResolvedValue(null);

    await expect(EditarEmpresaPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
  });

  it('responsável ATIVO → renderiza o formulário pré-preenchido', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.grantFindFirst.mockResolvedValue({ id: 'g-1' });
    guardState.companyFindUnique.mockResolvedValue({
      id: EMPRESA_ID,
      cnpj: '11222333000181',
      type: 'SIMPLES_NACIONAL',
      razaoSocial: 'Padaria Aurora Alimentos Ltda',
      nomeFantasia: 'Padaria Aurora',
      setor: 'Alimentação',
      descricao: null,
      endereco: null,
      isVerified: true,
    });

    const ui = await EditarEmpresaPage({ params });
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('edit-form')).toHaveTextContent('Padaria Aurora');
  });
});
