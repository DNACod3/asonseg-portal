import { z } from 'zod';

/**
 * Schemas de fronteira do agregado `Referral` (USP-037/038 — SOC-03..05).
 *
 * `professionalSummary`, quando **enviado**, não pode ser vazio/só-espaços
 * (`trim().min(1)`) — o campo é omitido (não enviado) quando irrelevante; um
 * valor presente porém vazio é rejeitado aqui (defesa de forma). A
 * obrigatoriedade **condicional** (REF-MN-03: exigido quando a Pessoa não tem
 * CV) depende de dado do DB e é decidida na action, não neste schema.
 */
export const PROFESSIONAL_SUMMARY_MAX = 2000;
export const JUSTIFICATION_MAX = 1000;

/** Criar um encaminhamento (USP-037 / AC-037-1..4). */
export const createReferralSchema = z.object({
  personId: z.string().uuid('Pessoa inválida.'),
  jobId: z.string().uuid('Vaga inválida.'),
  professionalSummary: z
    .string()
    .trim()
    .min(1, 'Informe o resumo profissional.')
    .max(PROFESSIONAL_SUMMARY_MAX, `Máximo de ${PROFESSIONAL_SUMMARY_MAX} caracteres.`)
    .optional(),
  justification: z
    .string()
    .trim()
    .max(JUSTIFICATION_MAX, `Máximo de ${JUSTIFICATION_MAX} caracteres.`)
    .optional(),
});

export type CreateReferralInput = z.input<typeof createReferralSchema>;
export type CreateReferralData = z.output<typeof createReferralSchema>;
