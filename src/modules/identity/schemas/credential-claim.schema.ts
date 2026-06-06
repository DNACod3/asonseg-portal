import { z } from 'zod';
import { isValidCpf } from './registerPerson';

/**
 * Schemas da reivindicação de credencial (USP-003 / IDN-07, IDN-08).
 *
 *  - `requestCredentialClaimSchema` — fluxo público: a Pessoa pré-cadastrada (ou
 *    familiar autorizado) informa CPF (ou identificador alternativo), o e-mail
 *    desejado e o meio de verificação pretendido (E-001).
 *  - `verifyCredentialClaimSchema` — fluxo interno: AS/diretoria confirma a
 *    verificação registrando o meio efetivamente utilizado (E-002 / P-001).
 *
 * O CPF é normalizado (remove máscara) e validado pelo dígito verificador, igual
 * ao auto-cadastro. A senha NUNCA trafega aqui: ela é definida pela própria
 * Pessoa, depois da ativação, via link de definição de senha (reuso da USP-005).
 */

/** Meios de verificação de identidade aceitos (D-011 — manual pela AS). */
export const CREDENTIAL_VERIFICATION_METHODS = [
  'IN_PERSON',
  'AS_CONFIRMATION',
  'CODE_BY_MAIL',
] as const;

export type CredentialVerificationMethod = (typeof CREDENTIAL_VERIFICATION_METHODS)[number];

/** Rótulos PT-BR dos meios de verificação (UI + e-mail). */
export const VERIFICATION_METHOD_LABELS: Record<CredentialVerificationMethod, string> = {
  AS_CONFIRMATION: 'Confirmação pela assistente social',
  IN_PERSON: 'Presencial',
  CODE_BY_MAIL: 'Código enviado por carta',
};

/**
 * Resposta genérica do fluxo público de solicitação (P-006 — anti-enumeração).
 * Retornada em TODOS os caminhos de sucesso/no-op: existindo ou não a Pessoa, o
 * solicitante recebe a mesma mensagem e não consegue inferir quem está cadastrado.
 */
export const GENERIC_CLAIM_REQUEST_MESSAGE =
  'Recebemos sua solicitação. Se os dados corresponderem a um cadastro elegível, ' +
  'nossa equipe fará a verificação de identidade e entrará em contato para concluir a ' +
  'ativação da sua credencial.';

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .max(255, 'E-mail deve ter no máximo 255 caracteres');

const verificationMethodField = z.enum(CREDENTIAL_VERIFICATION_METHODS, {
  message: 'Meio de verificação inválido',
});

export const requestCredentialClaimSchema = z
  .object({
    // CPF opcional: aceita com/sem máscara; "" vira `undefined` antes de validar.
    cpf: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, '') : undefined))
      .refine((v) => v === undefined || isValidCpf(v), {
        message: 'CPF inválido (formato ou dígito verificador)',
      }),

    // Identificador alternativo (ex.: protocolo de atendimento) quando a Pessoa
    // foi cadastrada sob exceção de CPF (USP-002). Usado pela AS no casamento
    // manual com a Pessoa pré-existente (P-002).
    alternativeIdentifier: z
      .string()
      .trim()
      .max(150, 'Identificador deve ter no máximo 150 caracteres')
      .optional()
      .transform((v) => v || undefined),

    requestedEmail: emailField,

    verificationMethod: verificationMethodField,

    // CAPTCHA obrigatório (ADR-0014): endpoint público de identidade — contém
    // mail-bombing e enumeração por volume, mesma exigência do auto-cadastro e
    // da recuperação de senha. Verificado fail-closed na Server Action.
    captchaToken: z.string().min(1, 'CAPTCHA obrigatório'),
  })
  .superRefine((data, ctx) => {
    if (!data.cpf && !data.alternativeIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cpf'],
        message: 'Informe o CPF ou um identificador alternativo da Pessoa cadastrada.',
      });
    }
  });

/** Tipo de entrada (o que o formulário/caller envia). */
export type RequestCredentialClaimInput = z.input<typeof requestCredentialClaimSchema>;
/** Tipo de saída (normalizado, após o parse). */
export type RequestCredentialClaimData = z.output<typeof requestCredentialClaimSchema>;

export const verifyCredentialClaimSchema = z.object({
  claimId: z.string().uuid('Solicitação inválida'),
  // Meio efetivamente utilizado na verificação — gravado no log (P-001 / E-002).
  verificationMethod: verificationMethodField,
});

export type VerifyCredentialClaimInput = z.infer<typeof verifyCredentialClaimSchema>;
