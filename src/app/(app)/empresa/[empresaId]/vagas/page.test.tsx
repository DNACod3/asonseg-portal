import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota do painel de gestão de vagas (USP-023 / T8 / P-005 / D-005):
 * só a Pessoa responsável ATIVA da Empresa acessa; qualquer outra Pessoa (ou Empresa
 * inexistente) recebe 404 — a rota não revela a existência da Empresa, mesmo padrão
 * de `empresa/[empresaId]/editar/page.test.tsx` (USP-015). `requireActivePerson` e o
 * Prisma são mockados; `listCompanyJobs` NÃO pode ser chamada quando o gate barra
 * (confinamento — nenhum dado da Empresa vaza antes do 404).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  grantFindFirst: vi.fn(),
  companyFindUnique: vi.fn(),
  listCompanyJobs: vi.fn(),
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

vi.mock('@/modules/jobs', () => ({
  listCompanyJobs: (...a: unknown[]) => guardState.listCompanyJobs(...a),
  viewCompanyJobRow: (row: unknown) => row,
  CompanyJobList: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="company-job-list">{rows.length} vaga(s)</div>
  ),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    personCompanyGrant: { findFirst: (...a: unknown[]) => guardState.grantFindFirst(...a) },
    company: { findUnique: (...a: unknown[]) => guardState.companyFindUnique(...a) },
  },
}));

const { default: GestaoVagasPage } = await import('./page');

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
const params = Promise.resolve({ empresaId: EMPRESA_ID });

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
});

describe('GestaoVagasPage — gate de rota (P-005/D-005)', () => {
  it('não-responsável → 404, e as vagas NÃO são carregadas', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho' });
    guardState.grantFindFirst.mockResolvedValue(null); // sem grant ativo

    await expect(GestaoVagasPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.companyFindUnique).not.toHaveBeenCalled();
    expect(guardState.listCompanyJobs).not.toHaveBeenCalled();
  });

  it('responsável ATIVO mas Empresa inexistente → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.grantFindFirst.mockResolvedValue({ id: 'g-1' });
    guardState.companyFindUnique.mockResolvedValue(null);

    await expect(GestaoVagasPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.listCompanyJobs).not.toHaveBeenCalled();
  });

  it('responsável ATIVO → renderiza o painel com as vagas da Empresa', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.grantFindFirst.mockResolvedValue({ id: 'g-1' });
    guardState.companyFindUnique.mockResolvedValue({ nomeFantasia: 'Padaria Aurora' });
    guardState.listCompanyJobs.mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }]);

    const ui = await GestaoVagasPage({ params });
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByText(/Padaria Aurora/)).toBeInTheDocument();
    expect(screen.getByTestId('company-job-list')).toHaveTextContent('2 vaga(s)');
  });
});
