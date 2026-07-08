// Barrel do módulo `persons`.
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Inativar Pessoa (USP-007 / IDN-15, IDN-16) ────────────────────────────────
export { inactivatePerson } from './actions/inactivate-person';
export type { InactivatePersonResult } from './actions/inactivate-person';
export {
  inactivatePersonSchema,
  INACTIVATION_REASON_MIN,
  INACTIVATION_REASON_MAX,
} from './schemas/inactivate-person.schema';
export type {
  InactivatePersonInput,
  InactivatePersonData,
} from './schemas/inactivate-person.schema';
export {
  canInactivatePerson,
  hasInactivationPrivilege,
  PERSON_INACTIVATION_ROLES,
} from './domain/person-inactivation';
export type {
  InactivationAuthz,
  InactivationDenialReason,
  PersonInactivationRole,
} from './domain/person-inactivation';

// ── Reativar Pessoa (USP-045 — fluxo inverso da USP-007) ──────────────────────
export { reactivatePerson } from './actions/reactivate-person';
export type { ReactivatePersonResult } from './actions/reactivate-person';
export {
  reactivatePersonSchema,
  REACTIVATION_REASON_MIN,
  REACTIVATION_REASON_MAX,
} from './schemas/reactivate-person.schema';
export type {
  ReactivatePersonInput,
  ReactivatePersonData,
} from './schemas/reactivate-person.schema';
export {
  canReactivatePerson,
  hasReactivationPrivilege,
  institutionalRank,
  PERSON_REACTIVATION_ROLES,
} from './domain/person-reactivation';
export type {
  ReactivationAuthz,
  ReactivationDenialReason,
  PersonReactivationRole,
} from './domain/person-reactivation';

// ── Cadastro de candidato (USP-009 / CAD-01, CAD-03, CAD-05) ──────────────────
export {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  normalizePhone,
} from './domain/candidate';
export type { EducationLevel } from './domain/candidate';
export {
  candidateProfileSchema,
  PHONE_MIN_DIGITS,
  PHONE_MAX_DIGITS,
} from './schemas/candidate';
export type { CandidateProfileInput, CandidateProfileData } from './schemas/candidate';
export { activateCandidateRole } from './actions/activate-candidate-role';
export type { ActivateCandidateRoleResult } from './actions/activate-candidate-role';
export { submitCandidateForModeration } from './actions/submit-candidate-for-moderation';
export { CandidateForm } from './components/candidate-form';
export type { CandidateFormProps } from './components/candidate-form';

// USP-011 — Cadastro de cliente de serviço (papel leve, ativação automática).
export { decideClientActivation } from './domain/client';
export { ensureClientRole } from './actions/ensure-client-role';
export type { EnsureClientRoleArgs, EnsureClientRoleResult } from './actions/ensure-client-role';

// USP-010 — Cadastro de prestador de serviço PF (sem CNPJ — ADR-0031).
export { providerProfileSchema } from './schemas/provider';
export type { ProviderProfileInput, ProviderProfileData } from './schemas/provider';
export { activateProviderRole } from './actions/activate-provider-role';
export type { ActivateProviderRoleResult } from './actions/activate-provider-role';
export { ProviderForm } from './components/provider-form';
export type { ProviderFormProps } from './components/provider-form';

// Porta "único responsável de Empresa" (P-002 / E-003). O adapter real chega com
// o módulo `companies`; o nulo é o binding padrão (ver shared/container.ts).
export { COMPANY_RESPONSIBILITY_TOKEN } from './ports/companyResponsibility';
export type {
  CompanyResponsibilityPort,
  OrphanedCompanyRef,
} from './ports/companyResponsibility';
export { NullCompanyResponsibilityAdapter } from './adapters/null-company-responsibility';

// View de Pessoa para operador institucional (coordenador/diretoria).
export { viewPersonForStaff, viewStaffPersonNames } from './views/view-person-for-staff';
export type { StaffPersonView } from './views/view-person-for-staff';

// Busca ativa de candidatos pela Empresa (USP-028 / CAN-04).
export { firstNameOf } from './domain/candidate-display';
export {
  viewCandidateForSearch,
  QUALIFICATIONS_SUMMARY_MAX,
} from './views/view-candidate-for-search';
export type {
  SearchCandidateRow,
  SearchCandidateView,
} from './views/view-candidate-for-search';

// View de candidato para a Empresa dona da vaga (USP-027 / CAN-03).
export { viewCandidateForEmployer } from './views/view-candidate-for-employer';
export type {
  EmployerCandidateRow,
  EmployerCandidateView,
} from './views/view-candidate-for-employer';

// Componentes de UI da inativação (USP-007) e reativação (USP-045).
export { InactivatePersonDialog } from './components/inactivate-person-dialog';
export { ReactivatePersonDialog } from './components/reactivate-person-dialog';
