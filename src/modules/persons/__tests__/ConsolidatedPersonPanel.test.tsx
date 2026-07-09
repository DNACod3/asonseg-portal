import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentStatus } from '@/modules/moderation';
import { ConsolidatedPersonPanel } from '../components/consolidated-person-panel';
import type { ConsolidatedPersonView } from '../views/view-person-for-social-assistant';

/**
 * Componente de apresentação do painel consolidado (USP-039 / T7). Consome só
 * `ConsolidatedPersonView` — o teste garante que renderiza todas as dimensões,
 * os estados vazios por dimensão, e (SOC-039-MN-01) que **nenhum** rótulo/valor
 * sensível da ficha aparece quando `view.ficha = null` (coordenador).
 */

const BASE_VIEW: ConsolidatedPersonView = {
  person: {
    id: 'person-1',
    fullName: 'Maria Consolidado',
    status: 'ATIVO',
    roles: ['CANDIDATE'],
    inactivatedAt: null,
    inactivationReason: null,
  },
  ficha: null,
  applications: [],
  referrals: [],
  servicesOffered: [],
  serviceInterests: [],
  companyGrants: [],
};

function view(overrides: Partial<ConsolidatedPersonView> = {}): ConsolidatedPersonView {
  return { ...BASE_VIEW, ...overrides };
}

describe('ConsolidatedPersonPanel', () => {
  it('renderiza identidade + papéis ativos', () => {
    render(<ConsolidatedPersonPanel view={view()} />);
    expect(screen.getByText('Maria Consolidado')).toBeInTheDocument();
    expect(screen.getByText('CANDIDATE')).toBeInTheDocument();
    expect(screen.getByText('ATIVO')).toBeInTheDocument();
  });

  it('estados vazios: exibe mensagem "nenhum registro" para cada dimensão sem dados', () => {
    render(<ConsolidatedPersonPanel view={view()} />);
    expect(screen.getByText('Nenhuma candidatura.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum encaminhamento.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum serviço oferecido.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma manifestação de interesse.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum vínculo com Empresa.')).toBeInTheDocument();
  });

  it('SOC-039-MN-01: com ficha=null (coordenador), NENHUM rótulo/valor sensível é renderizado', () => {
    render(<ConsolidatedPersonPanel view={view({ ficha: null })} />);
    expect(screen.queryByText('Ficha socioeconômica')).not.toBeInTheDocument();
    expect(screen.queryByText('Renda aproximada')).not.toBeInTheDocument();
    expect(screen.queryByText('Benefício social')).not.toBeInTheDocument();
    expect(screen.queryByText('Situação de moradia')).not.toBeInTheDocument();
    expect(screen.queryByText('Composição familiar')).not.toBeInTheDocument();
  });

  it('com ficha presente (AS/BOARD), renderiza a seção com os 4 campos', () => {
    render(
      <ConsolidatedPersonPanel
        view={view({
          ficha: {
            personId: 'person-1',
            incomeBracket: 'FROM_1_TO_2_MW',
            socialBenefit: 'Bolsa Família',
            housingSituation: 'OWNED',
            familyComposition: '3 pessoas',
            updatedAt: new Date('2026-06-01T10:00:00Z'),
            updatedByPersonId: 'as-1',
          },
        })}
      />,
    );
    expect(screen.getByText('Ficha socioeconômica')).toBeInTheDocument();
    expect(screen.getByText('De 1 a 2 salários mínimos')).toBeInTheDocument();
    expect(screen.getByText('Bolsa Família')).toBeInTheDocument();
    expect(screen.getByText('Própria')).toBeInTheDocument();
    expect(screen.getByText('3 pessoas')).toBeInTheDocument();
  });

  it('renderiza candidaturas ativas/históricas com badge correto', () => {
    render(
      <ConsolidatedPersonPanel
        view={view({
          applications: [
            {
              id: 'app-1',
              jobId: 'job-1',
              jobTitle: 'Vaga Consolidado',
              companyName: 'Empresa Consolidado',
              appliedAt: new Date('2026-07-01T10:00:00Z'),
              cancelledAt: null,
              active: true,
              viaEncaminhamento: true,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Vaga Consolidado')).toBeInTheDocument();
    expect(screen.getByText('Empresa Consolidado')).toBeInTheDocument();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.getByText('Via encaminhamento')).toBeInTheDocument();
  });

  it('renderiza encaminhamentos com resultado e observação', () => {
    render(
      <ConsolidatedPersonPanel
        view={view({
          referrals: [
            {
              id: 'ref-1',
              jobId: 'job-1',
              jobTitle: 'Vaga Consolidado',
              companyName: 'Empresa Consolidado',
              referrerName: 'Assistente Social X',
              justification: 'Perfil aderente',
              result: 'HIRED',
              resultObservation: 'Contratado',
              resultRegisteredAt: new Date('2026-07-02T10:00:00Z'),
              createdAt: new Date('2026-07-01T10:00:00Z'),
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Contratado')).toBeInTheDocument();
    expect(screen.getByText('Encaminhado por Assistente Social X')).toBeInTheDocument();
    expect(screen.getByText('Justificativa: Perfil aderente')).toBeInTheDocument();
  });

  it('renderiza serviços oferecidos, manifestações e vínculos organizacionais', () => {
    render(
      <ConsolidatedPersonPanel
        view={view({
          servicesOffered: [
            {
              id: 'svc-1',
              title: 'Serviço Consolidado',
              status: ContentStatus.ACTIVE,
              publishedAt: new Date(),
              lastStatusChangeAt: new Date(),
            },
          ],
          serviceInterests: [
            {
              id: 'int-1',
              serviceId: 'svc-2',
              serviceTitle: 'Serviço Interesse Consolidado',
              providerName: 'Prestador Consolidado',
              interestedAt: new Date('2026-07-01T10:00:00Z'),
              cancelledAt: null,
              active: true,
            },
          ],
          companyGrants: [
            {
              grantId: 'grant-1',
              companyId: 'company-1',
              companyName: 'Empresa Grant Consolidado',
              grantType: 'RESPONSIBLE',
              status: 'ACTIVE',
              grantedAt: new Date('2026-07-01T10:00:00Z'),
              acceptedAt: new Date('2026-07-01T10:00:00Z'),
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Serviço Consolidado')).toBeInTheDocument();
    expect(screen.getByText('Serviço Interesse Consolidado')).toBeInTheDocument();
    expect(screen.getByText('Prestador: Prestador Consolidado')).toBeInTheDocument();
    expect(screen.getByText('Empresa Grant Consolidado')).toBeInTheDocument();
  });

  it('Pessoa inativa: exibe status e metadados de inativação', () => {
    render(
      <ConsolidatedPersonPanel
        view={view({
          person: {
            id: 'person-2',
            fullName: 'João Inativo',
            status: 'INATIVO',
            roles: [],
            inactivatedAt: '2026-06-01T10:00:00.000Z',
            inactivationReason: 'Sem contato há 6 meses',
          },
        })}
      />,
    );
    expect(screen.getByText('INATIVO')).toBeInTheDocument();
    expect(screen.getByText('Sem papéis ativos.')).toBeInTheDocument();
    expect(screen.getByText(/Sem contato há 6 meses/)).toBeInTheDocument();
  });
});
