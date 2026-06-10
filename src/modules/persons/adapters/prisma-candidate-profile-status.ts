import { ContentStatus as PrismaContentStatus } from '@prisma/client';
import type { AuditTx } from '@/modules/audit';
import type { ContentKind, ContentStatus, ContentStatusRepository } from '@/modules/moderation';
import { prisma } from '@/shared/lib/prisma';

/**
 * Adapter Prisma do {@link ContentStatusRepository} (módulo moderation) para o
 * perfil de candidato (USP-009 / GAP-8). Lê/escreve `candidate_profiles.publication_status`,
 * onde `contentId` é o `personId` (PK do perfil).
 *
 * Registrado no dispatcher por `ContentKind.CANDIDATE_PROFILE` (shared/container).
 * O parâmetro `kind` é ignorado — este adapter só atende perfis de candidato.
 * Os valores de `ContentStatus` (domínio) e do enum Prisma são strings idênticas.
 */
export class PrismaCandidateProfileStatusRepository implements ContentStatusRepository {
  async loadStatus(_kind: ContentKind, contentId: string): Promise<ContentStatus | null> {
    const row = await prisma.candidateProfile.findUnique({
      where: { personId: contentId },
      select: { publicationStatus: true },
    });
    return row ? (row.publicationStatus as unknown as ContentStatus) : null;
  }

  async updateStatus(
    tx: AuditTx,
    _kind: ContentKind,
    contentId: string,
    from: ContentStatus,
    to: ContentStatus,
  ): Promise<boolean> {
    // Concorrência otimista (ADR-0011 R3): só casa se o status ainda é `from`.
    const result = await tx.candidateProfile.updateMany({
      where: {
        personId: contentId,
        publicationStatus: from as unknown as PrismaContentStatus,
      },
      data: {
        publicationStatus: to as unknown as PrismaContentStatus,
        lastStatusChangeAt: new Date(),
      },
    });
    return result.count === 1;
  }
}
