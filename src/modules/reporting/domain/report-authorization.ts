import type { CurrentPerson, DelegatedGrant } from '@/modules/identity';
import { canViewModerationQueueReport, canViewOperationalReports, canViewSocialReports } from './report-access';
import type { ReportType } from '../schemas/export-report';

/**
 * Resolve o guard (T1) aplicável a cada `reportType` — compartilhado entre a
 * Server Action `exportReport` (T11) e a rota `(app)/relatorios/[tipo]`
 * (T12), para as duas superfícies nunca divergirem sobre quem pode ver o
 * quê (REL42-MN-02/03).
 */
export function isReportTypeAuthorized(
  reportType: ReportType,
  person: CurrentPerson,
  moderationGrants: readonly DelegatedGrant[],
): boolean {
  switch (reportType) {
    case 'jobs':
    case 'applications':
    case 'services':
    case 'referrals':
      return canViewOperationalReports(person.roles);
    case 'moderation_queue':
      return canViewModerationQueueReport(person, moderationGrants);
    case 'social':
      return canViewSocialReports(person.roles) || canViewOperationalReports(person.roles);
  }
}
