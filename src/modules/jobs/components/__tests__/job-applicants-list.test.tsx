import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobApplicantsList } from '../job-applicants-list';
import type { EmployerCandidateView } from '@/modules/persons';

/**
 * Componente de apresentação da lista de candidatos (USP-027 / T4). Consome só
 * `EmployerCandidateView[]` — o teste garante que o componente renderiza os
 * campos do View Model (nome, contato, CV, data, badge) e o estado vazio.
 */

function applicant(overrides: Partial<EmployerCandidateView> = {}): EmployerCandidateView {
  return {
    candidatePersonId: 'candidate-1',
    fullName: 'Maria Candidata',
    contact: { email: 'maria@example.com', phone: '11988887777' },
    cv: { available: true, url: 'https://storage.example.com/signed/cv.pdf', uploadedAt: new Date() },
    appliedAt: new Date('2026-07-01T15:30:00Z'),
    viaEncaminhamento: false,
    ...overrides,
  };
}

describe('JobApplicantsList', () => {
  it('USP027-08: lista vazia mostra "Nenhuma candidatura ativa"', () => {
    render(<JobApplicantsList applicants={[]} />);
    expect(screen.getByText('Nenhuma candidatura ativa.')).toBeInTheDocument();
  });

  it('USP027-01: renderiza nome, contato e link do CV do candidato', () => {
    render(<JobApplicantsList applicants={[applicant()]} />);
    expect(screen.getByText('Maria Candidata')).toBeInTheDocument();
    expect(screen.getByText('maria@example.com')).toBeInTheDocument();
    expect(screen.getByText('11988887777')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver currículo' })).toHaveAttribute(
      'href',
      'https://storage.example.com/signed/cv.pdf',
    );
  });

  it('USP027-02: exibe o badge de encaminhamento quando viaEncaminhamento=true', () => {
    render(<JobApplicantsList applicants={[applicant({ viaEncaminhamento: true })]} />);
    expect(screen.getByText('Candidato encaminhado pela ASONSEG')).toBeInTheDocument();
  });

  it('não exibe o badge quando viaEncaminhamento=false', () => {
    render(<JobApplicantsList applicants={[applicant({ viaEncaminhamento: false })]} />);
    expect(screen.queryByText('Candidato encaminhado pela ASONSEG')).not.toBeInTheDocument();
  });

  it('edge: telefone null exibe "não informado" sem quebrar', () => {
    render(<JobApplicantsList applicants={[applicant({ contact: { email: 'maria@example.com', phone: null } })]} />);
    expect(screen.getByText('não informado')).toBeInTheDocument();
  });

  it('edge: CV indisponível exibe "Currículo não disponível" em vez de link', () => {
    render(
      <JobApplicantsList
        applicants={[applicant({ cv: { available: false, url: null, uploadedAt: null } })]}
      />,
    );
    expect(screen.getByText('Currículo não disponível')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver currículo' })).not.toBeInTheDocument();
  });
});
