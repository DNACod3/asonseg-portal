// Barrel do módulo `consents` (USP-043 — Consentimentos LGPD por finalidade).
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Domínio: finalidades + termos versionados (#35) ──────────────────────────
export {
  CONSENT_PURPOSES,
  PURPOSE_METADATA,
  purposeMetadata,
  isConsentPurpose,
} from './domain/purposes';
export type { ConsentPurpose, PurposeMetadata } from './domain/purposes';

export {
  TERMS_REGISTRY,
  currentTermVersion,
  normalizeTermVersion,
  isCurrentTermVersion,
} from './domain/terms-registry';
export type { TermRegistryEntry } from './domain/terms-registry';

export { loadTerm, TermLoaderError } from './adapters/term-loader';
export type { LoadedTerm, TermLoaderErrorCode } from './adapters/term-loader';

export { stripTermFrontMatter, TERM_BODY_UNAVAILABLE } from './domain/term-body';

// ── Matriz de cascata + guarda on-read (#37) ─────────────────────────────────
export { PURPOSE_ROLE_MAP, roleForPurpose } from './domain/purpose-role-map';
export { requireActiveConsent } from './server/require-active-consent';
export type { ConsentCheck, ConsentCheckReason } from './server/require-active-consent';

// ── Server Actions (#37) ─────────────────────────────────────────────────────
export { grantConsent } from './actions/grant-consent';
export type { GrantConsentResult } from './actions/grant-consent';
export { revokeConsent } from './actions/revoke-consent';
export type { RevokeConsentResult } from './actions/revoke-consent';

export {
  grantConsentSchema,
  revokeConsentSchema,
  consentPurposeSchema,
} from './schemas/consent';
export type { GrantConsentInput, RevokeConsentInput } from './schemas/consent';

// ── Painel do titular (#39) ──────────────────────────────────────────────────
export { listOwnConsents } from './queries/list-own-consents';
export type { OwnConsentRow } from './queries/list-own-consents';
export { buildOwnConsentsView } from './views/own-consents.view';
export type { OwnConsentView, OwnConsentStatus } from './views/own-consents.view';
export { ConsentsPanel } from './components/consents-panel';
export type { ConsentsPanelItem } from './components/consents-panel';
