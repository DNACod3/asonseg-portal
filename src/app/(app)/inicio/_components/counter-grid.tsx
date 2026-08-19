import Link from 'next/link';

export interface Counter {
  value: number;
  label: string;
  href: string;
}

export interface CounterGridProps {
  counters: readonly Counter[];
}

/**
 * Grid de contadores clicáveis (card CLIENT "prestadores por tipo de
 * serviço" — USP-067 PNL-03 / A-06). Mapeia `.counter-grid`/`.counter` do
 * protótipo. Tokens-only (PNL-MN-08). Sem contadores → estado vazio.
 */
export function CounterGrid({ counters }: Readonly<CounterGridProps>) {
  if (counters.length === 0) {
    return <p className="px-6 py-8 text-center text-sm text-fg-muted">Nada por aqui ainda.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-6 sm:grid-cols-3">
      {counters.map((counter) => (
        <Link
          key={counter.href}
          href={counter.href}
          className="block rounded-md border border-border p-4 text-left transition-colors hover:border-primary hover:shadow-md"
        >
          <p className="font-heading text-xl font-extrabold text-primary">{counter.value}</p>
          <p className="text-sm font-semibold text-fg">{counter.label}</p>
        </Link>
      ))}
    </div>
  );
}
