import { requireActivePerson } from '@/modules/identity';
import {
  ConsentsPanel,
  buildOwnConsentsView,
  listOwnConsents,
  loadTerm,
  type ConsentsPanelItem,
} from '@/modules/consents';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/** Remove o front-matter YAML (`---...---`) do termo para exibição ao titular. */
function termBody(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

/**
 * Painel "Meus consentimentos" (USP-043 / LGP-05). Lista os consentimentos
 * vigentes e revogados **do próprio titular**, permite abrir o termo aceito e
 * revogar por finalidade. Privacidade: usa o `id` da Pessoa autenticada.
 */
export default async function ConsentimentosPage() {
  const person = await requireActivePerson();
  const rows = await listOwnConsents(person.id);
  const views = buildOwnConsentsView(rows);

  // Carrega o corpo do termo da versão aceita (cache por finalidade+versão).
  const termCache = new Map<string, string>();
  const items: ConsentsPanelItem[] = await Promise.all(
    views.map(async (view) => {
      const key = `${view.purpose}@${view.termVersion}`;
      let body = termCache.get(key);
      if (body === undefined) {
        try {
          const term = await loadTerm(view.purpose, view.termVersion);
          body = termBody(term.content);
        } catch {
          body = 'Não foi possível carregar o texto desta versão do termo.';
        }
        termCache.set(key, body);
      }
      return { ...view, termBody: body };
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Meus consentimentos</h1>
        <p className="mt-1 text-sm text-gray-600">
          Gerencie as finalidades para as quais você autorizou o uso dos seus dados. Você pode abrir
          cada termo aceito e revogar uma finalidade a qualquer momento — seus dados de perfil são
          preservados e as demais finalidades não são afetadas (LGPD).
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
          Você ainda não registrou nenhum consentimento.
        </p>
      ) : (
        <ConsentsPanel items={items} />
      )}
    </main>
  );
}
