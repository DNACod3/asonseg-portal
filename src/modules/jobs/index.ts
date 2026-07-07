// Barrel do módulo `jobs` (USP-020 — Publicar vaga / ADR-0011).
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Domínio ───────────────────────────────────────────────────────────────────
export { MAX_VALIDADE_DIAS, validadeStatus } from './domain/validade';
export type { ValidadeStatus } from './domain/validade';

// ── Schemas ───────────────────────────────────────────────────────────────────
export {
  publishJobSchema,
  draftJobSchema,
  submitJobSchema,
  TITLE_MIN,
  TITLE_MAX,
  DESCRICAO_MAX,
  REQUISITOS_MAX,
  REGIME_MAX,
  LOCAL_MAX,
  BENEFICIOS_MAX,
  SALARIO_MAX,
} from './schemas/publish-job.schema';
export type {
  PublishJobInput,
  PublishJobData,
  DraftJobInput,
  DraftJobData,
  SubmitJobInput,
  SubmitJobData,
} from './schemas/publish-job.schema';

// ── Actions ───────────────────────────────────────────────────────────────────
export { createJobDraft, type CreateJobDraftResult } from './actions/create-job-draft';
export { submitJobForModeration, type SubmitJobResult } from './actions/submit-job-for-moderation';

// ── Adapters ──────────────────────────────────────────────────────────────────
export { PrismaJobStatusRepository } from './adapters/prisma-job-status';

// ── Queries ───────────────────────────────────────────────────────────────────
export { listApprovedJobAreas, type JobAreaOption } from './queries/list-approved-job-areas';
export { listActiveRegions, type RegionOption } from './queries/list-active-regions';
export {
  searchJobs,
  SEARCH_PAGE_SIZE,
  type SearchJobsFilters,
  type SearchJobsResult,
} from './queries/search-jobs';
export { getActiveJobDetail } from './queries/get-job-detail';
export {
  listActivePublishedJobs,
  PUBLISHED_JOBS_PAGE_SIZE,
  type PublishedJobRow,
  type ListActivePublishedJobsResult,
} from './queries/list-active-published-jobs';

// ── Views (View Models por papel) ───────────────────────────────────────────────
export { viewJobForVisitor, type JobListItem, type JobListRow } from './views/job-list-item.view';
export {
  viewJobDetail,
  jobDetailJsonLd,
  serializeJsonLd,
  APPLICATION_COUNTER_THRESHOLD,
  CANDIDATE_ROLE,
  type JobDetail,
  type JobDetailRow,
} from './views/job-detail.view';

// ── Componentes ───────────────────────────────────────────────────────────────
export { JobForm, type JobFormProps } from './components/job-form';
export {
  JobSearchFilters,
  type JobSearchFiltersProps,
  type JobSearchFilterValues,
} from './components/job-search-filters';
export { JobCard } from './components/job-card';
export { JobList } from './components/job-list';
export { JobDetailView } from './components/job-detail';
