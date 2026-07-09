import { Prisma } from '@prisma/client';
import type { AuditTx } from '@/modules/audit';
import type { ContentKind, ContentStatus, ContentStatusRepository } from '@/modules/moderation';
import { prisma } from '@/shared/lib/prisma';

/**
 * Adapter Prisma do {@link ContentStatusRepository} (módulo moderation) para o
 * serviço (USP-029). Lê/escreve `services.status`, onde `contentId` é o `id` do
 * serviço. Espelha {@link PrismaJobStatusRepository} (`@/modules/jobs`).
 *
 * Registrado no dispatcher por `ContentKind.SERVICE` (shared/container). O
 * parâmetro `kind` é ignorado — este adapter só atende serviços.
 */
export class PrismaServiceStatusRepository implements ContentStatusRepository {
  async loadStatus(_kind: ContentKind, contentId: string): Promise<ContentStatus | null> {
    const row = await prisma.service.findUnique({
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
    // Em `to=ACTIVE`, grava `published_at = COALESCE(published_at, now())` — 1ª
    // ativação grava a data; re-aprovação pós-edição preserva a original
    // (mesmo padrão de Job — AC-030-1 ordena a busca por published_at).
    const affected = await tx.$executeRaw(Prisma.sql`
      UPDATE services
      SET status = ${to as unknown as string}::"content_status",
          last_status_change_at = now(),
          published_at = CASE
            WHEN ${to as unknown as string}::"content_status" = 'ACTIVE'::"content_status"
              THEN COALESCE(published_at, now())
            ELSE published_at
          END
      WHERE id = ${contentId}::uuid
        AND status = ${from as unknown as string}::"content_status"
    `);
    return affected === 1;
  }
}
