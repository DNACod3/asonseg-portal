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
