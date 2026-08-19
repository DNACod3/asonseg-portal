import Link from 'next/link';
import { Button } from '@/shared/ui';

export interface QuickAction {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface QuickActionsProps {
  actions: readonly QuickAction[];
}

/**
 * Bloco de ações rápidas por papel, no topo do painel `/inicio` (USP-067 —
 * PNL-00). Mapeia `.quick-actions` do protótipo. Só links para rotas já
 * validadas pelo loader (PNL-MN-04) — Server Component, sem ação de mutação
 * própria. Sem ações → não renderiza nada.
 */
export function QuickActions({ actions }: Readonly<QuickActionsProps>) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action.href} variant={action.variant ?? 'outline'} asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ))}
    </div>
  );
}
