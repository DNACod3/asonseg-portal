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
export { DispatchingContentStatusRepository } from './adapters/dispatching-content-status-repository';
export { StubModerationNotification } from './adapters/stub-moderation-notification';
export { NextCacheInvalidation } from './adapters/next-cache-invalidation';
export { StubCompanyVerifyHook } from './adapters/stub-company-verify-hook';
export { PrismaCompanyVerifyHook } from './adapters/prisma-company-verify-hook';

// ── Actions de decisão + fila do coordenador (#123) ──────────────────────────
export { approveContent, returnForAdjustments, rejectContent } from './actions/decide';
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
export { viewModerationQueue } from './queries/moderation-queue';
export type { ModerationQueueItem } from './views/moderation-queue-item';
export { canAccessModerationQueue } from './server/moderation-access';
export { ModerationQueue } from './components/moderation-queue';
export type { ModerationQueueRow } from './components/moderation-queue';
export { VerificationPanel } from './components/verification-panel';
export type {
  VerificationPanelData,
  VerificationRejectionRow,
} from './components/verification-panel';
export {
  VERIFICATION_CHECKLIST_ITEMS,
  type VerificationChecklistItem,
} from './domain/verification-checklist';
