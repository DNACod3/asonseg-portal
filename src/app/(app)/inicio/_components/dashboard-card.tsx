import type { ReactNode } from 'react';
import Link from 'next/link';

/** Teto de linhas renderizadas por card (must-not PNL-MN-07 — reforço estrutural). */
export const DASHBOARD_CARD_MAX_ROWS = 5;

export interface DashboardCardProps {
  title: string;
  description?: string;
  /** Linhas já prontas (ex.: `DashboardRow`) — cortadas a `DASHBOARD_CARD_MAX_ROWS` mesmo se vier mais. */
  rows: readonly ReactNode[];
  /** Mensagem do estado vazio (`rows.length === 0`). */
  emptyMessage?: string;
  /**
   * Rota de "ver lista completa". **Ausente** → o link é omitido (A-11):
   * a rota-alvo não existe ou a Pessoa não pode abri-la.
   */
  footHref?: string;
  footLabel?: string;
  /** Contador "5 de N" — exibido mesmo sem `footHref` (mantém o dado, omite só o link). */
  countHint?: string;
}

/**
 * Card de lista do painel `/inicio` (USP-067 — PNL-00). Mapeia `.dcard`/
 * `.dcard-head`/`.dcard-foot` do protótipo. Tokens-only (PNL-MN-08).
 *
 * `footHref` ausente → omite o link "ver lista completa" mas preserva o
 * `countHint` (A-11 / PNL-MN-04). Sem `rows` → renderiza `emptyMessage`.
 * `rows` é sempre cortado a {@link DASHBOARD_CARD_MAX_ROWS} (PNL-MN-07),
 * mesmo que o caller já tenha aplicado `take` na query — defesa em
 * profundidade.
 */
export function DashboardCard({
  title,
  description,
  rows,
  emptyMessage = 'Nada por aqui ainda.',
  footHref,
  footLabel = 'Ver lista completa',
  countHint,
}: Readonly<DashboardCardProps>) {
  const visibleRows = rows.slice(0, DASHBOARD_CARD_MAX_ROWS);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description && <p className="text-xs text-fg-muted">{description}</p>}
      </div>

      <div className="flex flex-col">
        {visibleRows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-fg-muted">{emptyMessage}</p>
        ) : (
          visibleRows
        )}
      </div>

      {(footHref || countHint) && (
        <div className="flex items-center gap-2 border-t border-border bg-background px-6 py-3">
          {countHint && <span className="text-xs text-fg-muted">{countHint}</span>}
          <div className="flex-1" />
          {footHref && (
            <Link
              href={footHref}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {footLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
