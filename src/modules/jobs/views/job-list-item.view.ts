import { Prisma } from '@prisma/client';
import type { CurrentPerson } from '@/modules/identity';

/**
 * View Model da vaga na **lista pública** (USP-021 / ADR-0017 / ADR-0022).
 *
 * Por que um View Model e não Prisma direto: a busca pública devolve dados de uma
 * Empresa a um visitante. Para o **visitante anônimo**, o nome real da Empresa é
 * dado restrito (ADR-0017): a anonimização acontece AQUI, no serializer (P-001/E-004),
 * nunca no template — assim nenhum campo estruturado (`company.name`) escapa, em
 * HTML, JSON, SEO ou OG. Para o autenticado, o nome real aparece (E-005).
 */

/** Faixa salarial projetada (null quando `salaryVisible=false` — edge do issue). */
export interface JobListItemSalary {
  min: number | null;
  max: number | null;
}

export interface JobListItem {
  id: string;
  title: string;
  area: string | null;
  region: string | null;
  educationLevel: string | null;
  contractType: string | null;
  workRegime: string | null;
  salary: JobListItemSalary | null;
  publishedAt: Date | null;
  company: {
    /** Anônimo → "Empresa do setor de X"; autenticado → nome fantasia real. */
    displayName: string;
    isAnonymized: boolean;
  };
}

/** Shape mínimo que o serializer consome (a query faz `select` explícito disto). */
export interface JobListRow {
  id: string;
  title: string;
  educationLevelRequired: string | null;
  contractType: string | null;
  workRegime: string | null;
  salaryMin: Prisma.Decimal | null;
  salaryMax: Prisma.Decimal | null;
  salaryVisible: boolean;
  publishedAt: Date | null;
  area: { name: string } | null;
  region: { name: string } | null;
  company: { nomeFantasia: string; setor: string };
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value == null ? null : value.toNumber();
}

/**
 * Projeta uma linha de vaga para o item de lista, aplicando a anonimização por papel.
 *
 * - `viewer === null` (anônimo): `displayName = "Empresa do setor de " + setor`,
 *   `isAnonymized = true`. O nome real **nunca** sai — em nenhum campo (E-004/P-001/P-004).
 * - `viewer` autenticado: `displayName = company.nomeFantasia`, `isAnonymized = false` (E-005).
 * - `salaryVisible === false`: `salary = null` para ambos os papéis (edge).
 */
export function viewJobForVisitor(row: JobListRow, viewer: CurrentPerson | null): JobListItem {
  const isAnonymized = viewer === null;
  return {
    id: row.id,
    title: row.title,
    area: row.area?.name ?? null,
    region: row.region?.name ?? null,
    educationLevel: row.educationLevelRequired,
    contractType: row.contractType,
    workRegime: row.workRegime,
    salary: row.salaryVisible
      ? { min: decimalToNumber(row.salaryMin), max: decimalToNumber(row.salaryMax) }
      : null,
    publishedAt: row.publishedAt,
    company: {
      displayName: isAnonymized ? `Empresa do setor de ${row.company.setor}` : row.company.nomeFantasia,
      isAnonymized,
    },
  };
}
