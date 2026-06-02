import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import type { ConsentPurpose } from './purposes';
import { isCurrentTermVersion } from './terms-registry';

/**
 * Guarda de consentimento on-read (LGP-03 / ADR-0025). Decide se uma Pessoa tem
 * consentimento **ativo** para uma finalidade, no momento da operação.
 *
 * Ativo ⇔ existe um registro de consentimento da finalidade **não revogado**
 * (`revokedAt` nulo) **na versão vigente** do termo. Versão antiga (mudança
 * major sem re-aceite — E-005) ou registro revogado ⇒ não ativo.
 *
 * Contrato (issue #37): **nunca lança**. Retorna `{ active }` para o chamador
 * compor `{ ok:false, error: { code:'CONSENT_REQUIRED' } }`. Chamada na sequência
 * canônica **após** `requirePermission()` e **antes** das pré-condições de negócio.
 *
 * Aceita um cliente Prisma transacional (`tx`) ou o singleton — assim a mesma
 * checagem roda dentro da transação auditada de quem consome a finalidade.
 */

type ConsentClient = PrismaClient | Prisma.TransactionClient;

/** Motivo de um consentimento não estar ativo. */
export type ConsentCheckReason = 'ABSENT' | 'OUTDATED' | 'REVOKED';

/** Resultado da checagem de consentimento ativo. */
export type ConsentCheck =
  | { readonly active: true; readonly consentId: string }
  | { readonly active: false; readonly reason: ConsentCheckReason; readonly consentId?: string };

export async function requireActiveConsent(
  personId: string,
  purpose: ConsentPurpose,
  client: ConsentClient = prisma,
): Promise<ConsentCheck> {
  // Registro vigente (não revogado) mais recente da finalidade.
  const activeRow = await client.consent.findFirst({
    where: { personId, purpose, revokedAt: null },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true, termVersion: true },
  });

  if (activeRow) {
    if (isCurrentTermVersion(purpose, activeRow.termVersion)) {
      return { active: true, consentId: activeRow.id };
    }
    // Aceite válido porém em versão antiga: exige re-aceite (mudança major — E-005).
    return { active: false, reason: 'OUTDATED', consentId: activeRow.id };
  }

  // Sem registro vigente: distinguir "nunca consentiu" de "revogado" (UX do painel).
  const anyRow = await client.consent.findFirst({
    where: { personId, purpose },
    select: { id: true },
  });
  return anyRow ? { active: false, reason: 'REVOKED' } : { active: false, reason: 'ABSENT' };
}
