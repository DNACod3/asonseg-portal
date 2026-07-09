'use server';

import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { resumeServiceSchema, type ResumeServiceInput } from '../schemas/lifecycle.schema';
import { requireServiceOwner } from '../server/require-service-owner';

export interface ResumeServiceResult {
  serviceId: string;
  status: ContentStatus;
}

/**
 * Retoma um serviço pausado (USP-032 / AC-032-4 — paridade de ciclo de vida,
 * serviço não tem validade automática). `PAUSED → ACTIVE` via
 * `transitionContent` (`AUTHOR_ACTION`), **sem** nova moderação — grava
 * `SERVICE_UNPAUSED` (distinto de `CONTENT_APPROVED`, reservado à aprovação do
 * coordenador — USP-029/T029-2) e o serviço volta a aparecer na busca pública.
 *
 * Mesma sequência canônica de `pauseService`.
 */
export async function resumeService(rawInput: ResumeServiceInput): Promise<ActionResult<ResumeServiceResult>> {
  const log = childLogger({ module: 'services', action: 'resumeService' });

  const parsed = resumeServiceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos.', parsed.error.flatten().fieldErrors);
  }
  const { serviceId } = parsed.data;

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const owner = await requireServiceOwner(person.id, serviceId);
  if (!owner.ok) {
    return fail('FORBIDDEN', 'Você não é o dono deste serviço.');
  }

  const transition = await transitionContent({
    contentKind: ContentKind.SERVICE,
    contentId: serviceId,
    to: ContentStatus.ACTIVE,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, serviceId }, 'services:resumed');
  return ok({ serviceId, status: transition.data.to });
}
