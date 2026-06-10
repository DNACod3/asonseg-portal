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

// Componentes de UI da inativação (USP-007) e reativação (USP-045).
export { InactivatePersonDialog } from './components/inactivate-person-dialog';
export { ReactivatePersonDialog } from './components/reactivate-person-dialog';
