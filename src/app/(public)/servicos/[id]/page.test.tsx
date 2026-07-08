import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Testes de componente da rota pública `/servicos/[id]` (USP-031 / T031-3).
 * Server Component: `getActiveServiceDetail`/`getCurrentPerson` mockados.
 * Cobre: AC-031-1 (render de campos públicos), AC-031-4 (disclaimer), CTA seam
 * autenticado (AC-031-3), anônimo sem contato (AC-031-2/SVC031-MN-01).
 */

const guardState = vi.hoisted(() => ({
  getCurrentPerson: vi.fn(),
  getActiveServiceDetail: vi.fn(),
  getMyActiveServiceInterest: vi.fn(),
  getProviderContactForService: vi.fn(),
}));

vi.mock('@/modules/identity', () => ({
  getCurrentPerson: (...a: unknown[]) => guardState.getCurrentPerson(...a),
}));

// ManifestInterestButton (USP-033) usa useRouter() no bloco autenticado sem interesse.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

vi.mock('@/modules/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/services')>();
  return {
    ...actual,
    getActiveServiceDetail: (...a: unknown[]) => guardState.getActiveServiceDetail(...a),
    getMyActiveServiceInterest: (...a: unknown[]) => guardState.getMyActiveServiceInterest(...a),
    getProviderContactForService: (...a: unknown[]) => guardState.getProviderContactForService(...a),
  };
});

const { default: ServicoDetalhePage } = await import('./page');

const ROW = {
  id: 'service-1',
  title: 'Jardinagem residencial',
  description: 'Poda e manutenção de jardins.',
  priceMin: null,
  priceMax: null,
  priceUnit: null,
  availabilityDescription: 'Segunda a sexta.',
  publishedAt: new Date('2026-07-01T12:00:00Z'),
  category: { name: 'Jardinagem' },
  region: { name: 'Centro' },
  photos: [],
  author: { fullName: 'João da Silva' },
  company: null,
};

const params = Promise.resolve({ id: 'service-1' });

beforeEach(() => {
  vi.clearAllMocks();
  guardState.getCurrentPerson.mockResolvedValue(null);
  guardState.getActiveServiceDetail.mockResolvedValue(null);
  guardState.getMyActiveServiceInterest.mockResolvedValue(null);
  guardState.getProviderContactForService.mockResolvedValue(null);
});

describe('ServicoDetalhePage — AC-031-1: render de campos públicos', () => {
  it('serviço ACTIVE: mostra título, nome do prestador, categoria/região e descrição', async () => {
    guardState.getActiveServiceDetail.mockResolvedValue(ROW);

    const ui = await ServicoDetalhePage({ params });
    render(ui);

    expect(screen.getByRole('heading', { name: 'Jardinagem residencial' })).toBeInTheDocument();
    expect(screen.getByText('João da Silva')).toBeInTheDocument();
    expect(screen.getByText('Jardinagem')).toBeInTheDocument();
    expect(screen.getByText('Centro')).toBeInTheDocument();
    expect(screen.getByText('Poda e manutenção de jardins.')).toBeInTheDocument();
  });

  it('serviço não-ativo (null): mostra estado indisponível, não 404', async () => {
    guardState.getActiveServiceDetail.mockResolvedValue(null);

    const ui = await ServicoDetalhePage({ params });
    render(ui);

    expect(screen.getByRole('heading', { name: /serviço indisponível/i })).toBeInTheDocument();
  });
});

describe('ServicoDetalhePage — AC-031-4: disclaimer', () => {
  it('exibe o termo de isenção da ASONSEG mesmo quando o serviço está indisponível', async () => {
    guardState.getActiveServiceDetail.mockResolvedValue(null);

    const ui = await ServicoDetalhePage({ params });
    render(ui);

    expect(screen.getByText(/apenas plataforma de conexão/i)).toBeInTheDocument();
  });
});

describe('ServicoDetalhePage — CTA seam (AC-031-3) e anônimo sem contato (SVC031-MN-01)', () => {
  it('anônimo: CTA aponta para criar conta, e nenhum contato é exibido', async () => {
    guardState.getCurrentPerson.mockResolvedValue(null);
    guardState.getActiveServiceDetail.mockResolvedValue(ROW);

    const ui = await ServicoDetalhePage({ params });
    const { container } = render(ui);

    expect(screen.getByRole('link', { name: /criar conta para entrar em contato/i })).toBeInTheDocument();
    // Regra de negócio (SVC031-MN-01): a página não pode expor telefone/e-mail.
    // Exclui o `<script>` JSON-LD (schema.org usa `@type`/`@context`, não é contato)
    // e checa apenas o texto visível.
    const bodyWithoutScripts = container.cloneNode(true) as HTMLElement;
    bodyWithoutScripts.querySelectorAll('script').forEach((s) => s.remove());
    expect(bodyWithoutScripts.textContent).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    expect(bodyWithoutScripts.textContent).not.toMatch(/\(\d{2}\)\s?\d{4,5}-\d{4}/);
  });

  it('autenticado: CTA "Entrar em contato" presente (afordância, sem revelação real)', async () => {
    guardState.getCurrentPerson.mockResolvedValue({ id: 'viewer-1', roles: ['CLIENT'] });
    guardState.getActiveServiceDetail.mockResolvedValue(ROW);

    const ui = await ServicoDetalhePage({ params });
    const { container } = render(ui);

    expect(screen.getByRole('button', { name: /entrar em contato/i })).toBeInTheDocument();
    // Regra de negócio (SVC031-MN-01): a página não pode expor telefone/e-mail.
    // Exclui o `<script>` JSON-LD (schema.org usa `@type`/`@context`, não é contato)
    // e checa apenas o texto visível.
    const bodyWithoutScripts = container.cloneNode(true) as HTMLElement;
    bodyWithoutScripts.querySelectorAll('script').forEach((s) => s.remove());
    expect(bodyWithoutScripts.textContent).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    expect(bodyWithoutScripts.textContent).not.toMatch(/\(\d{2}\)\s?\d{4,5}-\d{4}/);
  });

  it('@ac-033-5 autenticado com interesse ativo: revela o contato do prestador', async () => {
    guardState.getCurrentPerson.mockResolvedValue({ id: 'viewer-1', roles: ['CLIENT'] });
    guardState.getActiveServiceDetail.mockResolvedValue(ROW);
    guardState.getMyActiveServiceInterest.mockResolvedValue({ id: 'interest-1' });
    guardState.getProviderContactForService.mockResolvedValue({
      displayName: 'João da Silva',
      phone: '11988887777',
      email: 'joao@example.com',
    });

    const ui = await ServicoDetalhePage({ params });
    render(ui);

    expect(screen.getByText(/contato do prestador/i)).toBeInTheDocument();
    expect(screen.getByText('11988887777')).toBeInTheDocument();
    expect(screen.getByText('joao@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /entrar em contato/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar manifestação/i })).toBeInTheDocument();
  });
});
