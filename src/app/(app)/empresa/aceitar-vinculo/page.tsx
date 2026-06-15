import { requireActivePerson } from '@/modules/identity';
import {
  listPendingResponsibleLinks,
  PendingResponsibleLinksList,
} from '@/modules/companies';

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
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Aceitar vínculo de responsável</h1>
        <p className="mt-1 text-sm text-gray-600">
          Convites para você representar uma Empresa como responsável. Ao aceitar, o vínculo passa
          a valer imediatamente.
        </p>
      </header>

      <PendingResponsibleLinksList items={links} />
    </main>
  );
}
