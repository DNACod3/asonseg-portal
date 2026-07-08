import { z } from 'zod';
import { MAX_VALIDADE_DIAS, validadeStatus } from '../domain/validade';

/**
 * Schemas de fronteira das actions de ciclo de vida pós-publicação (USP-023):
 * pausar/despausar/arquivar (só `jobId`) e prorrogar validade (`jobId` + nova data).
 */
export const jobIdSchema = z.object({ jobId: z.string().uuid('Vaga inválida.') });
export type JobIdInput = z.infer<typeof jobIdSchema>;

export const pauseJobSchema = jobIdSchema;
export type PauseJobInput = z.infer<typeof pauseJobSchema>;

export const unpauseJobSchema = jobIdSchema;
export type UnpauseJobInput = z.infer<typeof unpauseJobSchema>;

export const archiveJobSchema = jobIdSchema;
export type ArchiveJobInput = z.infer<typeof archiveJobSchema>;

/**
 * Prorrogar validade (E-004): a nova data deve ser futura e respeitar o teto
 * ({@link MAX_VALIDADE_DIAS}) — mesma regra pura de `publishJobSchema` (submit),
 * via {@link validadeStatus}. Sem teto de *quantidade* de prorrogações (P-002 N/A).
 */
export const extendJobValiditySchema = z
  .object({
    jobId: z.string().uuid('Vaga inválida.'),
    validUntil: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Data inválida.'),
  })
  .superRefine((data, ctx) => {
    if (Number.isNaN(new Date(data.validUntil).getTime())) return; // já sinalizado acima
    const status = validadeStatus(new Date(data.validUntil), new Date());
    if (status === 'passado') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: 'A data de validade deve ser futura.',
      });
    } else if (status === 'excede_teto') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: `A validade não pode ultrapassar ${MAX_VALIDADE_DIAS} dias.`,
      });
    }
  });
export type ExtendJobValidityInput = z.infer<typeof extendJobValiditySchema>;

export { MAX_VALIDADE_DIAS };
