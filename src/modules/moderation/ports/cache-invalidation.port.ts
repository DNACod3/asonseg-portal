import { createToken } from '@/shared/container';
import type { ContentKind, ContentStatus } from '../domain/content-status';

/** Conteúdo cuja visibilidade pública mudou após uma transição. */
export interface CacheInvalidationTarget {
  contentKind: ContentKind;
  contentId: string;
  to: ContentStatus;
}

/**
 * Invalidação de cache público on-demand após transições que afetam visibilidade
 * (entrar/sair de `ACTIVE` — ADR-T-0013). Side effect **soft-fail**: o ISR de
 * fallback cobre eventual falha (ADR-0011 R2).
 */
export interface CacheInvalidationPort {
  revalidateForContent(target: CacheInvalidationTarget): Promise<void>;
}

export const CACHE_INVALIDATION_TOKEN =
  createToken<CacheInvalidationPort>('CacheInvalidationPort');
