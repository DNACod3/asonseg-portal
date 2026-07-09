/**
 * Calculadora pura de MP9 (E-004 / REL42-MN-04) — taxa de sucesso de
 * encaminhamento ("contratado" / `HIRED`) **sempre** ao lado da taxa de "sem
 * resultado registrado". Sem IO: recebe contagens já agregadas (`groupBy`)
 * pela query (`report-referrals.ts`).
 */

/** Contagens por `ReferralResult` (Prisma) + os sem resultado (`result = null`). */
export interface ReferralResultCounts {
  HIRED: number;
  NOT_SELECTED: number;
  UNDER_REVIEW: number;
  NO_RESPONSE: number;
  /** Encaminhamentos ainda sem resultado registrado (`result = null`). */
  withoutResult: number;
}

export interface ReferralOutcomeRates {
  /** Total de encaminhamentos na janela (com + sem resultado). */
  total: number;
  /** Encaminhamentos com QUALQUER resultado registrado. */
  withResult: number;
  /** Encaminhamentos sem resultado registrado ainda. */
  withoutResult: number;
  /** MP9 — `HIRED / withResult`. `null` quando `withResult = 0` ("—" na UI). */
  successRate: number | null;
  /**
   * Taxa de "sem resultado registrado" (E-004/REL42-MN-04) — SEMPRE presente
   * ao lado de `successRate`, nunca omitida/zerada silenciosamente. `null`
   * apenas quando `total = 0` ("—").
   */
  noResultRate: number | null;
}

/**
 * Deriva `{ total, withResult, withoutResult, successRate, noResultRate }` a
 * partir das contagens agregadas. `total = 0` (nenhum encaminhamento na
 * janela) ⇒ ambas as taxas `null` (a UI mostra "—", não `0%` — evitaria
 * sugerir 0% de sucesso quando não há dado nenhum).
 */
export function referralOutcomeRates(counts: ReferralResultCounts): ReferralOutcomeRates {
  const withResult = counts.HIRED + counts.NOT_SELECTED + counts.UNDER_REVIEW + counts.NO_RESPONSE;
  const withoutResult = counts.withoutResult;
  const total = withResult + withoutResult;

  if (total === 0) {
    return { total: 0, withResult: 0, withoutResult: 0, successRate: null, noResultRate: null };
  }

  const successRate = withResult === 0 ? null : counts.HIRED / withResult;
  const noResultRate = withoutResult / total;

  return { total, withResult, withoutResult, successRate, noResultRate };
}
