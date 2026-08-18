// Unit do ModerationContentDetails (USP-066 / T7 / E-002..E-004 / P-003). RTL + jsdom.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModerationContentDetails } from '../moderation-content-details';
import type { ModerationContentView } from '../../views/moderation-content';

const jobView: ModerationContentView = {
  kind: 'JOB',
  title: 'Analista de RH',
  description: 'Descrição integral da vaga',
  requirements: 'Requisitos completos',
  salaryRange: 'R$ 3.000 – R$ 4.000',
  workRegime: 'Presencial',
  contractType: 'CLT',
  educationLevelRequired: 'Ensino médio',
  location: 'Belo Horizonte',
  area: 'Recursos Humanos',
  region: 'Zona Norte',
  companyName: 'ACME',
};

const serviceView: ModerationContentView = {
  kind: 'SERVICE',
  title: 'Reforma elétrica',
  description: 'Descrição integral do serviço',
  category: 'Elétrica',
  serviceArea: 'Centro',
  availability: 'Seg a sex, 8h-18h',
  priceRange: 'R$ 100 – R$ 200 (por hora)',
  photos: ['https://cdn.example/svc/1.jpg', 'https://cdn.example/svc/2.jpg'],
};

const candidateView: ModerationContentView = {
  kind: 'CANDIDATE_PROFILE',
  headline: 'Analista de dados',
  educationLevel: 'Superior completo',
  educationArea: 'Estatística',
  experience: 'Experiência integral',
  skills: 'Excel, SQL, Python',
  courses: 'Curso de Power BI',
  cvUrl: 'https://storage/cv.pdf',
};

describe('ModerationContentDetails (T7)', () => {
  it('E-002: renderiza os campos de JOB', () => {
    render(<ModerationContentDetails view={jobView} />);
    // B3 (PR#294): título é um campo de E-002 e agora é renderizado no
    // próprio painel (antes só aparecia no card da fila, fora do componente).
    expect(screen.getByRole('heading', { name: 'Analista de RH' })).toBeInTheDocument();
    expect(screen.getByText('Descrição integral da vaga')).toBeInTheDocument();
    expect(screen.getByText('Requisitos completos')).toBeInTheDocument();
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('R$ 3.000 – R$ 4.000')).toBeInTheDocument();
    expect(screen.getByText('Presencial')).toBeInTheDocument();
    expect(screen.getByText('CLT')).toBeInTheDocument();
    expect(screen.getByText('Belo Horizonte')).toBeInTheDocument();
    expect(screen.getByText('Recursos Humanos')).toBeInTheDocument();
    expect(screen.getByText('Zona Norte')).toBeInTheDocument();
  });

  it('E-003: renderiza os campos de SERVICE, incluindo as fotos', () => {
    render(<ModerationContentDetails view={serviceView} />);
    // B3 (PR#294): título é um campo de E-003 e agora é renderizado no painel.
    expect(screen.getByRole('heading', { name: 'Reforma elétrica' })).toBeInTheDocument();
    expect(screen.getByText('Descrição integral do serviço')).toBeInTheDocument();
    expect(screen.getByText('Elétrica')).toBeInTheDocument();
    expect(screen.getByText('Centro')).toBeInTheDocument();
    expect(screen.getByText('Seg a sex, 8h-18h')).toBeInTheDocument();
    expect(screen.getByText('R$ 100 – R$ 200 (por hora)')).toBeInTheDocument();
    const photos = screen.getAllByAltText('Foto do serviço');
    expect(photos).toHaveLength(2);
    expect(photos[0]).toHaveAttribute('src', 'https://cdn.example/svc/1.jpg');
    // C5 (PR#294 rodada 2) — objeto original do bucket público (até 5 MiB)
    // pintado num quadrado de 96px, em painéis que se acumulam por item;
    // `lazy`+`async` adiam decodificação de fotos fora da viewport.
    for (const photo of photos) {
      expect(photo).toHaveAttribute('loading', 'lazy');
      expect(photo).toHaveAttribute('decoding', 'async');
    }
  });

  it('E-003: sem fotos, nenhuma <img> é renderizada', () => {
    render(<ModerationContentDetails view={{ ...serviceView, photos: [] }} />);
    expect(screen.queryByAltText('Foto do serviço')).not.toBeInTheDocument();
  });

  it('E-004: renderiza os campos de CANDIDATE_PROFILE + link de CV quando cvUrl presente', () => {
    render(<ModerationContentDetails view={candidateView} />);
    expect(screen.getByText('Analista de dados')).toBeInTheDocument();
    expect(screen.getByText('Superior completo')).toBeInTheDocument();
    expect(screen.getByText('Estatística')).toBeInTheDocument();
    expect(screen.getByText('Experiência integral')).toBeInTheDocument();
    expect(screen.getByText('Excel, SQL, Python')).toBeInTheDocument();
    expect(screen.getByText('Curso de Power BI')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Abrir CV em nova aba' });
    expect(link).toHaveAttribute('href', 'https://storage/cv.pdf');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('E-004/E-006: cvUrl ausente ⇒ nota "CV não anexado" (sem link)', () => {
    render(<ModerationContentDetails view={{ ...candidateView, cvUrl: null }} />);
    expect(screen.getByText('CV não anexado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir CV em nova aba' })).not.toBeInTheDocument();
  });

  it('P-003: conteúdo longo (5.000 caracteres) aparece integralmente na saída, sem truncar', () => {
    const longText = 'Parágrafo de teste. '.repeat(250); // ~5.000 chars
    render(<ModerationContentDetails view={{ ...jobView, description: longText }} />);
    const el = screen.getByText((_, node) => node?.textContent === longText);
    expect(el.textContent).toHaveLength(longText.length);
    expect(el).toHaveClass('whitespace-pre-wrap');
  });
});
