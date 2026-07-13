import {
  requireActivePerson,
  hubAccessFromRoles,
  buildHubLinks,
  SignOutForm,
  type HubAccess,
} from '@/modules/identity';
import { canAccessModerationQueue } from '@/modules/moderation';
import { FormHeader } from '@/shared/ui';
import { HubLinkCard } from './_components/hub-link-card';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request (ADR-0030).
export const dynamic = 'force-dynamic';

/**
 * Hub `/inicio` (USP-049 — ORQ-1): destino pós-login role-aware. Composition-root
 * (ADR-0030 / AD-022) — resolve sessão + guards e passa dados prontos ao
 * `buildHubLinks` (puro). Nunca 404: `requireActivePerson()` sem
 * `allowFirstAccess` herda o redirect a `/trocar-senha` no 1º acesso (HUB-07);
 * qualquer Pessoa ativa vê ao menos os links pessoais fixos (HUB-02).
 */
export default async function HubPage() {
  const person = await requireActivePerson();

  const access: HubAccess = {
    ...hubAccessFromRoles(person.roles),
    moderation: await canAccessModerationQueue(person),
  };
  const groups = buildHubLinks(access);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <FormHeader
        title={`Olá, ${person.fullName}`}
        description="Estes são os atalhos disponíveis para você."
      />

      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold text-fg">{group.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.links.map((link) => (
              <HubLinkCard key={link.href} link={link} />
            ))}
          </div>
        </section>
      ))}

      <SignOutForm />
    </main>
  );
}
