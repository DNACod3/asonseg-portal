import type { AuditTx } from '@/modules/audit';
import { ContentKind, type ContentStatus } from '../domain/content-status';
import type { ContentStatusRepository } from '../ports/content-status.port';

/**
 * Despacha cada operação de status para o {@link ContentStatusRepository} do
 * `ContentKind` correspondente (GAP-8 da USP-016).
 *
 * Enquanto os models reais de conteúdo não existem, JOB/CV/SERVICE caem no
 * `fallback` (a tabela `_moderation_fixture`). Conforme cada tipo aterrissa com
 * sua USP, registra-se seu adapter concreto no mapa `byKind` — o primeiro é
 * `CANDIDATE_PROFILE` (USP-009). Este dispatcher é **genérico**: não conhece
 * nenhum módulo de conteúdo; o mapa é montado na composição (shared/container).
 */
export class DispatchingContentStatusRepository implements ContentStatusRepository {
  constructor(
    private readonly byKind: Partial<Record<ContentKind, ContentStatusRepository>>,
    private readonly fallback: ContentStatusRepository,
  ) {}

  private repoFor(kind: ContentKind): ContentStatusRepository {
    return this.byKind[kind] ?? this.fallback;
  }

  loadStatus(kind: ContentKind, contentId: string): Promise<ContentStatus | null> {
    return this.repoFor(kind).loadStatus(kind, contentId);
  }

  updateStatus(
    tx: AuditTx,
    kind: ContentKind,
    contentId: string,
    from: ContentStatus,
    to: ContentStatus,
  ): Promise<boolean> {
    return this.repoFor(kind).updateStatus(tx, kind, contentId, from, to);
  }
}
