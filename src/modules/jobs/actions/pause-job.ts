'use server';

import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { pauseJobSchema, type PauseJobInput } from '../schemas/lifecycle.schema';
import { requireActiveResponsible } from '../server/require-active-responsible';

export interface PauseJobResult {
  jobId: string;
  status: ContentStatus;
}

/**
 * Pausa uma vaga publicada (USP-023 / E-002 / AC-023-2). `ACTIVE → PAUSED` via
 * `transitionContent` (`AUTHOR_ACTION`), sem re-moderação — a vaga some da busca
 * pública (`searchJobs` já filtra `status='ACTIVE'`) e o detalhe passa a exibir
 * "vaga temporariamente pausada" (P-003, `getPausedJobNotice`).
 *
 * Sequência canônica: Zod → Pessoa autenticada → carrega vaga (`companyId`) →
 * gate P-005/D-005 (responsável ativo) **antes** de qualquer escrita →
 * `transitionContent` → `ActionResult`. Nunca `throw`.
 */
export async function pauseJob(rawInput: PauseJobInput): Promise<ActionResult<PauseJobResult>> {
  const log = childLogger({ module: 'jobs', action: 'pauseJob' });

  const parsed = pauseJobSchema.safeParse(rawInput);
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
    to: ContentStatus.PAUSED,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, jobId }, 'jobs:paused');
  return ok({ jobId, status: transition.data.to });
}
