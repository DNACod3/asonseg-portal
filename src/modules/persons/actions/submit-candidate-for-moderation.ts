'use server';

import {
  transitionContent,
  ContentKind,
  ContentStatus,
  type TransitionContentData,
} from '@/modules/moderation';
import { getCurrentPerson } from '@/modules/identity';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { prisma } from '@/shared/lib/prisma';

/**
 * Envia o perfil de candidato da Pessoa autenticada para moderação (USP-009 / CAD-03):
 * transição DRAFT → IN_MODERATION via `transitionContent()` (ADR-0011 — única via;
 * **nunca** `prisma.update` de status). A própria `transitionContent` audita a
 * transição (`CONTENT_SUBMITTED_TO_MODERATION`) e enfileira para o coordenador.
 *
 * P-002: opera sobre o perfil da sessão (sem `personId` no input). Nunca lança.
 */
export async function submitCandidateForModeration(): Promise<ActionResult<TransitionContentData>> {
  const log = childLogger({ module: 'persons', action: 'submitCandidateForModeration' });

  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const profile = await prisma.candidateProfile.findUnique({
    where: { personId: person.id },
    select: { personId: true },
  });
  if (!profile) {
    return fail('NOT_FOUND', 'Perfil de candidato não encontrado. Conclua o cadastro primeiro.');
  }

  const result = await transitionContent({
    contentKind: ContentKind.CANDIDATE_PROFILE,
    contentId: person.id,
    to: ContentStatus.IN_MODERATION,
    trigger: 'AUTHOR_ACTION',
    actorPersonId: person.id,
  });

  if (!result.ok) {
    log.info({ personId: person.id, error: result.error.code }, 'persons:candidate_submit_rejected');
    return result;
  }

  log.info({ personId: person.id }, 'persons:candidate_submitted_for_moderation');
  return ok(result.data);
}
