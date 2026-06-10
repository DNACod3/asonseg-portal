import type { AuditTx } from '@/modules/audit';
import { createToken } from '@/shared/container';
import type { ContentKind, ContentStatus } from '../domain/content-status';

/**
 * Acesso à coluna `status` do conteúdo moderável, abstraído por tipo (GAP-8).
 *
 * Nenhum model real de conteúdo (`jobs`/`services`/`candidate_profiles`) existe
 * ainda — só `Company` (USP-012). Por isso `transitionContent` (#122) lê/escreve
 * o status atrás deste port, resolvido por `ContentKind` no container. O adapter
 * Prisma de cada tipo real chega com sua própria USP; nesta US o backing store é
 * a tabela transitória `_moderation_fixture` (cf. `_health_check`).
 */
export interface ContentStatusRepository {
  /** Status atual do conteúdo, ou `null` se o item não existe. */
  loadStatus(kind: ContentKind, contentId: string): Promise<ContentStatus | null>;

  /**
   * Aplica a transição **dentro da transação** (`tx`) com concorrência otimista:
   * `UPDATE ... SET status = to WHERE id = ? AND status = from` (ADR-0011 R3).
   * Retorna `true` se exatamente uma linha casou; `false` quando o status já
   * mudou (segunda decisão concorrente) — o caller aborta a transação.
   */
  updateStatus(
    tx: AuditTx,
    kind: ContentKind,
    contentId: string,
    from: ContentStatus,
    to: ContentStatus,
  ): Promise<boolean>;
}

export const CONTENT_STATUS_REPOSITORY_TOKEN =
  createToken<ContentStatusRepository>('ContentStatusRepository');
