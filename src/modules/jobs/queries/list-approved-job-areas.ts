import { prisma } from '@/shared/lib/prisma';

export interface JobAreaOption {
  id: string;
  name: string;
}

/**
 * Áreas profissionais aprovadas (catálogo D-007 / taxonomia US #111), para popular
 * o select de "área" do formulário de vaga. "Aprovada" = `isSuggestion === false`
 * (mesma regra do formulário de candidato). Paginação defensiva (convenção Prisma).
 */
export async function listApprovedJobAreas(): Promise<JobAreaOption[]> {
  return prisma.jobArea.findMany({
    where: { isSuggestion: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
}
