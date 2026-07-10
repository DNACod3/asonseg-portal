import Link from 'next/link';
import { Button, cn } from '@/shared/ui';
import { PublicNav } from './public-nav';

/**
 * Header público sticky (USP-046 T3, CASCA-01/04/15). Server Component
 * estático (A-08) — compõe a marca (linka `/`), o `PublicNav` (T2, único
 * Client Component da casca) e as ações Entrar/Cadastrar via
 * `Button asChild` sobre `<Link>` (navegação declarativa, sem handler
 * client). Paridade estrutural com o protótipo (`docs/prototipo/index.html`
 * L811-838): `.header`/`.logo`/`.nav`/`.nav-actions`.
 */

const HEADER_ACTIONS = (
  <>
    <Button asChild variant="outline" size="sm">
      <Link href="/login">Entrar</Link>
    </Button>
    <Button asChild variant="primary" size="sm">
      <Link href="/cadastro">Cadastrar</Link>
    </Button>
  </>
);

export interface SiteHeaderProps {
  className?: string;
}

export function SiteHeader({ className }: SiteHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur',
        className,
      )}
    >
      <div className="relative mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-sm bg-gradient-to-br from-primary to-secondary font-heading text-lg font-black text-white"
          >
            A
          </span>
          <span className="flex flex-col">
            <span className="font-heading text-lg font-extrabold text-primary">ASONSEG</span>
            <span className="-mt-1 text-[0.65rem] font-medium text-fg-muted">Portal de Vagas</span>
          </span>
        </Link>

        <PublicNav actions={HEADER_ACTIONS} className="flex-1 justify-end" />
      </div>
    </header>
  );
}
