import { prisma } from '@/shared/lib/prisma';
import type { DelegatedGrant } from '@/modules/identity';
import { MODERATION_QUEUE_PERMISSIONS } from '../domain/report-access';

/**
 * Busca os `DelegatedPermission` ativos (`revokedAt: null`) de MODERATE_JOB/
 * CV/SERVICE de uma Pessoa — insumo de `isReportTypeAuthorized`/
 * `canViewModerationQueueReport` (R5, P-006) para decidir acesso ao
 * relatório de fila de moderação.
 *
 * Extraída de 3 call sites que duplicavam a mesma const
 * `MODERATION_PERMISSIONS` + o mesmo `findMany` (`relatorios/page.tsx`,
 * `relatorios/[tipo]/page.tsx`, `exportReport` — PR#286): agora todos
 * chamam este único ponto, que reusa `MODERATION_QUEUE_PERMISSIONS` de
 * `domain/report-access.ts` (fonte única da lista de permissões) em vez de
 * uma 5ª cópia local.
 */
export async function getModerationGrants(personId: string): Promise<DelegatedGrant[]> {
  return prisma.delegatedPermission.findMany({
    where: { personId, permission: { in: [...MODERATION_QUEUE_PERMISSIONS] }, revokedAt: null },
    select: { permission: true, scopeArea: true, revokedAt: true },
    take: 50,
  });
}
