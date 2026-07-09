import { cache } from 'react';
import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';
import { prisma } from '@/shared/lib/prisma';
import type { ServiceDetailRow } from '../views/service-detail.view';

/**
 * `select` explícito (P-004 — least privilege), espelhando `search-services.ts`.
 * **NUNCA** seleciona `phone`/`emailLogin` do autor (SVC031-MN-01) — o campo
 * nem é carregado, defesa contra vazamento no payload RSC/Flight. O nome do
 * prestador/Empresa é público a todos (ADR-0010) — por isso, ao contrário de
 * `jobDetailSelect`, `nomeFantasia`/`fullName` são sempre carregados (não
 * condicionais ao viewer).
 */
const serviceDetailSelect = {
  id: true,
  title: true,
  description: true,
  priceMin: true,
  priceMax: true,
  priceUnit: true,
  availabilityDescription: true,
  publishedAt: true,
  category: { select: { name: true } },
  region: { select: { name: true } },
  photos: { select: { storagePath: true, position: true }, orderBy: { position: 'asc' as const } },
  author: { select: { fullName: true } },
  company: { select: { nomeFantasia: true } },
} satisfies Prisma.ServiceSelect;

/**
 * Detalhe de um serviço **detalhável** (USP-031). Read-only, sem Server Action
 * (leitura pública). Espelha exatamente o `where` on-read de `searchServices`:
 * um serviço só é detalhável se passaria na busca pública.
 *
 * - On-read obrigatório (AC-031-1/SVC031-MN-02): `status='ACTIVE'` **AND**
 *   prestador ativo (`author.inactivatedAt IS NULL`).
 * - **Retorna `null`** quando o serviço não casa o on-read → a página renderiza
 *   o estado "indisponível", nunca um 404 técnico.
 * - Memoizada por (id, autenticado) com React `cache()`: num mesmo request, o
 *   `generateMetadata` (sempre anônimo) e o componente da página compartilham a
 *   leitura quando o viewer é anônimo (caso comum) → 1 ida ao banco, não 2.
 *   Para o autenticado a chave diverge — mas o `select` é idêntico (nome
 *   público a todos, SEM condicional), então a memoização por `authenticated`
 *   é só paridade de assinatura com `getActiveJobDetail`, não uma otimização
 *   de privacidade aqui.
 */
const getActiveServiceDetailCached = cache(
  async (id: string, _authenticated: boolean): Promise<ServiceDetailRow | null> => {
    return prisma.service.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        author: { inactivatedAt: null },
      },
      select: serviceDetailSelect,
    });
  },
);

export function getActiveServiceDetail(
  id: string,
  viewer: CurrentPerson | null,
): Promise<ServiceDetailRow | null> {
  return getActiveServiceDetailCached(id, viewer !== null);
}
