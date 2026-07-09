import { prisma } from '@/shared/lib/prisma';
import { resolveReportWindow, type ReportWindowInput } from '../domain/report-window';
import { referralOutcomeRates, type ReferralOutcomeRates, type ReferralResultCounts } from '../domain/referral-outcomes';

/** R4 — relatório de encaminhamentos (MP8/MP9), por período. */
export type ReferralReportFilters = ReportWindowInput;

export interface ReferralReport {
  /** MP8 — total de encaminhamentos criados na janela. */
  totalCreated: number;
  /**
   * MP9 + REL42-MN-04 — `successRate` NUNCA aparece sem `noResultRate`
   * (calculadora pura T3): o tipo carrega ambos, sempre.
   */
  outcome: ReferralOutcomeRates;
}

const EMPTY_COUNTS: ReferralResultCounts = {
  HIRED: 0,
  NOT_SELECTED: 0,
  UNDER_REVIEW: 0,
  NO_RESPONSE: 0,
  withoutResult: 0,
};

/**
 * MP8 via `count` + MP9 via `groupBy(by:['result'])` → `referralOutcomeRates`
 * (T3). `result = null` (sem resultado ainda) é um bucket próprio do
 * `groupBy` — mapeado para `withoutResult`. Janela vazia/invertida (T2) ⇒
 * `totalCreated: 0` e `outcome` com taxas `null` ("—"), nunca erro.
 */
export async function reportReferrals(filters: ReferralReportFilters): Promise<ReferralReport> {
  const window = resolveReportWindow(filters);
  const dateRange = { gte: window.gte ?? undefined, lt: window.lt ?? undefined };

  const [totalCreated, grouped] = await Promise.all([
    prisma.referral.count({ where: { createdAt: dateRange } }),
    prisma.referral.groupBy({
      by: ['result'],
      where: { createdAt: dateRange },
      _count: { _all: true },
    }),
  ]);

  const counts: ReferralResultCounts = { ...EMPTY_COUNTS };
  for (const group of grouped) {
    if (group.result === null) {
      counts.withoutResult = group._count._all;
    } else {
      counts[group.result] = group._count._all;
    }
  }

  return { totalCreated, outcome: referralOutcomeRates(counts) };
}
