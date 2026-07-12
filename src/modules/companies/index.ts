// Barrel do módulo `companies` (USP-012 — ADR-0015).
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Domínio ───────────────────────────────────────────────────────────────────
export { normalizeCnpj, isValidCnpj, formatCnpj } from './domain/cnpj';
export { COMPANY_TYPES, COMPANY_TYPE_LABELS, COMPANY_TYPE_OPTIONS } from './domain/company-type';
export type { CompanyType } from './domain/company-type';
export { identityFieldsChanged } from './domain/company-edit';
export type { CompanyIdentityFields } from './domain/company-edit';
export { COMPANY_GRANT_STATUS_LABELS } from './domain/company-grant-status-labels';
export {
  buildVerificationSnapshot,
  diffVerificationSnapshot,
} from './domain/company-verification';
export type {
  CompanyVerificationSnapshot,
  CompanyVerificationFields,
  SnapshotField,
} from './domain/company-verification';

// ── Schemas ───────────────────────────────────────────────────────────────────
export {
  createCompanySchema,
  RAZAO_SOCIAL_MAX,
  NOME_FANTASIA_MAX,
  SETOR_MAX,
  DESCRICAO_MAX,
  ENDERECO_MAX,
} from './schemas/create-company.schema';
export type { CreateCompanyInput, CreateCompanyData } from './schemas/create-company.schema';
export { addResponsibleSchema, classifyIdentifier } from './schemas/add-responsible.schema';
export type {
  AddResponsibleInput,
  AddResponsibleData,
  ResponsibleIdentifier,
} from './schemas/add-responsible.schema';
export { acceptResponsibleLinkSchema } from './schemas/accept-responsible-link.schema';
export type {
  AcceptResponsibleLinkInput,
  AcceptResponsibleLinkData,
} from './schemas/accept-responsible-link.schema';
export { removeResponsibleSchema, MOTIVO_MAX } from './schemas/remove-responsible.schema';
export type {
  RemoveResponsibleInput,
  RemoveResponsibleData,
} from './schemas/remove-responsible.schema';
export { editCompanySchema } from './schemas/edit-company.schema';
export type { EditCompanyInput, EditCompanyData } from './schemas/edit-company.schema';

// ── Actions ───────────────────────────────────────────────────────────────────
export { createCompany } from './actions/create-company';
export type { CreateCompanyResult } from './actions/create-company';
export { adicionarResponsavel } from './actions/add-responsible';
export type { AddResponsibleResult } from './actions/add-responsible';
export { aceitarVinculoResponsavel } from './actions/accept-responsible-link';
export type { AcceptResponsibleLinkResult } from './actions/accept-responsible-link';
export { removerResponsavel } from './actions/remove-responsible';
export type { RemoveResponsibleResult } from './actions/remove-responsible';
export { editarEmpresa } from './actions/edit-company';
export type { EditCompanyResult } from './actions/edit-company';

// ── Queries ───────────────────────────────────────────────────────────────────
export { listPendingResponsibleLinks } from './queries/list-pending-responsible-links';
export type { PendingResponsibleLink } from './queries/list-pending-responsible-links';
export { listActiveResponsibles } from './queries/list-active-responsibles';
export type { ActiveResponsible } from './queries/list-active-responsibles';
export {
  listPersonCompanyGrants,
  PERSON_COMPANY_GRANTS_PAGE_SIZE,
  type PersonCompanyGrantRow,
} from './queries/list-person-company-grants';
export {
  listCompanyRejections,
  listCompanyRejectionsByCompany,
} from './queries/list-company-rejections';
export type { CompanyRejection } from './queries/list-company-rejections';

// ── Views ───────────────────────────────────────────────────────────────────
export { viewCompanyVerificationContexts } from './views/view-company-verification';
export type { CompanyVerificationContext } from './views/view-company-verification';

// ── Adapters ──────────────────────────────────────────────────────────────────
export { PrismaCompanyResponsibilityAdapter } from './adapters/prisma-company-responsibility';

// ── Componentes ───────────────────────────────────────────────────────────────
export { CreateCompanyForm } from './components/create-company-form';
export type { CreateCompanyFormProps } from './components/create-company-form';
export { AddResponsibleForm } from './components/add-responsible-form';
export type { AddResponsibleFormProps } from './components/add-responsible-form';
export { PendingResponsibleLinksList } from './components/pending-responsible-links-list';
export { RemoveResponsibleDialog } from './components/remove-responsible-dialog';
export type { RemoveResponsibleDialogProps } from './components/remove-responsible-dialog';
export { EditCompanyForm } from './components/edit-company-form';
export type { EditCompanyFormProps } from './components/edit-company-form';
