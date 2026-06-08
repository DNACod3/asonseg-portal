// Barrel do módulo `identity`.
// Todos os imports externos devem passar por este arquivo.

export { registerPerson } from './actions/registerPerson';
export { acceptRoleConsent } from './actions/acceptRoleConsent';
export { registerPersonSchema, acceptRoleConsentSchema, PUBLIC_ROLES, ROLE_PURPOSE_MAP } from './schemas/registerPerson';
export type { RegisterPersonInput, AcceptRoleConsentInput, PublicRole, RolePurpose } from './schemas/registerPerson';
export type { RegisterPersonResult } from './actions/registerPerson';
export type { AcceptRoleConsentResult } from './actions/acceptRoleConsent';
export { CAPTCHA_VERIFIER_TOKEN } from './ports/captchaVerifier';
export type { CaptchaVerifier, CaptchaVerifyResult } from './ports/captchaVerifier';
export { RegisterPersonForm } from './components/RegisterPersonForm';

// ── Autenticação (USP-004) ────────────────────────────────────────────────────
export { loginAction } from './actions/login';
export type { LoginData } from './actions/login';
export { changePasswordFirstAccess } from './actions/changePassword';
export { signInSchema, GENERIC_AUTH_ERROR } from './schemas/signIn';
export type { SignInInput } from './schemas/signIn';
export { changePasswordFirstAccessSchema } from './schemas/changePassword';
export type { ChangePasswordFirstAccessInput } from './schemas/changePassword';
export { LoginForm } from './components/LoginForm';
export { ChangePasswordForm } from './components/ChangePasswordForm';

// ── Recuperação de senha (USP-005) ────────────────────────────────────────────
export { requestPasswordReset } from './actions/request-password-reset';
export { resetPassword } from './actions/reset-password';
export {
  requestPasswordResetSchema,
  resetPasswordSchema,
  GENERIC_RESET_REQUEST_MESSAGE,
  RESET_LINK_EXPIRY_HOURS,
} from './schemas/password-reset.schema';
export type {
  RequestPasswordResetInput,
  ResetPasswordInput,
} from './schemas/password-reset.schema';
export { PasswordResetRequestForm } from './components/password-reset-request-form';
export { PasswordResetForm } from './components/password-reset-form';
export {
  isLocked,
  withinWindow,
  LOCKOUT_WINDOW_MS,
  LOCKOUT_THRESHOLD,
  LOCKOUT_DURATION_MS,
} from './domain/lockout';
export type { LockoutAttempt, LockoutPolicy } from './domain/lockout';
export { AUTH_PROVIDER_TOKEN } from './ports/authProvider';
export type { AuthProvider, AuthSignInResult } from './ports/authProvider';
export { AUTH_ATTEMPTS_REPO_TOKEN } from './ports/authAttemptsRepo';
export type { AuthAttemptsRepo, AttemptKey } from './ports/authAttemptsRepo';
export { requireActivePerson, getCurrentPerson } from './server/session';
export type { CurrentPerson } from './server/session';

// ── Cadastro assistido pela AS (USP-002) ──────────────────────────────────────
export { registerPersonByAssistant } from './actions/register-person-by-assistant';
export type { RegisterByAssistantResult } from './actions/register-person-by-assistant';
export {
  registerByAssistantSchema,
} from './schemas/register-by-assistant.schema';
export type {
  RegisterByAssistantInput,
  RegisterByAssistantData,
} from './schemas/register-by-assistant.schema';
export {
  ASSISTED_REGISTRATION_ROLES,
  canRegisterAssisted,
  CPF_EXCEPTION_MIN_JUSTIFICATION,
} from './domain/assisted-registration';
export type { AssistedRegistrationRole } from './domain/assisted-registration';
export { AssistedRegisterForm } from './components/assisted-register-form';

// ── Reivindicação de credencial de Pessoa pré-cadastrada (USP-003) ────────────
export { requestCredentialClaim } from './actions/request-credential-claim';
export type { RequestCredentialClaimResult } from './actions/request-credential-claim';
export { verifyCredentialClaim } from './actions/verify-credential-claim';
export type { VerifyCredentialClaimResult } from './actions/verify-credential-claim';
export {
  requestCredentialClaimSchema,
  verifyCredentialClaimSchema,
  CREDENTIAL_VERIFICATION_METHODS,
  VERIFICATION_METHOD_LABELS,
  GENERIC_CLAIM_REQUEST_MESSAGE,
} from './schemas/credential-claim.schema';
export type {
  RequestCredentialClaimInput,
  RequestCredentialClaimData,
  VerifyCredentialClaimInput,
  CredentialVerificationMethod,
} from './schemas/credential-claim.schema';
export {
  CREDENTIAL_CLAIM_APPROVER_ROLES,
  canApproveCredentialClaim,
} from './domain/credential-claim';
export type { CredentialClaimApproverRole } from './domain/credential-claim';
export { listPendingCredentialClaims } from './queries/list-pending-credential-claims';
export type { PendingCredentialClaimRow } from './queries/list-pending-credential-claims';
export { CredentialClaimForm } from './components/credential-claim-form';
export { CredentialClaimReview } from './components/credential-claim-review';
export type { CredentialClaimReviewItem } from './components/credential-claim-review';

// ── Ativar papel adicional na Pessoa autenticada (USP-006) ────────────────────
export { activateAdditionalRole } from './actions/activate-additional-role';
export type { ActivateAdditionalRoleResult } from './actions/activate-additional-role';
export {
  activateAdditionalRoleSchema,
} from './schemas/activate-role.schema';
export type { ActivateAdditionalRoleInput } from './schemas/activate-role.schema';
export {
  PROFILE_FIELDS,
  ROLE_PROFILE_FIELDS,
  ROLE_LABELS,
  PROFILE_FIELD_META,
  ROLE_NEXT_STEP,
  missingProfileFields,
} from './domain/role-activation';
export type { ProfileField, ProfileSnapshot } from './domain/role-activation';
export { ActivateRoleForm } from './components/activate-role-form';
export type { ActivatableRoleOption } from './components/activate-role-form';
export { buildActivatableOptions } from './server/build-activatable-options';

// ── Permissões delegadas a voluntários (USP-008) ──────────────────────────────
export { grantDelegatedPermission } from './actions/grant-delegated-permission';
export type { GrantDelegatedPermissionInput, GrantDelegatedPermissionResult } from './actions/grant-delegated-permission';
export { revokeDelegatedPermission } from './actions/revoke-delegated-permission';
export type { RevokeDelegatedPermissionInput, RevokeDelegatedPermissionResult } from './actions/revoke-delegated-permission';
export { requirePermission } from './server/require-permission';
export { DELEGABLE_PERMISSIONS, checkPermission, isCoordinator } from './domain/permissions';
export type { PermissionId, PermissionCheckResult, DelegatedGrant } from './domain/permissions';
