import { cn } from '@/shared/ui';

export type KpiTone = 'primary' | 'cta' | 'success' | 'muted';

export interface KpiItem {
  label: string;
  value: number | string;
  tone?: KpiTone;
}

export interface KpiStripProps {
  items: readonly KpiItem[];
}

const TONE_TEXT: Record<KpiTone, string> = {
  primary: 'text-primary',
  cta: 'text-cta',
  success: 'text-success',
  muted: 'text-fg-muted',
};

/**
 * Faixa de indicadores (KPIs) do painel `/inicio` (USP-067 — PNL-00). Mapeia
 * `.kpi-grid`/`.kpi` do protótipo (`docs/prototipo/painel.html`). Tokens-only
 * (PNL-MN-08) — Server Component puro, sem IO. Sem itens → não renderiza
 * nada (o bloco chamador decide se isso é um estado válido).
 */
export function KpiStrip({ items }: Readonly<KpiStripProps>) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border bg-surface p-4 shadow-sm">
          <p
            className={cn(
              'font-heading text-2xl font-extrabold leading-tight',
              TONE_TEXT[item.tone ?? 'primary'],
            )}
          >
            {item.value}
          </p>
          <p className="text-xs font-medium text-fg-muted">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
