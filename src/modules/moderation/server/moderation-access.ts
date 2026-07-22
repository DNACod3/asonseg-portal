import { cache } from 'react';
import type { PermissionId } from '@prisma/client';
import { isCoordinator, type CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';
import { ContentKind } from '../domain/content-status';
import { CONTENT_KINDS_BY_PERMISSION } from '../domain/moderation-permissions';

/** Permissões que dão acesso à fila de moderação (catálogo USP-008). */
const MODERATION_PERMISSIONS: PermissionId[] = ['MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE'];

/** Todos os `ContentKind` que o coordenador pode moderar (permissão inerente). */
const ALL_MODERATABLE_KINDS: ContentKind[] = [
  ContentKind.JOB,
  ContentKind.SERVICE,
  ContentKind.CV,
  ContentKind.CANDIDATE_PROFILE,
];

/**
 * `true` se a Pessoa pode acessar a fila de moderação — coordenador (permissão
 * inerente) ou voluntário com **qualquer** delegação de moderação ativa
 * (ADR-0001 / USP-008). A decisão por item ainda re-checa a permissão do tipo
 * específico na Server Action (defesa em profundidade — P-007).
 *
 * Envolvida em `cache()` de `'react'` (mesmo padrão de dedupe do App Router
 * usado em {@link getCurrentPerson}): `(app)/layout.tsx` e a `page.tsx` do hub
 * chamam esta função de forma independente com a MESMA instância de `person`
 * (já que `getCurrentPerson` é cacheada), então o cache — keyed por
 * referência do argumento — também bate na 2ª chamada dentro da mesma
 * request, evitando a query dupla ao Prisma.
 */
export const canAccessModerationQueue = cache(async function canAccessModerationQueue(
  person: CurrentPerson,
): Promise<boolean> {
  if (isCoordinator(person)) return true;
  const grant = await prisma.delegatedPermission.findFirst({
    where: { personId: person.id, permission: { in: MODERATION_PERMISSIONS }, revokedAt: null },
    select: { id: true },
  });
  return grant !== null;
});

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

/**
 * Conjunto de `ContentKind` que o viewer pode moderar (MOD-7 / P-007) — usado
 * para o gating de **ação** na UI da fila (`ModerationQueue`), nunca como
 * checagem de autorização: a Server Action (`decide.ts`) segue re-checando
 * `requirePermission` de forma independente (defesa em profundidade).
 *
 * Coordenador → todos os tipos (permissão inerente). Voluntário → união dos
 * tipos habilitados por cada delegação ativa (`revokedAt: null`), via o mapa
 * único {@link CONTENT_KINDS_BY_PERMISSION} (mesma fonte de `decide.ts` —
 * evita a permissão exigida na action divergir da inferida aqui).
 */
export async function listViewerModeratableKinds(person: CurrentPerson): Promise<ContentKind[]> {
  if (isCoordinator(person)) return ALL_MODERATABLE_KINDS;

  const grants = await prisma.delegatedPermission.findMany({
    where: { personId: person.id, permission: { in: MODERATION_PERMISSIONS }, revokedAt: null },
    select: { permission: true },
  });

  const kinds = new Set<ContentKind>();
  for (const grant of grants) {
    for (const kind of CONTENT_KINDS_BY_PERMISSION[grant.permission] ?? []) {
      kinds.add(kind);
    }
  }
  return [...kinds];
}
