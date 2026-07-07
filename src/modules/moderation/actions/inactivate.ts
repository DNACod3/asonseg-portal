'use server';

import { requirePermission } from '@/modules/identity';
import { fail, type ActionResult } from '@/shared/errors';
import { ContentStatus } from '../domain/content-status';
import { transitionContent, type TransitionContentData } from './transition-content';
import { inactivateSchema, type InactivateContentInput } from '../schemas/inactivate';

const INVALID_INPUT = 'Não foi possível processar a inativação: dados inválidos.';

/**
 * Server Action de inativação administrativa de conteúdo publicado (USP-018).
 * Sequência canônica do CLAUDE.md: Zod → `requirePermission` (P-007) →
 * `transitionContent` (a única via de mudança de status — AC6/P-006).
 *
 * Genérica por `ContentKind` (INACT-08/P2): a fatia vertical desta USP é JOB
 * (superfície + query + testes E2E), mas a action aceita qualquer
 * `ContentKind` sem lógica específica de tipo — a FSM decide se a transição
 * é permitida (ex.: CANDIDATE_PROFILE também tem `ACTIVE → INACTIVATED`).
 *
 * Diferente das decisões de moderação (`decide.ts`), a permissão exigida
 * (`INACTIVATE_PUBLISHED_CONTENT`) é fixa — não varia por `ContentKind` — pois
 * é a válvula de escape do coordenador sobre conteúdo já público, não uma
 * decisão de moderação de rascunho.
 */
export async function inactivateContent(
  input: InactivateContentInput,
): Promise<ActionResult<TransitionContentData>> {
  const parsed = inactivateSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const authz = await requirePermission('INACTIVATE_PUBLISHED_CONTENT');
  if (!authz.ok) return authz;

  return transitionContent({
    contentKind: parsed.data.contentKind,
    contentId: parsed.data.contentId,
    to: ContentStatus.INACTIVATED,
    trigger: 'COORDINATOR_INACTIVATION',
    justification: parsed.data.justification,
    actorPersonId: authz.data.person.id,
  });
}
