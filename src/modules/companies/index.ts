// Barrel do módulo `companies` (USP-012 — ADR-0015).
// Todos os imports externos devem passar por este arquivo (nunca deep paths).

// ── Domínio ───────────────────────────────────────────────────────────────────
export { normalizeCnpj, isValidCnpj, formatCnpj } from './domain/cnpj';

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

// ── Actions ───────────────────────────────────────────────────────────────────
export { createCompany } from './actions/create-company';
export type { CreateCompanyResult } from './actions/create-company';
export { adicionarResponsavel } from './actions/add-responsible';
export type { AddResponsibleResult } from './actions/add-responsible';

// ── Adapters ──────────────────────────────────────────────────────────────────
export { PrismaCompanyResponsibilityAdapter } from './adapters/prisma-company-responsibility';

// ── Componentes ───────────────────────────────────────────────────────────────
export { CreateCompanyForm } from './components/create-company-form';
export type { CreateCompanyFormProps } from './components/create-company-form';
