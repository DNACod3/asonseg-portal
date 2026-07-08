'use server';

import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';
import { archiveJobSchema, type ArchiveJobInput } from '../schemas/lifecycle.schema';
import { requireActiveResponsible } from '../server/require-active-responsible';

export interface ArchiveJobResult {
  jobId: string;
  status: ContentStatus;
}

/**
 * Arquiva uma vaga publicada — operação **terminal** (USP-023 / E-003 / AC-023-3 /
 * P-006). `ACTIVE → ARCHIVED` via `transitionContent` (`AUTHOR_ACTION`); a FSM
 * (`TRANSITIONS[JOB]`) não declara nenhuma aresta a partir de `ARCHIVED` — qualquer
 * tentativa de reativação direta é recusada com `INVALID_TRANSITION` (must-not
 * P-006, sem código extra: a garantia vem da tabela declarativa). Histórico de
 * candidaturas preservado (sem exclusão física).
 *
 * Mesma sequência canônica das demais actions de ciclo de vida (T3).
 */
export async function archiveJob(rawInput: ArchiveJobInput): Promise<ActionResult<ArchiveJobResult>> {
  const log = childLogger({ module: 'jobs', action: 'archiveJob' });

  const parsed = archiveJobSchema.safeParse(rawInput);
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
    to: ContentStatus.ARCHIVED,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, jobId }, 'jobs:archived');
  return ok({ jobId, status: transition.data.to });
}
