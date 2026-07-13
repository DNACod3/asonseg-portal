import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReportViewProps } from '../components/report-view';

/**
 * Component test de `ReportView` (T12 — E-001/E-002/REL42-MN-01/
 * REL42-MN-04/REL42-MN-06). `page.test.tsx` mocka este componente com um
 * stub `data-testid`, então o código real nunca renderiza ali — este arquivo
 * cobre o componente de verdade: export (CSV/PDF via `exportReport` +
 * `atob`→Blob→download), o gate de ciência LGPD (REL42-MN-06/MN-01) e o
 * must-not visual MN-04 (successRate nunca sozinha). Mesmo padrão de
 * `ChangePasswordForm.test.tsx` (USP-004): action mockada via `vi.hoisted` +
 * `fireEvent`/`waitFor` (sem `@testing-library/user-event`, não é dependência
 * do projeto).
 */

const actionState = vi.hoisted(() => ({ exportReport: vi.fn() }));

vi.mock('../actions/export-report', () => ({
  exportReport: (...a: unknown[]) => actionState.exportReport(...a),
}));

const { ReportView } = await import('../components/report-view');

const baseProps: ReportViewProps = {
  reportType: 'jobs',
  title: 'Relatório de vagas',
  columns: [{ key: 'status', label: 'Status' }],
  rows: [{ status: 'ACTIVE' }],
  filters: {},
  containsPII: false,
};

let lastAnchor: { download: string; href: string } | null = null;
const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock-url');
const revokeObjectURL = vi.fn();

beforeAll(() => {
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
    lastAnchor = { download: this.download, href: this.href };
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  createObjectURL.mockReturnValue('blob:mock-url');
  lastAnchor = null;
});

