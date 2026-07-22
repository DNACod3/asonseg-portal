import { AppHeader } from './app-header';

/**
 * Casca da área logada `(app)/*` (USP-061 — APP-SHELL-06, -07;
 * APP-SHELL-MN-01). Server Component apresentacional montado pelo
 * composition-root (`(app)/layout.tsx`) — o único ponto de extensão da
 * navegação: `headerNav` (seam do menu desktop, USP-063) e `bottomNav`
 * (seam da bottom tab bar mobile/tablet, USP-062). Não declara `<main>`
 * (A2) — cada página `(app)/*` mantém o seu.
 */
export interface AppShellProps {
  personName: string;
  roleLabel: string;
  children: React.ReactNode;
  headerNav?: React.ReactNode;
  bottomNav?: React.ReactNode;
}

export function AppShell({ personName, roleLabel, children, headerNav, bottomNav }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader personName={personName} roleLabel={roleLabel} nav={headerNav} />
      {children}
      {bottomNav}
    </div>
  );
}
