import { z } from 'zod';
import { contentRef } from './decision';

/**
 * Input de `openModerationContent` (USP-066 / T6) — mesma referência de
 * conteúdo (tipo + id) usada pelas decisões (`decide.ts`), reusada de
 * `contentRef` em vez de duplicada.
 */
export const openContentSchema = z.object(contentRef);

export type OpenContentInput = z.infer<typeof openContentSchema>;
