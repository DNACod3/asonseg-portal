import { prisma } from '@/shared/lib/prisma';

export interface ServiceCategoryOption {
  id: string;
  name: string;
}

/**
 * Categorias de serviço aprovadas (catálogo D-007 / taxonomia US #111), para
 * popular o select de "categoria" do formulário de publicação (USP-029 /
 * AC-029-3). "Aprovada" = `isSuggestion === false` (espelha `listApprovedJobAreas`).
 * Paginação defensiva (convenção Prisma).
 */
export async function listServiceCategories(): Promise<ServiceCategoryOption[]> {
  return prisma.serviceCategory.findMany({
    where: { isSuggestion: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
}
