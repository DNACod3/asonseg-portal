import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { JobDetailView } from '../components/job-detail';
import { viewJobDetail, type JobDetail, type JobDetailRow } from '../views/job-detail.view';

/**
 * Renderização do detalhe da vaga (USP-022 — #277 / D-002/D-003/D-005). Os fluxos
 * autenticados NÃO têm E2E por decisão de pirâmide do projeto (não semear sessão Supabase,
 * ver `e2e/candidato.spec.ts`): aqui travamos, em jsdom, que o `viewer` se propaga até o
 * render — `viewJobDetail(row, viewer)` → `<JobDetailView>` — produzindo o nome correto e o
 * CTA por papel (E-001/E-002/E-004/P-002/P-003). O E2E cobre só o caminho anônimo.
 */

const REAL_NAME = 'Lojas Guadalupe';
const SETOR = 'Comércio e Vendas';

function row(overrides: Partial<JobDetailRow> = {}): JobDetailRow {
  return {
    id: 'job-1',
    title: 'Vendedor(a) de loja',
    description: 'Vendas no varejo.',
    requirements: 'Boa comunicação.',
    benefits: 'Vale-transporte.',
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

const prestador: CurrentPerson = { ...candidato, id: 'viewer-2', roles: ['PROVIDER'] };

describe('JobDetailView', () => {
  it('@d-002 candidato vê o nome real e o botão "Candidatar-se"', () => {
    render(<JobDetailView job={viewJobDetail(row(), candidato)} />);
    expect(screen.getByText(REAL_NAME)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /candidatar-se/i })).toBeInTheDocument();
  });

  it('@d-003 autenticado sem papel candidato vê o CTA "ativar perfil" e nenhum botão candidatar', () => {
    render(<JobDetailView job={viewJobDetail(row(), prestador)} />);
    expect(screen.getByText(REAL_NAME)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ative seu perfil candidato/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /candidatar-se/i })).not.toBeInTheDocument();
  });

  it('@p-002 anônimo vê a Empresa anonimizada e o CTA de criar conta — nome real ausente', () => {
    const { container } = render(<JobDetailView job={viewJobDetail(row(), null)} />);
    expect(screen.getByText(`Empresa do setor de ${SETOR}`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /criar conta para candidatar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /candidatar-se/i })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(REAL_NAME);
  });

  it('@d-005 contador só aparece acima do limiar e concorda em número/plural', () => {
    const { rerender } = render(<JobDetailView job={viewJobDetail(row({ applicationCount: 1 }), null)} />);
    // 1 candidatura está abaixo do limiar (3) ⇒ contador oculto.
    expect(screen.queryByText(/se candidat/i)).not.toBeInTheDocument();

    rerender(<JobDetailView job={viewJobDetail(row({ applicationCount: 7 }), null)} />);
    expect(screen.getByText(/7 pessoas se candidataram/i)).toBeInTheDocument();
  });

  it('a concordância singular do contador é coberta na apresentação', () => {
    const singular: JobDetail = { ...viewJobDetail(row(), null), applicationCount: 1 };
    render(<JobDetailView job={singular} />);
    expect(screen.getByText(/1 pessoa se candidatou/i)).toBeInTheDocument();
  });
});

/**
 * Restyle Design System (USP-022 / T1 / U22-STYLE-01). O `JobDetailView` passou a usar
 * os primitivos `Card/FormCard/FormSectionTitle/Badge/Button` de `@/shared/ui` — este
 * bloco trava que a mudança foi só de apresentação: os 3 CTAs continuam com a
 * estrutura/papel corretos e o CTA "Candidatar-se" continua display-only (U22-MN-04).
 */
describe('JobDetailView — restyle Design System (USP-022)', () => {
  it('U22-MN-04: "Candidatar-se" é type="button" e não dispara nenhuma action (display-only)', () => {
    render(<JobDetailView job={viewJobDetail(row(), candidato)} />);
    const cta = screen.getByRole('button', { name: /candidatar-se/i });
    expect(cta).toHaveAttribute('type', 'button');
    expect(cta).not.toHaveAttribute('onclick');
    expect(cta).not.toHaveAttribute('formaction');
  });

  it('metadados renderizam como Badge (papel/estrutura do primitivo DS)', () => {
    render(<JobDetailView job={viewJobDetail(row(), candidato)} />);
    // Badge do DS renderiza `<span class="...rounded-full...">` — mesma pílula do JobCard (USP-021).
    const areaBadge = screen.getByText('Comércio e Vendas', { selector: 'span' });
    expect(areaBadge.className).toMatch(/rounded-full/);
  });

  it('CTA "ativar perfil" e CTA "criar conta" renderizam como link (Button asChild)', () => {
    const { rerender } = render(<JobDetailView job={viewJobDetail(row(), prestador)} />);
    const activateCta = screen.getByRole('link', { name: /ative seu perfil candidato/i });
    expect(activateCta.tagName).toBe('A');

    rerender(<JobDetailView job={viewJobDetail(row(), null)} />);
    const anonCta = screen.getByRole('link', { name: /criar conta para candidatar/i });
    expect(anonCta.tagName).toBe('A');
  });
});
