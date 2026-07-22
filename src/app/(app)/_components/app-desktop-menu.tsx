'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/ui';
// SPEC_DEVIATION: ver nota em app-bottom-nav.tsx — import direto dos
// arquivos puros (`domain/app-nav`, `domain/hub-links`) em vez do barrel
// `@/modules/identity`, para não arrastar dependências server-only
// (next/headers, next/cache) ao bundle deste Client Component e quebrar
// `next build`.
// eslint-disable-next-line no-restricted-imports
import { pickActiveHref } from '@/modules/identity/domain/app-nav';
// eslint-disable-next-line no-restricted-imports
import type { HubLinkGroup } from '@/modules/identity/domain/hub-links';

/**
 * Menu disclosure do header desktop (`≥ md` — USP-063, DNAV-01..05). Client
 * Component apresentacional: recebe `groups` já resolvidos do
 * composition-root (`(app)/layout.tsx`); nunca busca sessão/Prisma
 * (DNAV-MN-03). Molde direto do hambúrguer do `PublicNav` (`useState`,
 * `aria-expanded`/`aria-controls`/`aria-label`, SVG inline, fecha ao
 * clicar). Ativo por rota via `pickActiveHref` (longest-match — DNAV-03).
 * Oculto `< md` (`hidden md:block`), onde a bottom bar (USP-062) assume.
 */
export interface AppDesktopMenuProps {
  groups: HubLinkGroup[];
  className?: string;
}

export function AppDesktopMenu({ groups, className }: AppDesktopMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeHref = pickActiveHref(
    groups.flatMap((g) => g.links.map((l) => l.href)),
    pathname,
  );

  return (
    <div className={cn('relative hidden md:block', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="app-menu-panel"
        aria-label={open ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
        className="flex items-center justify-center rounded-sm p-2 text-fg"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>

      {open && (
        <nav
          id="app-menu-panel"
          aria-label="Navegação da conta"
          className="absolute right-0 top-full mt-2 w-72 rounded-md border border-border bg-surface p-3 shadow-lg"
        >
          {groups.map((group) => (
            <div key={group.title} className="mb-2 last:mb-0">
              <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                {group.title}
              </p>
              {group.links.map((link) => {
                const active = link.href === activeHref;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'block rounded-sm px-2 py-2 text-sm',
                      active ? 'font-semibold text-primary' : 'text-fg hover:text-primary',
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
