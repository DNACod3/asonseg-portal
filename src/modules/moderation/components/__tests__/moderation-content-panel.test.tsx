// Unit do ModerationContentPanel (USP-066 / T8 / E-001/E-006/P-004). RTL + jsdom.
// Action mockada.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const openModerationContent = vi.hoisted(() => vi.fn());

vi.mock('../../actions/open-content', () => ({
  openModerationContent: (...a: unknown[]) => openModerationContent(...a),
}));

const { ModerationContentPanel } = await import('../moderation-content-panel');
const { ContentKind } = await import('../../domain/content-status');

const jobView = {
  kind: 'JOB',
  title: 'Vaga X',
  description: 'Descrição integral',
  requirements: null,
  salaryRange: null,
  workRegime: null,
  contractType: null,
  educationLevelRequired: null,
  location: null,
  area: null,
  region: null,
  companyName: 'ACME',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ModerationContentPanel (T8)', () => {
  it('P-004: montar o painel NÃO chama openModerationContent (sem auto-carga no mount)', () => {
    render(
      <ModerationContentPanel contentKind={ContentKind.JOB} contentId="c1" onStateChange={vi.fn()} />,
    );
    expect(openModerationContent).not.toHaveBeenCalled();
  });

  it('clicar em "Ver conteúdo" carrega e renderiza os campos (loaded) + onStateChange("loaded")', async () => {
    openModerationContent.mockResolvedValue({ ok: true, data: jobView });
    const onStateChange = vi.fn();
    render(
      <ModerationContentPanel contentKind={ContentKind.JOB} contentId="c1" onStateChange={onStateChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver conteúdo' }));

    await waitFor(() => expect(screen.getByText('Descrição integral')).toBeInTheDocument());
    expect(openModerationContent).toHaveBeenCalledWith({ contentKind: ContentKind.JOB, contentId: 'c1' });
    expect(onStateChange).toHaveBeenCalledWith('loaded');
  });

  it('action fail ⇒ aviso role="alert" + onStateChange("error")', async () => {
    openModerationContent.mockResolvedValue({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Não foi possível carregar o conteúdo deste item.' },
    });
    const onStateChange = vi.fn();
    render(
      <ModerationContentPanel contentKind={ContentKind.JOB} contentId="c2" onStateChange={onStateChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver conteúdo' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível carregar/i));
    expect(onStateChange).toHaveBeenCalledWith('error');
  });

  it('recarregar é permitido após erro (botão vira "Tentar novamente" e dispara de novo)', async () => {
    openModerationContent
      .mockResolvedValueOnce({ ok: false, error: { code: 'NOT_FOUND', message: 'Falhou.' } })
      .mockResolvedValueOnce({ ok: true, data: jobView });
    render(
      <ModerationContentPanel contentKind={ContentKind.JOB} contentId="c3" onStateChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver conteúdo' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByText('Descrição integral')).toBeInTheDocument());
    expect(openModerationContent).toHaveBeenCalledTimes(2);
  });
});
