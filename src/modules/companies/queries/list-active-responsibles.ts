import { prisma } from '@/shared/lib/prisma';

/**
 * Responsável ATIVO de uma Empresa, visível aos co-responsáveis. Expõe só o nome
 * (visível entre responsáveis da mesma Empresa) + o `grantId` para a remoção e a
 * flag `isSelf` (o vínculo do próprio ator) — sem outra PII.
 */
export interface ActiveResponsible {
  grantId: string;
  nome: string;
  /** `true` quando este vínculo é o do próprio ator (remover = auto-remoção). */
  isSelf: boolean;
}

/**
 * Lista os responsáveis ATIVOS (status=ACTIVE, não-revogados) de uma Empresa,
 * marcando o vínculo do próprio ator (`selfPersonId`). O gate de permissão é da
 * página/Server Action (esta query assume um responsável ativo já autorizado).
 */
export async function listActiveResponsibles(
  empresaId: string,
  selfPersonId: string,
): Promise<ActiveResponsible[]> {
  const grants = await prisma.personCompanyGrant.findMany({
    where: {
      companyId: empresaId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    orderBy: { grantedAt: 'asc' },
    take: 100, // paginação defensiva (convenção Prisma)
    select: {
      id: true,
      personId: true,
      person: { select: { fullName: true } },
    },
  });

  return grants.map((g) => ({
    grantId: g.id,
    nome: g.person.fullName,
    isSelf: g.personId === selfPersonId,
  }));
}
