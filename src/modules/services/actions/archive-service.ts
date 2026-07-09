'use server';

import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { archiveServiceSchema, type ArchiveServiceInput } from '../schemas/lifecycle.schema';
import { requireServiceOwner } from '../server/require-service-owner';

export interface ArchiveServiceResult {
  serviceId: string;
  status: ContentStatus;
}

/**
 * Arquiva um serviço publicado — operação **terminal** (USP-032 / AC-032-3).
 * `ACTIVE → ARCHIVED` via `transitionContent` (`AUTHOR_ACTION`); a FSM
 * (`TRANSITIONS[SERVICE]` = `SHARED_TRANSITIONS`) não declara nenhuma aresta a
 * partir de `ARCHIVED` — qualquer tentativa de reativação direta é recusada com
 * `INVALID_TRANSITION` (a garantia vem da tabela declarativa, sem código extra).
 *
 * Mesma sequência canônica das demais actions de ciclo de vida.
 */
export async function archiveService(rawInput: ArchiveServiceInput): Promise<ActionResult<ArchiveServiceResult>> {
  const log = childLogger({ module: 'services', action: 'archiveService' });

  const parsed = archiveServiceSchema.safeParse(rawInput);
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
    to: ContentStatus.ARCHIVED,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, serviceId }, 'services:archived');
  return ok({ serviceId, status: transition.data.to });
}
