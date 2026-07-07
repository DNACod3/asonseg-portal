import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import {
  canApproveTaxonomySuggestions,
  listTaxonomySuggestions,
  TaxonomySuggestionsList,
  type TaxonomySuggestionRow,
} from '@/modules/moderation';
import { formatSaoPaulo } from '@/shared/lib/time';

const DATE_LABEL = "dd/MM/yyyy 'às' HH:mm";

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Fila de sugestões de taxonomia (USP-019 / SUGG-06).
 *
 * Visível a coordenadores e voluntários com delegação de
 * `APPROVE_CATEGORY_SUGGESTION`; quem não tem acesso recebe 404 — a rota não
 * revela sua existência. Lista sugestões pendentes de área de vaga e
 * categoria de serviço; aprovar/rejeitar re-checa a permissão na Server
 * Action (defesa em profundidade — SUGG-MN-02).
 */
export default async function SugestoesPage() {
  const person = await requireActivePerson();
  if (!(await canApproveTaxonomySuggestions(person))) {
    notFound();
  }

  const items = await listTaxonomySuggestions();

  const rows: TaxonomySuggestionRow[] = items.map((item) => ({
    id: item.id,
    kind: item.kind,
    name: item.name,
    suggestedByName: item.suggestedByName,
    createdAtLabel: formatSaoPaulo(item.createdAt, DATE_LABEL),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-fg">Sugestões de categoria</h1>
        <p className="text-sm text-fg-muted">
          Revise as áreas de vaga e categorias de serviço sugeridas por Pessoas ao publicar
          conteúdo. Aprovar integra o nome ao catálogo padronizado; rejeitar remove a sugestão sem
          afetar o catálogo. Toda decisão fica registrada na auditoria.
        </p>
      </header>

      <TaxonomySuggestionsList items={rows} />
    </main>
  );
}
