// CompanyJobList — motivo da devolução visível + remoção do Link morto de canSubmit
// (USP-054 / EMP-2 / MOD-3 / T7). RTL + jsdom. `CompanyJobActions` (client, com suas
// próprias Server Actions) é mockado — o que se testa aqui é a composição da lista:
// o que é `Link` (Editar) vs. o que é ação direta (Enviar/Reenviar, delegado ao mock).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentStatus } from '@/modules/moderation';
import type { CompanyJobRowView } from '../views/company-job-row.view';

vi.mock('../components/company-job-actions', () => ({
  CompanyJobActions: ({ status }: { status?: string }) => (
    <div data-testid="company-job-actions">{status}</div>
  ),
}));

const { CompanyJobList } = await import('../components/company-job-list');

const NO_ACTIONS = {
  canEdit: false,
  canSubmit: false,
  canPause: false,
  canUnpause: false,
  canArchive: false,
  canExtend: false,
};

function baseRow(overrides: Partial<CompanyJobRowView> = {}): CompanyJobRowView {
  return {
    id: 'job-1',
    title: 'Vaga Teste',
    status: ContentStatus.DRAFT,
    statusLabel: 'Rascunho',
    badgeVariant: 'gray',
    validUntil: null,
    publishedAt: null,
    actions: NO_ACTIONS,
    expiraEmDias: null,
    returnReason: null,
    ...overrides,
  };
}

describe('CompanyJobList — Editar continua Link; Enviar/Reenviar não é mais Link (USP-054/EMP-2)', () => {
  it('canEdit → renderiza um Link "Editar" para a rota de edição', () => {
    render(<CompanyJobList empresaId="empresa-1" rows={[baseRow({ actions: { ...NO_ACTIONS, canEdit: true } })]} />);
    const link = screen.getByRole('link', { name: 'Editar' });
    expect(link).toHaveAttribute('href', '/empresa/empresa-1/vagas/job-1/editar');
  });

  it('canSubmit → NÃO renderiza mais o Link morto para "Enviar para moderação" (delegado a CompanyJobActions)', () => {
    render(<CompanyJobList empresaId="empresa-1" rows={[baseRow({ actions: { ...NO_ACTIONS, canSubmit: true } })]} />);
    expect(screen.queryByRole('link', { name: /moderação/i })).not.toBeInTheDocument();
  });

  it('passa o status da linha para CompanyJobActions (rótulo do botão de submit)', () => {
    render(<CompanyJobList empresaId="empresa-1" rows={[baseRow({ status: ContentStatus.AWAITING_ADJUSTMENTS })]} />);
    expect(screen.getByTestId('company-job-actions')).toHaveTextContent('AWAITING_ADJUSTMENTS');
  });
});

describe('CompanyJobList — motivo da devolução (USP-054/MOD-3)', () => {
  it('USP054-07: AWAITING_ADJUSTMENTS com returnReason → exibe o motivo', () => {
    render(
      <CompanyJobList
        empresaId="empresa-1"
        rows={[baseRow({ status: ContentStatus.AWAITING_ADJUSTMENTS, returnReason: 'Falta a descrição completa' })]}
      />,
    );
    expect(screen.getByText(/Falta a descrição completa/)).toBeInTheDocument();
  });

  it('USP054-E2: AWAITING_ADJUSTMENTS sem returnReason → fallback "Sem motivo registrado", sem quebrar', () => {
    render(
      <CompanyJobList
        empresaId="empresa-1"
        rows={[baseRow({ status: ContentStatus.AWAITING_ADJUSTMENTS, returnReason: null })]}
      />,
    );
    expect(screen.getByText(/Sem motivo registrado/)).toBeInTheDocument();
  });

  it('USP054-10: vaga fora de AWAITING_ADJUSTMENTS (ex. DRAFT) → nenhum bloco de motivo', () => {
    render(<CompanyJobList empresaId="empresa-1" rows={[baseRow({ status: ContentStatus.DRAFT, returnReason: null })]} />);
    expect(screen.queryByText(/motivo da devolução/i)).not.toBeInTheDocument();
  });
});