describe('ReportView — handleExport (E-001/E-002)', () => {
  it('CSV: clique dispara exportReport com reportType/filters/format/acknowledgePII e baixa o conteúdo CRU (sem atob)', async () => {
    const rawCsv = 'Status\r\nACTIVE';
    actionState.exportReport.mockResolvedValue({
      ok: true,
      data: { format: 'CSV', filename: 'relatorio-vagas.csv', mimeType: 'text/csv', content: rawCsv },
    });

    render(<ReportView {...baseProps} filters={{ from: '2026-01-01' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() =>
      expect(actionState.exportReport).toHaveBeenCalledWith({
        reportType: 'jobs',
        filters: { from: '2026-01-01' },
        format: 'CSV',
        acknowledgePII: false,
      }),
    );

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blobArg = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blobArg.type).toBe('text/csv');
    await expect(blobArg.text()).resolves.toBe(rawCsv); // CSV NÃO passa por atob — conteúdo cru.

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(lastAnchor?.download).toBe('relatorio-vagas.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('PDF: clique dispara exportReport com format=PDF e decodifica o conteúdo via atob antes de baixar', async () => {
    const decodedPdfBytes = 'binary-pdf-bytes';
    const base64Content = Buffer.from(decodedPdfBytes, 'binary').toString('base64');
    actionState.exportReport.mockResolvedValue({
      ok: true,
      data: { format: 'PDF', filename: 'relatorio-vagas.pdf', mimeType: 'application/pdf', content: base64Content },
    });

    render(<ReportView {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));

    await waitFor(() =>
      expect(actionState.exportReport).toHaveBeenCalledWith({
        reportType: 'jobs',
        filters: {},
        format: 'PDF',
        acknowledgePII: false,
      }),
    );

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const blobArg = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blobArg.type).toBe('application/pdf');
    // Prova o caminho atob→Uint8Array→Blob: o conteúdo decodificado bate com os bytes originais.
    await expect(blobArg.text()).resolves.toBe(decodedPdfBytes);

    expect(lastAnchor?.download).toBe('relatorio-vagas.pdf');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('action retorna erro → exibe a mensagem, NÃO baixa nada', async () => {
    actionState.exportReport.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Sem permissão para exportar este relatório.' },
    });

    render(<ReportView {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    expect(await screen.findByText('Sem permissão para exportar este relatório.')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('ReportView — gate de ciência LGPD (REL42-MN-06 / REL42-MN-01)', () => {
  it('containsPII=true: botões de export começam desabilitados e habilitam só após marcar o checkbox de ciência', () => {
    render(<ReportView {...baseProps} containsPII={true} />);
    const csvButton = screen.getByRole('button', { name: 'Exportar CSV' });
    const pdfButton = screen.getByRole('button', { name: 'Exportar PDF' });
    const checkbox = screen.getByRole('checkbox');

    expect(csvButton).toBeDisabled();
    expect(pdfButton).toBeDisabled();
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(csvButton).not.toBeDisabled();
    expect(pdfButton).not.toBeDisabled();
  });

  it('containsPII=true + acionar exportReport ANTES de marcar o checkbox: acknowledgePII=false chega desmarcado (defesa em profundidade da action)', async () => {
    actionState.exportReport.mockResolvedValue({
      ok: true,
      data: { format: 'CSV', filename: 'x.csv', mimeType: 'text/csv', content: 'a' },
    });
    render(<ReportView {...baseProps} containsPII={true} />);

    // Botão está desabilitado — clique não dispara handler (jsdom não invoca onClick de <button disabled>).
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(actionState.exportReport).not.toHaveBeenCalled();
  });

  it('containsPII=false: nenhum checkbox de ciência é exibido, botões nascem habilitados', () => {
    render(<ReportView {...baseProps} containsPII={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).not.toBeDisabled();
  });
});

describe('ReportView — MN-04 (successRate nunca aparece sem noResultRate)', () => {
  it('outcomeRates presente: as duas taxas aparecem juntas no mesmo bloco (data-testid="referral-outcome-rates")', () => {
    render(<ReportView {...baseProps} outcomeRates={{ successRate: 0.5, noResultRate: 0.25 }} />);
    const block = screen.getByTestId('referral-outcome-rates');
    expect(block).toHaveTextContent('Taxa de sucesso (MP9): 50.0%');
    expect(block).toHaveTextContent('Sem resultado registrado: 25.0%');
  });

  it('outcomeRates ausente (relatórios que não são referrals): nem o bloco nem os textos de taxa aparecem', () => {
    render(<ReportView {...baseProps} />);
    expect(screen.queryByTestId('referral-outcome-rates')).not.toBeInTheDocument();
    expect(screen.queryByText(/Taxa de sucesso/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sem resultado registrado/)).not.toBeInTheDocument();
  });

  it('outcomeRates com valores null (sem encaminhamento com resultado ainda): as duas ainda renderizam juntas como "—", nunca uma sem a outra', () => {
    render(<ReportView {...baseProps} outcomeRates={{ successRate: null, noResultRate: null }} />);
    const block = screen.getByTestId('referral-outcome-rates');
    expect(block).toHaveTextContent('Taxa de sucesso (MP9): —');
    expect(block).toHaveTextContent('Sem resultado registrado: —');
  });
});

describe('ReportView — selects de status/categoria/região (USP-058/REL-5, USP058-05..10/MN-04)', () => {
  it('USP058-05: statusOptions presente → <select name="status"> com as opções + "Todos", pré-selecionado por filters.status', () => {
    render(
      <ReportView
        {...baseProps}
        filters={{ status: 'ACTIVE' }}
        statusOptions={[
          { value: 'ACTIVE', label: 'Ativo' },
          { value: 'PAUSED', label: 'Pausado' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('ACTIVE');
    expect(screen.getByRole('option', { name: 'Todos' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ativo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pausado' })).toBeInTheDocument();
  });

  it('USP058-06: categoryOptions presente → <select name="categoryId"> com as categorias + "Todas", pré-selecionado por filters.categoryId', () => {
    render(
      <ReportView
        {...baseProps}
        filters={{ categoryId: 'cat-2' }}
        categoryOptions={[
          { value: 'cat-1', label: 'Elétrica' },
          { value: 'cat-2', label: 'Jardinagem' },
        ]}
      />,
    );
    const select = screen.getByLabelText('Categoria') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('cat-2');
    expect(screen.getByRole('option', { name: 'Todas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Jardinagem' })).toBeInTheDocument();
  });

  it('USP058-07: regionOptions presente → <select name="regionId"> com as regiões + "Todas", pré-selecionado por filters.regionId', () => {
    render(
      <ReportView
        {...baseProps}
        filters={{ regionId: 'reg-1' }}
        regionOptions={[{ value: 'reg-1', label: 'Centro' }]}
      />,
    );
    const select = screen.getByLabelText('Região') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('reg-1');
  });

  it('USP058-08/MN-04: sem nenhuma prop de opções → nenhum select de status/categoria/região é renderizado (sem controle inerte)', () => {
    render(<ReportView {...baseProps} />);
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Categoria')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Região')).not.toBeInTheDocument();
  });

  it('MN-04: apenas statusOptions presente (ex. R1/Vagas) → só o select de status aparece, categoria/região ausentes', () => {
    render(<ReportView {...baseProps} statusOptions={[{ value: 'ACTIVE', label: 'Ativo' }]} />);
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.queryByLabelText('Categoria')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Região')).not.toBeInTheDocument();
  });

  it('USP058-10: inputs from/to e a chamada de exportReport permanecem intactos com selects presentes', async () => {
    actionState.exportReport.mockResolvedValue({
      ok: true,
      data: { format: 'CSV', filename: 'x.csv', mimeType: 'text/csv', content: 'a' },
    });
    render(
      <ReportView
        {...baseProps}
        filters={{ from: '2026-01-01', to: '2026-01-31', status: 'ACTIVE' }}
        statusOptions={[{ value: 'ACTIVE', label: 'Ativo' }]}
      />,
    );

    expect(screen.getByLabelText('De')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Até')).toHaveValue('2026-01-31');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() =>
      expect(actionState.exportReport).toHaveBeenCalledWith({
        reportType: 'jobs',
        filters: { from: '2026-01-01', to: '2026-01-31', status: 'ACTIVE' },
        format: 'CSV',
        acknowledgePII: false,
      }),
    );
  });
});
