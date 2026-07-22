// Route group (auth): login/cadastro/recuperar-senha. CLAUDE.md: sem cache.
import { ThemeToggle } from '@/shared/ui';

export const dynamic = 'force-dynamic';

// O `ThemeToggle` flutuante (round 2 — USP-065, PROF-05/PROF-MN-04) é
// reinstalado aqui: saiu do `layout.tsx` raiz (que monta em todos os
// grupos); em `(app)` o controle de tema mora só no Menu de Perfil.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ThemeToggle className="fixed bottom-4 right-4 z-50 shadow-md" />
    </>
  );
}
