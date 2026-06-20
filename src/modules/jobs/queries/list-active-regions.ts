import { prisma } from '@/shared/lib/prisma';

export interface RegionOption {
  id: string;
  name: string;
}

/**
 * Regiões ativas (taxonomia US #111) para popular os selects de região — tanto o
 * formulário de vaga (USP-020/021) quanto o filtro da busca pública (USP-021/E-002).
 * "Ativa" = `isActive === true`. Paginação defensiva (convenção Prisma).
 */
export async function listActiveRegions(): Promise<RegionOption[]> {
  return prisma.region.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 200,
  });
}
