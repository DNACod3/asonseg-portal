import { z } from 'zod';

/**
 * Schema de entrada da inativação de Pessoa (USP-007 / IDN-15, IDN-16).
 *
 * **Motivo obrigatório (não opcional):** `PERSON_INACTIVATED` está no conjunto
 * `JUSTIFICATION_REQUIRED_EVENTS` do catálogo de auditoria, e L-004 das
 * expectations exige que o log de inativação inclua "responsável, motivo e
 * data/hora". O `withAudit` faria rollback se a justificativa faltasse — então a
 * exigimos já na borda (Zod), com mensagem amigável, em vez de deixar estourar
 * uma exceção genérica de auditoria. (Diverge do texto "motivo opcional" da
 * sub-task #84 em favor do invariante de auditoria, que é a fonte canônica.)
 */

export const INACTIVATION_REASON_MIN = 5;
export const INACTIVATION_REASON_MAX = 500;

export const inactivatePersonSchema = z.object({
  personId: z.string().uuid('Pessoa inválida.'),
  reason: z
    .string()
    .trim()
    .min(
      INACTIVATION_REASON_MIN,
      `Informe o motivo da inativação (mínimo ${INACTIVATION_REASON_MIN} caracteres).`,
    )
    .max(INACTIVATION_REASON_MAX, `Motivo deve ter no máximo ${INACTIVATION_REASON_MAX} caracteres.`),
});

/** Tipo de entrada (o que o formulário/caller envia). */
export type InactivatePersonInput = z.input<typeof inactivatePersonSchema>;
/** Tipo de saída (normalizado, após o parse). */
export type InactivatePersonData = z.output<typeof inactivatePersonSchema>;
