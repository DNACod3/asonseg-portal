// Unit do painel de verificação de Empresa (USP-017 / #157) — E-001/E-004/P-001/
// P-002/P-003/D-005/D-006. RTL + jsdom.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { VerificationPanel, type VerificationPanelData } from '../verification-panel';
import type { VerificationChecklistItem } from '../../domain/verification-checklist';

const CHECKLIST: VerificationChecklistItem[] = [
  { id: 'a', label: 'Conferir item A da verificação' },
  { id: 'b', label: 'Conferir item B da verificação' },
];

const baseData: VerificationPanelData = {
  companyId: 'co-1',
  cnpj: '11444777000133',
  razaoSocial: 'Empresa Verif Ltda',
  nomeFantasia: 'Empresa Verif',
  setor: 'Comércio',
  endereco: 'Rua A, 100',
  isVerified: false,
  verifiedAtLabel: null,
  verifiedByName: null,
  rejectionCount: 0,
  changedSinceVerification: [],
  rejections: [],
};

function renderPanel(over: Partial<VerificationPanelData> = {}, onReady = vi.fn()) {
  render(
    <VerificationPanel
      data={{ ...baseData, ...over }}
      checklistItems={CHECKLIST}
      onReadinessChange={onReady}
    />,
  );
  return onReady;
}

describe('VerificationPanel', () => {
  it('E-001: Empresa não verificada exibe banner de 1ª vaga, dados e checklist', () => {
    renderPanel();
    expect(screen.getByText(/primeira vaga desta empresa/i)).toBeInTheDocument();
    expect(screen.getByText('11444777000133')).toBeInTheDocument();
    expect(screen.getByText('Empresa Verif Ltda')).toBeInTheDocument();
    expect(screen.getByText(/checklist de verificação/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /item A da verificação/i })).toBeInTheDocument();
  });

  it('P-002: o painel é uma seção própria "Verificação da Empresa"', () => {
    renderPanel();
    expect(screen.getByRole('region', { name: /verificação da empresa/i })).toBeInTheDocument();
  });

  it('P-001: aprovação bloqueada (ready=false) até todos os itens serem resolvidos', async () => {
    const onReady = renderPanel();
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(false));

    fireEvent.click(screen.getByRole('checkbox', { name: /item A da verificação/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /item B da verificação/i }));

    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
  });

  it('P-001: item dispensado sem motivo NÃO libera; com motivo libera', async () => {
    const onReady = renderPanel();
    // Marca A; dispensa B.
    fireEvent.click(screen.getByRole('checkbox', { name: /item A da verificação/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /não se aplica/i }));
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(false)); // dispensa sem motivo

    fireEvent.change(screen.getByLabelText(/motivo da dispensa: conferir item B/i), {
      target: { value: 'Não há endereço físico (empresa digital)' },
    });
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(true));
  });

  it('E-004: Empresa já verificada exibe "verificada em ... por ..." e oculta a checklist', () => {
    const onReady = renderPanel({
      isVerified: true,
      verifiedAtLabel: '10/06/2026 às 14:30',
      verifiedByName: 'Ana Coordenadora',
    });
    expect(screen.getByText(/empresa verificada em 10\/06\/2026 às 14:30 por ana coordenadora/i)).toBeInTheDocument();
    expect(screen.queryByText(/checklist de verificação/i)).not.toBeInTheDocument();
    expect(onReady).toHaveBeenCalledWith(true); // não exige checklist
  });

  it('P-003/D-005: rejeições exibem badge e histórico (quando/quem/motivo)', () => {
    renderPanel({
      rejectionCount: 2,
      rejections: [
        { rejectedAtLabel: '02/06/2026 às 10:00', byName: 'João', reason: 'CNPJ inexistente' },
        { rejectedAtLabel: '01/06/2026 às 09:00', byName: 'Ana', reason: 'Endereço incompatível' },
      ],
    });
    expect(screen.getByText(/rejeitada 2 vezes/i)).toBeInTheDocument();
    const history = screen.getByText(/rejeitada 2 vezes/i).closest('details') as HTMLElement;
    expect(within(history).getByText(/CNPJ inexistente/)).toBeInTheDocument();
    expect(within(history).getByText(/João/)).toBeInTheDocument();
    expect(within(history).getByText(/Endereço incompatível/)).toBeInTheDocument();
  });

  it('D-006: campos alterados desde a verificação anterior são destacados', () => {
    renderPanel({ changedSinceVerification: ['razaoSocial', 'endereco'] });
    expect(screen.getByText(/empresa editada após a verificação anterior/i)).toBeInTheDocument();
    expect(screen.getByText(/alterado desde a última verificação/i)).toHaveTextContent(/Razão social/);
    expect(screen.getByText(/alterado desde a última verificação/i)).toHaveTextContent(/Endereço/);
  });
});
