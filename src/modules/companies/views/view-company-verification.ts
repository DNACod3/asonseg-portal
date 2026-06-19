import { prisma } from '@/shared/lib/prisma';
import { viewStaffPersonNames } from '@/modules/persons';
import {
  diffVerificationSnapshot,
  type CompanyVerificationSnapshot,
  type SnapshotField,
} from '../domain/company-verification';

/**
 * Contexto de verificação de uma Empresa exposto ao moderador (USP-017 / E-001,
 * E-004, D-006). View Model: só o necessário para o painel — dados identitários
 * **vigentes**, estado da verificação e os campos alterados desde a verificação
 * anterior. Nunca expõe o snapshot bruto à UI.
 */
export interface CompanyVerificationContext {
  companyId: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  setor: string;
  endereco: string | null;
  isVerified: boolean;
  /** E-004 — preenchidos quando já verificada. */
  verifiedAt: Date | null;
  verifiedByName: string | null;
  /** P-003 — agregado de rejeições enquanto não verificada (badge). */
  rejectionCount: number;
  /**
   * D-006 — campos identitários/de contato alterados **desde a verificação
   * anterior** (snapshot). Vazio na 1ª verificação ou quando nada mudou. Usado
   * pelo painel para destacar o que reverificar após edição (USP-015).
   */
  changedSinceVerification: SnapshotField[];
}

/** Converte o `verifiedSnapshot` (Json) para o tipo do domínio, ou `null`. */
function parseSnapshot(raw: unknown): CompanyVerificationSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.cnpj !== 'string' || typeof s.razaoSocial !== 'string') return null;
  return s as unknown as CompanyVerificationSnapshot;
}

/**
 * Carrega o contexto de verificação de várias Empresas numa única consulta
 * (evita N+1 na fila). Retorna um `Map companyId → contexto`; ids não encontrados
 * ficam de fora.
 */
export async function viewCompanyVerificationContexts(
  companyIds: readonly string[],
): Promise<Map<string, CompanyVerificationContext>> {
  const unique = [...new Set(companyIds)];
  if (unique.length === 0) return new Map();

  const companies = await prisma.company.findMany({
    where: { id: { in: unique } },
    // Paginação obrigatória (project-guideline §13): a busca já é limitada pela
    // lista de ids únicos, então `take` apenas formaliza o teto.
    take: unique.length,
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nomeFantasia: true,
      setor: true,
      endereco: true,
      isVerified: true,
      verifiedAt: true,
      verifiedByPersonId: true,
      verifiedSnapshot: true,
      rejectionCount: true,
    },
  });

  // Nome de quem verificou via View Model de staff (ADR-0010) — sem ler Person direto.
  const verifierIds = companies
    .map((c) => c.verifiedByPersonId)
    .filter((id): id is string => Boolean(id));
  const nameById = await viewStaffPersonNames(verifierIds);

  const result = new Map<string, CompanyVerificationContext>();
  for (const c of companies) {
    const snapshot = parseSnapshot(c.verifiedSnapshot);
    result.set(c.id, {
      companyId: c.id,
      cnpj: c.cnpj,
      razaoSocial: c.razaoSocial,
      nomeFantasia: c.nomeFantasia,
      setor: c.setor,
      endereco: c.endereco,
      isVerified: c.isVerified,
      verifiedAt: c.verifiedAt,
      verifiedByName: c.verifiedByPersonId ? (nameById.get(c.verifiedByPersonId) ?? null) : null,
      rejectionCount: c.rejectionCount,
      changedSinceVerification: diffVerificationSnapshot(snapshot, c),
    });
  }
  return result;
}
