import { Prisma } from '@prisma/client';
import type { ContentKind, ContentModerationReader, ModerationContentView } from '@/modules/moderation';
import { prisma } from '@/shared/lib/prisma';
import { buildServicePhotoUrl } from '../domain/photo-url';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Faixa de preço formatada — espelha `priceLabel` de `components/service-detail.tsx`. */
function priceRangeLabel(min: number | null, max: number | null, unit: string | null): string | null {
  const unitSuffix = unit ? ` (${unit})` : '';
  if (min != null && max != null) {
    return (min === max ? brl.format(min) : `${brl.format(min)} – ${brl.format(max)}`) + unitSuffix;
  }
  if (min != null) return `A partir de ${brl.format(min)}${unitSuffix}`;
  if (max != null) return `Até ${brl.format(max)}${unitSuffix}`;
  return null;
}

const serviceModerationSelect = {
  title: true,
  description: true,
  category: { select: { name: true } },
  region: { select: { name: true } },
  availabilityDescription: true,
  priceMin: true,
  priceMax: true,
  priceUnit: true,
  photos: { select: { storagePath: true, position: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.ServiceSelect;

/**
 * Adapter Prisma do {@link ContentModerationReader} para o serviço (USP-066 / E-003).
 *
 * Lê o conteúdo **integral** do rascunho — sem filtro de `status` (o item já
 * chega `IN_MODERATION` pela fila; a fronteira de permissão é a Server Action
 * `openModerationContent`). `serviceArea` = `region.name` (premissa §6 da
 * spec — proxy geográfico; single-region MVP). Fotos = URLs públicas do CDN
 * (bucket `provider-photos`), na ordem `position asc`.
 */
export class PrismaServiceModerationReader implements ContentModerationReader {
  async readContent(_kind: ContentKind, serviceId: string): Promise<ModerationContentView | null> {
    const row = await prisma.service.findUnique({
      where: { id: serviceId },
      select: serviceModerationSelect,
    });
    if (!row) return null;

    return {
      kind: 'SERVICE',
      title: row.title,
      description: row.description,
      category: row.category?.name ?? null,
      serviceArea: row.region?.name ?? null,
      availability: row.availabilityDescription,
      priceRange: priceRangeLabel(
        row.priceMin?.toNumber() ?? null,
        row.priceMax?.toNumber() ?? null,
        row.priceUnit,
      ),
      photos: row.photos.map((photo) => buildServicePhotoUrl(photo.storagePath)),
    };
  }
}
