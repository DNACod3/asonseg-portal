import { createToken } from '@/shared/container';
import type { ContentKind } from '../domain/content-status';
import type { ModerationContentView } from '../views/moderation-content';

/**
 * Leitura do conteúdo integral de um item de moderação, por `ContentKind`
 * (USP-066 / E-001). Espelha `ContentStatusRepository` (status): aqui o dado
 * é o **conteúdo**, não o estado da FSM.
 *
 * Resolvido por tipo no `DispatchingContentModerationReader` (container) —
 * cada módulo dono (`jobs`/`services`/`persons`) registra seu adapter Prisma.
 * `readContent` nunca lança: item inexistente ou kind sem reader registrado
 * (`CV` isolado) devolvem `null` (E-006, falha graciosa a cargo da action).
 */
export interface ContentModerationReader {
  readContent(kind: ContentKind, contentId: string): Promise<ModerationContentView | null>;
}

export const CONTENT_MODERATION_READER_TOKEN =
  createToken<ContentModerationReader>('ContentModerationReader');
