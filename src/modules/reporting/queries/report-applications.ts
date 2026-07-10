import { prisma } from '@/shared/lib/prisma';
import { resolveReportWindow, type ReportWindowInput } from '../domain/report-window';

/**
 * R2 — relatório de candidaturas (MP6), por período (design.md §2 / TD §4.5).
 * "Realizadas" = TODAS as candidaturas criadas na janela, independente de
 * `cancelledAt` (cancelamento é um estado pós-criação; MP6 mede o ato de
 * candidatar-se, não a candidatura ainda ativa).
 */
export type ApplicationReportFilters = ReportWindowInput;

export interface ApplicationReportRow {
  /** Total de candidaturas criadas (`appliedAt`) dentro da janela. */
  total: number;
}

/**
 * Agrega candidaturas via `count` (E-005: agregado no DB). Janela
 * vazia/invertida (T2) resulta em `total: 0`, nunca erro.
 */
export async function reportApplications(
  filters: ApplicationReportFilters,
): Promise<ApplicationReportRow[]> {
  const window = resolveReportWindow(filters);

  const total = await prisma.application.count({
    where: {
      appliedAt: { gte: window.gte ?? undefined, lt: window.lt ?? undefined },
    },
  });

  return [{ total }];
}
