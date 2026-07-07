import { requireActivePerson } from '@/modules/identity';
import {
  ConsentsPanel,
  buildOwnConsentsView,
  listOwnConsents,
  loadTerm,
  stripTermFrontMatter,
  TERM_BODY_UNAVAILABLE,
  type ConsentsPanelItem,
} from '@/modules/consents';
import { Card } from '@/shared/ui';

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Painel "Meus consentimentos" (USP-043 / LGP-05). Lista os consentimentos
 * vigentes e revogados **do próprio titular**, permite abrir o termo aceito e
 * revogar por finalidade. Privacidade: usa o `id` da Pessoa autenticada.
 */
export default async function ConsentimentosPage() {
  const person = await requireActivePerson();
  const rows = await listOwnConsents(person.id);
  const views = buildOwnConsentsView(rows);

  // Carrega o corpo do termo da versão aceita, deduplicando por finalidade+versão
  // ANTES do fan-out: várias linhas (revogar + re-aceitar a mesma versão) leem o
  // disco uma única vez. Resolver as chaves distintas primeiro evita a corrida do
  // `Promise.all` (todas as callbacks veriam o cache vazio antes de qualquer
  // `set`), que faria `loadTerm` rodar uma vez por linha.
  const uniqueKeys = new Map(views.map((v) => [`${v.purpose}@${v.termVersion}`, v]));
  const loaded = await Promise.all(
    [...uniqueKeys.values()].map(async (view) => {
      const key = `${view.purpose}@${view.termVersion}`;
      try {
        const term = await loadTerm(view.purpose, view.termVersion);
        return [key, stripTermFrontMatter(term.content)] as const;
      } catch {
        return [key, TERM_BODY_UNAVAILABLE] as const;
      }
    }),
  );
  const termCache = new Map(loaded);

  const items: ConsentsPanelItem[] = views.map((view) => ({
    ...view,
    termBody: termCache.get(`${view.purpose}@${view.termVersion}`) ?? TERM_BODY_UNAVAILABLE,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-fg">Meus consentimentos</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Gerencie as finalidades para as quais você autorizou o uso dos seus dados. Você pode abrir
          cada termo aceito e revogar uma finalidade a qualquer momento - seus dados de perfil são
          preservados e as demais finalidades não são afetadas (LGPD).
        </p>
      </header>

      {items.length === 0 ? (
        <Card className="text-sm text-fg-muted">Você ainda não registrou nenhum consentimento.</Card>
      ) : (
        <ConsentsPanel items={items} />
      )}
    </main>
  );
}
