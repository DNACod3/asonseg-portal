'use server';

import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { unpauseJobSchema, type UnpauseJobInput } from '../schemas/lifecycle.schema';
import { requireActiveResponsible } from '../server/require-active-responsible';

export interface UnpauseJobResult {
  jobId: string;
  status: ContentStatus;
}

/**
 * Despausa uma vaga (USP-023 / E-002 / AC-023-2). `PAUSED → ACTIVE` via
 * `transitionContent` (`AUTHOR_ACTION`), **sem** nova moderação — grava
 * `JOB_UNPAUSED` (distinto de `CONTENT_APPROVED`, reservado à aprovação do
 * coordenador) e a vaga volta a aparecer na busca pública.
 *
 * Mesma sequência canônica de `pauseJob`.
 */
export async function unpauseJob(rawInput: UnpauseJobInput): Promise<ActionResult<UnpauseJobResult>> {
  const log = childLogger({ module: 'jobs', action: 'unpauseJob' });

  const parsed = unpauseJobSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { jobId } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { companyId: true } });
  if (!job) {
    return fail('NOT_FOUND', 'Vaga não encontrada.');
  }

  if (!(await requireActiveResponsible(person.id, job.companyId))) {
    return fail('FORBIDDEN', 'Você não é responsável ativo desta Empresa.');
  }

  const transition = await transitionContent({
    contentKind: ContentKind.JOB,
    contentId: jobId,
    to: ContentStatus.ACTIVE,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, jobId }, 'jobs:unpaused');
  return ok({ jobId, status: transition.data.to });
}
