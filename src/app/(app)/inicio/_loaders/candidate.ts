import {
  searchJobs,
  listPersonApplications,
  deriveCandidateApplicationKpis,
  type JobListItem,
} from '@/modules/jobs';
import { getHomeIndicators } from '@/modules/reporting';
import {
  getCandidateProfileStatus,
  getCandidatePrimaryArea,
  CANDIDATE_STATUS_LABELS,
} from '@/modules/persons';
import type { CurrentPerson } from '@/modules/identity';
import { childLogger } from '@/shared/lib/logger';
import type { KpiItem } from '../_components/kpi-strip';
import type { QuickAction } from '../_components/quick-actions';

const log = childLogger({ module: 'inicio', loader: 'candidate' });

export interface CandidateMatchingJobRow {
  id: string;
  title: string;
  companyName: string;
}

export interface CandidateApplicationRow {
  /** Id da Application — para `CancelApplicationButton` (só quando `active`). */
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  appliedAt: Date;
  active: boolean;
}

export interface CandidatePanelData {
  kpis: KpiItem[];
  quickActions: QuickAction[];
  matchingJobs: CandidateMatchingJobRow[];
  matchingJobsTotal: number;
  applications: CandidateApplicationRow[];
  applicationsTotal: number;
}

function toMatchingJobRow(item: JobListItem): CandidateMatchingJobRow {
  return { id: item.id, title: item.title, companyName: item.company.displayName };
}

/**
 * Carrega o bloco CANDIDATE do painel `/inicio` (USP-067 — PNL-01). Cada
 * dimensão degrada isoladamente (`try/catch → fallback`, espelha
 * `loadIndicators` de `(public)/page.tsx`) — falha numa leitura não derruba
 * as demais nem a página (P1.0-7).
 */
export async function loadCandidatePanel(person: CurrentPerson): Promise<CandidatePanelData> {
  const [openJobs, primaryAreaId, resumeStatus, applicationRows] = await Promise.all([
    getHomeIndicators()
      .then((r) => r.activeJobs)
      .catch((err) => {
        log.error({ err }, 'candidate:open-jobs-failed');
        return 0;
      }),
    getCandidatePrimaryArea(person.id).catch((err) => {
      log.error({ err }, 'candidate:primary-area-failed');
      return null;
    }),
    getCandidateProfileStatus(person.id).catch((err) => {
      log.error({ err }, 'candidate:profile-status-failed');
      return null;
    }),
    listPersonApplications(person.id).catch((err) => {
      log.error({ err }, 'candidate:applications-failed');
      return [];
    }),
  ]);

  // `searchJobs` depende do resultado de `primaryAreaId` — não entra no
  // `Promise.all` acima (encadeamento sequencial necessário).
  const matchingJobsResult = await searchJobs(
    primaryAreaId ? { areaId: primaryAreaId, page: 1 } : { page: 1 },
    person,
  ).catch((err) => {
    log.error({ err }, 'candidate:matching-jobs-failed');
    return { items: [] as JobListItem[], total: 0, page: 1, pageSize: 0 };
  });

  const { totalActive, underReview } = deriveCandidateApplicationKpis(applicationRows);
  const resumeStatusLabel = resumeStatus ? CANDIDATE_STATUS_LABELS[resumeStatus] : 'Não enviado';

  const kpis: KpiItem[] = [
    { label: 'Vagas abertas no portal', value: openJobs, tone: 'primary' },
    { label: 'Minhas candidaturas', value: totalActive, tone: 'cta' },
    { label: 'Em análise pela empresa', value: underReview, tone: 'muted' },
    { label: 'Status do currículo', value: resumeStatusLabel, tone: 'success' },
  ];

  const quickActions: QuickAction[] = [
    { label: 'Buscar vagas', href: '/vagas', variant: 'primary' },
    { label: 'Atualizar currículo', href: '/candidato', variant: 'outline' },
  ];

  return {
    kpis,
    quickActions,
    matchingJobs: matchingJobsResult.items.slice(0, 5).map(toMatchingJobRow),
    matchingJobsTotal: matchingJobsResult.total,
    applications: applicationRows.slice(0, 5).map((row) => ({
      id: row.id,
      jobId: row.jobId,
      jobTitle: row.jobTitle,
      companyName: row.companyName,
      appliedAt: row.appliedAt,
      active: row.active,
    })),
    applicationsTotal: applicationRows.length,
  };
}
