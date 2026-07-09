import { z } from 'zod';

/**
 * Schemas de fronteira das actions de ciclo de vida pós-publicação (USP-032):
 * pausar/despausar/arquivar (só `serviceId`). Espelha `jobs/schemas/lifecycle.schema.ts`
 * — serviço não tem `validUntil`/prorrogação (sem validade automática, épico Out-of-Scope).
 */
export const serviceIdSchema = z.object({ serviceId: z.string().uuid('Serviço inválido.') });
export type ServiceIdInput = z.infer<typeof serviceIdSchema>;

export const pauseServiceSchema = serviceIdSchema;
export type PauseServiceInput = z.infer<typeof pauseServiceSchema>;

export const resumeServiceSchema = serviceIdSchema;
export type ResumeServiceInput = z.infer<typeof resumeServiceSchema>;

export const archiveServiceSchema = serviceIdSchema;
export type ArchiveServiceInput = z.infer<typeof archiveServiceSchema>;
