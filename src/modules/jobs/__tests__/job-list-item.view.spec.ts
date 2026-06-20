import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { viewJobForVisitor, type JobListRow } from '../views/job-list-item.view';

/**
 * View Model da lista pública de vagas (USP-021). A anonimização por papel é a
 * garantia central de privacidade (ADR-0017/ADR-0022): o nome real da Empresa só
 * pode sair para o autenticado. Testes RED → verdes da fase Execute.
 */

const REAL_NAME = 'Lojas Guadalupe';
const SETOR = 'Comércio e Vendas';

function row(overrides: Partial<JobListRow> = {}): JobListRow {
  return {
    id: 'job-1',
    title: 'Vendedor(a)',
    educationLevelRequired: 'Ensino médio completo',
    contractType: 'CLT',
    workRegime: 'Presencial',
    salaryMin: new Prisma.Decimal(2000),
    salaryMax: new Prisma.Decimal(2800),
    salaryVisible: true,
    publishedAt: new Date('2026-06-18T12:00:00Z'),
    area: { name: 'Comércio e Vendas' },
    region: { name: 'Ingleses' },
    company: { nomeFantasia: REAL_NAME, setor: SETOR },
    ...overrides,
  };
}

const authenticated: CurrentPerson = {
  id: 'viewer-1',
  supabaseUserId: '00000000-0000-0000-0000-000000000001',
  fullName: 'Maria',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['CANDIDATE'],
  phone: null,
  fullAddress: null,
};

describe('viewJobForVisitor', () => {
  it('@e-004 @p-001 @p-004 anônimo NÃO vê o nome real da Empresa em nenhum campo', () => {
    const item = viewJobForVisitor(row(), null);
    expect(item.company.isAnonymized).toBe(true);
    expect(item.company.displayName).toBe(`Empresa do setor de ${SETOR}`);
    // O nome real não pode aparecer em nenhum lugar do payload serializado.
    expect(JSON.stringify(item)).not.toContain(REAL_NAME);
  });

  it('@e-005 autenticado vê o nome real (nome fantasia) da Empresa', () => {
    const item = viewJobForVisitor(row(), authenticated);
    expect(item.company.isAnonymized).toBe(false);
    expect(item.company.displayName).toBe(REAL_NAME);
  });

  it('salaryVisible=false oculta o salário (null) para ambos os papéis', () => {
    const hidden = row({ salaryVisible: false });
    expect(viewJobForVisitor(hidden, null).salary).toBeNull();
    expect(viewJobForVisitor(hidden, authenticated).salary).toBeNull();
  });

  it('salaryVisible=true projeta a faixa como números', () => {
    const item = viewJobForVisitor(row(), authenticated);
    expect(item.salary).toEqual({ min: 2000, max: 2800 });
  });

  it('faixa salarial parcial/ausente vira null nos extremos', () => {
    const item = viewJobForVisitor(row({ salaryMin: null, salaryMax: null }), null);
    expect(item.salary).toEqual({ min: null, max: null });
  });

  it('projeta área e região pelo nome (ou null)', () => {
    const item = viewJobForVisitor(row({ area: null, region: null }), null);
    expect(item.area).toBeNull();
    expect(item.region).toBeNull();
  });
});
