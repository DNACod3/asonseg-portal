import { requireActivePerson } from '@/modules/identity';
import {
  listPendingResponsibleLinks,
  PendingResponsibleLinksList,
} from '@/modules/companies';
import { FormHeader } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Aceite de vínculo de responsável (USP-013). O e-mail de convite aponta para cá
 * com `?empresaId=...`, mas listamos todos os convites pendentes da Pessoa — a
 * identidade vem da sessão (P-002), o link não autentica. Sem sessão,
 * `requireActivePerson` redireciona para /login (comportamento testado em E2E).
 */
export default async function AceitarVinculoPage() {
  const person = await requireActivePerson();
  const links = await listPendingResponsibleLinks(person.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <FormHeader
        title="Aceitar vínculo de responsável"
        description="Convites para você representar uma Empresa como responsável. Ao aceitar, o vínculo passa a valer imediatamente."
      />

      <PendingResponsibleLinksList items={links} />
    </main>
  );
}
