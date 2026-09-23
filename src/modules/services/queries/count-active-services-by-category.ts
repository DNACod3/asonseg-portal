import { prisma } from '@/shared/lib/prisma';
import { listServiceCategories } from './list-service-categories';

export interface ServiceCategoryCount {
  categoryId: string;
  name: string;
  count: number;
}

/**
 * Contadores de serviços `ACTIVE` por categoria, para o card "Prestadores por
 * tipo de serviço" do bloco CLIENT do painel `/inicio` (USP-067 — PNL-03 /
 * A-06). 1 agregação (`groupBy`) + a lista de categorias já existente
 * (`listServiceCategories`) — sem N+1. Categorias aprovadas sem nenhum
 * serviço ativo aparecem com `count: 0` (o card mostra todas as categorias,
 * não só as com resultado).
 */
export async function countActiveServicesByCategory(): Promise<ServiceCategoryCount[]> {
  const [categories, grouped] = await Promise.all([
    listServiceCategories(),
    prisma.service.groupBy({
      by: ['categoryId'],
      where: { status: 'ACTIVE', categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByCategoryId = new Map<string, number>();
  for (const group of grouped) {
    if (group.categoryId !== null) {
      countByCategoryId.set(group.categoryId, group._count._all);
    }
  }

  return categories.map((category) => ({
    categoryId: category.id,
    name: category.name,
    count: countByCategoryId.get(category.id) ?? 0,
  }));
}
