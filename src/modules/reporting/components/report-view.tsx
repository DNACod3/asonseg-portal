'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card, Label } from '@/shared/ui';
import { exportReport } from '../actions/export-report';
import type { ReportType } from '../schemas/export-report';

export interface ReportViewColumn {
  key: string;
  label: string;
}

export interface ReportViewFilters {
  from?: string;
  to?: string;
  status?: string;
  categoryId?: string;
  regionId?: string;
}

/** Uma opção de `<select>` de filtro (USP-058/REL-5 — status/categoria/região). */
export interface FilterOption {
  value: string;
  label: string;
}

export interface ReportViewProps {
  reportType: ReportType;
  title: string;
  columns: ReportViewColumn[];
  rows: Record<string, unknown>[];
  filters: ReportViewFilters;
  /**
   * Reforço visual de MN-04 — só presente no relatório de encaminhamentos
   * (R4): `successRate` NUNCA aparece na tela sem `noResultRate` ao lado.
   */
  outcomeRates?: { successRate: number | null; noResultRate: number | null };
  /** Vindo do gate da rota — só `true` para o relatório social visto por AS/BOARD (T10 scope=full). */
  containsPII: boolean;
  /**
   * Opções do `<select name="status">` (USP-058/REL-5 — só R1/Vagas honra
   * status). Ausente ⇒ nenhum select de status é renderizado (gating —
   * USP058-08/MN-04, evita controle inerte).
   */
  statusOptions?: FilterOption[];
  /** Opções do `<select name="categoryId">` (só R3/Serviços honra categoria). */
  categoryOptions?: FilterOption[];
  /** Opções do `<select name="regionId">` (só R6/Social honra região). */
  regionOptions?: FilterOption[];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

function downloadFile(filename: string, mimeType: string, content: string, isBase64: boolean): void {
  const blob = isBase64
    ? new Blob([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))], { type: mimeType })
    : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Lista filtrável de um relatório operacional + botões de export (E-001/E-002).
 * A busca/filtro em si é feita pela rota (Server Component, `page.tsx`) via
 * `searchParams` — este componente só renderiza o que já chegou pronto e
 * dispara `exportReport` (Server Action) para CSV/PDF.
 */
export function ReportView({
  reportType,
  title,
  columns,
  rows,
  filters,
  outcomeRates,
  containsPII,
  statusOptions,
  categoryOptions,
  regionOptions,
}: ReportViewProps) {
  const [isPending, startTransition] = useTransition();
  const [acknowledgePII, setAcknowledgePII] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleExport(format: 'CSV' | 'PDF') {
    setError(null);
    startTransition(async () => {
      const result = await exportReport({ reportType, filters, format, acknowledgePII });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      downloadFile(result.data.filename, result.data.mimeType, result.data.content, format === 'PDF');
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold text-fg">{title}</h2>
        <p className="text-sm text-fg-muted">{rows.length} linha(s) no período selecionado.</p>
      </header>

      {/* Filtros — form GET nativo: a rota (Server Component) refaz a busca via searchParams. */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="from">De</Label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="to">Até</Label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={filters.to}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </div>
        {statusOptions ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status ?? ''}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">Todos</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {categoryOptions ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="categoryId">Categoria</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={filters.categoryId ?? ''}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {regionOptions ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="regionId">Região</Label>
            <select
              id="regionId"
              name="regionId"
              defaultValue={filters.regionId ?? ''}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="">Todas</option>
              {regionOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {/* MN-04: successRate NUNCA sozinha — sempre ao lado da taxa sem resultado. */}
      {outcomeRates ? (
        <div className="flex gap-4" data-testid="referral-outcome-rates">
          <Badge>Taxa de sucesso (MP9): {formatRate(outcomeRates.successRate)}</Badge>
          <Badge>Sem resultado registrado: {formatRate(outcomeRates.noResultRate)}</Badge>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {columns.map((c) => (
                <th key={c.key} className="py-2 pr-4 font-medium text-fg-muted">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-4 text-fg-muted">
                  Sem dados no período selecionado.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  {columns.map((c) => (
                    <td key={c.key} className="py-2 pr-4">
                      {formatCell(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {containsPII ? (
        <label className="flex items-center gap-2 text-sm text-fg" htmlFor="acknowledge-pii">
          <input
            id="acknowledge-pii"
            type="checkbox"
            checked={acknowledgePII}
            onChange={(e) => setAcknowledgePII(e.target.checked)}
          />
          Estou ciente de que este relatório contém dados pessoais e assumo a responsabilidade pelo
          uso restrito conforme a LGPD.
        </label>
      ) : null}

      <div className="flex gap-3">
        <Button
          type="button"
          disabled={isPending || (containsPII && !acknowledgePII)}
          onClick={() => handleExport('CSV')}
        >
          Exportar CSV
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending || (containsPII && !acknowledgePII)}
          onClick={() => handleExport('PDF')}
        >
          Exportar PDF
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
