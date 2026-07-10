import { prisma } from '@/shared/lib/prisma';

/**
 * Os 3 indicadores agregados da home pública (USP-041 / E-001). **Apenas
 * inteiros** — nenhum campo de PII. Esta é a barreira estrutural do
 * REL41-MN-01: o tipo não tem onde carregar nome/identificador de pessoa ou
 * empresa.
 */
export interface HomeIndicators {
  activeJobs: number;
  activeCandidates: number;
  verifiedCompanies: number;
}

/**
 * Lê os 3 contadores agregados da home pública direto do Postgres —
 * `count` puro, sem `select`/`findMany` de linha (TD §4.5, design.md §2):
 *  - `activeJobs`: `Job.status = ACTIVE` (MP4, estado materializado —
 *    ADR-0026, mesmo filtro on-read da busca pública/USP-024).
 *  - `activeCandidates`: `CandidateProfile.publicationStatus = ACTIVE` (MP1).
 *  - `verifiedCompanies`: `Company.isVerified = true` (MP2).
 *
 * `$transaction` dá consistência de snapshot entre os 3 counts (mesma
 * "foto" do banco). Nunca lança em baseline vazio — `count()` retorna `0`.
 */
export async function getHomeIndicators(): Promise<HomeIndicators> {
  const [activeJobs, activeCandidates, verifiedCompanies] = await prisma.$transaction([
    prisma.job.count({ where: { status: 'ACTIVE' } }),
    prisma.candidateProfile.count({ where: { publicationStatus: 'ACTIVE' } }),
    prisma.company.count({ where: { isVerified: true } }),
  ]);

  return { activeJobs, activeCandidates, verifiedCompanies };
}
