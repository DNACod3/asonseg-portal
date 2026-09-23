import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

/** Tamanho máximo do card "candidaturas recentes" do painel `/inicio` (PNL-MN-07). */
export const COMPANY_RECENT_APPLICATIONS_PAGE_SIZE = 5;

/**
 * Linha de candidatura recente projetada **por vaga**, sem identidade do
 * candidato — para o card "candidaturas recentes" do bloco
 * COMPANY_RESPONSIBLE do painel `/inicio` (USP-067 — PNL-04 / A-08).
 */
export interface CompanyRecentApplicationRow {
  jobId: string;
  jobTitle: string;
  appliedAt: Date;
}

/**
 * `select` explícito (PNL-MN-02) — **não** inclui `candidate`/
 * `candidatePersonId` nem qualquer campo de identidade do candidato. Só o
 * necessário para a linha por vaga: título da vaga + data. A identidade do
 * candidato só é acessível na superfície auditada
 * `/empresa/[id]/vagas/[jobId]/candidatos` (`listJobApplicants`).
 */
const companyRecentApplicationSelect = {
  jobId: true,
  appliedAt: true,
  job: { select: { title: true } },
} satisfies Prisma.ApplicationSelect;

/**
 * Lista as top-5 candidaturas **ativas** mais recentes de todas as vagas de
 * uma Empresa, por vaga (sem identidade do candidato — PNL-MN-02), para o
 * card "candidaturas recentes" do painel `/inicio`. `orderBy appliedAt desc`,
 * `take 5` (PNL-MN-07).
 */
export async function listCompanyRecentApplications(
  companyId: string,
): Promise<CompanyRecentApplicationRow[]> {
  const rows = await prisma.application.findMany({
    where: { job: { companyId }, cancelledAt: null },
    orderBy: { appliedAt: 'desc' },
    take: COMPANY_RECENT_APPLICATIONS_PAGE_SIZE,
    select: companyRecentApplicationSelect,
  });

  return rows.map((row) => ({
    jobId: row.jobId,
    jobTitle: row.job.title,
    appliedAt: row.appliedAt,
  }));
}
