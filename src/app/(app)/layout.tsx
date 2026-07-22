import {
  requireActivePerson,
  describeActiveRoles,
  hubAccessFromRoles,
  buildHubLinks,
  selectPrimaryTabs,
  type HubAccess,
} from '@/modules/identity';
import { canAccessModerationQueue } from '@/modules/moderation';
import { AppShell } from './_components/app-shell';
import { AppBottomNav } from './_components/app-bottom-nav';
import { AppSidebar } from './_components/app-sidebar';

// Route group (app): área autenticada. CLAUDE.md: force-dynamic (dados sensíveis por usuário).
export const dynamic = 'force-dynamic';

/**
 * Confinamento autoritativo das rotas `(app)/*` (USP-004 — T-08, ADR-0030) e
 * composition-root da casca (USP-061 — APP-SHELL-01/03/04, ângulo MN-03;
 * USP-062 — BNAV-01, ângulo composition-root de BNAV-MN-02; round 2 USP-064
 * — SIDE-01, ângulo composition-root de SIDE-MN-02, substitui o
 * `AppDesktopMenu` da USP-063). Revalida a sessão e o status da Pessoa a cada
 * request (runtime Node, onde o Prisma roda), força a troca de senha no 1º
 * acesso (D-F), computa o `HubAccess`/`groups` (mesmo trecho do hub
 * `/inicio/page.tsx`) e alimenta o `AppShell` apresentacional com dados já
 * resolvidos — a casca em si nunca importa sessão/Prisma. O middleware Edge
 * faz apenas o gate barato de presença de cookie.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const person = await requireActivePerson();

  const access: HubAccess = {
    ...hubAccessFromRoles(person.roles),
    moderation: await canAccessModerationQueue(person),
  };
  const groups = buildHubLinks(access);

  return (
    <AppShell
      personName={person.fullName}
      roleLabel={describeActiveRoles(person.roles)}
      sidebar={<AppSidebar groups={groups} />}
      bottomNav={<AppBottomNav tabs={selectPrimaryTabs(groups)} />}
    >
      {children}
    </AppShell>
  );
}
