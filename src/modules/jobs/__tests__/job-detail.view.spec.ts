import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import {
  viewJobDetail,
  jobDetailJsonLd,
  serializeJsonLd,
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

/**
 * Serializer JSON-LD (USP-022 / T4 / P-002). O conteúdo deve ser sempre anônimo (recebe a
 * projeção `viewer=null`) e a serialização precisa ser segura para injeção em `<script>`.
 */
describe('jobDetailJsonLd', () => {
  const anon = () => viewJobDetail(row(), null);

  it('@p-002 hiringOrganization é anonimizado por setor, nunca o nome real', () => {
    const ld = jobDetailJsonLd(anon());
    expect(ld['@type']).toBe('JobPosting');
    expect(ld.hiringOrganization).toEqual({
      '@type': 'Organization',
      name: `Empresa do setor de ${SETOR}`,
    });
    expect(JSON.stringify(ld)).not.toContain(REAL_NAME);
  });

  it('projeta baseSalary (MonetaryAmount) a partir da faixa visível', () => {
    const ld = jobDetailJsonLd(viewJobDetail(row(), candidato));
    const baseSalary = ld.baseSalary as {
      '@type': string;
      currency: string;
      value: Record<string, unknown>;
    };
    expect(baseSalary['@type']).toBe('MonetaryAmount');
    expect(baseSalary.currency).toBe('BRL');
    expect(baseSalary.value).toMatchObject({ minValue: 2000, maxValue: 2800, unitText: 'MONTH' });
  });

  it('omite baseSalary quando o salário não é visível', () => {
    const ld = jobDetailJsonLd(viewJobDetail(row({ salaryVisible: false }), candidato));
    expect(ld.baseSalary).toBeUndefined();
  });

  it('projeta jobLocation (Place/PostalAddress) a partir da localização', () => {
    const ld = jobDetailJsonLd(anon());
    const jobLocation = ld.jobLocation as {
      '@type': string;
      address: { addressLocality: string };
    };
    expect(jobLocation['@type']).toBe('Place');
    expect(jobLocation.address.addressLocality).toBe('Ingleses - Florianópolis/SC');
  });

  it('omite jobLocation quando não há localização', () => {
    const ld = jobDetailJsonLd(viewJobDetail(row({ location: null }), null));
    expect(ld.jobLocation).toBeUndefined();
  });
});

describe('serializeJsonLd', () => {
  it('produz JSON válido e equivalente ao objeto de origem', () => {
    const ld = jobDetailJsonLd(viewJobDetail(row(), null));
    expect(JSON.parse(serializeJsonLd(ld))).toEqual(ld);
  });

  it('escapa break-out de <script> e separadores de linha (anti-XSS)', () => {
    const out = serializeJsonLd({
      title: '</script><script>alert(1)</script>',
      note: `a & b${String.fromCharCode(0x2028)}c${String.fromCharCode(0x2029)}d`,
    });
    // Nenhum caractere capaz de quebrar o bloco <script> sobrevive na string serializada.
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(out).toContain('\\u003c');
    // Ainda assim é JSON válido e preserva o valor original ao desserializar.
    expect(JSON.parse(out).title).toBe('</script><script>alert(1)</script>');
  });
});
