import { prisma } from '@/shared/lib/prisma';

/**
 * Gate compartilhado (P-006-like, espelha `jobs/server/require-active-responsible.ts`):
 * a Pessoa é responsável **ativo** (vínculo não revogado, não pendente) da Empresa em
 * cujo nome o serviço é/seria publicado? Replicado localmente (não importado de
 * `@/modules/jobs`) para não acoplar `services`→`jobs` (design USP-029 §4).
 *
 * Server-only (ADR-0030 pattern): checado **antes** de qualquer escrita (anti-bypass).
 */
export async function requireActiveResponsible(personId: string, companyId: string): Promise<boolean> {
  const grant = await prisma.personCompanyGrant.findFirst({
    where: {
      personId,
      companyId,
      grantType: 'RESPONSIBLE',
      status: 'ACTIVE',
      revokedAt: null,
    },
    select: { id: true },
  });
  return grant != null;
}
