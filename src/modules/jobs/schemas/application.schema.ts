import { z } from 'zod';

/**
 * Schemas de fronteira do caminho de escrita do agregado `Application`
 * (USP-025/026 — AD-017). Nenhum dos dois carrega `personId` no input (P-002):
 * ambas as actions operam exclusivamente sobre a Pessoa da sessão.
 */

/** Candidatar-se a uma vaga (USP-025). */
export const applyToJobSchema = z.object({ jobId: z.string().uuid('Vaga inválida.') });
export type ApplyToJobInput = z.infer<typeof applyToJobSchema>;

/** Cancelar uma candidatura própria (USP-026). */
export const cancelApplicationSchema = z.object({
  applicationId: z.string().uuid('Candidatura inválida.'),
});
export type CancelApplicationInput = z.infer<typeof cancelApplicationSchema>;
