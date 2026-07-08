import { prisma } from '@/shared/lib/prisma';

/**
 * Estado da candidatura ATIVA do próprio candidato a uma vaga (USP-025 —
 * CAN-025-06). Leitura do dado da PRÓPRIA Pessoa (privacidade OK — não é a view
 * de terceiro). Usada pela página de detalhe para decidir entre o CTA
 * "Candidatar-se" (USP-025) e "Cancelar candidatura" (USP-026).
 */
export async function getMyActiveApplication(
  jobId: string,
  candidatePersonId: string,
): Promise<{ id: string } | null> {
  return prisma.application.findFirst({
    where: { jobId, candidatePersonId, cancelledAt: null },
    select: { id: true },
  });
}
