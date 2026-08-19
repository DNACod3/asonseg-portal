import type { ReactNode } from 'react';

export interface DashboardRowProps {
  /** Marca curta (iniciais/ícone) à esquerda — opcional. */
  mark?: ReactNode;
  title: ReactNode;
  subtitle?: string;
  /** Metadados curtos (datas, contadores) — renderizados lado a lado. */
  meta?: readonly string[];
  /** Botões de ação rápida da linha (`Link`/`Button`, incl. Client Components existentes). */
  actions?: ReactNode;
}

/**
 * Linha de lista dentro de um `DashboardCard` (USP-067 — PNL-00). Mapeia
 * `.drow`/`.drow-mark`/`.drow-body`/`.drow-meta`/`.drow-actions` do
 * protótipo. Tokens-only (PNL-MN-08).
 */
export function DashboardRow({ mark, title, subtitle, meta, actions }: Readonly<DashboardRowProps>) {
  return (
    <div className="flex items-center gap-4 border-b border-border px-6 py-3 last:border-b-0">
      {mark && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-background text-xs font-bold text-fg-muted">
          {mark}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">{title}</div>
        {subtitle && <p className="text-xs text-fg-muted">{subtitle}</p>}
        {meta && meta.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-fg-muted">
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap justify-end gap-1.5">{actions}</div>}
    </div>
  );
}
