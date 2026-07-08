/**
 * Barrel do módulo `services` (USP-029 — fundação de Serviços). Todo import
 * externo ao módulo passa por aqui (`@/modules/services`), nunca por caminho
 * profundo (CLAUDE.md). Exceções documentadas: Client Components importam
 * Server Actions por caminho relativo (`../actions/...`, padrão do repo — ver
 * `job-form.tsx`), e o container (`@/shared/container.ts`) importa o adapter
 * por caminho profundo dentro do bloco `eslint-disable no-restricted-imports`.
 */

// ── Domínio ────────────────────────────────────────────────────────────────
export { isServiceDedupViolation } from './domain/dedup';
export {
  detectServicePhotoMime,
  isWithinServicePhotoSizeLimit,
  MAX_SERVICE_PHOTO_BYTES,
  MAX_SERVICE_PHOTOS,
  type ServicePhotoMimeType,
} from './domain/photo-mime';

// ── Schemas ────────────────────────────────────────────────────────────────
export {
  draftServiceSchema,
  publishServiceSchema,
  submitServiceSchema,
  editServiceSchema,
  type DraftServiceInput,
  type DraftServiceData,
  type PublishServiceInput,
  type PublishServiceData,
  type SubmitServiceInput,
  type SubmitServiceData,
  type EditServiceInput,
  type EditServiceData,
} from './schemas/publish-service.schema';
export {
  serviceIdSchema,
  pauseServiceSchema,
  resumeServiceSchema,
  archiveServiceSchema,
  type ServiceIdInput,
  type PauseServiceInput,
  type ResumeServiceInput,
  type ArchiveServiceInput,
} from './schemas/lifecycle.schema';

// ── Actions ────────────────────────────────────────────────────────────────
export { createServiceDraft, type CreateServiceDraftResult } from './actions/create-service-draft';
export {
  submitServiceForModeration,
  type SubmitServiceResult,
} from './actions/submit-service-for-moderation';
export { uploadServicePhoto, type UploadServicePhotoResult } from './actions/upload-service-photo';

// ── Adapters ───────────────────────────────────────────────────────────────
export { PrismaServiceStatusRepository } from './adapters/prisma-service-status';

// ── Server (gates) ─────────────────────────────────────────────────────────
export { requireServiceAuthorization } from './server/require-service-authorization';
export { requireServiceOwner, type ServiceOwnerCheck } from './server/require-service-owner';
export { requireActiveResponsible } from './server/require-active-responsible';

// ── Queries ────────────────────────────────────────────────────────────────
export { listServiceCategories, type ServiceCategoryOption } from './queries/list-service-categories';

// ── Components ─────────────────────────────────────────────────────────────
export { ServiceForm, type ServiceFormProps, type CompanyOption, type RegionOption } from './components/service-form';
