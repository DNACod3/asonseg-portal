import type { ContentStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { resolveReportWindow, type ReportWindowInput } from '../domain/report-window';

/**
 * R1 — relatório de vagas (MP4), por status, dentro da janela de período
 * (design.md §2 / TD §4.5). Filtro adicional opcional por `status`.
 */
export interface JobReportFilters extends ReportWindowInput {
  status?: string;
}

export interface JobReportRow {
  status: string;
  count: number;
}

/**
 * Agrega vagas por `status` — `groupBy` no DB (E-005: agregado, nunca
 * `findMany` de linha para contar em memória). Período aplicado sobre
 * `createdAt` (cobre rascunhos e publicadas — MP4 é "acumulado publicadas E
 * aprovadas", mas o relatório operacional lista TODOS os status na janela,
 * cabendo ao filtro `status` estreitar). Janela vazia/invertida (T2) resulta
 * em `[]`, nunca erro.
 */
export async function reportJobs(filters: JobReportFilters): Promise<JobReportRow[]> {
  const window = resolveReportWindow(filters);

  const grouped = await prisma.job.groupBy({
    by: ['status'],
    where: {
      createdAt: { gte: window.gte ?? undefined, lt: window.lt ?? undefined },
      ...(filters.status ? { status: filters.status as ContentStatus } : {}),
    },
    _count: { _all: true },
  });

  return grouped.map((g) => ({ status: g.status, count: g._count._all }));
}
