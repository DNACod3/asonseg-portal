// Barrel do módulo `moderation` (USP-016 / ADR-0011).
// Todos os imports externos passam por aqui — nunca por caminhos profundos.

// ── Máquina de estados (domínio puro, #121) ──────────────────────────────────
export {
  ContentStatus,
  ContentKind,
  TRANSITIONS,
} from './domain/content-status';
export type { TransitionTrigger, TransitionRule } from './domain/content-status';
export {
  findTransition,
  isValidTransition,
  requiresJustification,
} from './domain/transition-rules';
export {
  MIN_JUSTIFICATION_LENGTH,
  JUSTIFICATION_TOO_SHORT_MESSAGE,
  JUSTIFICATION_NOT_MEANINGFUL_MESSAGE,
  isMeaningfulJustification,
} from './domain/justification';
export {
  PERMISSION_BY_KIND,
  CONTENT_KINDS_BY_PERMISSION,
} from './domain/moderation-permissions';

// ── transitionContent + ports (#122) ─────────────────────────────────────────
export { transitionContent } from './actions/transition-content';
export type {
  TransitionContentInput,
  TransitionContentData,
} from './actions/transition-content';
export { CONTENT_STATUS_REPOSITORY_TOKEN } from './ports/content-status.port';
export type { ContentStatusRepository } from './ports/content-status.port';
export { MODERATION_NOTIFICATION_TOKEN } from './ports/moderation-notification.port';
export type {
  ModerationNotificationPort,
  ModerationDecisionNotice,
} from './ports/moderation-notification.port';
export { CACHE_INVALIDATION_TOKEN } from './ports/cache-invalidation.port';
export type {
  CacheInvalidationPort,
  CacheInvalidationTarget,
} from './ports/cache-invalidation.port';
export { COMPANY_VERIFY_HOOK_TOKEN } from './ports/company-verify-hook.port';
export type {
  CompanyVerifyHookPort,
  ContentActivation,
} from './ports/company-verify-hook.port';
export { PrismaModerationContentRepository } from './adapters/prisma-moderation-content-repository';

// ── Leitura do conteúdo integral por ContentKind (USP-066) ──────────────────
export { CONTENT_MODERATION_READER_TOKEN } from './ports/content-moderation-reader.port';
export type { ContentModerationReader } from './ports/content-moderation-reader.port';
export type { ModerationContentView, ModerationContentKind } from './views/moderation-content';
export { DispatchingContentStatusRepository } from './adapters/dispatching-content-status-repository';
export { StubModerationNotification } from './adapters/stub-moderation-notification';
export { OutboxModerationNotification } from './adapters/outbox-moderation-notification';
export { NextCacheInvalidation } from './adapters/next-cache-invalidation';
export { StubCompanyVerifyHook } from './adapters/stub-company-verify-hook';
export { PrismaCompanyVerifyHook } from './adapters/prisma-company-verify-hook';

// ── Actions de decisão + fila do coordenador (#123) ──────────────────────────
export { approveContent, returnForAdjustments, rejectContent } from './actions/decide';
export { inactivateContent } from './actions/inactivate';
export { suggestTaxonomy } from './actions/suggest-taxonomy';
export {
  approveTaxonomySuggestion,
  rejectTaxonomySuggestion,
} from './actions/resolve-taxonomy-suggestion';
export {
  approveSchema,
  returnForAdjustmentsSchema,
  rejectSchema,
} from './schemas/decision';
export type {
  ApproveInput,
  ReturnForAdjustmentsInput,
  RejectInput,
} from './schemas/decision';
export { inactivateSchema } from './schemas/inactivate';
export type { InactivateContentInput } from './schemas/inactivate';
export {
  TAXONOMY_NAME_MIN,
  TAXONOMY_NAME_MAX,
  foldForDedup,
} from './domain/taxonomy-suggestion';
export type { TaxonomyKind } from './domain/taxonomy-suggestion';
export {
  suggestTaxonomySchema,
  resolveTaxonomySuggestionSchema,
} from './schemas/taxonomy-suggestion';
export type {
  SuggestTaxonomyInput,
  ResolveTaxonomySuggestionInput,
} from './schemas/taxonomy-suggestion';
export { viewModerationQueue } from './queries/moderation-queue';
export type { ModerationQueueItem } from './views/moderation-queue-item';
export { listTaxonomySuggestions } from './queries/list-taxonomy-suggestions';
export type { TaxonomySuggestionItem } from './views/taxonomy-suggestion-item';
export { canApproveTaxonomySuggestions } from './server/taxonomy-suggestion-access';
export { listVerificationChecklistItems } from './queries/list-verification-checklist';
export {
  canAccessModerationQueue,
  canManagePublishedContent,
  listViewerModeratableKinds,
} from './server/moderation-access';
export { ModerationQueue } from './components/moderation-queue';
export type { ModerationQueueRow } from './components/moderation-queue';
export { PublishedContentManager } from './components/published-content-manager';
export type { PublishedContentRow } from './components/published-content-manager';
export { TaxonomySuggestionsList } from './components/taxonomy-suggestions-list';
export type { TaxonomySuggestionRow } from './components/taxonomy-suggestions-list';
export { VerificationPanel } from './components/verification-panel';
export type {
  VerificationPanelData,
  VerificationRejectionRow,
} from './components/verification-panel';
export {
  VERIFICATION_CHECKLIST_ITEMS,
  type VerificationChecklistItem,
} from './domain/verification-checklist';
