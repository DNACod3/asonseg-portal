import { Prisma, type CompanyGrantType, type CompanyGrantStatus } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

/** Tamanho de página dos vínculos de uma Pessoa no painel consolidado (L-002). */
export const PERSON_COMPANY_GRANTS_PAGE_SIZE = 50;

/**
 * Linha de vínculo organizacional projetada para o painel consolidado da
 * Pessoa (USP-039). Só vínculos **vivos** (`revokedAt: null` — ACTIVE/PENDING).
 */
export interface PersonCompanyGrantRow {
  grantId: string;
  companyId: string;
  companyName: string;
  grantType: CompanyGrantType;
  status: CompanyGrantStatus;
  grantedAt: Date;
  acceptedAt: Date | null;
}

/**
 * `select` explícito (molde `list-active-responsibles.ts`) — carrega só o
 * operacional (nome fantasia da Empresa, tipo/status/datas do vínculo). Nunca
 * carrega PII de terceiros.
 */
const personCompanyGrantSelect = {
  id: true,
  companyId: true,
  grantType: true,
  status: true,
  grantedAt: true,
  acceptedAt: true,
  company: { select: { nomeFantasia: true } },
} satisfies Prisma.PersonCompanyGrantSelect;

/**
 * Lista os papéis organizacionais **vivos** de uma Pessoa (vínculos
 * Pessoa↔Empresa, `revokedAt: null` — ACTIVE ou PENDING), para a dimensão
 * "papéis organizacionais" do painel consolidado (USP-039 / SOC-06). Direção
 * inversa de `listActiveResponsibles` (que escopa por `companyId`).
 *
 * Ordena os mais recentes primeiro (`grantedAt` desc). Paginada via `take`
 * (anti-N+1, CLAUDE.md). Leitura não-sensível — não audita.
 */
export async function listPersonCompanyGrants(
  personId: string,
): Promise<PersonCompanyGrantRow[]> {
  const rows = await prisma.personCompanyGrant.findMany({
    where: { personId, revokedAt: null },
    orderBy: { grantedAt: 'desc' },
    take: PERSON_COMPANY_GRANTS_PAGE_SIZE,
    select: personCompanyGrantSelect,
  });

  return rows.map((row) => ({
    grantId: row.id,
    companyId: row.companyId,
    companyName: row.company.nomeFantasia,
    grantType: row.grantType,
    status: row.status,
    grantedAt: row.grantedAt,
    acceptedAt: row.acceptedAt,
  }));
}
