'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/ui';

/**
 * Navegação primária do header público (USP-046, CASCA-02/03/05/06/07/15).
 * Client Component (A-08) — precisa de `usePathname()` (active-state) e do
 * estado do menu mobile (`useState`, React nativo, A-06/CASCA-MN-04).
 *
 * Seam CASCA-15: `items` é data-driven (default = destinos públicos reais);
 * USP-048 pode injetar itens (ex.: "Sou Candidato/Sou Empresa") sem
 * reescrever esta casca. `actions` é outro seam — o `SiteHeader` (T3) passa
 * os botões Entrar/Cadastrar aqui porque o painel mobile precisa refletir o
 * mesmo estado `open` que abre/fecha a navegação (o botão/painel mobile só
 * pode viver num único Client Component — A-08).
 */

export type NavItem = { label: string; href: string };

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { label: 'Início', href: '/' },
  { label: 'Vagas', href: '/vagas' },
  { label: 'Serviços', href: '/servicos' },
];

/**
 * Match por seção (CASCA-03): `/` só casa exatamente (não por prefixo vazio
 * contra `/vagas`); os demais casam por rota exata ou por prefixo de seção
 * (`/vagas/123` → "Vagas", `/servicos/x` → "Serviços"). Nenhum item casa
 * fora da nav (edge case do spec).
 */
export function isActive(itemHref: string, pathname: string): boolean {
  if (itemHref === '/') return pathname === '/';
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export interface PublicNavProps {
  items?: NavItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PublicNav({ items = PUBLIC_NAV_ITEMS, actions, className }: PublicNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function closeMobileMenu() {
    setOpen(false);
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <nav
        aria-label="Navegação principal"
        className="hidden items-center gap-8 md:flex"
      >
        {items.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative py-1 text-sm font-medium transition-colors',
                active ? 'text-primary' : 'text-fg-muted hover:text-primary',
              )}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {actions && <div className="hidden items-center gap-2 md:flex">{actions}</div>}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="public-mobile-menu"
        aria-label={open ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
        className="flex items-center justify-center rounded-sm p-2 text-fg md:hidden"
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
        <div
          id="public-mobile-menu"
          className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-border bg-surface p-4 shadow-md md:hidden"
        >
          {items.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={closeMobileMenu}
                className={cn(
                  'rounded-sm px-3 py-2 text-sm font-medium',
                  active ? 'text-primary' : 'text-fg-muted hover:text-primary',
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {actions && (
            <div className="flex items-center gap-2 border-t border-border pt-3">{actions}</div>
          )}
        </div>
      )}
    </div>
  );
}
