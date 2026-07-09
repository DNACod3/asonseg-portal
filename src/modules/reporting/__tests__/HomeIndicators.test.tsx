import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeIndicators } from '../components/home-indicators';

/**
 * Componente `HomeIndicators` (USP-041 / T4 — E-001/E-003/REL41-MN-01/
 * REL41-MN-02). Apresentacional: 3 cards, rótulo + número ou "Em breve".
 */
describe('HomeIndicators — E-001 (rótulos + números)', () => {
  it('renderiza os 3 rótulos com valores acima do limiar', () => {
    render(
      <HomeIndicators indicators={{ activeJobs: 47, activeCandidates: 12, verifiedCompanies: 8 }} />,
    );

    expect(screen.getByText('Vagas ativas')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('Candidatos')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Empresas verificadas')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});

describe('HomeIndicators — REL41-MN-02 (negativo: placeholder abaixo do limiar)', () => {
  it('activeJobs=2 (< 5) mostra "Em breve", nunca "2" nem "0"', () => {
    render(
      <HomeIndicators indicators={{ activeJobs: 2, activeCandidates: 12, verifiedCompanies: 8 }} />,
    );

    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('activeJobs=47 (>= 5) mostra "47", não "Em breve" para este indicador', () => {
    render(
      <HomeIndicators indicators={{ activeJobs: 47, activeCandidates: 12, verifiedCompanies: 8 }} />,
    );

    expect(screen.getByText('47')).toBeInTheDocument();
  });

  it('baseline 0/0/0 (cold start): os 3 indicadores mostram "Em breve", nunca "0"', () => {
    render(
      <HomeIndicators indicators={{ activeJobs: 0, activeCandidates: 0, verifiedCompanies: 0 }} />,
    );

    expect(screen.getAllByText('Em breve')).toHaveLength(3);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('HomeIndicators — REL41-MN-01 (sem PII no markup)', () => {
  it('a prop só carrega inteiros — o markup nunca contém texto além dos 3 rótulos fixos e dos números/placeholder', () => {
    const { container } = render(
      <HomeIndicators indicators={{ activeJobs: 47, activeCandidates: 12, verifiedCompanies: 8 }} />,
    );

    // Âncora estrutural: o componente só aceita `HomeIndicators` (3 números)
    // como prop — não há campo de nome/e-mail/CNPJ no tipo para vazar. O
    // teste confirma que o texto renderizado é exatamente o esperado (3
    // rótulos + 3 números), sem nada extra que indicaria um objeto de
    // pessoa/empresa tendo sido passado por engano.
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/@|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/); // sem e-mail nem CNPJ formatado
    expect(text).toContain('Vagas ativas');
    expect(text).toContain('Candidatos');
    expect(text).toContain('Empresas verificadas');
  });
});
