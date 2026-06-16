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

// ── Componentes ───────────────────────────────────────────────────────────────
export { JobForm, type JobFormProps } from './components/job-form';
