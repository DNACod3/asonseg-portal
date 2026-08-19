import type { ContentStatus } from '@/modules/moderation';

/** Campos mínimos consumidos de `PersonApplicationRow` — evita acoplar ao módulo `jobs/queries`. */
export interface CandidateApplicationKpiRow {
  active: boolean;
  jobStatus: ContentStatus;
}

export interface CandidateApplicationKpis {
  /** Total de candidaturas ativas (não canceladas). */
  totalActive: number;
  /** Ativas cuja vaga ainda está `ACTIVE` (A-01 — "em análise", sem coluna de triagem). */
  underReview: number;
}

/**
 * Deriva os KPIs "minhas candidaturas" e "em análise" do bloco CANDIDATE do
 * painel `/inicio` (USP-067 — PNL-01 / A-01), a partir das linhas já
 * carregadas de `listPersonApplications`. Puro, sem IO.
 */
export function deriveCandidateApplicationKpis(
  rows: readonly CandidateApplicationKpiRow[],
): CandidateApplicationKpis {
  const activeRows = rows.filter((row) => row.active);
  const underReview = activeRows.filter((row) => row.jobStatus === 'ACTIVE').length;
  return { totalActive: activeRows.length, underReview };
}
