import { checkPermission, type CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';

/**
 * `true` se a Pessoa pode acessar a superfície de encaminhamento
 * (`(app)/encaminhamentos/novo` — USP-037 / REF-MN-04 na rota) — papel
 * inerente (COORDINATOR/SOCIAL_ASSISTANT) ou delegação ativa de
 * `REFER_PERSON_TO_JOB` (ADR-0001 / USP-008). Espelha
 * `canManagePublishedContent` (moderation). A Server Action `createReferral`
 * ainda re-checa a permissão via `requirePermission` (defesa em profundidade).
 */
export async function canReferPersonToJob(person: CurrentPerson): Promise<boolean> {
  const grants = await prisma.delegatedPermission.findMany({
    where: { personId: person.id, permission: 'REFER_PERSON_TO_JOB', revokedAt: null },
    select: { permission: true, scopeArea: true, revokedAt: true },
    take: 50,
  });
  return checkPermission(person, 'REFER_PERSON_TO_JOB', grants).granted;
}
