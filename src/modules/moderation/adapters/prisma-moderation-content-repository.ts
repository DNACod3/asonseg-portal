import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import type { AuditTx } from '@/modules/audit';
import { prisma } from '@/shared/lib/prisma';
import { ContentStatus, type ContentKind } from '../domain/content-status';
import type { ContentStatusRepository } from '../ports/content-status.port';

/**
 * Adapter Prisma do {@link ContentStatusRepository} sobre a tabela transitória
 * `_moderation_fixture` (GAP-8 — o 1º tipo de conteúdo a aterrissar).
 *
 * Quando os models reais (`jobs`/`services`/`candidate_profiles`) chegarem com
 * suas USPs, o binding no container passa a despachar por `ContentKind` para o
 * adapter de cada tabela; o contrato (load + update otimista) permanece.
 *
 * Os valores de `ContentStatus` (domínio) e do enum Prisma `content_status` são
 * strings idênticas — a conversão é só de tipo nominal.
 */
export class PrismaModerationContentRepository implements ContentStatusRepository {
  async loadStatus(kind: ContentKind, contentId: string): Promise<ContentStatus | null> {
    const row = await prisma.moderationFixtureContent.findFirst({
      where: { id: contentId, kind },
      select: { status: true },
    });
    return row ? (row.status as unknown as ContentStatus) : null;
  }

  async updateStatus(
    tx: AuditTx,
    kind: ContentKind,
    contentId: string,
    from: ContentStatus,
    to: ContentStatus,
  ): Promise<boolean> {
    // Concorrência otimista (ADR-0011 R3): só casa se o status ainda é `from`.
    const result = await tx.moderationFixtureContent.updateMany({
      where: {
        id: contentId,
        kind,
        status: from as unknown as PrismaContentStatus,
      },
      data: { status: to as unknown as PrismaContentStatus },
    });
    return result.count === 1;
  }
}
