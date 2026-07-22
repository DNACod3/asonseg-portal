import Link from 'next/link';
import { cn } from '@/shared/ui';
import { SignOutForm } from '@/modules/identity';
import { ProfileMenu } from './profile-menu';

/**
 * Header persistente da área autenticada `(app)/*` (USP-061 — APP-SHELL-01,
 * -02, -03, -04, -05; APP-SHELL-MN-04; round 2 USP-065 — PROF-01, -03, -06,
 * PROF-MN-05). Server Component apresentacional (A3): sem interatividade
 * própria — recebe `personName`/`roleLabel` já computados do
 * composition-root (`(app)/layout.tsx`) e exibe a marca (linka `/inicio`) e
 * o `ProfileMenu` (Client, USP-065), a quem passa `signOut={<SignOutForm/>}`
 * como `ReactNode` (o `ProfileMenu` nunca importa o barrel `@/modules/identity`
 * — L-021/PROF-MN-03). Visual espelha o `SiteHeader` público (badge "A" +
 * wordmark), mas linkando ao hub autenticado em vez da home pública (A7).
 *
 * O seam `nav` (`headerNav`, USP-063) foi removido — a sidebar (USP-064)
 * assume a navegação desktop. `PROF-MN-05` reenquadra `APP-SHELL-MN-01`:
 * a garantia "sem beco sem saída" passa a ser o trigger de perfil sempre
 * visível + Sair alcançável ao abrir o menu (em vez de "Sair sempre no DOM").
 */
export interface AppHeaderProps {
  personName: string;
  roleLabel: string;
  className?: string;
}

export function AppHeader({ personName, roleLabel, className }: AppHeaderProps) {
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

        <div className="flex flex-1 items-center justify-end">
          <ProfileMenu personName={personName} roleLabel={roleLabel} signOut={<SignOutForm />} />
        </div>
      </div>
    </header>
  );
}
