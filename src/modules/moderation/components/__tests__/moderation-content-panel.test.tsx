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

  it('C7 (PR#294 rodada 2): após carregado, "Recarregar conteúdo" refaz a chamada e atualiza o view (URL assinada renovada)', async () => {
    const candidateViewV1 = {
      kind: 'CANDIDATE_PROFILE',
      headline: 'Analista',
      educationLevel: null,
      educationArea: null,
      experience: null,
      skills: null,
      courses: null,
      cvUrl: 'https://storage/cv.pdf?token=v1',
    };
    const candidateViewV2 = { ...candidateViewV1, cvUrl: 'https://storage/cv.pdf?token=v2' };
    openModerationContent
      .mockResolvedValueOnce({ ok: true, data: candidateViewV1 })
      .mockResolvedValueOnce({ ok: true, data: candidateViewV2 });
    const onStateChange = vi.fn();
    render(
      <ModerationContentPanel
        contentKind={ContentKind.CANDIDATE_PROFILE}
        contentId="cand-1"
        onStateChange={onStateChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver conteúdo' }));
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /abrir cv/i })).toHaveAttribute(
        'href',
        'https://storage/cv.pdf?token=v1',
      ),
    );
    expect(screen.getByText(/expira em 5 minutos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recarregar conteúdo' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /abrir cv/i })).toHaveAttribute(
        'href',
        'https://storage/cv.pdf?token=v2',
      ),
    );
    expect(openModerationContent).toHaveBeenCalledTimes(2);
  });

  it('C7 (PR#294 rodada 2): o aviso de expiração do link só aparece para CANDIDATE_PROFILE com cvUrl (JOB não exibe)', async () => {
    openModerationContent.mockResolvedValue({ ok: true, data: jobView });
    render(
      <ModerationContentPanel contentKind={ContentKind.JOB} contentId="c1" onStateChange={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver conteúdo' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Recarregar conteúdo' })).toBeInTheDocument());
    expect(screen.queryByText(/expira em 5 minutos/i)).not.toBeInTheDocument();
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
