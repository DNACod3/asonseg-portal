import { z } from 'zod';
import { CONSENT_PURPOSES } from '../domain/purposes';

/** Finalidade válida — uma das 8 do conjunto fechado do MVP (P-008). */
export const consentPurposeSchema = z.enum(CONSENT_PURPOSES, {
  message: 'Finalidade de consentimento inválida',
});

/** Entrada de `grantConsent`: a finalidade que o titular está aceitando. */
export const grantConsentSchema = z.object({
  purpose: consentPurposeSchema,
});

export type GrantConsentInput = z.infer<typeof grantConsentSchema>;

/** Entrada de `revokeConsent`: finalidade + motivo opcional do titular. */
export const revokeConsentSchema = z.object({
  purpose: consentPurposeSchema,
  reason: z
    .string()
    .trim()
    .max(500, 'Motivo deve ter no máximo 500 caracteres')
    .optional(),
});

export type RevokeConsentInput = z.infer<typeof revokeConsentSchema>;
