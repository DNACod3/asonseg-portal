'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/ui';
import { pickActiveHref, type BottomTab } from '@/modules/identity';
import { NavIcon } from './nav-icons';

/**
 * Bottom tab bar fixa (mobile/tablet — USP-062, BNAV-01/03/04/05). Client
 * Component apresentacional: recebe `tabs` já computadas do composition-root
 * (`(app)/layout.tsx`); nunca busca sessão/Prisma (BNAV-MN-03). Ativo por
 * rota via `pickActiveHref` (longest-match). Some em `≥ md` (`md:hidden`);
 * o spacer in-flow reserva o espaço para o conteúdo `min-h-screen` das
 * páginas não ficar coberto (A7).
 */
export interface AppBottomNavProps {
  tabs: BottomTab[];
  className?: string;
}

export function AppBottomNav({ tabs, className }: AppBottomNavProps) {
  const pathname = usePathname();
  const activeHref = pickActiveHref(
    tabs.map((t) => t.href),
    pathname,
  );

  return (
    <>
      <div aria-hidden="true" className="h-16 md:hidden" />
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden',
          className,
        )}
      >
        {tabs.map((tab) => {
          const active = tab.href === activeHref;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[0.65rem] font-medium',
                active ? 'text-primary' : 'text-fg-muted',
              )}
            >
              <NavIcon href={tab.href} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
