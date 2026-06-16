import { z } from 'zod';
import { normalizeCnpj, isValidCnpj } from '../domain/cnpj';
import {
  RAZAO_SOCIAL_MAX,
  NOME_FANTASIA_MAX,
  SETOR_MAX,
  DESCRICAO_MAX,
  ENDERECO_MAX,
} from './create-company.schema';

/**
 * Schema de edição de Empresa (USP-015 / #141).
 *
 * Reusa os mesmos validadores de campo de `createCompanySchema` (normalização e
 * dígitos do CNPJ via `domain/cnpj`, trims/limites de tamanho) e adiciona
 * `empresaId: uuid`. `isVerified` **não** é campo de entrada — o rebaixamento é
 * decidido pelo sistema na action (D-015-C), nunca enviado pelo cliente.
 *
 * `type` é **obrigatório** na edição (sem `.default`): a action sempre grava
 * `type` no UPDATE, então um payload sem o campo rebaixaria silenciosamente o
 * regime tributário de uma Empresa `MEI`/`LUCRO_REAL` para `SIMPLES_NACIONAL`.
 * O formulário sempre o pré-preenche, então exigi-lo não afeta a UX.
 */
export const editCompanySchema = z.object({
  empresaId: z.string().uuid('Identificador de empresa inválido.'),

  cnpj: z
    .string()
    .min(1, 'CNPJ é obrigatório.')
    .transform((v) => normalizeCnpj(v))
    .refine(isValidCnpj, 'CNPJ inválido. Verifique o número digitado.'),

  type: z.enum(['MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'SA'], {
    required_error: 'Tipo de empresa é obrigatório.',
    invalid_type_error: 'Tipo de empresa inválido.',
  }),

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
});

export type EditCompanyInput = z.input<typeof editCompanySchema>;
export type EditCompanyData = z.output<typeof editCompanySchema>;
