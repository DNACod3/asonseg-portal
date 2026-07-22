'use client';

import { useState } from 'react';
import { cn, ThemeToggle } from '@/shared/ui';

/**
 * Dropdown de perfil no header da área logada (USP-065 round 2 —
 * PROF-01..06, PROF-MN-01..03, PROF-MN-05). Client Component apresentacional:
 * trigger avatar(inicial)+nome; painel com nome + papel ativo, o controle de
 * tema (`ThemeToggle` reusado, sem reescrever a lógica) e a ação Sair
 * (injetada como `ReactNode` pelo `AppHeader`, que é Server). Nunca importa
 * `@/modules/identity` — o barrel reexporta `session.ts` server-only e
 * quebraria `next build` (lição L-021, PROF-MN-03). Molde: disclosure do
 * `PublicNav`/`AppDesktopMenu` (`useState`, `aria-expanded`/`aria-controls`).
 */
export interface ProfileMenuProps {
  personName: string;
  roleLabel: string;
  signOut: React.ReactNode;
  className?: string;
}

export function ProfileMenu({ personName, roleLabel, signOut, className }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const initial = personName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="profile-menu-panel"
        aria-haspopup="menu"
        aria-label={open ? 'Fechar menu de perfil' : 'Abrir menu de perfil'}
        className="flex items-center gap-2 rounded-sm p-1 text-fg"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary font-heading font-black text-white"
        >
          {initial}
        </span>
        <span className="hidden text-sm font-semibold text-fg sm:block">{personName}</span>
      </button>

      {open && (
        <div
          id="profile-menu-panel"
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-md border border-border bg-surface p-2 shadow-lg"
        >
          <div className="px-2 py-2">
            <p className="text-sm font-semibold text-fg">{personName}</p>
            {roleLabel && (
              <p data-testid="app-header-role-label" className="text-xs text-fg-muted">
                {roleLabel}
              </p>
            )}
          </div>
          <hr className="my-1 border-border" />
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-sm text-fg">Tema</span>
            <ThemeToggle className="h-8 w-8" />
          </div>
          <hr className="my-1 border-border" />
          <div className="px-2 py-1" onClick={() => setOpen(false)}>
            {signOut}
          </div>
        </div>
      )}
    </div>
  );
}
