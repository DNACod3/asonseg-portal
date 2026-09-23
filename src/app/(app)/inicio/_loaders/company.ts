import {
  listCompanyJobs,
  viewCompanyJobRow,
  countCompanyApplications,
  listCompanyRecentApplications,
} from '@/modules/jobs';
import { listPersonCompanyGrants } from '@/modules/companies';
import type { CurrentPerson } from '@/modules/identity';
import { childLogger } from '@/shared/lib/logger';
import type { KpiItem } from '../_components/kpi-strip';
import type { QuickAction } from '../_components/quick-actions';

const log = childLogger({ module: 'inicio', loader: 'company' });

export interface CompanyJobPanelRow {
  id: string;
  companyId: string;
  title: string;
  statusLabel: string;
  badgeVariant: 'gray' | 'blue' | 'orange' | 'green';
  canEdit: boolean;
  canSubmit: boolean;
}

export interface CompanyRecentApplicationPanelRow {
  jobId: string;
  companyId: string;
  jobTitle: string;
  appliedAt: Date;
}

export interface CompanyPanelData {
  hasActiveCompany: boolean;
  kpis: KpiItem[];
  quickActions: QuickAction[];
  jobs: CompanyJobPanelRow[];
  jobsTotal: number;
  recentApplications: CompanyRecentApplicationPanelRow[];
  recentApplicationsTotal: number;
}

const EMPTY: CompanyPanelData = {
  hasActiveCompany: false,
  kpis: [],
  quickActions: [{ label: 'Cadastrar empresa', href: '/empresa/cadastrar', variant: 'primary' }],
  jobs: [],
  jobsTotal: 0,
  recentApplications: [],
  recentApplicationsTotal: 0,
};

/**
 * Carrega o bloco COMPANY_RESPONSIBLE do painel `/inicio` (USP-067 —
 * PNL-04). Agrega sobre **todas** as empresas do responsável com grant
 * `RESPONSIBLE`/`ACTIVE` (A-07). Sem empresa ativa → estado vazio +
 * atalho "cadastrar empresa" (P1.4-4), sem erro.
 */
export async function loadCompanyPanel(person: CurrentPerson): Promise<CompanyPanelData> {
  const grants = await listPersonCompanyGrants(person.id).catch((err) => {
    log.error({ err }, 'company:grants-failed');
    return [];
  });
  const activeCompanies = grants.filter(
    (grant) => grant.grantType === 'RESPONSIBLE' && grant.status === 'ACTIVE',
  );

  if (activeCompanies.length === 0) return EMPTY;

  const perCompany = await Promise.all(
    activeCompanies.map(async (company) => {
      const [jobRows, applicationCounts, recentRows] = await Promise.all([
        listCompanyJobs(company.companyId).catch((err) => {
          log.error({ err, companyId: company.companyId }, 'company:jobs-failed');
          return [];
        }),
        countCompanyApplications(company.companyId).catch((err) => {
          log.error({ err, companyId: company.companyId }, 'company:applications-count-failed');
          return { total: 0, active: 0 };
        }),
        listCompanyRecentApplications(company.companyId).catch((err) => {
          log.error({ err, companyId: company.companyId }, 'company:recent-applications-failed');
          return [];
        }),
      ]);
      return { companyId: company.companyId, jobRows, applicationCounts, recentRows };
    }),
  );

  const allJobRows = perCompany.flatMap((c) => c.jobRows.map((job) => ({ companyId: c.companyId, job })));
  const openJobsCount = allJobRows.filter(({ job }) => job.status === 'ACTIVE').length;
  const totalApplications = perCompany.reduce((sum, c) => sum + c.applicationCounts.total, 0);
  const activeApplications = perCompany.reduce((sum, c) => sum + c.applicationCounts.active, 0);

  const kpis: KpiItem[] = [
    { label: 'Vagas criadas', value: allJobRows.length, tone: 'primary' },
    { label: 'Vagas em aberto', value: openJobsCount, tone: 'success' },
    { label: 'Candidatos aplicados', value: totalApplications, tone: 'cta' },
    { label: 'Candidatos ativos', value: activeApplications, tone: 'muted' },
  ];

  const quickActions: QuickAction[] = [
    { label: 'Publicar vaga', href: `/empresa/${activeCompanies[0]?.companyId}/vagas/nova`, variant: 'primary' },
  ];

  const jobs: CompanyJobPanelRow[] = allJobRows.slice(0, 5).map(({ companyId, job }) => {
    const view = viewCompanyJobRow(job);
    return {
      id: view.id,
      companyId,
      title: view.title,
      statusLabel: view.statusLabel,
      badgeVariant: view.badgeVariant,
      canEdit: view.actions.canEdit,
      canSubmit: view.actions.canSubmit,
    };
  });

  const allRecentRows = perCompany.flatMap((c) =>
    c.recentRows.map((row) => ({ companyId: c.companyId, ...row })),
  );
  allRecentRows.sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());

  return {
    hasActiveCompany: true,
    kpis,
    quickActions,
    jobs,
    jobsTotal: allJobRows.length,
    recentApplications: allRecentRows.slice(0, 5),
    recentApplicationsTotal: allRecentRows.length,
  };
}
