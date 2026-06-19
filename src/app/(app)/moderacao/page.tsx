import { notFound } from 'next/navigation';
import { requireActivePerson } from '@/modules/identity';
import {
  ModerationQueue,
  canAccessModerationQueue,
  viewModerationQueue,
  type ModerationQueueRow,
  type VerificationPanelData,
} from '@/modules/moderation';
import {
  viewCompanyVerificationContexts,
  listCompanyRejections,
  type CompanyRejection,
} from '@/modules/companies';
import { formatSaoPaulo } from '@/shared/lib/time';

const DATE_LABEL = "dd/MM/yyyy 'às' HH:mm";

// Rota (app): área autenticada — sem cache, revalida a sessão a cada request.
export const dynamic = 'force-dynamic';

/**
 * Fila de moderação de conteúdo (USP-016 / E-001..E-004).
 *
 * Visível a coordenadores e voluntários com delegação de moderação; quem não
 * tem acesso recebe 404 — a rota não revela sua existência. A decisão por item
 * re-checa a permissão na Server Action (defesa em profundidade — P-007), e a
 * mudança de status passa exclusivamente por `transitionContent` (AC6/P-006),
 * com auditoria na mesma transação (AC5) e e-mail ao autor (E-002..E-004).
 */
export default async function ModeracaoPage() {
  const person = await requireActivePerson();
  if (!(await canAccessModerationQueue(person))) {
    notFound();
  }

  const items = await viewModerationQueue({ viewerPersonId: person.id });

  // Contexto de verificação das Empresas das vagas na fila (USP-017) — batch para
  // evitar N+1; o histórico de rejeições é carregado por Empresa em paralelo.
  const companyIds = [
    ...new Set(items.map((i) => i.companyId).filter((id): id is string => Boolean(id))),
  ];
  const contexts = await viewCompanyVerificationContexts(companyIds);
  const rejectionsByCompany = new Map<string, CompanyRejection[]>(
    await Promise.all(
      companyIds.map(
        async (id) => [id, await listCompanyRejections(id)] as const,
      ),
    ),
  );

  function buildVerification(companyId: string | undefined): VerificationPanelData | undefined {
    if (!companyId) return undefined;
    const ctx = contexts.get(companyId);
    if (!ctx) return undefined;
    return {
      companyId: ctx.companyId,
      cnpj: ctx.cnpj,
      razaoSocial: ctx.razaoSocial,
      nomeFantasia: ctx.nomeFantasia,
      setor: ctx.setor,
      endereco: ctx.endereco,
      isVerified: ctx.isVerified,
      verifiedAtLabel: ctx.verifiedAt ? formatSaoPaulo(ctx.verifiedAt, DATE_LABEL) : null,
      verifiedByName: ctx.verifiedByName,
      rejectionCount: ctx.rejectionCount,
      changedSinceVerification: ctx.changedSinceVerification,
      rejections: (rejectionsByCompany.get(companyId) ?? []).map((r) => ({
        rejectedAtLabel: formatSaoPaulo(r.rejectedAt, DATE_LABEL),
        byName: r.byName,
        reason: r.reason,
      })),
    };
  }

  const rows: ModerationQueueRow[] = items.map((item) => ({
    contentKind: item.contentKind,
    contentId: item.contentId,
    title: item.title,
    authorName: item.authorName,
    submittedAtLabel: formatSaoPaulo(item.submittedAt, DATE_LABEL),
    companyUnverified: item.companyUnverified,
    verification: buildVerification(item.companyId),
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900">Fila de moderação</h1>
        <p className="text-sm text-gray-600">
          Revise os rascunhos enviados e decida: aprovar (fica visível no portal), devolver para
          ajustes ou rejeitar. Devolução e rejeição exigem um motivo descritivo, enviado ao autor.
          Toda decisão fica registrada na auditoria com o seu nome e a data/hora.
        </p>
      </header>

      <ModerationQueue items={rows} />
    </main>
  );
}
