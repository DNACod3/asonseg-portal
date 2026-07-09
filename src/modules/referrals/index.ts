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
