import { prisma } from '@/shared/lib/prisma';
import { formatSaoPaulo } from '@/shared/lib/time';

/**
 * Convite de vínculo de responsável pendente da própria Pessoa (USP-013).
 * Só o estritamente necessário para a Pessoa reconhecer e aceitar o convite —
 * nome fantasia da Empresa + data de envio (sem PII de terceiros / P-001).
 */
export interface PendingResponsibleLink {
  empresaId: string;
  empresaNome: string;
  pendingAtLabel: string;
}

/**
 * Lista os convites de vínculo PENDENTES da própria Pessoa (a consulta por
 * `personId` garante que cada Pessoa só enxerga os seus convites). Mais recentes
 * primeiro. O aceite em si é feito pela Server Action `aceitarVinculoResponsavel`,
 * que reconfirma a pré-condição (defesa em profundidade / P-005).
 */
export async function listPendingResponsibleLinks(
  personId: string,
): Promise<PendingResponsibleLink[]> {
  const grants = await prisma.personCompanyGrant.findMany({
    where: {
      personId,
      grantType: 'RESPONSIBLE',
      status: 'PENDING',
      revokedAt: null,
    },
    orderBy: { pendingAt: 'desc' },
    take: 100, // paginação defensiva (convenção Prisma)
    select: {
      companyId: true,
      pendingAt: true,
      company: { select: { id: true, nomeFantasia: true } },
    },
  });

  return grants.map((g) => ({
    empresaId: g.companyId,
    empresaNome: g.company.nomeFantasia,
    // `pendingAt` é nullable no schema; convites da USP-013 sempre o preenchem.
    pendingAtLabel: g.pendingAt
      ? formatSaoPaulo(g.pendingAt, "dd/MM/yyyy 'às' HH:mm")
      : '—',
  }));
}
