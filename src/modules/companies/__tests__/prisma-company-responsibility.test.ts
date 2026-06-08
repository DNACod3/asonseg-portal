import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes unitários do PrismaCompanyResponsibilityAdapter (USP-012 / USP-007).
 * Todos os I/O são mockados; sem Postgres real.
 */

type GrantRow = { companyId: string };
type CountRow = { companyId: string; _count: { id: number } };
type CompanyRow = { id: string; razaoSocial: string };

const prismaState = vi.hoisted(() => ({
  grants: [] as GrantRow[],
  counts: [] as CountRow[],
  companies: [] as CompanyRow[],
}));

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    personCompanyGrant: {
      findMany: vi.fn(async () => prismaState.grants),
      groupBy: vi.fn(async () => prismaState.counts),
    },
    company: {
      findMany: vi.fn(async () => prismaState.companies),
    },
  },
}));

const { PrismaCompanyResponsibilityAdapter } = await import(
  '../adapters/prisma-company-responsibility'
);
const adapter = new PrismaCompanyResponsibilityAdapter();

beforeEach(() => {
  prismaState.grants = [];
  prismaState.counts = [];
  prismaState.companies = [];
});

describe('PrismaCompanyResponsibilityAdapter.companiesLeftWithoutResponsible', () => {
  it('sem grants ativos retorna []', async () => {
    prismaState.grants = [];
    const result = await adapter.companiesLeftWithoutResponsible('person-1');
    expect(result).toEqual([]);
  });

  it('empresa com 2 responsáveis não é órfã', async () => {
    prismaState.grants = [{ companyId: 'company-a' }];
    prismaState.counts = [{ companyId: 'company-a', _count: { id: 2 } }];
    const result = await adapter.companiesLeftWithoutResponsible('person-1');
    expect(result).toEqual([]);
  });

  it('empresa com 1 responsável ativo é retornada como órfã', async () => {
    prismaState.grants = [{ companyId: 'company-a' }];
    prismaState.counts = [{ companyId: 'company-a', _count: { id: 1 } }];
    prismaState.companies = [{ id: 'company-a', razaoSocial: 'Empresa A' }];
    const result = await adapter.companiesLeftWithoutResponsible('person-1');
    expect(result).toEqual([{ id: 'company-a', name: 'Empresa A' }]);
  });

  it('filtra corretamente múltiplas empresas com contagens distintas', async () => {
    prismaState.grants = [
      { companyId: 'company-a' },
      { companyId: 'company-b' },
    ];
    prismaState.counts = [
      { companyId: 'company-a', _count: { id: 1 } }, // órfã
      { companyId: 'company-b', _count: { id: 2 } }, // não é órfã
    ];
    prismaState.companies = [{ id: 'company-a', razaoSocial: 'Empresa A' }];
    const result = await adapter.companiesLeftWithoutResponsible('person-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('company-a');
  });
});
