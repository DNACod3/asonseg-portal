import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

/** Tamanho de página das manifestações de uma Pessoa no painel consolidado (L-002). */
export const PERSON_SERVICE_INTERESTS_PAGE_SIZE = 50;

/**
 * Linha de manifestação de interesse projetada para o painel consolidado da
 * Pessoa (USP-039). `active = cancelledAt === null`. `providerName` é o nome do
 * prestador dono do serviço — operacional/público (ADR-0010).
 */
export interface PersonServiceInterestRow {
  id: string;
  serviceId: string;
  serviceTitle: string;
  providerName: string;
  interestedAt: Date;
  cancelledAt: Date | null;
  active: boolean;
}

/**
 * `select` explícito (molde `list-provider-interests.ts`) — carrega só o
 * operacional (título do serviço, nome do prestador, datas). Nunca carrega PII
 * restrita de terceiros (cpf/endereço/contato do prestador).
 */
const personServiceInterestSelect = {
  id: true,
  serviceId: true,
  interestedAt: true,
  cancelledAt: true,
  service: { select: { title: true, author: { select: { fullName: true } } } },
} satisfies Prisma.ServiceInterestSelect;

/**
 * Lista as manifestações de interesse que uma Pessoa fez **como cliente**
 * (`clientPersonId`), para a dimensão "manifestações" do painel consolidado
 * (USP-039 / SOC-06). Direção inversa de `listProviderInterests`
 * (`service.authorPersonId`).
 *
 * Ordena ativas primeiro, depois mais recentes. Paginada via `take` (anti-N+1,
 * CLAUDE.md). Leitura não-sensível — não audita, mesmo padrão de
 * `listPersonApplications`.
 */
export async function listPersonServiceInterests(
  personId: string,
): Promise<PersonServiceInterestRow[]> {
  const rows = await prisma.serviceInterest.findMany({
    where: { clientPersonId: personId },
    orderBy: [{ cancelledAt: { sort: 'asc', nulls: 'first' } }, { interestedAt: 'desc' }],
    take: PERSON_SERVICE_INTERESTS_PAGE_SIZE,
    select: personServiceInterestSelect,
  });

  return rows.map((row) => ({
    id: row.id,
    serviceId: row.serviceId,
    serviceTitle: row.service.title,
    providerName: row.service.author.fullName,
    interestedAt: row.interestedAt,
    cancelledAt: row.cancelledAt,
    active: row.cancelledAt === null,
  }));
}
