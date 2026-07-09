import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { buildServicePhotoUrl } from '../domain/photo-url';
import { decimalToNumber, providerDisplayName } from './provider-display';

/**
 * View Model do **detalhe do serviço** (USP-031). E a **unica fonte de
 * anonimizacao/privacidade** do detalhe (runbook-view-model-visibility, AD-012):
 * consumido tanto pela pagina quanto pelo `generateMetadata`/JSON-LD
 * (SVC031-MN-03 - anonimizar/recortar uma vez, no serializer, nunca no
 * template). O nome do prestador/Empresa e **publico a todos** (ADR-0010) -
 * diferenca chave vs `viewJobDetail`. A barreira aqui e so o **contato**
 * (telefone/e-mail): o tipo `ServiceDetail` **nao tem** campo de contato -
 * o dado nem e carregado pela query (SVC031-MN-01), entao nao ha como vazar
 * em nenhum canal (HTML, JSON, OG, JSON-LD).
 */

export interface ServiceDetailPrice {
  min: number | null;
  max: number | null;
  unit: string | null;
}

export interface ServiceDetailPhoto {
  url: string;
  position: number;
}

export interface ServiceDetail {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  region: string | null;
  price: ServiceDetailPrice | null;
  availability: string | null;
  photos: ServiceDetailPhoto[];
  provider: {
    displayName: string;
    isPF: boolean;
  };
  publishedAt: Date | null;
  /** Afordancia autenticada (seam U3): a acao real de manifestar interesse e a
   *  revelacao de contato sao USP-033. Aqui e so `viewer != null`. */
  canManifestInterest: boolean;
}

/** Shape minimo que o serializer consome - a query faz `select` explicito disto.
 *  NUNCA inclui `phone`/`emailLogin` do autor (SVC031-MN-01, defesa RSC/Flight). */
export interface ServiceDetailRow {
  id: string;
  title: string;
  description: string | null;
  priceMin: Prisma.Decimal | null;
  priceMax: Prisma.Decimal | null;
  priceUnit: string | null;
  availabilityDescription: string | null;
  publishedAt: Date | null;
  category: { name: string } | null;
  region: { name: string } | null;
  photos: { storagePath: string; position: number }[];
  author: { fullName: string };
  company: { nomeFantasia: string } | null;
}

/**
 * Projeta uma linha de detalhe de servico para o View Model.
 *
 * - `provider.displayName`: `company.nomeFantasia` quando publicado em nome de
 *   Empresa, senao `author.fullName` (PF) - publico a **todos** (anonimo e
 *   autenticado), sem branch de anonimizacao (AC-031-1).
 * - Nenhum campo de contato existe no tipo (AC-031-2/SVC031-MN-01) - oculto
 *   para anonimo **e** autenticado nesta USP; a revelacao e USP-033.
 * - `canManifestInterest = viewer != null` (seam U3 - afordancia apenas,
 *   nenhuma acao real acontece aqui).
 */
export function viewServiceDetail(row: ServiceDetailRow, viewer: CurrentPerson | null): ServiceDetail {
  const hasPrice = row.priceMin != null || row.priceMax != null || row.priceUnit != null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category?.name ?? null,
    region: row.region?.name ?? null,
    price: hasPrice
      ? { min: decimalToNumber(row.priceMin), max: decimalToNumber(row.priceMax), unit: row.priceUnit }
      : null,
    availability: row.availabilityDescription,
    photos: row.photos.map((p) => ({ url: buildServicePhotoUrl(p.storagePath), position: p.position })),
    provider: {
      displayName: providerDisplayName(row),
      isPF: row.company == null,
    },
    publishedAt: row.publishedAt,
    canManifestInterest: viewer != null,
  };
}

/**
 * JSON-LD schema.org `Service` do detalhe (USP-031). Para SEO/social o conteudo
 * e **sempre** derivado de `viewServiceDetail(row, null)` (SVC031-MN-03 - mesma
 * fonte unica) - mas como o nome do prestador e publico a todos, o resultado e
 * identico independente do viewer passado. **Sem contato** em nenhum campo.
 */
export function serviceDetailJsonLd(service: ServiceDetail): Record<string, unknown> {
  const offers =
    service.price && (service.price.min != null || service.price.max != null)
      ? {
          '@type': 'Offer',
          priceCurrency: 'BRL',
          price: service.price.min ?? service.price.max ?? undefined,
        }
      : undefined;

  return {
    '@context': 'https://schema.org/',
    '@type': 'Service',
    name: service.title,
    description: service.description ?? undefined,
    category: service.category ?? undefined,
    areaServed: service.region ?? undefined,
    // Prestador anonimizado por CONSTRUCAO (nunca inclui contato) - o nome e
    // publico (ADR-0010), mas telefone/e-mail nunca entram aqui.
    provider: { '@type': 'Person', name: service.provider.displayName },
    offers,
  };
}

// Separadores de linha U+2028/U+2029 - quebras de linha validas em JS mas nao
// em JSON. Construidos via `fromCharCode` (nao como literal no source) para
// que o arquivo-fonte permaneca ASCII puro e inequivoco.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/**
 * Serializa um objeto JSON-LD para injecao **segura** dentro de um `<script>`
 * (replica `jobs/views/job-detail.view.ts::serializeJsonLd` - evitar acoplar
 * `services` -> `jobs` por um utilitario tao pequeno).
 *
 * `JSON.stringify` por si so nao escapa `<`, `>` ou `&`, entao um campo
 * controlado pelo prestador (titulo/descricao) contendo `</script>` quebraria
 * o bloco e abriria XSS armazenado. Aqui esses caracteres - mais U+2028/U+2029 -
 * viram escapes unicode. O resultado segue sendo JSON valido, mas inerte como HTML.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}
