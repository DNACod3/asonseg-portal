import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

/** Tamanho de página das candidaturas de uma Pessoa no painel consolidado (L-002). */
export const PERSON_APPLICATIONS_PAGE_SIZE = 50;

/**
 * Linha de candidatura projetada para o painel consolidado da Pessoa (USP-039).
 * `active = cancelledAt === null` (candidatura ATIVA vs. histórica/cancelada).
 * Nunca inclui PII de terceiros (candidato já é a própria Pessoa consultada).
 */
export interface PersonApplicationRow {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  appliedAt: Date;
  cancelledAt: Date | null;
  active: boolean;
  viaEncaminhamento: boolean;
}

/**
 * `select` explícito (molde `list-job-applicants.ts`) — carrega só o mínimo
 * operacional (título da vaga, nome fantasia da Empresa, datas, flags). Nunca
 * carrega PII de terceiros (o candidato é a própria Pessoa consultada; não há
 * dado de terceiro nesta dimensão).
 */
const personApplicationSelect = {
  id: true,
  jobId: true,
  appliedAt: true,
  cancelledAt: true,
  viaEncaminhamento: true,
  job: { select: { title: true, company: { select: { nomeFantasia: true } } } },
} satisfies Prisma.ApplicationSelect;

/**
 * Lista as candidaturas (ativas e históricas) de uma Pessoa como candidato, para
 * a dimensão "candidaturas" do painel consolidado (USP-039 / SOC-06). Escopada
 * por `candidatePersonId` — direção inversa de `listJobApplicants` (que escopa
 * por `jobId`).
 *
 * Ordena ativas primeiro (`cancelledAt` asc, `null` primeiro), depois mais
 * recentes (`appliedAt` desc). Paginada via `take` (anti-N+1, CLAUDE.md).
 *
 * Leitura não-sensível (dados operacionais/públicos — título de vaga, nome
 * fantasia de Empresa) — não audita, mesmo padrão de `listProviderServices`.
 */
export async function listPersonApplications(personId: string): Promise<PersonApplicationRow[]> {
  const rows = await prisma.application.findMany({
    where: { candidatePersonId: personId },
    orderBy: [{ cancelledAt: 'asc' }, { appliedAt: 'desc' }],
    take: PERSON_APPLICATIONS_PAGE_SIZE,
    select: personApplicationSelect,
  });

  return rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    jobTitle: row.job.title,
    companyName: row.job.company.nomeFantasia,
    appliedAt: row.appliedAt,
    cancelledAt: row.cancelledAt,
    active: row.cancelledAt === null,
    viaEncaminhamento: row.viaEncaminhamento,
  }));
}
