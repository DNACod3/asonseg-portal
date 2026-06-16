import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import type { AuditTx } from '@/modules/audit';
import type { ContentKind, ContentStatus, ContentStatusRepository } from '@/modules/moderation';
import { prisma } from '@/shared/lib/prisma';

/**
 * Adapter Prisma do {@link ContentStatusRepository} (módulo moderation) para a vaga
 * (USP-020). Lê/escreve `jobs.status`, onde `contentId` é o `id` da vaga.
 *
 * Registrado no dispatcher por `ContentKind.JOB` (shared/container). Espelha
 * {@link PrismaCandidateProfileStatusRepository} (USP-009). O parâmetro `kind` é
 * ignorado — este adapter só atende vagas. Os valores de `ContentStatus` (domínio)
 * e do enum Prisma são strings idênticas.
 */
export class PrismaJobStatusRepository implements ContentStatusRepository {
  async loadStatus(_kind: ContentKind, contentId: string): Promise<ContentStatus | null> {
    const row = await prisma.job.findUnique({
      where: { id: contentId },
      select: { status: true },
    });
    return row ? (row.status as unknown as ContentStatus) : null;
  }

  async updateStatus(
    tx: AuditTx,
    _kind: ContentKind,
    contentId: string,
    from: ContentStatus,
    to: ContentStatus,
  ): Promise<boolean> {
    // Concorrência otimista (ADR-0011 R3): só casa se o status ainda é `from`.
    const result = await tx.job.updateMany({
      where: {
        id: contentId,
        status: from as unknown as PrismaContentStatus,
      },
      data: {
        status: to as unknown as PrismaContentStatus,
        lastStatusChangeAt: new Date(),
      },
    });
    return result.count === 1;
  }
}
