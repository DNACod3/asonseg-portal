import { z } from 'zod';
import { EDUCATION_LEVELS } from '@/modules/persons';

/**
 * Schema de entrada de `confirmCvFields` (USP-040 / CVE-04) — os 5 campos
 * estruturados do CV, todos opcionais (o candidato pode confirmar só uma
 * parte, ou nenhum, deixando o resto para preenchimento manual posterior).
 * `educationLevel` reusa o enum canônico de `persons` (CAD-01).
 */
export const confirmCvFieldsSchema = z.object({
  educationLevel: z.enum(EDUCATION_LEVELS, { message: 'Escolaridade inválida.' }).optional(),
  educationArea: z.string().trim().max(120, 'Máximo de 120 caracteres.').optional(),
  experienceText: z.string().trim().max(5000, 'Máximo de 5000 caracteres.').optional(),
  skillsText: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').optional(),
  coursesText: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').optional(),
});

export type ConfirmCvFieldsInput = z.input<typeof confirmCvFieldsSchema>;
export type ConfirmCvFieldsData = z.output<typeof confirmCvFieldsSchema>;
