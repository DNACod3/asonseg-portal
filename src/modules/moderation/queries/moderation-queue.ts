import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { viewStaffPersonNames } from '@/modules/persons';
import { ContentKind } from '../domain/content-status';
import type { ModerationQueueItem } from '../views/moderation-queue-item';

/** Limite de itens da fila por leitura (paginação obrigatória — L-001). */
const QUEUE_PAGE_SIZE = 100;

/** Linha intermediária antes de resolver o nome do autor (fonte-agnóstica). */
interface QueueRow {
  contentKind: ContentKind;
  contentId: string;
  title: string;
  authorPersonId: string;
  submittedAt: Date;
  companyUnverified?: boolean;
  companyId?: string;
}

/**
 * Fila do coordenador (E-001 / P-005): rascunhos `IN_MODERATION`, do mais antigo
 * para o mais recente, **excluindo** os itens cujo autor é o próprio moderador
 * (conflito de interesse — ADR-0024).
 *
 * GAP-8 / USP-017: as **vagas** (`JOB`) já têm model real e são lidas de `jobs`
 * com join à Empresa (`companyUnverified` dispara o painel de verificação). Os
 * demais tipos (`CV`/`SERVICE`/`CANDIDATE_PROFILE`) ainda usam o store transitório
 * `_moderation_fixture` até suas USPs. As fontes são unidas, ordenadas por
 * `submittedAt` e cortadas no limite da página — o contrato do view model permanece.
 */
export async function viewModerationQueue({
  viewerPersonId,
}: {
  viewerPersonId: string;
}): Promise<ModerationQueueItem[]> {
  const [jobRows, fixtureRows] = await Promise.all([
    prisma.job.findMany({
      where: {
        status: PrismaContentStatus.IN_MODERATION,
        authorPersonId: { not: viewerPersonId }, // P-005 — autor ≠ moderador
      },
      select: {
        id: true,
        title: true,
        authorPersonId: true,
        lastStatusChangeAt: true,
        company: { select: { id: true, isVerified: true } },
      },
      orderBy: { lastStatusChangeAt: 'asc' }, // E-001 — mais antigo primeiro
      take: QUEUE_PAGE_SIZE,
    }),
    prisma.moderationFixtureContent.findMany({
      where: {
        status: PrismaContentStatus.IN_MODERATION,
        authorPersonId: { not: viewerPersonId },
      },
      select: { id: true, kind: true, title: true, authorPersonId: true, submittedAt: true },
      orderBy: { submittedAt: 'asc' },
      take: QUEUE_PAGE_SIZE,
    }),
  ]);

  const jobItems: QueueRow[] = jobRows.map((j) => ({
    contentKind: ContentKind.JOB,
    contentId: j.id,
    title: j.title,
    authorPersonId: j.authorPersonId,
    // Entrada em IN_MODERATION (lastStatusChangeAt é setado na transição — USP-020).
    submittedAt: j.lastStatusChangeAt,
    companyUnverified: !j.company.isVerified, // E-001 — dispara o painel (USP-017)
    companyId: j.company.id,
  }));

  const fixtureItems: QueueRow[] = fixtureRows.map((r) => ({
    contentKind: r.kind as ContentKind,
    contentId: r.id,
    title: r.title,
    authorPersonId: r.authorPersonId,
    submittedAt: r.submittedAt,
  }));

  // Une as fontes, ordena (mais antigo primeiro) e respeita o limite da página.
  const rows = [...jobItems, ...fixtureItems]
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(0, QUEUE_PAGE_SIZE);

  if (rows.length === 0) return [];

  // Nome do autor via View Model de staff do módulo `persons` (ADR-0010): nunca
  // lemos `Person` direto de outro módulo. O helper resolve tudo numa única
  // consulta (evita N+1) e expõe só `id → nome`, sem dados da ficha social.
  const nameById = await viewStaffPersonNames(rows.map((r) => r.authorPersonId));

  return rows.map((r) => ({
    contentKind: r.contentKind,
    contentId: r.contentId,
    title: r.title,
    authorName: nameById.get(r.authorPersonId) ?? null,
    submittedAt: r.submittedAt,
    companyUnverified: r.companyUnverified,
    companyId: r.companyId,
  }));
}
