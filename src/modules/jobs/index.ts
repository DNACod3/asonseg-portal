// Barrel do módulo `jobs` (USP-020 — Publicar vaga / ADR-0011).
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Domínio ───────────────────────────────────────────────────────────────────
export { MAX_VALIDADE_DIAS, validadeStatus, diasAteExpiracao } from './domain/validade';
export type { ValidadeStatus } from './domain/validade';
export { isJobOpenForApplication, isProfileApplicable } from './domain/application-rules';
export type { ApplicationJobInput, ApplicationProfileInput } from './domain/application-rules';

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
  EditJobInput,
  EditJobData,
} from './schemas/publish-job.schema';
export { editJobSchema } from './schemas/publish-job.schema';
export {
  jobIdSchema,
  pauseJobSchema,
  unpauseJobSchema,
  archiveJobSchema,
  extendJobValiditySchema,
} from './schemas/lifecycle.schema';
export type {
  JobIdInput,
  PauseJobInput,
  UnpauseJobInput,
  ArchiveJobInput,
  ExtendJobValidityInput,
} from './schemas/lifecycle.schema';
export { applyToJobSchema } from './schemas/application.schema';
export type { ApplyToJobInput } from './schemas/application.schema';

// ── Actions ───────────────────────────────────────────────────────────────────
export { createJobDraft, type CreateJobDraftResult } from './actions/create-job-draft';
export { submitJobForModeration, type SubmitJobResult } from './actions/submit-job-for-moderation';
export { pauseJob, type PauseJobResult } from './actions/pause-job';
export { unpauseJob, type UnpauseJobResult } from './actions/unpause-job';
export { archiveJob, type ArchiveJobResult } from './actions/archive-job';
export { extendJobValidity, type ExtendJobValidityResult } from './actions/extend-job-validity';
export { editJob, type EditJobResult } from './actions/edit-job';
export { runJobExpiration, type RunJobExpirationResult } from './actions/run-job-expiration';
export {
  enqueueExpiryReminder,
  type JobExpiryReminderPayload,
} from './actions/enqueue-expiry-reminder';
export { applyToJob, type ApplyToJobResult } from './actions/apply-to-job';

// ── Server (server-only helpers, ADR-0030) ──────────────────────────────────────
export { requireActiveResponsible } from './server/require-active-responsible';

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
export { getPausedJobNotice, type PausedJobNotice } from './queries/get-paused-job-notice';
export {
  listCompanyJobs,
  COMPANY_JOBS_PAGE_SIZE,
  type CompanyJobRow,
} from './queries/list-company-jobs';
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
export {
  viewCompanyJobRow,
  type CompanyJobRowView,
  type CompanyJobRowActions,
} from './views/company-job-row.view';

// ── Componentes ───────────────────────────────────────────────────────────────
export { CompanyJobList, type CompanyJobListProps } from './components/company-job-list';
export { JobEditForm, type JobEditFormProps } from './components/job-edit-form';
export { JobForm, type JobFormProps } from './components/job-form';
export {
  JobSearchFilters,
  type JobSearchFiltersProps,
  type JobSearchFilterValues,
} from './components/job-search-filters';
export { JobCard } from './components/job-card';
export { JobList } from './components/job-list';
export { JobDetailView } from './components/job-detail';
