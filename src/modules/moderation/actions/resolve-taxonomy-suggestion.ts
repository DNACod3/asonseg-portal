'use server';

import { Prisma } from '@prisma/client';
import { requirePermission } from '@/modules/identity';
import { withAudit, type AuditTx } from '@/modules/audit';
import { fail, ok, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import type { TaxonomyKind } from '../domain/taxonomy-suggestion';
import {
  resolveTaxonomySuggestionSchema,
  type ResolveTaxonomySuggestionInput,
} from '../schemas/taxonomy-suggestion';

const log = childLogger({ module: 'moderation', fn: 'resolveTaxonomySuggestion' });

const INVALID_INPUT = 'Não foi possível processar a decisão: dados inválidos.';
const NOT_FOUND_MESSAGE = 'Sugestão não encontrada.';

function entityTypeFor(kind: TaxonomyKind): string {
  return kind === 'JOB_AREA' ? 'job_area' : 'service_category';
}

interface TaxonomyRow {
  id: string;
  name: string;
  isSuggestion: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  suggestedBy: string | null;
  createdAt: Date;
}

/**
 * Lê a linha pendente por `id` (defesa contra `id` inexistente/já resolvido —
 * `switch` explícito pelo mesmo motivo de `suggest-taxonomy.ts`: os delegates
 * Prisma de `JobArea`/`ServiceCategory` não são union-callable).
 */
async function findPending(kind: TaxonomyKind, tx: AuditTx, id: string): Promise<TaxonomyRow | null> {
  switch (kind) {
    case 'JOB_AREA':
      return tx.jobArea.findUnique({ where: { id } });
    case 'SERVICE_CATEGORY':
      return tx.serviceCategory.findUnique({ where: { id } });
  }
}

async function approveRow(
  kind: TaxonomyKind,
  tx: AuditTx,
  id: string,
  approvedBy: string,
): Promise<TaxonomyRow> {
  const data = { isSuggestion: false, approvedAt: new Date(), approvedBy };
  switch (kind) {
    case 'JOB_AREA':
      return tx.jobArea.update({ where: { id, isSuggestion: true }, data });
    case 'SERVICE_CATEGORY':
      return tx.serviceCategory.update({ where: { id, isSuggestion: true }, data });
  }
}

async function deleteRow(kind: TaxonomyKind, tx: AuditTx, id: string): Promise<TaxonomyRow> {
  switch (kind) {
    case 'JOB_AREA':
      return tx.jobArea.delete({ where: { id } });
    case 'SERVICE_CATEGORY':
      return tx.serviceCategory.delete({ where: { id } });
  }
}

/**
 * Aprovar uma sugestão de taxonomia pendente (USP-019 / SUGG-03): promove
 * `isSuggestion=false` (passa a ser selecionável) e audita `CATEGORY_APPROVED`
 * na mesma transação. Sequência canônica: Zod → `requirePermission` → `withAudit`.
 */
export async function approveTaxonomySuggestion(
  input: ResolveTaxonomySuggestionInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = resolveTaxonomySuggestionSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const authz = await requirePermission('APPROVE_CATEGORY_SUGGESTION');
  if (!authz.ok) return authz;

  const { kind, id } = parsed.data;

  try {
    const updated = await withAudit(
      'CATEGORY_APPROVED',
      async (tx, audit) => {
        const before = await findPending(kind, tx, id);
        if (!before) throw new NotFoundError();

        const after = await approveRow(kind, tx, id, authz.data.person.id);
        audit.entityType = entityTypeFor(kind);
        audit.entityId = id;
        audit.before = before;
        audit.after = after;
        return after;
      },
      { actorPersonId: authz.data.person.id, context: { kind } },
    );

    return ok({ id: updated.id });
  } catch (err) {
    if (err instanceof NotFoundError || isRecordNotFound(err)) {
      return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
    }
    log.error({ err, kind, id }, 'moderation:approve-taxonomy-suggestion:failed');
    return fail('INTERNAL', 'Não foi possível aprovar a sugestão.');
  }
}

/**
 * Rejeitar uma sugestão de taxonomia pendente (USP-019 / SUGG-04): remove a
 * linha (DELETE — schema não tem colunas de rejeição) preservando o
 * before-state no `audit_log` (`CATEGORY_SUGGESTION_REJECTED`, motivo opcional).
 */
export async function rejectTaxonomySuggestion(
  input: ResolveTaxonomySuggestionInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = resolveTaxonomySuggestionSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const authz = await requirePermission('APPROVE_CATEGORY_SUGGESTION');
  if (!authz.ok) return authz;

  const { kind, id, reason } = parsed.data;

  try {
    const deleted = await withAudit(
      'CATEGORY_SUGGESTION_REJECTED',
      async (tx, audit) => {
        const before = await findPending(kind, tx, id);
        if (!before || !before.isSuggestion) throw new NotFoundError();

        const removed = await deleteRow(kind, tx, id);
        audit.entityType = entityTypeFor(kind);
        audit.entityId = id;
        audit.before = before;
        audit.justification = reason?.trim() || null;
        return removed;
      },
      { actorPersonId: authz.data.person.id, context: { kind } },
    );

    return ok({ id: deleted.id });
  } catch (err) {
    if (err instanceof NotFoundError || isRecordNotFound(err)) {
      return fail('NOT_FOUND', NOT_FOUND_MESSAGE);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      // Defensivo: sugestão pendente nunca é selecionável, então nunca deveria
      // ter FK dependente — mapeia para CONFLICT em vez de vazar um 500.
      return fail('CONFLICT', 'Esta sugestão não pode ser removida no momento.');
    }
    log.error({ err, kind, id }, 'moderation:reject-taxonomy-suggestion:failed');
    return fail('INTERNAL', 'Não foi possível rejeitar a sugestão.');
  }
}

/** Erro sentinela — `id` inexistente ou já resolvido (aprovado). */
class NotFoundError extends Error {}

function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}
