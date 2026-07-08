import { z } from 'zod';
import { contentRef, justification } from './decision';

/**
 * Schema de entrada da inativação administrativa de conteúdo publicado (USP-018).
 * Motivo obrigatório e significativo (INACT-02 / INACT-MN-02) — mesma regra de
 * devolver/rejeitar (`schemas/decision.ts`), reusada aqui via `contentRef` +
 * `justification` para não duplicar a validação de P-003.
 */
export const inactivateSchema = z.object({ ...contentRef, justification });

export type InactivateContentInput = z.infer<typeof inactivateSchema>;
