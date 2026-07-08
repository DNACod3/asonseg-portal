'use server';

import { getCurrentPerson } from '@/modules/identity';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { extendJobValiditySchema, type ExtendJobValidityInput } from '../schemas/lifecycle.schema';
import { requireActiveResponsible } from '../server/require-active-responsible';

export interface ExtendJobValidityResult {
  jobId: string;
  validUntil: string;
}

/** Conflito de concorrência otimista (2ª prorrogação simultânea ou vaga não-ACTIVE). */
class ExtendConflictError extends Error {}

/**
 * Prorroga a validade de uma vaga `ACTIVE` (USP-023 / E-004 / AC-023-4). **Metadata**,
 * não transição de status — a vaga permanece `ACTIVE` (fora do `transitionContent`,
 * ver design §3 "extendJobValidity fora do transitionContent"), auditada em
 * `withAudit(JOB_VALIDITY_EXTENDED)` com before/after de `validUntil`. Prorrogação
 * livre (sem teto de quantidade — P-002 N/A); a data ainda respeita o teto de
 * `MAX_VALIDADE_DIAS` (validado no schema via `validadeStatus`).
 *
 * Sequência: Zod (`validadeStatus`) → Pessoa autenticada → carrega vaga → gate
 * `requireActiveResponsible` → precondição `status=ACTIVE` (`updateMany` com
 * `count===1`, senão `CONFLICT`) → `ActionResult`. Nunca `throw`.
 */
export async function extendJobValidity(
  rawInput: ExtendJobValidityInput,
): Promise<ActionResult<ExtendJobValidityResult>> {
  const log = childLogger({ module: 'jobs', action: 'extendJobValidity' });

  const parsed = extendJobValiditySchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { jobId, validUntil } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { companyId: true, validUntil: true },
  });
  if (!job) {
    return fail('NOT_FOUND', 'Vaga não encontrada.');
  }

  if (!(await requireActiveResponsible(person.id, job.companyId))) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  try {
    const newValidUntil = new Date(validUntil);
    await withAudit(
      AuditEvent.JOB_VALIDITY_EXTENDED,
      async (tx, audit) => {
        const result = await tx.job.updateMany({
          where: { id: jobId, status: 'ACTIVE' },
          data: { validUntil: newValidUntil, lastStatusChangeAt: new Date() },
        });
        if (result.count !== 1) {
          throw new ExtendConflictError();
        }
        audit.entityType = 'JOB';
        audit.entityId = jobId;
        audit.before = { validUntil: job.validUntil };
        audit.after = { validUntil: newValidUntil };
      },
      { actorUserId: person.supabaseUserId, actorPersonId: person.id, context: { companyId: job.companyId } },
    );
  } catch (err) {
    if (err instanceof ExtendConflictError) {
      return fail('CONFLICT', 'Só é possível prorrogar uma vaga ativa.');
    }
    log.error({ err, jobId }, 'jobs:extend_validity_failed');
    return fail('INTERNAL', 'Não foi possível prorrogar a validade. Tente novamente mais tarde.');
  }

  log.info({ actorPersonId: person.id, jobId }, 'jobs:validity_extended');
  return ok({ jobId, validUntil });
}
