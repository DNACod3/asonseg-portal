import { z } from 'zod';
import { normalizeCnpj, isValidCnpj } from '../domain/cnpj';

export const RAZAO_SOCIAL_MAX = 200;
export const NOME_FANTASIA_MAX = 200;
export const SETOR_MAX = 100;
export const DESCRICAO_MAX = 1000;
export const ENDERECO_MAX = 500;

export const createCompanySchema = z.object({
  cnpj: z
    .string()
    .min(1, 'CNPJ é obrigatório.')
    .transform((v) => normalizeCnpj(v))
    .refine(isValidCnpj, 'CNPJ inválido. Verifique o número digitado.'),

  type: z.enum(['CNPJ_REGULAR', 'MEI']).default('CNPJ_REGULAR'),

  razaoSocial: z
    .string()
    .min(2, 'Razão social deve ter ao menos 2 caracteres.')
    .max(RAZAO_SOCIAL_MAX, `Razão social deve ter no máximo ${RAZAO_SOCIAL_MAX} caracteres.`),

  nomeFantasia: z
    .string()
    .min(2, 'Nome fantasia deve ter ao menos 2 caracteres.')
    .max(NOME_FANTASIA_MAX, `Nome fantasia deve ter no máximo ${NOME_FANTASIA_MAX} caracteres.`),

  setor: z
    .string()
    .min(2, 'Setor é obrigatório.')
    .max(SETOR_MAX, `Setor deve ter no máximo ${SETOR_MAX} caracteres.`),

  descricao: z
    .string()
    .max(DESCRICAO_MAX, `Descrição deve ter no máximo ${DESCRICAO_MAX} caracteres.`)
    .optional(),

  endereco: z
    .string()
    .max(ENDERECO_MAX, `Endereço deve ter no máximo ${ENDERECO_MAX} caracteres.`)
    .optional(),

  // Aceite explícito do termo COMPANY_REPRESENTATION (ADR-0020 / ADR-0009).
  // O frontend carrega o termo vigente e envia versão + hash para auditoria.
  companyRepresentationTermVersion: z.string().min(1),
  companyRepresentationTermHash: z.string().length(64),
});

export type CreateCompanyInput = z.input<typeof createCompanySchema>;
export type CreateCompanyData = z.output<typeof createCompanySchema>;
