// ServiceManagementList — painel de gestão do prestador (USP-032 / T032-5).
// RTL + jsdom. Server Actions de ServiceActions são mockadas — o que se testa
// é a composição (estado vazio, ações por status), não a lógica das actions
// (coberta em lifecycle-service.int.test.ts / edit-service.int.test.ts).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../actions/pause-service', () => ({ pauseService: vi.fn() }));
vi.mock('../actions/resume-service', () => ({ resumeService: vi.fn() }));
vi.mock('../actions/archive-service', () => ({ archiveService: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { ServiceManagementList } = await import('../components/service-management-list');
const { viewProviderServiceRow } = await import('../views/provider-service-row.view');

describe('ServiceManagementList — estado vazio', () => {
  it('sem serviços, mostra CTA para publicar', () => {
    render(<ServiceManagementList rows={[]} />);
    expect(screen.getByText(/ainda não publicou nenhum serviço/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /publicar serviço/i })).toHaveAttribute(
      'href',
      '/prestador/servicos/nova',
    );
  });
});

describe('ServiceManagementList — ações por status (USP-032)', () => {
  it('ACTIVE: mostra badge "Ativo", link Editar e botões Pausar/Arquivar', () => {
    const row = viewProviderServiceRow({
      id: 's-1',
      title: 'Jardinagem residencial',
      status: 'ACTIVE' as never,
      publishedAt: new Date('2026-07-01T12:00:00Z'),
      lastStatusChangeAt: new Date(),
    });
    render(<ServiceManagementList rows={[row]} />);

    expect(screen.getByText('Jardinagem residencial')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /editar/i })).toHaveAttribute(
      'href',
      '/prestador/servicos/s-1/editar',
    );
    expect(screen.getByRole('button', { name: /pausar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arquivar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retomar/i })).not.toBeInTheDocument();
  });

  it('PAUSED: mostra badge "Pausado", sem link Editar, com botão Retomar/Arquivar', () => {
    const row = viewProviderServiceRow({
      id: 's-2',
      title: 'Encanador',
      status: 'PAUSED' as never,
      publishedAt: new Date('2026-07-01T12:00:00Z'),
      lastStatusChangeAt: new Date(),
    });
    render(<ServiceManagementList rows={[row]} />);

    expect(screen.getByText('Pausado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retomar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /arquivar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pausar$/i })).not.toBeInTheDocument();
  });

  it('IN_MODERATION: nenhuma ação de ciclo de vida disponível (fora do escopo desta US)', () => {
    const row = viewProviderServiceRow({
      id: 's-3',
      title: 'Aulas de reforço',
      status: 'IN_MODERATION' as never,
      publishedAt: null,
      lastStatusChangeAt: new Date(),
    });
    render(<ServiceManagementList rows={[row]} />);

    expect(screen.getByText('Em moderação')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pausar|retomar|arquivar/i })).not.toBeInTheDocument();
  });
});
