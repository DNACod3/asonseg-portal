import { prisma } from '@/shared/lib/prisma';
import type {
  CompanyResponsibilityPort,
  OrphanedCompanyRef,
} from '@/modules/persons';

/**
 * Implementação real do {@link CompanyResponsibilityPort} usando Prisma (USP-012).
 *
 * Retorna as Empresas em que a Pessoa é o **único** responsável ativo —
 * remover esse grant deixaria a Empresa sem nenhum RESPONSIBLE não-revogado.
 * Usado pela inativação de Pessoa (USP-007 / AC-007-3) para bloquear o fluxo.
 */
export class PrismaCompanyResponsibilityAdapter implements CompanyResponsibilityPort {
  async companiesLeftWithoutResponsible(personId: string): Promise<OrphanedCompanyRef[]> {
    // USP-013: vínculos PENDING (aguardando aceite) NÃO contam para a invariante
    // "≥1 responsável ativo" — apenas status=ACTIVE e não-revogados.
    const grants = await prisma.personCompanyGrant.findMany({
      where: { personId, grantType: 'RESPONSIBLE', status: 'ACTIVE', revokedAt: null },
      select: { companyId: true },
      take: 200,
    });

    if (grants.length === 0) return [];

    const companyIds = grants.map((g) => g.companyId);

    // Conta responsáveis ativos por Empresa (inclui a própria Pessoa).
    const counts = await prisma.personCompanyGrant.groupBy({
      by: ['companyId'],
      where: {
        companyId: { in: companyIds },
        grantType: 'RESPONSIBLE',
        status: 'ACTIVE',
        revokedAt: null,
      },
      _count: { id: true },
    });

    // Empresas com exatamente 1 responsável ativo ficariam órfãs.
    const orphanedIds = counts
      .filter((c) => c._count.id === 1)
      .map((c) => c.companyId);

    if (orphanedIds.length === 0) return [];

    const companies = await prisma.company.findMany({
      where: { id: { in: orphanedIds } },
      select: { id: true, razaoSocial: true },
      take: orphanedIds.length,
    });

    return companies.map((c) => ({ id: c.id, name: c.razaoSocial }));
  }
}
