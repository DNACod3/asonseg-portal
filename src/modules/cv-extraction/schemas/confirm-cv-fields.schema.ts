import { z } from 'zod';

/**
 * Espelha `EDUCATION_LEVELS` de `persons/domain/candidate.ts` — duplicado
 * intencionalmente (não importado). Este schema é consumido tanto pela
 * Server Action `confirmCvFields` quanto pelo Client Component
 * `CvUploadForm` (resolver do React Hook Form); importar o barrel
 * `@/modules/persons` aqui arrastaria queries com IO de Prisma e código
 * server-only para o bundle do cliente (mesma classe de problema documentada
 * em `persons/components/candidate-form.tsx` — verificado empiricamente via
 * `npm run build`).
 */
export const EDUCATION_LEVELS_CV = [
  'ENSINO_FUNDAMENTAL',
  'ENSINO_MEDIO',
  'ENSINO_TECNICO',
  'ENSINO_SUPERIOR',
  'POS_GRADUACAO',
] as const;

/**
 * Schema de entrada de `confirmCvFields` (USP-040 / CVE-04) — os 5 campos
 * estruturados do CV, todos opcionais (o candidato pode confirmar só uma
 * parte, ou nenhum, deixando o resto para preenchimento manual posterior).
 * `educationLevel` espelha o enum canônico de `persons` (CAD-01) — ver nota acima.
 */
export const confirmCvFieldsSchema = z.object({
  educationLevel: z.enum(EDUCATION_LEVELS_CV, { message: 'Escolaridade inválida.' }).optional(),
  educationArea: z.string().trim().max(120, 'Máximo de 120 caracteres.').optional(),
  experienceText: z.string().trim().max(5000, 'Máximo de 5000 caracteres.').optional(),
  skillsText: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').optional(),
  coursesText: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').optional(),
});

export type ConfirmCvFieldsInput = z.input<typeof confirmCvFieldsSchema>;
export type ConfirmCvFieldsData = z.output<typeof confirmCvFieldsSchema>;
