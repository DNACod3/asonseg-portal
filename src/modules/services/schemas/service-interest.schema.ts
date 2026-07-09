import { z } from 'zod';

/**
 * Schemas de fronteira do caminho de escrita do agregado `ServiceInterest`
 * (USP-033/034 — AD-020). Nenhum dos dois carrega `personId`/`clientPersonId`
 * no input (P-002): ambas as actions operam exclusivamente sobre a Pessoa da sessão.
 */

/** Manifestar interesse num serviço (USP-033). `consentAccepted` só é exigido
 *  quando o consentimento `SERVICE_HIRING` ainda não está ativo (design §D3). */
export const manifestInterestSchema = z.object({
  serviceId: z.string().uuid('Serviço inválido.'),
  consentAccepted: z.boolean().optional(),
});
export type ManifestInterestInput = z.infer<typeof manifestInterestSchema>;

/** Cancelar uma manifestação própria (USP-034). */
export const cancelInterestSchema = z.object({
  interestId: z.string().uuid('Manifestação inválida.'),
});
export type CancelInterestInput = z.infer<typeof cancelInterestSchema>;
