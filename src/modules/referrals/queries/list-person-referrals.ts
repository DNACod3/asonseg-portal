import { Prisma, type ReferralResult } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

/** Tamanho de página dos encaminhamentos de uma Pessoa no painel consolidado (L-002). */
export const PERSON_REFERRALS_PAGE_SIZE = 50;

/**
 * Linha de encaminhamento projetada para o painel consolidado da Pessoa
 * (USP-039). `referrerName` é o nome do encaminhador — operacional/público
 * (ADR-0010) — nunca PII restrita (cpf/endereço/contato).
 */
export interface PersonReferralRow {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  referrerName: string;
  justification: string | null;
  result: ReferralResult | null;
  resultObservation: string | null;
  resultRegisteredAt: Date | null;
  createdAt: Date;
}

/**
 * `select` explícito — carrega só o operacional (título/nome fantasia, nome do
 * encaminhador, justificativa/resultado). Nunca carrega PII restrita de
 * terceiros (cpf/endereço/contato do encaminhador ou de outros).
 */
const personReferralSelect = {
  id: true,
  jobId: true,
  justification: true,
  result: true,
  resultObservation: true,
  resultRegisteredAt: true,
  createdAt: true,
  job: { select: { title: true, company: { select: { nomeFantasia: true } } } },
  referrer: { select: { fullName: true } },
} satisfies Prisma.ReferralSelect;

/**
 * Lista os encaminhamentos **recebidos** por uma Pessoa (relação
 * `ReferredPerson`) + resultado de acompanhamento, para a dimensão
 * "encaminhamentos" do painel consolidado (USP-039 / SOC-06). Escopada por
 * `personId` (a Pessoa encaminhada, não o encaminhador).
 *
 * Ordena os mais recentes primeiro (`createdAt` desc). Paginada via `take`
 * (anti-N+1, CLAUDE.md). Primeiro read do módulo `referrals` — cria o dir
 * `queries/`, hoje inexistente.
 *
 * Leitura não-sensível (dados operacionais — título de vaga, nome fantasia de
 * Empresa, nome do encaminhador, justificativa/resultado) — não audita, mesmo
 * padrão de `listPersonApplications`.
 */
export async function listPersonReferrals(personId: string): Promise<PersonReferralRow[]> {
  const rows = await prisma.referral.findMany({
    where: { personId },
    orderBy: { createdAt: 'desc' },
    take: PERSON_REFERRALS_PAGE_SIZE,
    select: personReferralSelect,
  });

  return rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    jobTitle: row.job.title,
    companyName: row.job.company.nomeFantasia,
    referrerName: row.referrer.fullName,
    justification: row.justification,
    result: row.result,
    resultObservation: row.resultObservation,
    resultRegisteredAt: row.resultRegisteredAt,
    createdAt: row.createdAt,
  }));
}
