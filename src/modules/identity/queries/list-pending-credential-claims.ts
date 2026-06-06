import { prisma } from '@/shared/lib/prisma';
import type { CredentialVerificationMethod } from '../schemas/credential-claim.schema';

/**
 * Linha da fila de verificação de reivindicações de credencial (USP-003 / D-004).
 * Campos mínimos para o aprovador identificar a solicitação — sem dados sensíveis
 * da ficha social (ADR-0017). A verificação de identidade em si acontece pelo
 * canal seguro definido (D-011), fora da tela.
 */
export interface PendingCredentialClaimRow {
  id: string;
  personId: string;
  fullName: string;
  requestedEmail: string;
  verificationMethod: CredentialVerificationMethod;
  requestedAt: Date;
}

/**
 * Lista as reivindicações PENDENTES, mais antigas primeiro (a fila não pode
 * envelhecer em silêncio — P-003 / SLA ≤ 7 dias). Visível apenas para
 * aprovadores; a rota `(app)` faz o gate de permissão (L-004).
 */
export async function listPendingCredentialClaims(): Promise<PendingCredentialClaimRow[]> {
  const claims = await prisma.credentialClaim.findMany({
    where: { status: 'PENDING' },
    orderBy: { requestedAt: 'asc' },
    take: 100, // paginação defensiva (convenção Prisma)
    select: {
      id: true,
      personId: true,
      requestedEmail: true,
      verificationMethod: true,
      requestedAt: true,
      person: { select: { fullName: true } },
    },
  });

  return claims.map((c) => ({
    id: c.id,
    personId: c.personId,
    fullName: c.person.fullName,
    requestedEmail: c.requestedEmail,
    verificationMethod: c.verificationMethod as CredentialVerificationMethod,
    requestedAt: c.requestedAt,
  }));
}
