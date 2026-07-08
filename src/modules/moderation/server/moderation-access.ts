import type { PermissionId } from '@prisma/client';
import { isCoordinator, type CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';

/** Permissões que dão acesso à fila de moderação (catálogo USP-008). */
const MODERATION_PERMISSIONS: PermissionId[] = ['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE'];

/**
 * `true` se a Pessoa pode acessar a fila de moderação — coordenador (permissão
 * inerente) ou voluntário com **qualquer** delegação de moderação ativa
 * (ADR-0001 / USP-008). A decisão por item ainda re-checa a permissão do tipo
 * específico na Server Action (defesa em profundidade — P-007).
 */
export async function canAccessModerationQueue(person: CurrentPerson): Promise<boolean> {
  if (isCoordinator(person)) return true;
  const grant = await prisma.delegatedPermission.findFirst({
    where: { personId: person.id, permission: { in: MODERATION_PERMISSIONS }, revokedAt: null },
    select: { id: true },
  });
  return grant !== null;
}

/**
 * `true` se a Pessoa pode gerir conteúdo publicado (superfície de inativação —
 * USP-018 / `(app)/moderacao/publicados`) — coordenador (permissão inerente) ou
 * voluntário com delegação ativa de `INACTIVATE_PUBLISHED_CONTENT` (INACT-06).
 * Espelha {@link canAccessModerationQueue}. A decisão de inativar ainda re-checa
 * a permissão na Server Action (defesa em profundidade — INACT-MN-03).
 */
export async function canManagePublishedContent(person: CurrentPerson): Promise<boolean> {
  if (isCoordinator(person)) return true;
  const grant = await prisma.delegatedPermission.findFirst({
    where: { personId: person.id, permission: 'INACTIVATE_PUBLISHED_CONTENT', revokedAt: null },
    select: { id: true },
  });
  return grant !== null;
}
