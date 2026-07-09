import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceDetailView } from '../components/service-detail';
import { viewServiceDetail, type ServiceDetailRow } from '../views/service-detail.view';
import type { CurrentPerson } from '@/modules/identity';

/**
 * Renderização do CTA de manifestação de interesse no detalhe do serviço
 * (USP-033 — AC-031-3/AC-033-1..5). Trava os 3 caminhos por papel/estado:
 * anônimo (link de cadastro), autenticado sem interesse (ManifestInterestButton
 * real) e autenticado com interesse ativo (contato revelado, sem CTA de
 * manifestação). SVC033-MN-01: sem `myInterestId`, o contato nunca aparece no
 * DOM, mesmo que `providerContact` fosse passado por engano.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function row(overrides: Partial<ServiceDetailRow> = {}): ServiceDetailRow {
  return {
    id: 'svc-1',
    title: 'Jardinagem Residencial',
    description: 'Poda e manutenção de jardins.',
    priceMin: null,
    priceMax: null,
    priceUnit: null,
    availabilityDescription: 'Segunda a sexta',
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    category: { name: 'Jardinagem' },
    region: { name: 'Centro' },
    photos: [],
    author: { fullName: 'João Prestador' },
    company: null,
    ...overrides,
  };
}

const cliente: CurrentPerson = {
  id: 'viewer-1',
  supabaseUserId: '00000000-0000-0000-0000-000000000001',
  fullName: 'Maria Cliente',
  status: 'ATIVO',
  primeiroAcesso: false,
  roles: ['CLIENT'],
  phone: null,
  fullAddress: null,
};

const TERM = { humanName: 'Contratação de serviços', body: 'Corpo do termo.' };

describe('ServiceDetailView — CTA de manifestação de interesse (USP-033)', () => {
  it('anônimo: vê o link de criar conta, nenhum CTA de manifestação/contato', () => {
    render(<ServiceDetailView service={viewServiceDetail(row(), null)} consentTerm={TERM} />);
    expect(screen.getByRole('link', { name: /criar conta para entrar em contato/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /entrar em contato/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/contato do prestador/i)).not.toBeInTheDocument();
  });

  it('autenticado sem interesse: renderiza o ManifestInterestButton real', () => {
    render(<ServiceDetailView service={viewServiceDetail(row(), cliente)} consentTerm={TERM} />);
    expect(screen.getByRole('button', { name: /entrar em contato/i })).toBeInTheDocument();
    expect(screen.queryByText(/contato do prestador/i)).not.toBeInTheDocument();
  });

  it('SVC033-MN-01: sem myInterestId, o contato nunca aparece mesmo se providerContact for passado', () => {
    render(
      <ServiceDetailView
        service={viewServiceDetail(row(), cliente)}
        consentTerm={TERM}
        providerContact={{ displayName: 'João', phone: '11999998888', email: 'joao@example.com' }}
      />,
    );
    expect(screen.queryByText(/contato do prestador/i)).not.toBeInTheDocument();
    expect(screen.queryByText('11999998888')).not.toBeInTheDocument();
  });

  it('@ac-033-5 autenticado com interesse ativo: revela o contato, sem CTA de manifestação', () => {
    render(
      <ServiceDetailView
        service={viewServiceDetail(row(), cliente)}
        myInterestId="int-1"
        providerContact={{ displayName: 'João', phone: '11999998888', email: 'joao@example.com' }}
        consentTerm={TERM}
      />,
    );
    expect(screen.getByText(/contato do prestador/i)).toBeInTheDocument();
    expect(screen.getByText('11999998888')).toBeInTheDocument();
    expect(screen.getByText('joao@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /entrar em contato/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar manifestação/i })).toBeInTheDocument();
  });
});
