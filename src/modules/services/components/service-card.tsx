import { formatDate } from '@/shared/lib/time';
import { Badge, Card } from '@/shared/ui';
import type { ServiceListItem } from '../views/service-list-item.view';

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Texto da faixa de valor + unidade (ou null se ausente). */
function priceLabel(price: ServiceListItem['price']): string | null {
  if (!price) return null;
  const { min, max, unit } = price;
  const unitSuffix = unit ? ` (${unit})` : '';
  if (min != null && max != null) {
    return (min === max ? brl.format(min) : `${brl.format(min)} – ${brl.format(max)}`) + unitSuffix;
  }
  if (min != null) return `A partir de ${brl.format(min)}${unitSuffix}`;
  if (max != null) return `Até ${brl.format(max)}${unitSuffix}`;
  return null;
}

/**
 * Cartão de serviço na lista pública (USP-030). Mostra os dados projetados pelo
 * View Model — o nome do prestador/Empresa é **público** (ADR-0010, sem
 * anonimização, diferença vs `JobCard`). Nenhum dado de contato chega aqui: o
 * serializer já recortou (SVC030-MN-02). O link aponta para o detalhe (USP-031).
 */
export function ServiceCard({ service }: Readonly<{ service: ServiceListItem }>) {
  const price = priceLabel(service.price);
  const meta = [service.categoryName, service.regionName].filter(Boolean);

  return (
    <Card className="p-5">
      <a
        href={`/servicos/${service.id}`}
        className="block focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {service.coverPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URL pública externa (bucket Storage), sem otimização do next/image.
          <img
            src={service.coverPhotoUrl}
            alt=""
            className="mb-3 h-40 w-full rounded-md object-cover"
          />
        )}
        <h3 className="text-lg font-semibold text-fg">{service.title}</h3>
        <p className="mt-1 text-sm text-fg-muted">{service.providerDisplayName}</p>

        {meta.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {meta.map((tag) => (
              <li key={tag}>
                <Badge variant="gray">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-medium text-fg">{price ?? 'Valor a combinar'}</span>
          {service.publishedAt && (
            <time dateTime={service.publishedAt.toISOString()} className="text-fg-muted">
              {formatDate(service.publishedAt)}
            </time>
          )}
        </div>
      </a>
    </Card>
  );
}
