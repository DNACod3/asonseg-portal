// Barrel do módulo `referrals` (USP-037/038 — SOC-03..05, agregado `Referral`).
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Domínio ───────────────────────────────────────────────────────────────────
export { isProfessionalSummaryRequired } from './domain/referral-rules';

// ── Schemas ───────────────────────────────────────────────────────────────────
export {
  createReferralSchema,
  PROFESSIONAL_SUMMARY_MAX,
  JUSTIFICATION_MAX,
} from './schemas/referral.schema';
export type { CreateReferralInput, CreateReferralData } from './schemas/referral.schema';
export {
  registerReferralResultSchema,
  RESULT_OBSERVATION_MAX,
} from './schemas/referral.schema';
export type {
  RegisterReferralResultInput,
  RegisterReferralResultData,
} from './schemas/referral.schema';

// ── Actions ───────────────────────────────────────────────────────────────────
export { createReferral, type CreateReferralResult } from './actions/create-referral';

// ── Server (server-only helpers, ADR-0030) ──────────────────────────────────────
export { canReferPersonToJob } from './server/route-access';

// ── Componentes ───────────────────────────────────────────────────────────────
export { ReferralForm, type ReferralFormProps } from './components/referral-form';
