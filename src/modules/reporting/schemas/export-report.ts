import { z } from 'zod';
import { reportFiltersSchema } from './report-filters';

/** Os 6 relatórios operacionais do MVP (R1..R6 — spec.md "Report set"). */
export const REPORT_TYPES = [
  'jobs',
  'applications',
  'services',
  'referrals',
  'moderation_queue',
  'social',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const EXPORT_FORMATS = ['CSV', 'PDF'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Entrada de `exportReport` (T11 — design.md §6): tipo do relatório, filtros
 * (T2), formato do arquivo e a **ciência de responsabilidade LGPD**
 * (`acknowledgePII`, P-008/REL42-MN-06) — obrigatória quando o relatório tem
 * PII, checada na Server Action (não aqui: o schema não sabe se ESTE
 * `reportType`+viewer resulta em PII).
 */
export const exportReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  filters: reportFiltersSchema.optional().default({}),
  format: z.enum(EXPORT_FORMATS),
  acknowledgePII: z.boolean().optional().default(false),
});

export type ExportReportInput = z.infer<typeof exportReportSchema>;
