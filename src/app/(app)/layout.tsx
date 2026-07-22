import { requireActivePerson, describeActiveRoles } from '@/modules/identity';
import { AppShell } from './_components/app-shell';

// Route group (app): área autenticada. CLAUDE.md: force-dynamic (dados sensíveis por usuário).
export const dynamic = 'force-dynamic';

/**
 * Confinamento autoritativo das rotas `(app)/*` (USP-004 — T-08, ADR-0030) e
 * composition-root da casca (USP-061 — APP-SHELL-01/03/04, ângulo MN-03).
 * Revalida a sessão e o status da Pessoa a cada request (runtime Node, onde o
 * Prisma roda), força a troca de senha no 1º acesso (D-F), e alimenta o
 * `AppShell` apresentacional com dados já resolvidos (`fullName` + rótulo de
 * papel) — a casca em si nunca importa sessão/Prisma. O middleware Edge faz
 * apenas o gate barato de presença de cookie.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const person = await requireActivePerson();
  return (
    <AppShell personName={person.fullName} roleLabel={describeActiveRoles(person.roles)}>
      {children}
    </AppShell>
  );
  // USP-062/063: computar hubAccessFromRoles/buildHubLinks aqui e passar
  // headerNav={<AppDesktopMenu …/>} / bottomNav={<AppBottomNav …/>}.
}
