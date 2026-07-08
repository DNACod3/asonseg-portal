import { z } from 'zod';

/**
 * Schemas de fronteira do caminho de escrita do agregado `ServiceInterest`
 * (USP-033 — AD-020). Não carrega `personId`/`clientPersonId` no input
 * (P-002): a action opera exclusivamente sobre a Pessoa da sessão.
 */

/** Manifestar interesse num serviço (USP-033). `consentAccepted` só é exigido
 *  quando o consentimento `SERVICE_HIRING` ainda não está ativo (design §D3). */
export const manifestInterestSchema = z.object({
  serviceId: z.string().uuid('Serviço inválido.'),
  consentAccepted: z.boolean().optional(),
});
export type ManifestInterestInput = z.infer<typeof manifestInterestSchema>;
