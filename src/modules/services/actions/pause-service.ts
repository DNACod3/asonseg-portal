'use server';

import { getCurrentPerson } from '@/modules/identity';
import { transitionContent, ContentKind, ContentStatus } from '@/modules/moderation';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { pauseServiceSchema, type PauseServiceInput } from '../schemas/lifecycle.schema';
import { requireServiceOwner } from '../server/require-service-owner';

export interface PauseServiceResult {
  serviceId: string;
  status: ContentStatus;
}

/**
 * Pausa um serviço publicado (USP-032 / AC-032-2). `ACTIVE → PAUSED` via
 * `transitionContent` (`AUTHOR_ACTION`, evento `SERVICE_PAUSED` — USP-029/T029-2),
 * sem re-moderação — o serviço some da busca pública (`searchServices` já filtra
 * `status='ACTIVE'`) e o detalhe deixa de ser detalhável (`getActiveServiceDetail`).
 *
 * Sequência canônica: Zod → Pessoa autenticada → gate de ownership (autor OU
 * responsável ativo da Empresa — `requireServiceOwner`, SVC032-MN-02) **antes**
 * de qualquer escrita → `transitionContent` → `ActionResult`. Nunca `throw`.
 */
export async function pauseService(rawInput: PauseServiceInput): Promise<ActionResult<PauseServiceResult>> {
  const log = childLogger({ module: 'services', action: 'pauseService' });

  const parsed = pauseServiceSchema.safeParse(rawInput);
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
    to: ContentStatus.PAUSED,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });
  if (!transition.ok) {
    return transition;
  }

  log.info({ actorPersonId: person.id, serviceId }, 'services:paused');
  return ok({ serviceId, status: transition.data.to });
}
