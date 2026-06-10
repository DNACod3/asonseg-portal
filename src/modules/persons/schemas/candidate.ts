import { z } from 'zod';
import { EDUCATION_LEVELS, normalizePhone } from '../domain/candidate';

/**
 * Schema de entrada do cadastro de candidato (USP-009 / CAD-01).
 *
 * **Obrigatórios (EDGE):** escolaridade, área de interesse principal e telefone —
 * a submissão é rejeitada sem qualquer um deles, com mensagem PT-BR. Demais campos
 * são opcionais. O telefone é normalizado para dígitos no parse (`z.output`).
 *
 * **P-002:** não há `personId` no input — a action opera sobre a Pessoa autenticada
 * da sessão (`getCurrentPerson`).
 */

export const PHONE_MIN_DIGITS = 10; // DDD + 8 (fixo)
export const PHONE_MAX_DIGITS = 11; // DDD + 9 (celular)

export const candidateProfileSchema = z.object({
  educationLevel: z.enum(EDUCATION_LEVELS, { message: 'Selecione a escolaridade.' }),
  primaryAreaOfInterestId: z.string().uuid('Selecione a área de interesse principal.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Informe o telefone.')
    .transform(normalizePhone)
    .refine(
      (digits) => digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS,
      'Telefone inválido. Informe DDD + número.',
    ),
  headline: z.string().trim().max(120, 'Máximo de 120 caracteres.').optional(),
  educationArea: z.string().trim().max(120, 'Máximo de 120 caracteres.').optional(),
  experienceText: z.string().trim().max(5000, 'Máximo de 5000 caracteres.').optional(),
  skillsText: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').optional(),
  coursesText: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').optional(),
  availability: z.string().trim().max(120, 'Máximo de 120 caracteres.').optional(),
});

/** Tipo de entrada (o que o formulário envia). */
export type CandidateProfileInput = z.input<typeof candidateProfileSchema>;
/** Tipo de saída (normalizado, após o parse — telefone só com dígitos). */
export type CandidateProfileData = z.output<typeof candidateProfileSchema>;
