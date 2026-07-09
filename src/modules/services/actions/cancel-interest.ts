'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { canCancelInterest } from '../domain/service-interest-rules';
import { cancelInterestSchema, type CancelInterestInput } from '../schemas/service-interest.schema';

export interface CancelInterestResult {
  interestId: string;
  /** `true` quando a manifestação já estava cancelada (idempotência — AC-034-3). */
  alreadyCancelled: boolean;
}

/** Conflito de concorrência otimista — a manifestação não estava mais ativa no momento do write. */
class CancelConflictError extends Error {}

/**
 * Cancela uma manifestação de interesse ATIVA e própria do cliente autenticado
 * (USP-034 — AC-034-1). Self-service — sem `requirePermission` nem
 * `requireActiveConsent` (A-3/AD-017): retirar o próprio tratamento de dados é
 * sempre permitido ao titular. **Não** revoga o consentimento `SERVICE_HIRING`
 * nem desativa o papel `CLIENT` (SVC034-MN-02) — o cancelamento só toca a
 * linha `ServiceInterest`.
 *
 * Sequência: Zod → `getCurrentPerson` → `findFirst` **escopada** a
 * `clientPersonId = person.id` (owner + existência foldados — manifestação de
 * terceiro "não existe" para esta sessão, sem vazar existência, SVC034-MN-01)
 * → pré-decisão de idempotência **antes de abrir tx** (padrão `revokeConsent`
 * — já cancelada ⇒ `ok({ alreadyCancelled: true })` sem `withAudit`, para não
 * gravar `INTEREST_CANCELLED` espúrio no log append-only, AC-034-3) →
 * `withAudit(INTEREST_CANCELLED)`: `updateMany({ where: { id, clientPersonId,
 * cancelledAt: null } })` (optimistic — defesa em profundidade contra
 * duplo-cancelamento concorrente, junto ao pré-check). Nunca lança.
 */
export async function cancelInterest(
  rawInput: CancelInterestInput,
): Promise<ActionResult<CancelInterestResult>> {
  const log = childLogger({ module: 'services', action: 'cancelInterest' });

  const parsed = cancelInterestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { interestId } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  // Owner + existência foldados (SVC034-MN-01): manifestação de terceiro "não
  // existe" para esta sessão — sem vazar sua existência.
  const interest = await prisma.serviceInterest.findFirst({
    where: { id: interestId, clientPersonId: person.id },
    select: { id: true, cancelledAt: true },
  });
  if (!interest) {
    return fail('NOT_FOUND', 'Manifestação de interesse não encontrada.');
  }

  const gate = canCancelInterest(interest);
  if (!gate.ok) {
    // AC-034-3: idempotente — sem abrir `withAudit` (nenhum evento espúrio no
    // log append-only para uma operação que não mudou nada).
    return ok({ interestId, alreadyCancelled: true });
  }

  try {
    await withAudit(
      AuditEvent.INTEREST_CANCELLED,
      async (tx, audit) => {
        const result = await tx.serviceInterest.updateMany({
          where: { id: interestId, clientPersonId: person.id, cancelledAt: null },
          data: { cancelledAt: new Date() },
        });
        if (result.count !== 1) {
          throw new CancelConflictError();
        }
        audit.entityType = 'SERVICE_INTEREST';
        audit.entityId = interestId;
        audit.before = { cancelledAt: null };
        audit.after = { cancelledAt: new Date().toISOString() };
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, context: { interestId } },
    );
  } catch (err) {
    if (err instanceof CancelConflictError) {
      // A linha foi cancelada por uma requisição concorrente — idempotente,
      // sem novo audit (a corrida já foi auditada pela requisição que venceu).
      return ok({ interestId, alreadyCancelled: true });
    }
    log.error({ err, interestId }, 'services:cancel_interest_failed');
    return fail('INTERNAL', 'Não foi possível cancelar a manifestação de interesse. Tente novamente mais tarde.');
  }

  log.info({ actorPersonId: person.id, interestId }, 'services:interest_cancelled');
  return ok({ interestId, alreadyCancelled: false });
}
