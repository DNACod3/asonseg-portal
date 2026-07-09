import { prisma } from '@/shared/lib/prisma';

/**
 * Estado da manifestação de interesse ATIVA do próprio cliente num serviço
 * (USP-033 — AC-033-5). Leitura do dado da PRÓPRIA Pessoa (privacidade OK — não
 * é a view de terceiro). Usada pela página de detalhe para decidir entre o CTA
 * "Entrar em contato" (USP-033) e o bloco de contato + "Cancelar manifestação"
 * (USP-034).
 */
export async function getMyActiveServiceInterest(
  serviceId: string,
  clientPersonId: string,
): Promise<{ id: string } | null> {
  return prisma.serviceInterest.findFirst({
    where: { serviceId, clientPersonId, cancelledAt: null },
    select: { id: true },
  });
}
