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
  isServiceOpenForInterest,
  type ServiceInterestServiceInput,
} from './domain/service-interest-rules';
export {
  detectServicePhotoMime,
  isWithinServicePhotoSizeLimit,
  MAX_SERVICE_PHOTO_BYTES,
  MAX_SERVICE_PHOTOS,
  type ServicePhotoMimeType,
} from './domain/photo-mime';
export { buildServicePhotoUrl } from './domain/photo-url';

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
export {
  manifestInterestSchema,
  type ManifestInterestInput,
} from './schemas/service-interest.schema';

// ── Actions ────────────────────────────────────────────────────────────────
export { createServiceDraft, type CreateServiceDraftResult } from './actions/create-service-draft';
export {
  submitServiceForModeration,
  type SubmitServiceResult,
} from './actions/submit-service-for-moderation';
export { uploadServicePhoto, type UploadServicePhotoResult } from './actions/upload-service-photo';
export { editService, type EditServiceResult } from './actions/edit-service';
export { pauseService, type PauseServiceResult } from './actions/pause-service';
export { resumeService, type ResumeServiceResult } from './actions/resume-service';
export { archiveService, type ArchiveServiceResult } from './actions/archive-service';

// ── Adapters ───────────────────────────────────────────────────────────────
export { PrismaServiceStatusRepository } from './adapters/prisma-service-status';

// ── Server (gates) ─────────────────────────────────────────────────────────
export { requireServiceAuthorization } from './server/require-service-authorization';
export { requireServiceOwner, type ServiceOwnerCheck } from './server/require-service-owner';
export { requireActiveResponsible } from './server/require-active-responsible';

// ── Queries ────────────────────────────────────────────────────────────────
export { listServiceCategories, type ServiceCategoryOption } from './queries/list-service-categories';
export {
  searchServices,
  SERVICE_SEARCH_PAGE_SIZE,
  SERVICE_SEARCH_TERM_MAX,
  type SearchServicesFilters,
  type SearchServicesResult,
} from './queries/search-services';
export { getActiveServiceDetail } from './queries/get-service-detail';
export {
  listProviderServices,
  PROVIDER_SERVICES_PAGE_SIZE,
  type ProviderServiceRow,
} from './queries/list-provider-services';
export { getMyActiveServiceInterest } from './queries/get-my-service-interest';
export { getProviderContactForService } from './queries/get-provider-contact';

// ── Views ──────────────────────────────────────────────────────────────────
export {
  viewServiceForVisitor,
  type ServiceListItem,
  type ServiceListItemPrice,
  type ServiceListRow,
} from './views/service-list-item.view';
export {
  viewServiceDetail,
  serviceDetailJsonLd,
  serializeJsonLd,
  type ServiceDetail,
  type ServiceDetailPrice,
  type ServiceDetailPhoto,
  type ServiceDetailRow,
} from './views/service-detail.view';
export {
  viewProviderServiceRow,
  type ProviderServiceRowActions,
  type ProviderServiceRowView,
} from './views/provider-service-row.view';
export {
  viewProviderContactForClient,
  type ProviderContact,
  type ProviderContactRow,
} from './views/provider-contact.view';

// ── Components ─────────────────────────────────────────────────────────────
export { ServiceForm, type ServiceFormProps, type CompanyOption, type RegionOption } from './components/service-form';
export { ServiceSearchFilters, type ServiceSearchFilterValues } from './components/service-search-filters';
export { ServiceList } from './components/service-list';
export { ServiceCard } from './components/service-card';
export { AsonsegDisclaimer } from './components/asonseg-disclaimer';
export { ServiceDetailView } from './components/service-detail';
export { ServicoIndisponivel } from './components/servico-indisponivel';
export { ServiceManagementList } from './components/service-management-list';
export { ServiceActions } from './components/service-actions';
export { ServiceEditForm } from './components/service-edit-form';
