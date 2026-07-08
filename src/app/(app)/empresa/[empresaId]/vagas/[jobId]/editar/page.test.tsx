import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes do gate de rota da edição de vaga (USP-023 / T9 / P-005 / D-005): só a
 * Pessoa responsável ATIVA da Empresa acessa; qualquer outra Pessoa recebe 404 —
 * mesmo padrão de `empresa/[empresaId]/editar/page.test.tsx` (USP-015) e de
 * `empresa/[empresaId]/vagas/page.test.tsx` (USP-023/T8). A vaga também é
 * escopada por `companyId` no `where` (`job.findFirst({ id, companyId })`): uma
 * vaga de OUTRA Empresa não é encontrada mesmo com um `jobId` válido — 404
 * também nesse caso (a rota não revela a existência da vaga alheia).
 */

const guardState = vi.hoisted(() => ({
  requireActivePerson: vi.fn(),
  grantFindFirst: vi.fn(),
  jobFindFirst: vi.fn(),
  listApprovedJobAreas: vi.fn(),
  listActiveRegions: vi.fn(),
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
  JobEditForm: ({ jobId }: { jobId: string }) => <div data-testid="job-edit-form">{jobId}</div>,
  listApprovedJobAreas: (...a: unknown[]) => guardState.listApprovedJobAreas(...a),
  listActiveRegions: (...a: unknown[]) => guardState.listActiveRegions(...a),
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    personCompanyGrant: { findFirst: (...a: unknown[]) => guardState.grantFindFirst(...a) },
    job: { findFirst: (...a: unknown[]) => guardState.jobFindFirst(...a) },
  },
}));

const { default: EditarVagaPage } = await import('./page');

const EMPRESA_ID = '11111111-1111-1111-1111-111111111111';
const JOB_ID = '22222222-2222-2222-2222-222222222222';
const params = Promise.resolve({ empresaId: EMPRESA_ID, jobId: JOB_ID });

const JOB_ACTIVE = {
  title: 'Vendedor(a)',
  areaId: 'area-1',
  description: 'desc',
  requirements: 'req',
  workRegime: 'Presencial',
  location: 'Centro',
  benefits: null,
  salary: null,
  contractType: 'CLT',
  regionId: 'region-1',
  educationLevelRequired: null,
  salaryMin: null,
  salaryMax: null,
  salaryVisible: true,
  status: 'ACTIVE',
};

beforeEach(() => {
  vi.clearAllMocks();
  guardState.notFoundCalled = false;
  guardState.listApprovedJobAreas.mockResolvedValue([]);
  guardState.listActiveRegions.mockResolvedValue([]);
});

describe('EditarVagaPage — gate de rota (P-005/D-005)', () => {
  it('não-responsável → 404, e a vaga NÃO é carregada', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-estranho' });
    guardState.grantFindFirst.mockResolvedValue(null); // sem grant ativo

    await expect(EditarVagaPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    expect(guardState.jobFindFirst).not.toHaveBeenCalled();
  });

  it('responsável ATIVO mas vaga de OUTRA Empresa (ou inexistente) → 404', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.grantFindFirst.mockResolvedValue({ id: 'g-1' });
    guardState.jobFindFirst.mockResolvedValue(null); // where { id, companyId } não casa

    await expect(EditarVagaPage({ params })).rejects.toBeInstanceOf(NotFoundError);
    expect(guardState.notFoundCalled).toBe(true);
    // O `where` escopa por Empresa — confinamento (a vaga alheia não é revelada).
    expect(guardState.jobFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: JOB_ID, companyId: EMPRESA_ID } }),
    );
  });

  it('responsável ATIVO + vaga ACTIVE → renderiza o formulário de edição', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.grantFindFirst.mockResolvedValue({ id: 'g-1' });
    guardState.jobFindFirst.mockResolvedValue(JOB_ACTIVE);

    const ui = await EditarVagaPage({ params });
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.getByTestId('job-edit-form')).toHaveTextContent(JOB_ID);
  });

  it('responsável ATIVO + vaga não-ACTIVE → mostra aviso em vez do formulário', async () => {
    guardState.requireActivePerson.mockResolvedValue({ id: 'p-dono' });
    guardState.grantFindFirst.mockResolvedValue({ id: 'g-1' });
    guardState.jobFindFirst.mockResolvedValue({ ...JOB_ACTIVE, status: 'PAUSED' });

    const ui = await EditarVagaPage({ params });
    render(ui);

    expect(guardState.notFoundCalled).toBe(false);
    expect(screen.queryByTestId('job-edit-form')).not.toBeInTheDocument();
    expect(screen.getByText(/não pode ser editada/i)).toBeInTheDocument();
  });
});
