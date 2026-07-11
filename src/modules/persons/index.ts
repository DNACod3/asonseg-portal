// Barrel do módulo `persons`.
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// Máscara de CPF do titular para exibição (USP-049 / PERFIL-01).
export { maskCpf } from './domain/cpf-mask';

// View Model do próprio titular (viewer=self) para /perfil (USP-049 / AUTH-4).
export { viewPersonForSelf } from './views/view-person-for-self';
export type { SelfProfileView } from './views/view-person-for-self';

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
export {
  searchCandidates,
  SEARCH_PAGE_SIZE,
  SEARCH_TERM_MAX,
} from './queries/search-candidates';
export type {
  SearchCandidatesFilters,
  SearchCandidatesResult,
} from './queries/search-candidates';
export {
  CandidateSearchForm,
  type CandidateSearchFormProps,
  type CandidateSearchFilterValues,
} from './components/candidate-search-form';
export {
  CandidateSearchList,
  type CandidateSearchListProps,
} from './components/candidate-search-list';

// View de candidato para a Empresa dona da vaga (USP-027 / CAN-03).
export { viewCandidateForEmployer } from './views/view-candidate-for-employer';
export type {
  EmployerCandidateRow,
  EmployerCandidateView,
} from './views/view-candidate-for-employer';

// Componentes de UI da inativação (USP-007) e reativação (USP-045).
export { InactivatePersonDialog } from './components/inactivate-person-dialog';
export { ReactivatePersonDialog } from './components/reactivate-person-dialog';

// Ficha socioeconômica (USP-036 / SOC-01, SOC-02, SOC-036-MN-01/02).
export {
  canManageSocioeconomicRecord,
  isEmptyRecord,
  SOCIOECONOMIC_RECORD_ROLES,
  INCOME_BRACKETS,
  INCOME_BRACKET_LABELS,
  HOUSING_SITUATIONS,
  HOUSING_SITUATION_LABELS,
} from './domain/socioeconomic-record';
export type {
  SocioeconomicRecordRole,
  IncomeBracket,
  HousingSituation,
  EmptyRecordCheck,
} from './domain/socioeconomic-record';
export {
  socioeconomicRecordSchema,
  SOCIAL_BENEFIT_MAX,
  FAMILY_COMPOSITION_MAX,
} from './schemas/socioeconomic-record.schema';
export type {
  SocioeconomicRecordInput,
  SocioeconomicRecordData,
} from './schemas/socioeconomic-record.schema';
export { saveSocioeconomicRecord } from './actions/save-socioeconomic-record';
export type { SaveSocioeconomicRecordResult } from './actions/save-socioeconomic-record';
export { getSocioeconomicRecord } from './queries/get-socioeconomic-record';
export { viewSocioeconomicRecord } from './views/view-socioeconomic-record';
export type {
  SocioeconomicRow,
  SocioeconomicRecordView,
} from './views/view-socioeconomic-record';
export { SocioeconomicRecordForm } from './components/socioeconomic-record-form';
export type {
  SocioeconomicRecordFormProps,
  SocioeconomicRecordFormInitial,
} from './components/socioeconomic-record-form';

// Encaminhamento institucional (USP-037 / SOC-03, AC-037-2) — ativação tácita do
// papel candidato, chamada dentro da tx de `createReferral` (módulo `referrals`).
export { ensureCandidateRole } from './actions/ensure-candidate-role';
export type { EnsureCandidateRoleArgs, EnsureCandidateRoleResult } from './actions/ensure-candidate-role';

// Visão consolidada da Pessoa (USP-039 / SOC-06, SOC-039-MN-01/02).
export {
  canViewConsolidatedPerson,
  CONSOLIDATED_PERSON_ROLES,
} from './domain/consolidated-person';
export type { ConsolidatedPersonRole } from './domain/consolidated-person';
export { viewPersonForSocialAssistant } from './views/view-person-for-social-assistant';
export type {
  ConsolidatedExternalDimensions,
  ConsolidatedPersonView,
} from './views/view-person-for-social-assistant';
export { ConsolidatedPersonPanel } from './components/consolidated-person-panel';
export type { ConsolidatedPersonPanelProps } from './components/consolidated-person-panel';
