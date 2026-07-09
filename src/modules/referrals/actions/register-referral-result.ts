'use server';

import { requirePermission } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import {
  registerReferralResultSchema,
  type RegisterReferralResultInput,
} from '../schemas/referral.schema';

export interface RegisterReferralResultResult {
  referralId: string;
}

/**
 * Registra (ou re-registra) o resultado de um `Referral` existente, com
 * proveniência (USP-038 / SOC-05). Ação sensível — sequência canônica
 * (CLAUDE.md): Zod (enum restrito — REF38-MN-01) →
 * `requirePermission('REGISTER_REFERRAL_RESULT')` (REF38-MN-02) →
 * pré-condição (`Referral` existe — EC-1) → `withAudit(REFERRAL_RESULT_REGISTERED)`:
 * `UPDATE` seta `result`/`resultObservation`/`resultRegisteredBy`/
 * `resultRegisteredAt` (proveniência sempre presente — REF38-MN-03; `sem
 * requireActiveConsent` — ação institucional sobre o encaminhamento, não em
 * nome da Pessoa). Re-registro (EC-4) sobrescreve e atualiza autor/data; o
 * `before`/`after` do audit_log preserva o histórico de cada registro. Nunca lança.
 */
export async function registerReferralResult(
  rawInput: RegisterReferralResultInput,
): Promise<ActionResult<RegisterReferralResultResult>> {
  const log = childLogger({ module: 'referrals', action: 'registerReferralResult' });

  const parsed = registerReferralResultSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Resultado inválido.', parsed.error.flatten().fieldErrors);
  }
  const { referralId, result, observation } = parsed.data;

  const authz = await requirePermission('REGISTER_REFERRAL_RESULT');
  if (!authz.ok) return authz;
  const actor = authz.data.person;

  const existing = await prisma.referral.findUnique({
    where: { id: referralId },
    select: { result: true, resultObservation: true, resultRegisteredBy: true, resultRegisteredAt: true },
  });
  if (!existing) {
    return fail('NOT_FOUND', 'Encaminhamento não encontrado.');
  }

  try {
    await withAudit(
      AuditEvent.REFERRAL_RESULT_REGISTERED,
      async (tx, audit) => {
        const updated = await tx.referral.update({
          where: { id: referralId },
          data: {
            result,
            resultObservation: observation ?? null,
            resultRegisteredBy: actor.id,
            resultRegisteredAt: new Date(),
          },
          select: { result: true, resultObservation: true, resultRegisteredBy: true, resultRegisteredAt: true },
        });

        audit.entityType = 'REFERRAL';
        audit.entityId = referralId;
        audit.before = existing;
        audit.after = updated;
      },
      { actorUserId: actor.supabaseUserId, actorPersonId: actor.id, context: { referralId } },
    );

    log.info({ actorPersonId: actor.id, referralId, result }, 'referrals:referral_result_registered');
    return ok({ referralId });
  } catch (err) {
    log.error({ err, referralId }, 'referrals:register_referral_result_failed');
    return fail('INTERNAL', 'Erro ao registrar o resultado.');
  }
}
