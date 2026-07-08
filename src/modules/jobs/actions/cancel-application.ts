'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { canCancelApplication } from '../domain/application-rules';
import { cancelApplicationSchema, type CancelApplicationInput } from '../schemas/application.schema';

export interface CancelApplicationResult {
  applicationId: string;
}

/** Conflito de concorrência otimista — a candidatura não estava mais ativa no momento do write. */
class CancelConflictError extends Error {}

/**
 * Cancela uma candidatura ATIVA e própria da Pessoa autenticada (USP-026 /
 * CAN-02). Self-service — sem `requirePermission` nem `requireActiveConsent`
 * (A-3): retirar tratamento de dados é sempre permitido ao titular.
 *
 * Sequência: Zod → `getCurrentPerson` → `findFirst` **escopada** a
 * `candidatePersonId = person.id` (owner + existência foldados — candidatura de
 * terceiro "não existe" para esta sessão, sem vazar existência, CAN-026-MN-01) →
 * `canCancelApplication` (já cancelada → `PRECONDITION_FAILED`, CAN-026-MN-02) →
 * `withAudit(APPLICATION_CANCELLED)`: `updateMany({ where: { id, cancelledAt:
 * null } })` (optimistic — defesa em profundidade contra duplo-cancelamento
 * concorrente, junto ao pré-check). Nunca lança.
 */
export async function cancelApplication(
  rawInput: CancelApplicationInput,
): Promise<ActionResult<CancelApplicationResult>> {
  const log = childLogger({ module: 'jobs', action: 'cancelApplication' });

  const parsed = cancelApplicationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { applicationId } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // Owner + existência foldados (A-2 / CAN-026-MN-01): candidatura de terceiro
  // "não existe" para esta sessão — sem vazar sua existência.
  const app = await prisma.application.findFirst({
    where: { id: applicationId, candidatePersonId: person.id },
    select: { id: true, cancelledAt: true },
  });
  if (!app) {
    return fail('NOT_FOUND', 'Candidatura não encontrada.');
  }

  const gate = canCancelApplication(app);
  if (!gate.ok) {
    return fail('PRECONDITION_FAILED', 'Candidatura já cancelada.');
  }

  try {
    await withAudit(
      AuditEvent.APPLICATION_CANCELLED,
      async (tx, audit) => {
        const result = await tx.application.updateMany({
          where: { id: applicationId, cancelledAt: null },
          data: { cancelledAt: new Date() },
        });
        if (result.count !== 1) {
          throw new CancelConflictError();
        }
        audit.entityType = 'APPLICATION';
        audit.entityId = applicationId;
        audit.before = { cancelledAt: null };
        audit.after = { cancelledAt: new Date().toISOString() };
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, context: { applicationId } },
    );
  } catch (err) {
    if (err instanceof CancelConflictError) {
      return fail('PRECONDITION_FAILED', 'Candidatura já cancelada.');
    }
    log.error({ err, applicationId }, 'jobs:cancel_application_failed');
    return fail('INTERNAL', 'Não foi possível cancelar a candidatura. Tente novamente mais tarde.');
  }

  log.info({ actorPersonId: person.id, applicationId }, 'jobs:application_cancelled');
  return ok({ applicationId });
}
