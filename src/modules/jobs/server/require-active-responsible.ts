import { prisma } from '@/shared/lib/prisma';

/**
 * Gate compartilhado de autorização (P-005/D-005 — USP-023/T2): a Pessoa é
 * responsável **ativo** (vínculo não revogado, não pendente) da Empresa dona da
 * vaga? Extraído de `submit-job-for-moderation.ts` (USP-020/P-006) para ser
 * reusado por todas as actions de ciclo de vida de vaga (editar, pausar,
 * despausar, arquivar, prorrogar) — um único ponto testável, checado **antes**
 * de qualquer escrita (anti-bypass de autorização).
 *
 * Server-only (ADR-0030 pattern): não é o `requirePermission()` RBAC da
 * sequência canônica de Server Action sensível — é o gate de vínculo
 * Pessoa-Empresa específico do domínio `jobs`.
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
