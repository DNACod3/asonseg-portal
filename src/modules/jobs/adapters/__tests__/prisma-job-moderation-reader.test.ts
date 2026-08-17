// Unit do PrismaJobModerationReader (USP-066 / T2 / E-002 — corrigido A1/PR#294)
// — Prisma mockado. Cobre: mapeamento de todos os campos, faixa salarial
// (salaryVisible/legado), companyName (nome fantasia > razão social), `null`
// quando o item não existe e o filtro de escopo `status: IN_MODERATION` (A1).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const prismaState = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: { job: { findFirst: (...a: unknown[]) => prismaState.findFirst(...a) } },
}));

const { PrismaJobModerationReader } = await import('../prisma-job-moderation-reader');
const { ContentKind } = await import('@/modules/moderation');

beforeEach(() => {
  vi.clearAllMocks();
});

const baseRow = {
  title: 'Analista de RH',
  description: 'Descrição integral do rascunho',
  requirements: 'Requisitos completos',
  salary: null,
  salaryMin: null,
  salaryMax: null,
  salaryVisible: true,
  workRegime: 'Presencial',
  contractType: 'CLT',
  educationLevelRequired: 'Ensino médio',
  location: 'Belo Horizonte',
  area: { name: 'Recursos Humanos' },
  region: { name: 'Zona Norte' },
  company: { razaoSocial: 'ACME Ltda', nomeFantasia: 'ACME' },
};

describe('PrismaJobModerationReader (T2/E-002)', () => {
  it('mapeia todos os campos de E-002 (área, região, faixa salarial, empresa)', async () => {
    prismaState.findFirst.mockResolvedValue({
      ...baseRow,
      salaryMin: new Prisma.Decimal(3000),
      salaryMax: new Prisma.Decimal(4000),
    });

    const view = await new PrismaJobModerationReader().readContent(ContentKind.JOB, 'job-1');

    expect(view).toMatchObject({
      kind: 'JOB',
      title: 'Analista de RH',
      description: 'Descrição integral do rascunho',
      requirements: 'Requisitos completos',
      workRegime: 'Presencial',
      contractType: 'CLT',
      educationLevelRequired: 'Ensino médio',
      location: 'Belo Horizonte',
      area: 'Recursos Humanos',
      region: 'Zona Norte',
      companyName: 'ACME',
    });
    expect(view && 'salaryRange' in view ? view.salaryRange : undefined).toBe('R$ 3.000 – R$ 4.000');
    expect(prismaState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1', status: 'IN_MODERATION' } }),
    );
  });

  it('salaryVisible=false ⇒ faixa salarial oculta (null), mesmo com salaryMin/Max presentes', async () => {
    prismaState.findFirst.mockResolvedValue({
      ...baseRow,
      salaryVisible: false,
      salaryMin: new Prisma.Decimal(3000),
      salaryMax: new Prisma.Decimal(4000),
    });

    const view = await new PrismaJobModerationReader().readContent(ContentKind.JOB, 'job-2');
    expect(view).toMatchObject({ kind: 'JOB', salaryRange: null });
  });

  it('sem salaryMin/Max mas com salário legado (freetext) ⇒ usa o texto legado', async () => {
    prismaState.findFirst.mockResolvedValue({
      ...baseRow,
      salary: 'A combinar',
      salaryMin: null,
      salaryMax: null,
      salaryVisible: true,
    });

    const view = await new PrismaJobModerationReader().readContent(ContentKind.JOB, 'job-3');
    expect(view).toMatchObject({ kind: 'JOB', salaryRange: 'A combinar' });
  });

  it('companyName cai para razaoSocial quando nomeFantasia é ausente', async () => {
    prismaState.findFirst.mockResolvedValue({
      ...baseRow,
      company: { razaoSocial: 'ACME Ltda', nomeFantasia: null },
    });

    const view = await new PrismaJobModerationReader().readContent(ContentKind.JOB, 'job-4');
    expect(view).toMatchObject({ kind: 'JOB', companyName: 'ACME Ltda' });
  });

  it('findFirst → null ⇒ retorna null (E-006 gracioso)', async () => {
    prismaState.findFirst.mockResolvedValue(null);
    const view = await new PrismaJobModerationReader().readContent(ContentKind.JOB, 'nope');
    expect(view).toBeNull();
  });

  it('A1 (PR#294): escopa a leitura a status IN_MODERATION — vaga ACTIVE/DRAFT/ARCHIVED não é servida', async () => {
    prismaState.findFirst.mockResolvedValue(null);

    const view = await new PrismaJobModerationReader().readContent(ContentKind.JOB, 'job-active');

    expect(view).toBeNull();
    expect(prismaState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-active', status: 'IN_MODERATION' } }),
    );
  });
});
