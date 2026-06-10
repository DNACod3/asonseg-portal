'use server';

import type { PermissionId } from '@prisma/client';
import { requirePermission } from '@/modules/identity';
import { fail, type ActionResult } from '@/shared/errors';
import { ContentKind, ContentStatus } from '../domain/content-status';
import { transitionContent, type TransitionContentData } from './transition-content';
import {
  approveSchema,
  rejectSchema,
  returnForAdjustmentsSchema,
  type ApproveInput,
  type RejectInput,
  type ReturnForAdjustmentsInput,
} from '../schemas/decision';

/**
 * Server Actions de decisão de moderação (#123). Sequência canônica do CLAUDE.md:
 * Zod → `requirePermission(MODERATE_<KIND>)` (P-007) → `transitionContent` (a
 * única via de mudança de status — AC6/P-006). Retornam `ActionResult`, nunca `throw`.
 */

/** Permissão exigida por tipo de conteúdo (P-007 / catálogo USP-008 / D-006). */
const PERMISSION_BY_KIND: Record<ContentKind, PermissionId> = {
  [ContentKind.JOB]: 'MODERATE_JOB',
  [ContentKind.CV]: 'MODERATE_CV',
  [ContentKind.SERVICE]: 'MODERATE_SERVICE',
  // Perfil de candidato (USP-009) reusa a permissão de moderação de CV — o perfil
  // contém o CV e é a mesma capacidade do coordenador; evita novo PermissionId
  // (enum Prisma) + seeding RBAC. Reavaliar se a moderação divergir (AC-04 / USP-016).
  [ContentKind.CANDIDATE_PROFILE]: 'MODERATE_CV',
};

const INVALID_INPUT = 'Não foi possível processar a decisão: dados inválidos.';

/** E-002 — aprovar rascunho: `IN_MODERATION → ACTIVE`. */
export async function approveContent(input: ApproveInput): Promise<ActionResult<TransitionContentData>> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const authz = await requirePermission(PERMISSION_BY_KIND[parsed.data.contentKind]);
  if (!authz.ok) return authz;

  return transitionContent({
    contentKind: parsed.data.contentKind,
    contentId: parsed.data.contentId,
    to: ContentStatus.ACTIVE,
    trigger: 'MODERATOR_ACTION',
    actorPersonId: authz.data.person.id,
  });
}

/** E-003 — devolver para ajustes: `IN_MODERATION → AWAITING_ADJUSTMENTS` (motivo obrigatório). */
export async function returnForAdjustments(
  input: ReturnForAdjustmentsInput,
): Promise<ActionResult<TransitionContentData>> {
  const parsed = returnForAdjustmentsSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const authz = await requirePermission(PERMISSION_BY_KIND[parsed.data.contentKind]);
  if (!authz.ok) return authz;

  return transitionContent({
    contentKind: parsed.data.contentKind,
    contentId: parsed.data.contentId,
    to: ContentStatus.AWAITING_ADJUSTMENTS,
    trigger: 'MODERATOR_ACTION',
    justification: parsed.data.justification,
    actorPersonId: authz.data.person.id,
  });
}

/** E-004 — rejeitar definitivamente: `IN_MODERATION → REJECTED` (motivo obrigatório). */
export async function rejectContent(input: RejectInput): Promise<ActionResult<TransitionContentData>> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', INVALID_INPUT, parsed.error.flatten().fieldErrors);

  const authz = await requirePermission(PERMISSION_BY_KIND[parsed.data.contentKind]);
  if (!authz.ok) return authz;

  return transitionContent({
    contentKind: parsed.data.contentKind,
    contentId: parsed.data.contentId,
    to: ContentStatus.REJECTED,
    trigger: 'MODERATOR_ACTION',
    justification: parsed.data.justification,
    actorPersonId: authz.data.person.id,
  });
}
