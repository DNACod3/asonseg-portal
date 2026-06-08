import { z } from 'zod';

/**
 * Schema de entrada da reativação de Pessoa (USP-045 — fluxo inverso da USP-007).
 *
 * Motivo obrigatório: `PERSON_REACTIVATED` está em `JUSTIFICATION_REQUIRED_EVENTS`
 * (L-003 das expectations exige "responsável, motivo e data/hora" no log imutável).
 * O `withAudit` faria rollback se a justificativa faltasse — exigimos já na borda
 * (Zod), com mensagem amigável.
 *
 * ❓ (D-005 / gate Fase 0): catálogo controlado de motivos ainda não definido
 * pelo dono do intent. Por ora usa texto livre, mesmos limites da inativação.
 */

export const REACTIVATION_REASON_MIN = 5;
export const REACTIVATION_REASON_MAX = 500;

export const reactivatePersonSchema = z.object({
  personId: z.string().uuid('Pessoa inválida.'),
  reason: z
    .string()
    .trim()
    .min(
      REACTIVATION_REASON_MIN,
      `Informe o motivo da reativação (mínimo ${REACTIVATION_REASON_MIN} caracteres).`,
    )
    .max(REACTIVATION_REASON_MAX, `Motivo deve ter no máximo ${REACTIVATION_REASON_MAX} caracteres.`),
});

export type ReactivatePersonInput = z.input<typeof reactivatePersonSchema>;
export type ReactivatePersonData = z.output<typeof reactivatePersonSchema>;
