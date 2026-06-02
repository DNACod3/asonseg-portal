import { z } from 'zod';

/**
 * Entrada da emissão do relatório de acesso (LGPD art. 19 — direito de acesso).
 *
 * Identifica o titular (Pessoa) cujos dados pessoais + histórico de
 * consentimento serão consolidados. A autorização do solicitante (papel interno)
 * é checada na Server Action, não no schema.
 */
export const accessReportSchema = z.object({
  personId: z.string().uuid('personId inválido'),
});

export type AccessReportInput = z.infer<typeof accessReportSchema>;
