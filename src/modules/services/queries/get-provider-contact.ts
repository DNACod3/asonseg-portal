import { prisma } from '@/shared/lib/prisma';
import { providerDisplayName } from '../views/provider-display';
import { viewProviderContactForClient, type ProviderContact } from '../views/provider-contact.view';

/**
 * Resolve o contato do prestador de um serviço para um cliente, **somente**
 * quando ele tem manifestação de interesse ATIVA naquele serviço (USP-033 —
 * AC-033-5 / SVC033-MN-01).
 *
 * Defesa RSC/Flight (SVC033-MN-01): primeiro confirma o interesse ESCOPADO
 * (`clientPersonId` + `serviceId` + `cancelledAt: null`); se não houver, retorna
 * `null` **sem** jamais fazer o segundo `SELECT` que carregaria `phone`/
 * `emailLogin` — o campo restrito nem chega a existir em memória para um
 * viewer não-entitled, então é estruturalmente impossível vazá-lo num payload
 * Flight/RSC por engano de template.
 */
export async function getProviderContactForService(
  serviceId: string,
  clientPersonId: string,
): Promise<ProviderContact | null> {
  const activeInterest = await prisma.serviceInterest.findFirst({
    where: { serviceId, clientPersonId, cancelledAt: null },
    select: { id: true },
  });
  if (!activeInterest) return null;

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      author: { select: { fullName: true, phone: true, emailLogin: true } },
      company: { select: { nomeFantasia: true } },
    },
  });
  if (!service) return null;

  return viewProviderContactForClient({
    displayName: providerDisplayName(service),
    phone: service.author.phone,
    email: service.author.emailLogin,
  });
}
