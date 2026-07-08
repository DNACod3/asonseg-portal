import { z } from 'zod';
import { ContentKind } from '../domain/content-status';
import {
  MIN_JUSTIFICATION_LENGTH,
  JUSTIFICATION_TOO_SHORT_MESSAGE,
  JUSTIFICATION_NOT_MEANINGFUL_MESSAGE,
  isMeaningfulJustification,
} from '../domain/justification';

/** Referência a um conteúdo moderável (tipo + id). Reusada por `inactivate.ts` (USP-018). */
export const contentRef = {
  contentKind: z.nativeEnum(ContentKind),
  contentId: z.string().uuid('Conteúdo inválido.'),
};

/** Motivo obrigatório e significativo de devolução/rejeição/inativação (P-003). */
export const justification = z
  .string({ required_error: JUSTIFICATION_TOO_SHORT_MESSAGE })
  .trim()
  .min(MIN_JUSTIFICATION_LENGTH, JUSTIFICATION_TOO_SHORT_MESSAGE)
  .refine(isMeaningfulJustification, JUSTIFICATION_NOT_MEANINGFUL_MESSAGE);

/** Aprovar não exige motivo (E-002). */
export const approveSchema = z.object(contentRef);

/** Devolver para ajustes exige motivo (E-003). */
export const returnForAdjustmentsSchema = z.object({ ...contentRef, justification });

/** Rejeitar exige motivo (E-004). */
export const rejectSchema = z.object({ ...contentRef, justification });

export type ApproveInput = z.infer<typeof approveSchema>;
export type ReturnForAdjustmentsInput = z.infer<typeof returnForAdjustmentsSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
