import { z } from 'zod';

/** Tamanho máximo do motivo (opcional) de remoção de um responsável (USP-014). */
export const MOTIVO_MAX = 280;

/**
 * Entrada da remoção de um responsável (USP-014). Identifica o vínculo pelo
 * `grantId`; o `motivo` é opcional (negócio — gravado em `revokeReason`), com
 * trim e limite de tamanho. String vazia/whitespace vira `undefined`.
 */
export const removeResponsibleSchema = z.object({
  grantId: z.string().uuid('Vínculo inválido.'),
  motivo: z
    .string()
    .trim()
    .max(MOTIVO_MAX, `O motivo deve ter no máximo ${MOTIVO_MAX} caracteres.`)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type RemoveResponsibleInput = z.input<typeof removeResponsibleSchema>;
export type RemoveResponsibleData = z.output<typeof removeResponsibleSchema>;
