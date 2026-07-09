import { z } from 'zod';

/**
 * Filtros comuns aos relatórios operacionais (E-001): período (`from`/`to`,
 * datas de calendário `yyyy-MM-dd`), `status` (livre — cada relatório valida
 * seus próprios valores possíveis a jusante), `categoryId`/`regionId` (UUID).
 * Todos opcionais — um relatório sem filtro nenhum lista tudo (dentro do
 * `take`), a query decide o que fazer com cada campo ausente.
 */
export const reportFiltersSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from deve ser yyyy-MM-dd')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to deve ser yyyy-MM-dd')
    .optional(),
  status: z.string().min(1).optional(),
  categoryId: z.string().uuid('categoryId inválido').optional(),
  regionId: z.string().uuid('regionId inválido').optional(),
});

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;
