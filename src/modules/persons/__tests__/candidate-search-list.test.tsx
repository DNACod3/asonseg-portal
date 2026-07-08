import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidateSearchList } from '../components/candidate-search-list';
import type { SearchCandidateView } from '../views/view-candidate-for-search';

/**
 * Componente de apresentação da busca ativa de candidatos (USP-028 / T5). Consome
 * só `SearchCandidateView[]` — o teste garante que renderiza os campos do View
 * Model (primeiro nome, localização, escolaridade, resumo) e o estado vazio.
 */

function item(overrides: Partial<SearchCandidateView> = {}): SearchCandidateView {
  return {
    candidatePersonId: 'candidate-1',
    firstName: 'Maria',
    primaryArea: 'Administração',
    educationLevel: 'ENSINO_MEDIO',
    educationLevelLabel: 'Ensino Médio',
    location: 'Florianópolis — Ingleses',
    availability: 'Período integral',
    qualificationsSummary: 'Auxiliar administrativo com 3 anos de experiência',
    ...overrides,
  };
}

describe('CandidateSearchList', () => {
  it('USP028-07: lista vazia mostra "Nenhum candidato encontrado"', () => {
    render(<CandidateSearchList items={[]} />);
    expect(screen.getByText('Nenhum candidato encontrado.')).toBeInTheDocument();
  });

  it('USP028-03: renderiza primeiro nome, área, localização, escolaridade e resumo', () => {
    render(<CandidateSearchList items={[item()]} />);
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('Administração')).toBeInTheDocument();
    expect(screen.getByText('Florianópolis — Ingleses')).toBeInTheDocument();
    expect(screen.getByText('Ensino Médio')).toBeInTheDocument();
    expect(
      screen.getByText('Auxiliar administrativo com 3 anos de experiência'),
    ).toBeInTheDocument();
  });

  it('edge: região null exibe "Região não informada"', () => {
    render(<CandidateSearchList items={[item({ location: null })]} />);
    expect(screen.getByText('Região não informada')).toBeInTheDocument();
  });

  it('branch: campos opcionais ausentes (área/escolaridade/resumo null) não quebram o card', () => {
    render(
      <CandidateSearchList
        items={[item({ primaryArea: null, educationLevelLabel: null, qualificationsSummary: null })]}
      />,
    );
    expect(screen.getByText('Maria')).toBeInTheDocument();
  });
});
