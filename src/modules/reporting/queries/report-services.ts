import { prisma } from '@/shared/lib/prisma';
import { resolveReportWindow, type ReportWindowInput } from '../domain/report-window';

/**
 * R3 — relatório de serviços + manifestações (MP5/MP7), por
 * período/categoria (design.md §2 / TD §4.5). MP5 = serviços por
 * status+categoria; MP7 = manifestações de interesse na janela.
 */
export interface ServiceReportFilters extends ReportWindowInput {
  categoryId?: string;
}

export interface ServiceReportRow {
  status: string;
  categoryId: string | null;
  count: number;
}

/**
 * Composto MP5 (`byStatusAndCategory`) + MP7 (`interestsCount`).
 *
 * SPEC_DEVIATION: tasks.md/T7 nomeia o retorno como `Promise<ServiceReportRow[]>`,
 * mas o próprio "Done when" exige TAMBÉM `serviceInterest.count` (MP7) na
 * mesma função. Um `ServiceReportRow[]` sozinho não tem onde carregar essa
 * contagem sem misturar uma linha sintética de tipo diferente no array — o
 * mesmo problema que T8 resolve com um tipo composto (`ReferralReport`, que
 * "carrega successRate E noResultRate"). Sigo o mesmo padrão aqui: um tipo
 * composto `ServiceReport` com o array de agregados MP5 + o total MP7,
 * ambos tipados e discrimináveis — sem perder nenhuma métrica exigida.
 * Reason: fidelidade ao requisito (MP5 E MP7 juntos) > fidelidade literal ao
 * nome do tipo de retorno do texto da task.
 */
export interface ServiceReport {
  byStatusAndCategory: ServiceReportRow[];
  interestsCount: number;
}

/**
 * Agrega serviços por `status`+`categoryId` (`groupBy`, E-005) dentro da
 * janela (`createdAt`, espelha `reportJobs`), com filtro opcional de
 * `categoryId`; conta manifestações de interesse (`serviceInterest.count`)
 * na mesma janela (`interestedAt`). Janela vazia/invertida ⇒ agregados
 * vazios/zero, nunca erro.
 */
export async function reportServices(filters: ServiceReportFilters): Promise<ServiceReport> {
  const window = resolveReportWindow(filters);
  const dateRange = { gte: window.gte ?? undefined, lt: window.lt ?? undefined };

  // `Promise.all` (não `$transaction`) — MP5 (serviços) e MP7 (manifestações)
  // são métricas independentes; não precisam da mesma foto transacional, e o
  // array heterogêneo do `$transaction` perde a inferência de tipo do
  // `groupBy` (2 campos em `by`). `$transaction` fica reservado a quando a
  // consistência de snapshot importa (ex. `getHomeIndicators`, USP-041).
  const [grouped, interestsCount] = await Promise.all([
    prisma.service.groupBy({
      by: ['status', 'categoryId'],
      where: {
        createdAt: dateRange,
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      },
      // Prisma exige `orderBy` quando `by` tem mais de 1 campo — a ordem em
      // si não importa aqui (o consumidor não depende de ordenação).
      orderBy: { status: 'asc' },
      _count: { _all: true },
    }),
    prisma.serviceInterest.count({
      where: { interestedAt: dateRange },
    }),
  ]);

  return {
    byStatusAndCategory: grouped.map((g) => ({
      status: g.status,
      categoryId: g.categoryId,
      count: g._count._all,
    })),
    interestsCount,
  };
}
