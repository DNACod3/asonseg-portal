// Unit do componente cliente da superfície de conteúdo publicado (USP-018 / T8 /
// INACT-06) — estados e ramos de UI com inactivateContent mockado. RTL + jsdom.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const inactivateContent = vi.fn();

vi.mock('../../actions/inactivate', () => ({
  inactivateContent: (...a: unknown[]) => inactivateContent(...a),
}));

const { PublishedContentManager } = await import('../published-content-manager');
const { ContentKind } = await import('../../domain/content-status');

const baseRow = {
  contentId: 'job-1',
  title: 'Atendente de Balcão',
  companyName: 'Padaria do Zé',
  areaName: 'Comércio',
  publishedAtLabel: '01/06/2026 às 09:00',
};
const MOTIVO = 'Vaga enganosa, empresa não localizada no endereço informado';

beforeEach(() => {
  vi.clearAllMocks();
  inactivateContent.mockResolvedValue({ ok: true });
});

describe('PublishedContentManager', () => {
  it('lista vazia: mensagem de "não há vagas publicadas"', () => {
    render(<PublishedContentManager items={[]} />);
    expect(screen.getByText(/não há vagas publicadas/i)).toBeInTheDocument();
  });

  it('renderiza a vaga com empresa, área, título e data de publicação', () => {
    render(<PublishedContentManager items={[baseRow]} />);
    expect(screen.getByText('Padaria do Zé')).toBeInTheDocument();
    expect(screen.getByText('Comércio')).toBeInTheDocument();
    expect(screen.getByText('Atendente de Balcão')).toBeInTheDocument();
    expect(screen.getByText(/Publicada em 01\/06\/2026/)).toBeInTheDocument();
  });

  it('clicar em "Inativar" abre o campo de motivo; motivo curto bloqueia sem chamar a action', async () => {
    render(<PublishedContentManager items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /inativar/i }));

    const textarea = screen.getByLabelText(/motivo da inativação/i);
    fireEvent.change(textarea, { target: { value: 'curto' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/ao menos 20 caracteres/i));
    expect(inactivateContent).not.toHaveBeenCalled();
  });

  it('motivo válido confirma: chama inactivateContent e remove o item da lista', async () => {
    render(<PublishedContentManager items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /inativar/i }));
    fireEvent.change(screen.getByLabelText(/motivo da inativação/i), { target: { value: MOTIVO } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() =>
      expect(inactivateContent).toHaveBeenCalledWith({
        contentKind: ContentKind.JOB,
        contentId: 'job-1',
        justification: MOTIVO,
      }),
    );
    await waitFor(() => expect(screen.getByText(/vaga\(s\) inativada\(s\)/i)).toBeInTheDocument());
  });

  it('cancelar fecha o campo de motivo e volta ao botão "Inativar"', () => {
    render(<PublishedContentManager items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /inativar/i }));
    expect(screen.getByLabelText(/motivo da inativação/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByLabelText(/motivo da inativação/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inativar/i })).toBeInTheDocument();
  });

  it('erro da Server Action: mostra o alerta e mantém a vaga na lista', async () => {
    inactivateContent.mockResolvedValue({ ok: false, error: { message: 'Já foi inativada por outra decisão' } });
    render(<PublishedContentManager items={[baseRow]} />);
    fireEvent.click(screen.getByRole('button', { name: /inativar/i }));
    fireEvent.change(screen.getByLabelText(/motivo da inativação/i), { target: { value: MOTIVO } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Já foi inativada por outra decisão'),
    );
    expect(screen.getByText('Atendente de Balcão')).toBeInTheDocument(); // segue na lista
  });
});
