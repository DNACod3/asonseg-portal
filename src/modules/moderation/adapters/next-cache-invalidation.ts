import { revalidatePath } from 'next/cache';
import { childLogger } from '@/shared/lib/logger';
import { ContentKind, ContentStatus } from '../domain/content-status';
import type {
  CacheInvalidationPort,
  CacheInvalidationTarget,
} from '../ports/cache-invalidation.port';

/**
 * Adapter real do {@link CacheInvalidationPort} usando o cache do Next
 * (`revalidatePath`, ADR-T-0013). Revalida as rotas públicas afetadas quando um
 * conteúdo entra ou sai de `ACTIVE`. É soft-fail: erros são logados e engolidos
 * (o ISR de fallback cobre), nunca propagam para abortar a transição.
 */
export class NextCacheInvalidation implements CacheInvalidationPort {
  private readonly log = childLogger({ module: 'moderation', adapter: 'next-cache' });

  async revalidateForContent(target: CacheInvalidationTarget): Promise<void> {
    // Só transições que mudam visibilidade pública importam para o cache.
    if (target.to !== ContentStatus.ACTIVE && target.to !== ContentStatus.INACTIVATED) {
      return;
    }
    for (const path of this.publicPathsFor(target.contentKind)) {
      revalidatePath(path);
    }
    // Página de detalhe (USP-018 / INACT-05, INACT-MN-04 — espelhado em USP-029/030/031
    // para serviços): revalida também a rota `[id]` para que o ISR não sirva um
    // conteúdo inativado/pausado stale.
    if (target.contentKind === ContentKind.JOB) {
      revalidatePath(`/vagas/${target.contentId}`);
    } else if (target.contentKind === ContentKind.SERVICE) {
      revalidatePath(`/servicos/${target.contentId}`);
    }
    this.log.debug({ contentKind: target.contentKind, to: target.to }, 'moderation:cache:revalidated');
  }

  /** Rotas públicas (route group `(public)`) cuja listagem depende do conteúdo. */
  private publicPathsFor(kind: ContentKind): string[] {
    switch (kind) {
      case ContentKind.JOB:
        return ['/vagas'];
      case ContentKind.SERVICE:
        return ['/servicos'];
      case ContentKind.CV:
        return []; // CV não tem listagem pública (ADR-0010)
      default:
        return [];
    }
  }
}
