import { prisma } from '@/shared/lib/prisma';
import type { ConsentPurpose } from '../domain/purposes';

/** Linha crua de consentimento usada pelo painel do titular. */
export interface OwnConsentRow {
  id: string;
  purpose: ConsentPurpose;
  termVersion: string;
  acceptedAt: Date;
  revokedAt: Date | null;
}

/**
 * Lista os consentimentos **do próprio titular** (LGP-05). Read-only.
 *
 * Privacidade (P do USP-043): a query é parametrizada pelo `personId` da Pessoa
 * autenticada (a página passa `requireActivePerson().id`); nunca recebe o id de
 * outra Pessoa. O View Model {@link buildOwnConsentsView} consome só estas linhas.
 */
export async function listOwnConsents(personId: string): Promise<OwnConsentRow[]> {
  return prisma.consent.findMany({
    where: { personId },
    orderBy: { acceptedAt: 'desc' },
    take: 200,
    select: { id: true, purpose: true, termVersion: true, acceptedAt: true, revokedAt: true },
  });
}
