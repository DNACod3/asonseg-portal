'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/ui';
// SPEC_DEVIATION: ver nota em app-bottom-nav.tsx/app-desktop-menu.tsx — import
// direto dos arquivos puros (`domain/app-nav`, `domain/hub-links`) em vez do
// barrel `@/modules/identity`, para não arrastar dependências server-only
// (next/headers, next/cache) ao bundle deste Client Component e quebrar
// `next build` (L-021).
// eslint-disable-next-line no-restricted-imports
import { pickActiveHref } from '@/modules/identity/domain/app-nav';
// eslint-disable-next-line no-restricted-imports
import type { HubLinkGroup } from '@/modules/identity/domain/hub-links';
import { NavIcon } from './nav-icons';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'asonseg:sidebar-collapsed';

/**
 * Sidebar colapsável do desktop (`≥ md` — USP-064 round 2, SIDE-01..06).
 * Client Component apresentacional: recebe `groups` já resolvidos do
 * composition-root (`(app)/layout.tsx`); nunca busca sessão/Prisma
 * (SIDE-MN-03). Substitui o `AppDesktopMenu` (USP-063). Reaproveita
 * `pickActiveHref` (active-state longest-match) e `NavIcon` (registry
 * USP-062) sem alterá-los. Persistência do collapse em `localStorage`
 * (padrão `ThemeToggle`: `useState`+`useEffect`, degrada sem lançar).
 * Oculta `< md` (`hidden md:flex`), onde a bottom bar (USP-062) assume.
 */
export interface AppSidebarProps {
  groups: HubLinkGroup[];
  className?: string;
}

export function AppSidebar({ groups, className }: AppSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true');
    } catch {
      // localStorage indisponível (SSR/navegador privado) — degrada sem lançar.
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // localStorage indisponível (SSR/navegador privado) — degrada sem lançar.
    }
  }

  const activeHref = pickActiveHref(
    groups.flatMap((g) => g.links.map((l) => l.href)),
    pathname,
  );

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col shrink-0 self-start sticky top-0 h-screen',
        'border-r border-border bg-surface transition-[width]',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
    >
      <div className="flex items-center justify-end p-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          className="flex items-center justify-center rounded-sm p-2 text-fg-muted hover:text-primary"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
            />
          </svg>
        </button>
      </div>
      <nav aria-label="Navegação lateral" className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((group) => (
          <div key={group.title} className="mb-2 last:mb-0">
            {!collapsed && (
              <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {group.title}
              </p>
            )}
            {group.links.map((link) => {
              const active = link.href === activeHref;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? link.label : undefined}
                  title={collapsed ? link.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-sm px-2 py-2 text-sm',
                    collapsed && 'justify-center',
                    active ? 'font-semibold text-primary' : 'text-fg hover:text-primary',
                  )}
                >
                  <NavIcon href={link.href} />
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
