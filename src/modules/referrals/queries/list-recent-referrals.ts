import { Prisma, type ReferralResult } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';

/** Tamanho máximo do card "encaminhamentos recentes" do painel `/inicio` (PNL-MN-07). */
export const RECENT_REFERRALS_PAGE_SIZE = 5;

/**
 * Linha de encaminhamento recente projetada para o card "encaminhamentos
 * recentes" do painel `/inicio` — feed **org-wide** (não escopado a uma
 * Pessoa), para os blocos COORDINATOR/SOCIAL_ASSISTANT/BOARD (USP-067 —
 * PNL-05/06/07 / A-10). Espelha `PersonReferralRow` (mesmo `select`
 * operacional — sem PII sensível de ficha).
 */
export interface RecentReferralRow {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  referredPersonName: string;
  result: ReferralResult | null;
  createdAt: Date;
}

/**
 * `select` explícito (molde `list-person-referrals.ts`) — carrega só o
 * operacional (título/nome fantasia da vaga/Empresa, nome da Pessoa
 * referida, resultado, data). Nunca carrega PII restrita (cpf/endereço/
 * contato) de nenhuma das partes.
 */
const recentReferralSelect = {
  id: true,
  jobId: true,
  result: true,
  createdAt: true,
  job: { select: { title: true, company: { select: { nomeFantasia: true } } } },
  person: { select: { fullName: true } },
} satisfies Prisma.ReferralSelect;

/**
 * Lista os top-5 encaminhamentos mais recentes de **todo o portal**
 * (`orderBy createdAt desc`, `take 5` — PNL-MN-07), para o card
 * "encaminhamentos recentes" dos blocos institucionais do painel `/inicio`.
 * `result: null` representa "aguardando resultado".
 */
export async function listRecentReferrals(): Promise<RecentReferralRow[]> {
  const rows = await prisma.referral.findMany({
    orderBy: { createdAt: 'desc' },
    take: RECENT_REFERRALS_PAGE_SIZE,
    select: recentReferralSelect,
  });

  return rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    jobTitle: row.job.title,
    companyName: row.job.company.nomeFantasia,
    referredPersonName: row.person.fullName,
    result: row.result,
    createdAt: row.createdAt,
  }));
}
