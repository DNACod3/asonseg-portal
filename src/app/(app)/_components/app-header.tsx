import Link from 'next/link';
import { cn } from '@/shared/ui';
import { SignOutForm } from '@/modules/identity';

/**
 * Header persistente da área autenticada `(app)/*` (USP-061 — APP-SHELL-01,
 * -02, -03, -04, -05; APP-SHELL-MN-04). Server Component apresentacional
 * (A3): sem interatividade própria — recebe `personName`/`roleLabel` já
 * computados do composition-root (`(app)/layout.tsx`) e apenas exibe a
 * marca (linka `/inicio`), a identidade e o `SignOutForm`. Visual espelha o
 * `SiteHeader` público (badge "A" + wordmark), mas linkando ao hub
 * autenticado em vez da home pública (A7).
 *
 * `nav` é o seam `headerNav` (USP-063, A4) — `undefined` por padrão, sem
 * buraco visual (APP-SHELL-07).
 */
export interface AppHeaderProps {
  personName: string;
  roleLabel: string;
  nav?: React.ReactNode;
  className?: string;
}

export function AppHeader({ personName, roleLabel, nav, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur',
        className,
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/inicio" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-sm bg-gradient-to-br from-primary to-secondary font-heading text-lg font-black text-white"
          >
            A
          </span>
          <span className="flex flex-col">
            <span className="font-heading text-lg font-extrabold text-primary">ASONSEG</span>
            <span className="-mt-1 text-[0.65rem] font-medium text-fg-muted">Área logada</span>
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-end gap-4">
          {nav}

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-fg">{personName}</span>
              {roleLabel && <span className="text-xs text-fg-muted">{roleLabel}</span>}
            </div>
            <SignOutForm />
          </div>
        </div>
      </div>
    </header>
  );
}
