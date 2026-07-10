import type { ContentStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { resolveReportWindow, type ReportWindowInput } from '../domain/report-window';
import { moderationAvgHours, type ModerationPair } from '../domain/moderation-time';

/** R5 — relatório de fila de moderação (MP10/MP3), por período. Gated por REL42-MN-02 (T1). */
export type ModerationQueueReportFilters = ReportWindowInput;

/** Contagem da fila ATUAL (não filtrada por período — é um retrato do "agora"). */
export interface ModerationQueueCounts {
  JOB: number;
  CV: number;
  SERVICE: number;
  CANDIDATE_PROFILE: number;
}

export interface ModerationQueueReport {
  /** Fila atual: `IN_MODERATION`/`AWAITING_ADJUSTMENTS` por tipo (design.md §5). */
  queueByKind: ModerationQueueCounts;
  /** MP10 — média em horas envio→decisão dos pares extraídos do `audit_log` na janela. */
  avgModerationHours: number | null;
  /** MP3 — distinct `Service.authorPersonId` com `status='ACTIVE'` (não filtrado por período). */
  activeProviders: number;
}

const CURRENT_QUEUE_STATUSES: readonly ContentStatus[] = ['IN_MODERATION', 'AWAITING_ADJUSTMENTS'];
const DECISION_EVENTS = ['CONTENT_APPROVED', 'CONTENT_REJECTED', 'CONTENT_RETURNED_FOR_ADJUSTMENTS'] as const;

/**
 * Fila ATUAL por tipo de conteúdo — mesmas 3 fontes de `viewModerationQueue`
 * (moderation/queries/moderation-queue.ts, GAP-8): `Job`/`Service` têm model
 * real; `CV`/`CANDIDATE_PROFILE` ainda usam o store transitório
 * `_moderation_fixture`. Não é filtrada por período — é um retrato do "agora".
 */
async function currentQueueCounts(): Promise<ModerationQueueCounts> {
  const [jobCount, serviceCount, fixtureRows] = await Promise.all([
    prisma.job.count({ where: { status: { in: [...CURRENT_QUEUE_STATUSES] } } }),
    prisma.service.count({ where: { status: { in: [...CURRENT_QUEUE_STATUSES] } } }),
    prisma.moderationFixtureContent.groupBy({
      by: ['kind'],
      where: { status: { in: [...CURRENT_QUEUE_STATUSES] } },
      _count: { _all: true },
    }),
  ]);

  const fixtureByKind = new Map(fixtureRows.map((r) => [r.kind, r._count._all]));

  return {
    JOB: jobCount,
    SERVICE: serviceCount,
    CV: fixtureByKind.get('CV') ?? 0,
    CANDIDATE_PROFILE: fixtureByKind.get('CANDIDATE_PROFILE') ?? 0,
  };
}

/**
 * MP3 — prestadores ativos: distinct `Service.authorPersonId` com pelo menos
 * 1 serviço `ACTIVE`. Não filtrado por período (retrato do "agora", espelha
 * `getHomeIndicators`/USP-041).
 */
async function activeProvidersCount(): Promise<number> {
  const rows = await prisma.service.groupBy({ by: ['authorPersonId'], where: { status: 'ACTIVE' } });
  return rows.length;
}

/**
 * Extrai os pares submit→1ª decisão do `audit_log` (design.md §5), 1 linha
 * por `entityId`: `submittedAt` = a 1ª submissão dentro da janela;
 * `decidedAt` = a 1ª decisão (`CONTENT_APPROVED`/`CONTENT_REJECTED`/
 * `CONTENT_RETURNED_FOR_ADJUSTMENTS`) que ocorre DEPOIS dela (`null` se
 * ainda não decidido). MVP low-volume (ASSUMP-042-04) — pareamento em
 * memória, sem tabela de pré-agregação; `take` alto evita N+1 por entidade.
 */
async function fetchModerationPairs(dateRange: { gte?: Date; lt?: Date }): Promise<ModerationPair[]> {
  const submits = await prisma.auditLog.findMany({
    where: {
      action: 'CONTENT_SUBMITTED_TO_MODERATION',
      occurredAt: dateRange,
      entityId: { not: null },
    },
    select: { entityId: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
    take: 2000,
  });
  if (submits.length === 0) return [];

  const firstSubmitByEntity = new Map<string, Date>();
  for (const submit of submits) {
    const entityId = submit.entityId as string;
    const existing = firstSubmitByEntity.get(entityId);
    if (!existing || submit.occurredAt.getTime() < existing.getTime()) {
      firstSubmitByEntity.set(entityId, submit.occurredAt);
    }
  }

  const entityIds = [...firstSubmitByEntity.keys()];
  const decisions = await prisma.auditLog.findMany({
    where: { action: { in: [...DECISION_EVENTS] }, entityId: { in: entityIds } },
    select: { entityId: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
    take: 4000,
  });

  const firstDecisionAfterSubmit = new Map<string, Date>();
  for (const decision of decisions) {
    const entityId = decision.entityId as string;
    const submittedAt = firstSubmitByEntity.get(entityId);
    if (!submittedAt || decision.occurredAt.getTime() <= submittedAt.getTime()) continue;
    const existing = firstDecisionAfterSubmit.get(entityId);
    if (!existing || decision.occurredAt.getTime() < existing.getTime()) {
      firstDecisionAfterSubmit.set(entityId, decision.occurredAt);
    }
  }

  return entityIds.map((entityId) => ({
    submittedAt: firstSubmitByEntity.get(entityId) as Date,
    decidedAt: firstDecisionAfterSubmit.get(entityId) ?? null,
  }));
}

/**
 * R5 — fila atual + MP10 (janela) + MP3. **RBAC não é checado aqui** — a
 * decisão de acesso é de {@link canViewModerationQueueReport} (T1),
 * consultada pelo chamador (Server Action/rota, T11/T12); esta função é uma
 * leitura pura de agregados, reutilizável independente de quem pergunta.
 */
export async function reportModerationQueue(
  filters: ModerationQueueReportFilters,
): Promise<ModerationQueueReport> {
  const window = resolveReportWindow(filters);
  const dateRange = { gte: window.gte ?? undefined, lt: window.lt ?? undefined };

  const [queueByKind, pairs, activeProviders] = await Promise.all([
    currentQueueCounts(),
    fetchModerationPairs(dateRange),
    activeProvidersCount(),
  ]);

  return {
    queueByKind,
    avgModerationHours: moderationAvgHours(pairs),
    activeProviders,
  };
}
