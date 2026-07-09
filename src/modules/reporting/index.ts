// Barrel do módulo `reporting`.
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Relatório de acesso (LGPD art. 19 — direito de acesso) ───────────────────
export { issueAccessReport, ACCESS_REPORT_ROLES } from './actions/access-report';
export type { AccessReportResult } from './actions/access-report';

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
