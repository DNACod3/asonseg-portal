import { cn } from '@/shared/ui';

/**
 * Registry de ícones SVG inline (`href → conteúdo`) para as abas da bottom
 * tab bar (USP-062 — BNAV-04, BNAV-MN-04). Sem lib de ícones (CLAUDE.md
 * "Forbidden") — mesmo padrão do hambúrguer inline do `PublicNav`
 * (`viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth={2}`).
 *
 * `href` sem entrada mapeada → ícone **fallback** (círculo simples); nunca
 * lança (o registry é um lookup em `Record`, com `??` defensivo).
 */

const NAV_ICON_PATHS: Record<string, React.ReactNode> = {
  '/inicio': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9"
    />
  ),
  '/perfil': (
    <>
      <circle cx="12" cy="8" r="3.25" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  '/candidato': (
    <>
      <rect x="4" y="8" width="16" height="10" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M4 13h16"
      />
    </>
  ),
  '/prestador': (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.5 6.5a3 3 0 1 0-4.243 4.243L4 17l3 3 6.257-6.257A3 3 0 1 0 14.5 6.5Z"
    />
  ),
  '/empresa/cadastrar': (
    <>
      <rect x="5" y="4" width="14" height="16" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"
      />
    </>
  ),
  '/moderacao': (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 19 6v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </>
  ),
  '/relatorios': (
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 20V10M12 20V4M19 20v-7" />
  ),
  '/encaminhamentos/novo': (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 11 21 3l-8 18-2.5-7.5L3 11Z" />
  ),
  '/cadastro-assistido': (
    <>
      <circle cx="10" cy="8" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20a6 6 0 0 1 12 0M18 8v4M16 10h4"
      />
    </>
  ),
  '/credenciais/reivindicacoes': (
    <>
      <rect x="6" y="4" width="12" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v4" />
    </>
  ),
  '/permissoes': (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

/** Ícone fallback (círculo simples) — usado quando o href não tem entrada mapeada. */
const FALLBACK_ICON = <circle cx="12" cy="12" r="7" strokeLinecap="round" strokeLinejoin="round" />;

export interface NavIconProps {
  href: string;
  className?: string;
}

export function NavIcon({ href, className }: NavIconProps): React.ReactElement {
  const content = NAV_ICON_PATHS[href] ?? FALLBACK_ICON;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      className={cn('h-5 w-5', className)}
    >
      {content}
    </svg>
  );
}
