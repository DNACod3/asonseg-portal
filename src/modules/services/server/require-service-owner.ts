import { prisma } from '@/shared/lib/prisma';
import { requireActiveResponsible } from './require-active-responsible';

export interface ServiceOwnerCheck {
  ok: boolean;
  companyId: string | null;
}

/**
 * Gate de posse de um serviço já existente (USP-029 T029-6 / USP-032 §1):
 * dono = autor (`authorPersonId === personId`) OU (`companyId` setado E a
 * Pessoa é responsável **ativo** dessa Empresa — SVC032-MN-02). Checado
 * **antes** de qualquer escrita (anti-bypass): usado tanto pelo recheck de
 * ownership em `submitServiceForModeration({ serviceId })` (fronteira: uma
 * Pessoa não pode terminar de submeter o rascunho alheio) quanto pelas ações
 * de ciclo de vida da USP-032 (editar/pausar/retomar/arquivar).
 *
 * `ok: false` também cobre "serviço inexistente" — quem chama decide se isso
 * vira `NOT_FOUND` (não vaza existência) ou `FORBIDDEN`.
 */
export async function requireServiceOwner(
  personId: string,
  serviceId: string,
): Promise<ServiceOwnerCheck> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { authorPersonId: true, companyId: true },
  });
  if (!service) {
    return { ok: false, companyId: null };
  }
  if (service.authorPersonId === personId) {
    return { ok: true, companyId: service.companyId };
  }
  if (service.companyId != null && (await requireActiveResponsible(personId, service.companyId))) {
    return { ok: true, companyId: service.companyId };
  }
  return { ok: false, companyId: service.companyId };
}
