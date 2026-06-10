import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { viewStaffPersonNames } from '@/modules/persons';
import type { ContentKind } from '../domain/content-status';
import type { ModerationQueueItem } from '../views/moderation-queue-item';

/** Limite de itens da fila por leitura (paginação obrigatória — L-001). */
const QUEUE_PAGE_SIZE = 100;

/**
 * Fila do coordenador (E-001 / P-005): rascunhos `IN_MODERATION`, do mais antigo
 * para o mais recente, **excluindo** os itens cujo autor é o próprio moderador
 * (conflito de interesse — ADR-0024).
 *
 * GAP-8: enquanto os models reais de conteúdo (`jobs`/`services`/
 * `candidate_profiles`) não existem, a fila lê o store transitório
 * `_moderation_fixture`. Quando aterrissarem, a leitura passa a unir as fontes
 * por tipo — o contrato (status, ordem, autor≠moderador, view model) permanece.
 */
export async function viewModerationQueue({
  viewerPersonId,
}: {
  viewerPersonId: string;
}): Promise<ModerationQueueItem[]> {
  const rows = await prisma.moderationFixtureContent.findMany({
    where: {
      status: PrismaContentStatus.IN_MODERATION,
      authorPersonId: { not: viewerPersonId }, // P-005 — autor ≠ moderador
    },
    select: { id: true, kind: true, title: true, authorPersonId: true, submittedAt: true },
    orderBy: { submittedAt: 'asc' }, // E-001 — mais antigo primeiro
    take: QUEUE_PAGE_SIZE,
  });

  if (rows.length === 0) return [];

  // Nome do autor via View Model de staff do módulo `persons` (ADR-0010): nunca
  // lemos `Person` direto de outro módulo. O helper resolve tudo numa única
  // consulta (evita N+1) e expõe só `id → nome`, sem dados da ficha social.
  const nameById = await viewStaffPersonNames(rows.map((r) => r.authorPersonId));

  return rows.map((r) => ({
    contentKind: r.kind as ContentKind,
    contentId: r.id,
    title: r.title,
    authorName: nameById.get(r.authorPersonId) ?? null,
    submittedAt: r.submittedAt,
  }));
}
