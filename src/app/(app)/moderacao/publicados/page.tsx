import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import { canManagePublishedContent, PublishedContentManager, type PublishedContentRow } from '@/modules/moderation';
import { listActivePublishedJobs } from '@/modules/jobs';
import { formatSaoPaulo } from '@/shared/lib/time';

const DATE_LABEL = "dd/MM/yyyy 'às' HH:mm";

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Superfície de gestão de conteúdo publicado (USP-018 / INACT-06).
 *
 * Visível a coordenadores e voluntários com delegação de
 * `INACTIVATE_PUBLISHED_CONTENT`; quem não tem acesso recebe 404 — a rota não
 * revela sua existência. Lista vagas `ACTIVE` e permite inativar cada uma com
 * motivo obrigatório, exclusivamente via `inactivateContent` (a única via de
 * mudança de status — AC6/P-006), que re-checa a permissão (defesa em
 * profundidade — INACT-MN-03).
 */
export default async function ConteudoPublicadoPage() {
  const person = await requireActivePerson();
  if (!(await canManagePublishedContent(person))) {
    notFound();
  }

  const { items } = await listActivePublishedJobs();

  const rows: PublishedContentRow[] = items.map((item) => ({
    contentId: item.id,
    title: item.title,
    companyName: item.companyName,
    areaName: item.areaName,
    publishedAtLabel: item.publishedAt ? formatSaoPaulo(item.publishedAt, DATE_LABEL) : '—',
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-fg">Conteúdo publicado</h1>
        <p className="text-sm text-fg-muted">
          Vagas atualmente visíveis no portal. Inative uma vaga para removê-la imediatamente da
          vitrine pública — a inativação exige um motivo descritivo e fica registrada na auditoria
          com o seu nome e a data/hora. Esta ação não pode ser desfeita pela interface.
        </p>
      </header>

      <PublishedContentManager items={rows} />
    </main>
  );
}
