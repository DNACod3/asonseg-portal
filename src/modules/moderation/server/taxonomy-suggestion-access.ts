import { isCoordinator, type CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';

/**
 * `true` se a Pessoa pode acessar a fila de sugestões de taxonomia
 * (`(app)/moderacao/sugestoes` — USP-019 / SUGG-06) — coordenador (permissão
 * inerente) ou voluntário com delegação ATIVA de `APPROVE_CATEGORY_SUGGESTION`.
 * Espelha `canAccessModerationQueue`/`canManagePublishedContent`. A
 * aprovação/rejeição por item ainda re-checa a permissão na Server Action
 * (defesa em profundidade — SUGG-MN-02).
 */
export async function canApproveTaxonomySuggestions(person: CurrentPerson): Promise<boolean> {
  if (isCoordinator(person)) return true;
  const grant = await prisma.delegatedPermission.findFirst({
    where: { personId: person.id, permission: 'APPROVE_CATEGORY_SUGGESTION', revokedAt: null },
    select: { id: true },
  });
  return grant !== null;
}
