// Unit do componente cliente da fila (#123) — estados e ramos de UI (E-001..E-004,
// P-003) com as Server Actions de decisão mockadas. RTL + jsdom.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const decide = vi.hoisted(() => ({
  approveContent: vi.fn(),
  returnForAdjustments: vi.fn(),
  rejectContent: vi.fn(),
}));

vi.mock('../../actions/decide', () => ({
  approveContent: (...a: unknown[]) => decide.approveContent(...a),
  returnForAdjustments: (...a: unknown[]) => decide.returnForAdjustments(...a),
  rejectContent: (...a: unknown[]) => decide.rejectContent(...a),
}));

const { ModerationQueue } = await import('../moderation-queue');
const { ContentKind } = await import('../../domain/content-status');

const baseRow = {
  contentKind: ContentKind.JOB,
  contentId: 'c1',
  title: 'Vaga de Auxiliar',
  authorName: 'Maria da Silva',
  submittedAtLabel: '01/06/2026 às 09:00',
};
const MOTIVO = 'Faltou descrever as atividades exercidas no cargo anterior';

beforeEach(() => {
  vi.clearAllMocks();
  decide.approveContent.mockResolvedValue({ ok: true });
  decide.returnForAdjustments.mockResolvedValue({ ok: true });
  decide.rejectContent.mockResolvedValue({ ok: true });
});

describe('ModerationQueue', () => {
  it('fila vazia (sem decisões): mensagem de fila vazia', () => {
    render(<ModerationQueue items={[]} />);
    expect(screen.getByText(/não há rascunhos aguardando moderação/i)).toBeInTheDocument();
  });

  it('renderiza o item com tipo, título, autor e data; sem badge quando Empresa não marcada', () => {
    const { unmount } = render(<ModerationQueue items={[baseRow]} />);
    expect(screen.getByText('Vaga')).toBeInTheDocument();
    expect(screen.getByText('Vaga de Auxiliar')).toBeInTheDocument();
    expect(screen.getByText(/Maria da Silva/)).toBeInTheDocument();
    expect(screen.queryByText(/empresa não verificada/i)).not.toBeInTheDocument();
    unmount();
  });

  it('badge "Empresa não verificada" aparece quando companyUnverified', () => {
    render(<ModerationQueue items={[{ ...baseRow, companyUnverified: true }]} />);
    expect(screen.getByText(/empresa não verificada/i)).toBeInTheDocument();
  });

  it('autor nulo aparece como travessão', () => {
    render(<ModerationQueue items={[{ ...baseRow, authorName: null }]} />);
    expect(screen.getByText(/Autor:/)).toHaveTextContent('—');
  });

  it('aprovar: chama approveContent, remove o item e mostra a confirmação', async () => {
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() =>
      expect(decide.approveContent).toHaveBeenCalledWith({
        contentKind: ContentKind.JOB,
        contentId: 'c1',
      }),
    );
    await waitFor(() => expect(screen.getByText(/rascunho\(s\) processado\(s\)/i)).toBeInTheDocument());
  });

  it('devolver: motivo curto bloqueia com erro e NÃO chama a action; motivo válido confirma', async () => {
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /devolver para ajustes/i }));

    const textarea = screen.getByLabelText(/motivo da devolução/i);
    fireEvent.change(textarea, { target: { value: 'curto' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/ao menos 20 caracteres/i));
    expect(decide.returnForAdjustments).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: MOTIVO } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() =>
      expect(decide.returnForAdjustments).toHaveBeenCalledWith({
        contentKind: ContentKind.JOB,
        contentId: 'c1',
        justification: MOTIVO,
      }),
    );
  });

  it('rejeitar: motivo válido chama rejectContent', async () => {
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /rejeitar/i }));
    fireEvent.change(screen.getByLabelText(/motivo da rejeição/i), { target: { value: MOTIVO } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() =>
      expect(decide.rejectContent).toHaveBeenCalledWith({
        contentKind: ContentKind.JOB,
        contentId: 'c1',
        justification: MOTIVO,
      }),
    );
  });

  it('cancelar fecha o formulário de motivo e volta às ações', () => {
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /devolver para ajustes/i }));
    expect(screen.getByLabelText(/motivo da devolução/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByLabelText(/motivo da devolução/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
  });

  it('erro da Server Action: mostra o alerta e mantém o item na fila', async () => {
    decide.approveContent.mockResolvedValue({ ok: false, error: { message: 'Falhou aqui' } });
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Falhou aqui'));
    expect(screen.getByText('Vaga de Auxiliar')).toBeInTheDocument(); // segue na fila
  });

  it('erro sem mensagem: usa o fallback genérico', async () => {
    decide.approveContent.mockResolvedValue({ ok: false });
    render(<ModerationQueue items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /aprovar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível concluir/i));
  });
});
