import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ConsentsPanelItem } from '../components/consents-panel';

const revokeMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock('../actions/revoke-consent', () => ({ revokeConsent: revokeMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));

const { ConsentsPanel } = await import('../components/consents-panel');

function item(over: Partial<ConsentsPanelItem>): ConsentsPanelItem {
  return {
    consentId: 'c1',
    purpose: 'JOB_APPLICATION',
    humanName: 'Candidatura a vagas',
    description: 'desc',
    legalBasis: 'LGPD art. 7º, I',
    termVersion: 'v1.0',
    acceptedAt: new Date('2026-05-01T12:00:00Z'),
    revokedAt: null,
    status: 'vigente',
    termBody: 'Texto do termo aceito',
    ...over,
  };
}

beforeEach(() => {
  revokeMock.mockReset().mockResolvedValue({ ok: true, data: {} });
  refreshMock.mockReset();
});

describe('consents/ConsentsPanel', () => {
  it('separa vigentes de revogados e só oferece revogar nos vigentes', () => {
    render(
      <ConsentsPanel
        items={[
          item({ consentId: 'a', purpose: 'JOB_APPLICATION', humanName: 'Candidatura a vagas' }),
          item({
            consentId: 'b',
            purpose: 'CV_AI_EXTRACTION',
            humanName: 'Extração de currículo por IA',
            status: 'revogado',
            revokedAt: new Date('2026-05-10T12:00:00Z'),
          }),
        ]}
      />,
    );

    const vigentes = screen.getByRole('region', { name: /Consentimentos vigentes/i });
    const revogados = screen.getByRole('region', { name: /Consentimentos revogados/i });
    expect(within(vigentes).getByText('Candidatura a vagas')).toBeInTheDocument();
    expect(within(revogados).getByText('Extração de currículo por IA')).toBeInTheDocument();
    // Revogar só aparece no card vigente.
    expect(within(vigentes).getByRole('button', { name: 'Revogar' })).toBeInTheDocument();
    expect(within(revogados).queryByRole('button', { name: 'Revogar' })).toBeNull();
  });

  it('revogação pede confirmação e dispara a action com a finalidade', async () => {
    render(<ConsentsPanel items={[item({ purpose: 'JOB_APPLICATION' })]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/Tem certeza/i);

    fireEvent.click(screen.getByRole('button', { name: 'Sim, revogar' }));
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith({ purpose: 'JOB_APPLICATION' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it('abre o termo aceito sob demanda', () => {
    render(<ConsentsPanel items={[item({ termBody: 'Conteúdo do termo X' })]} />);
    expect(screen.queryByText('Conteúdo do termo X')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver termo aceito' }));
    expect(screen.getByText('Conteúdo do termo X')).toBeInTheDocument();
  });
});
