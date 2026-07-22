import { AppHeader } from './app-header';

/**
 * Casca da área logada `(app)/*` (USP-061 — APP-SHELL-06, -07;
 * APP-SHELL-MN-01; round 2 USP-064 — flex-row + seam `sidebar`). Server
 * Component apresentacional montado pelo composition-root
 * (`(app)/layout.tsx`) — flex-row: a `sidebar` (USP-064, `AppSidebar`) à
 * esquerda + uma coluna `flex-1` com o header + `{children}` + `bottomNav`
 * (seam da bottom tab bar mobile/tablet, USP-062). Não importa `AppSidebar`
 * (recebe-o pronto como `ReactNode` — preserva MN-03). Não declara `<main>`
 * (A2) — cada página `(app)/*` mantém o seu.
 */
export interface AppShellProps {
  personName: string;
  roleLabel: string;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  bottomNav?: React.ReactNode;
}

export function AppShell({ personName, roleLabel, children, sidebar, bottomNav }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      {sidebar}
      <div className="flex min-h-screen flex-1 flex-col">
        <AppHeader personName={personName} roleLabel={roleLabel} />
        {children}
        {bottomNav}
      </div>
    </div>
  );
}
