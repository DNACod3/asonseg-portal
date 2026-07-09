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

/**
 * `true` se a Pessoa pode registrar o resultado de um encaminhamento
 * (`(app)/encaminhamentos/[id]/resultado` — USP-038 / REF38-MN-02 na rota) —
 * papel inerente (COORDINATOR/SOCIAL_ASSISTANT) ou delegação ativa de
 * `REGISTER_REFERRAL_RESULT`. Espelha {@link canReferPersonToJob}. A Server
 * Action `registerReferralResult` ainda re-checa a permissão (defesa em profundidade).
 */
export async function canRegisterReferralResult(person: CurrentPerson): Promise<boolean> {
  const grants = await prisma.delegatedPermission.findMany({
    where: { personId: person.id, permission: 'REGISTER_REFERRAL_RESULT', revokedAt: null },
    select: { permission: true, scopeArea: true, revokedAt: true },
    take: 50,
  });
  return checkPermission(person, 'REGISTER_REFERRAL_RESULT', grants).granted;
}
