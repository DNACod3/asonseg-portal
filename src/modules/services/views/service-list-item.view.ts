import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { buildServicePhotoUrl } from '../domain/photo-url';
import { decimalToNumber, providerDisplayName } from './provider-display';

/**
 * View Model do serviço na **lista pública** (USP-030 / AC-030-1..3).
 *
 * Diferença chave vs `viewJobForVisitor`: em vagas o nome da Empresa é oculto
 * para o anônimo; em **serviços o nome é público para todos** (ADR-0010) — a
 * barreira U2 é só o **contato** (telefone/e-mail), que este View Model nem
 * carrega (SVC030-MN-02). `viewer` é aceito por paridade de assinatura com
 * `viewJobForVisitor`, mas não influencia a projeção aqui.
 */

export interface ServiceListItemPrice {
  min: number | null;
  max: number | null;
  unit: string | null;
}

export interface ServiceListItem {
  id: string;
  title: string;
  categoryName: string | null;
  regionName: string | null;
  price: ServiceListItemPrice | null;
  providerDisplayName: string;
  coverPhotoUrl: string | null;
  publishedAt: Date | null;
}

/** Shape mínimo que o serializer consome — a query faz `select` explícito disto.
 *  NUNCA inclui `phone`/`emailLogin` do autor (SVC030-MN-02, defesa RSC/Flight). */
export interface ServiceListRow {
  id: string;
  title: string;
  priceMin: Prisma.Decimal | null;
  priceMax: Prisma.Decimal | null;
  priceUnit: string | null;
  publishedAt: Date | null;
  category: { name: string } | null;
  region: { name: string } | null;
  author: { fullName: string };
  company: { nomeFantasia: string } | null;
  photos: { storagePath: string }[];
}

export function viewServiceForVisitor(row: ServiceListRow, _viewer: CurrentPerson | null): ServiceListItem {
  const hasPrice = row.priceMin != null || row.priceMax != null || row.priceUnit != null;
  return {
    id: row.id,
    title: row.title,
    categoryName: row.category?.name ?? null,
    regionName: row.region?.name ?? null,
    price: hasPrice
      ? { min: decimalToNumber(row.priceMin), max: decimalToNumber(row.priceMax), unit: row.priceUnit }
      : null,
    providerDisplayName: providerDisplayName(row),
    coverPhotoUrl: row.photos[0] ? buildServicePhotoUrl(row.photos[0].storagePath) : null,
    publishedAt: row.publishedAt,
  };
}
