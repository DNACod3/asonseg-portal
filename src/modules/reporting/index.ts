// Barrel do módulo `reporting`.
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Relatório de acesso (LGPD art. 19 — direito de acesso) ───────────────────
export { issueAccessReport } from './actions/access-report';
export type { AccessReportResult } from './actions/access-report';
// `ACCESS_REPORT_ROLES` vive fora do arquivo `'use server'` (ver domain/
// access-report-roles.ts) — obrigatório para o build do Next quando QUALQUER
// rota importa este barrel (USP-041/T5).
export { ACCESS_REPORT_ROLES } from './domain/access-report-roles';

// View Model (ADR-0010): leitura/projeção cross-Pessoa encapsulada.
export { viewPersonForAccessReport } from './views/access-report.view';
export type {
  AccessReportData,
  AccessReportProfile,
  AccessReportRoleGrant,
  AccessReportConsent,
} from './views/access-report.view';

export { accessReportSchema } from './schemas/access-report';
export type { AccessReportInput } from './schemas/access-report';

// ── Indicadores da home pública (USP-041) ─────────────────────────────────
// Fundação da camada `domain`/`queries` compartilhada com USP-042.
export { applyMinimumDisplay, MINIMUM_DISPLAY_THRESHOLD } from './domain/indicators';
export type { IndicatorDisplay } from './domain/indicators';

export { MP } from './domain/metrics';
export type { MetricDescriptor, MetricId, MetricUnit } from './domain/metrics';

export { getHomeIndicators } from './queries/home-indicators';
export type { HomeIndicators } from './queries/home-indicators';

export { HomeIndicators as HomeIndicatorsView } from './components/home-indicators';
export type { HomeIndicatorsProps } from './components/home-indicators';

export { revalidateHomeIndicators } from './server/revalidate-home';

// ── Relatórios operacionais (USP-042) ─────────────────────────────────────
export {
  canViewOperationalReports,
  canViewSocialReports,
  canViewModerationQueueReport,
  OPERATIONAL_REPORT_ROLES,
  SOCIAL_REPORT_ROLES,
} from './domain/report-access';

export { resolveReportWindow } from './domain/report-window';
export type { ReportWindow, ReportWindowInput } from './domain/report-window';

export { reportFiltersSchema } from './schemas/report-filters';
export type { ReportFiltersInput } from './schemas/report-filters';

export { referralOutcomeRates } from './domain/referral-outcomes';
export type { ReferralResultCounts, ReferralOutcomeRates } from './domain/referral-outcomes';

export { moderationAvgHours } from './domain/moderation-time';
export type { ModerationPair } from './domain/moderation-time';

export { toCsv, composeWatermark, WATERMARK_PII } from './domain/csv';
export type { CsvColumn, ToCsvOptions } from './domain/csv';

export { reportJobs } from './queries/report-jobs';
export type { JobReportFilters, JobReportRow } from './queries/report-jobs';

export { reportApplications } from './queries/report-applications';
export type { ApplicationReportFilters, ApplicationReportRow } from './queries/report-applications';

export { reportServices } from './queries/report-services';
export type { ServiceReportFilters, ServiceReportRow, ServiceReport } from './queries/report-services';

export { reportReferrals } from './queries/report-referrals';
export type { ReferralReportFilters, ReferralReport } from './queries/report-referrals';

export { reportModerationQueue } from './queries/report-moderation-queue';
export type {
  ModerationQueueReportFilters,
  ModerationQueueReport,
  ModerationQueueCounts,
} from './queries/report-moderation-queue';

export { viewSocialReport } from './views/social-report.view';
export type {
  SocialReportFilters,
  SocialReportViewer,
  SocialReport,
  SocialReportRegionRow,
  SocialReportSensitiveBreakdown,
} from './views/social-report.view';
