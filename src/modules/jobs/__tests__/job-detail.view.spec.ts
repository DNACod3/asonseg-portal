import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import {
  viewJobDetail,
  APPLICATION_COUNTER_THRESHOLD,
  type JobDetailRow,
} from '../views/job-detail.view';

/**
 * View Model do detalhe da vaga (USP-022). A anonimização por papel é a garantia
 * central de privacidade (ADR-0017/ADR-0022): o nome real da Empresa só pode sair
 * para o autenticado e em NENHUM campo para o anônimo (E-001/P-002). O contador
 * obedece ao limiar (E-003/P-001) e os CTAs dependem do papel (E-002/E-004/P-003).
 */

const REAL_NAME = 'Lojas Guadalupe';
const SETOR = 'Comércio e Vendas';

function row(overrides: Partial<JobDetailRow> = {}): JobDetailRow {
  return {
    id: 'job-1',
    title: 'Vendedor(a) de loja',
    description: 'Vendas no varejo, reposição e fechamento de caixa.',
    requirements: 'Boa comunicação. Experiência é diferencial.',
    benefits: 'Vale-transporte e comissão.',
    workRegime: 'Presencial',
    location: 'Ingleses - Florianópolis/SC',
    contractType: 'CLT',
    educationLevelRequired: 'Ensino médio completo',
    salaryMin: new Prisma.Decimal(2000),
    salaryMax: new Prisma.Decimal(2800),
    salaryVisible: true,
    validUntil: new Date('2026-09-01T00:00:00Z'),
    publishedAt: new Date('2026-06-18T12:00:00Z'),
    area: { name: 'Comércio e Vendas' },
    region: { name: 'Ingleses' },
    company: { nomeFantasia: REAL_NAME, setor: SETOR },
    applicationCount: 7,
    ...overrides,
  };
}

const candidato: CurrentPerson = {
  id: 'viewer-1',
  supabaseUserId: '00000000-0000-0000-0000-000000000001',
  fullName: 'Maria',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['CANDIDATE'],
  phone: null,
  fullAddress: null,
};

const prestadorSemCandidato: CurrentPerson = { ...candidato, id: 'viewer-2', roles: ['PROVIDER'] };

describe('viewJobDetail', () => {
  it('@e-001 @p-002 anônimo NÃO vê o nome real da Empresa em nenhum campo', () => {
    const detail = viewJobDetail(row({ company: { nomeFantasia: undefined, setor: SETOR } }), null);
    expect(detail.company.isAnonymized).toBe(true);
    expect(detail.company.displayName).toBe(`Empresa do setor de ${SETOR}`);
    // O nome real não pode aparecer em nenhum lugar do payload serializado (Flight/JSON).
    expect(JSON.stringify(detail)).not.toContain(REAL_NAME);
  });

  it('@e-002 autenticado vê o nome real (nome fantasia) da Empresa', () => {
    const detail = viewJobDetail(row(), candidato);
    expect(detail.company.isAnonymized).toBe(false);
    expect(detail.company.displayName).toBe(REAL_NAME);
  });

  it('@e-002 candidato ativo pode candidatar-se e não vê CTA de ativar perfil', () => {
    const detail = viewJobDetail(row(), candidato);
    expect(detail.canApply).toBe(true);
    expect(detail.showActivateCandidateCta).toBe(false);
  });

  it('@e-004 @p-003 autenticado sem papel candidato vê CTA "ativar perfil candidato"', () => {
    const detail = viewJobDetail(row(), prestadorSemCandidato);
    expect(detail.canApply).toBe(false);
    expect(detail.showActivateCandidateCta).toBe(true);
  });

  it('anônimo não pode candidatar nem vê CTA de ativar (UI mostra criar conta)', () => {
    const detail = viewJobDetail(row(), null);
    expect(detail.canApply).toBe(false);
    expect(detail.showActivateCandidateCta).toBe(false);
  });

  it(`@e-003 @p-001 contador é null abaixo do limiar (${APPLICATION_COUNTER_THRESHOLD})`, () => {
    for (const n of [0, 1, 2]) {
      expect(viewJobDetail(row({ applicationCount: n }), null).applicationCount).toBeNull();
    }
  });

  it('@e-003 contador é o número quando atinge o limiar', () => {
    expect(viewJobDetail(row({ applicationCount: 3 }), null).applicationCount).toBe(3);
    expect(viewJobDetail(row({ applicationCount: 7 }), null).applicationCount).toBe(7);
  });

  it('salaryVisible=false oculta o salário (null) para ambos os papéis', () => {
    expect(viewJobDetail(row({ salaryVisible: false }), null).salary).toBeNull();
    expect(viewJobDetail(row({ salaryVisible: false }), candidato).salary).toBeNull();
  });

  it('salaryVisible=true projeta a faixa como números', () => {
    expect(viewJobDetail(row(), candidato).salary).toEqual({ min: 2000, max: 2800 });
  });

  it('projeta os campos de texto longo e taxonomias do detalhe', () => {
    const detail = viewJobDetail(row(), null);
    expect(detail.description).toContain('Vendas no varejo');
    expect(detail.requirements).toContain('Boa comunicação');
    expect(detail.benefits).toContain('Vale-transporte');
    expect(detail.area).toBe('Comércio e Vendas');
    expect(detail.region).toBe('Ingleses');
  });
});
