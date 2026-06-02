// Barrel do módulo `reporting`.
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Relatório de acesso (LGPD art. 19 — direito de acesso) ───────────────────
export { issueAccessReport, ACCESS_REPORT_ROLES } from './actions/access-report';
export type {
  AccessReportResult,
  AccessReportProfile,
  AccessReportRoleGrant,
  AccessReportConsent,
} from './actions/access-report';

export { accessReportSchema } from './schemas/access-report';
export type { AccessReportInput } from './schemas/access-report';
