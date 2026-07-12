import type { PermissionId } from '@prisma/client';
import { ContentKind } from './content-status';

/**
 * Permissão exigida para moderar cada tipo de conteúdo (P-007 / catálogo
 * USP-008 / D-006). Fonte única — reusada pela checagem server-side
 * (`actions/decide.ts`, `requirePermission`) e pelo cálculo dos tipos
 * moderáveis do viewer (`listViewerModeratableKinds`, MOD-7). Evita que a
 * permissão exigida na action e a inferida na UI divirjam.
 *
 * Perfil de candidato (USP-009) reusa a permissão de moderação de CV — o
 * perfil contém o CV e é a mesma capacidade do coordenador; evita novo
 * `PermissionId` (enum Prisma) + seeding RBAC. Reavaliar se a moderação
 * divergir (AC-04 / USP-016).
 */
export const PERMISSION_BY_KIND: Record<ContentKind, PermissionId> = {
  [ContentKind.JOB]: 'MODERATE_JOB',
  [ContentKind.CV]: 'MODERATE_CV',
  [ContentKind.SERVICE]: 'MODERATE_SERVICE',
  [ContentKind.CANDIDATE_PROFILE]: 'MODERATE_CV',
};

/**
 * Mapa inverso de {@link PERMISSION_BY_KIND}: cada permissão de moderação →
 * os `ContentKind` que ela habilita. Derivado, não duplicado manualmente —
 * `MODERATE_CV` habilita `[CV, CANDIDATE_PROFILE]` porque ambos apontam para
 * `MODERATE_CV` em `PERMISSION_BY_KIND`.
 */
export const CONTENT_KINDS_BY_PERMISSION: Partial<Record<PermissionId, ContentKind[]>> = (
  Object.entries(PERMISSION_BY_KIND) as Array<[ContentKind, PermissionId]>
).reduce<Partial<Record<PermissionId, ContentKind[]>>>((acc, [kind, permission]) => {
  (acc[permission] ??= []).push(kind);
  return acc;
}, {});
