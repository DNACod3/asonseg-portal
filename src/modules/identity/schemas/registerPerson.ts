import { z } from 'zod';

// ── Validação de CPF ──────────────────────────────────────────────────────────
// Algoritmo oficial: dois dígitos verificadores calculados por peso decrescente.
// Rejeita sequências iguais (111.111.111-11) que passam no formato mas são
// documentalmente inválidas.

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(digits[i]) * (len + 1 - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

// Aceita CPF com ou sem pontuação (normaliza internamente para dígitos).
export const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidCpf, { message: 'CPF inválido (formato ou dígito verificador)' });

// ── Papéis públicos disponíveis no auto-cadastro ──────────────────────────────
// Somente papéis que uma Pessoa pode escolher ao se cadastrar publicamente.
// Papéis internos (COORDINATOR, SOCIAL_ASSISTANT, BOARD, VOLUNTEER) são
// concedidos pela AS — não aparecem aqui (toca P-007 das expectations).
export const PUBLIC_ROLES = ['CANDIDATE', 'PROVIDER', 'CLIENT'] as const;
export type PublicRole = (typeof PUBLIC_ROLES)[number];

// ── Schema do formulário de auto-cadastro ─────────────────────────────────────
export const registerPersonSchema = z.object({
  fullName: z
    .string()
    .min(3, 'Nome deve ter ao menos 3 caracteres')
    .max(150, 'Nome deve ter no máximo 150 caracteres')
    .trim(),

  cpf: cpfSchema,

  email: z
    .string()
    .email('E-mail inválido')
    .max(255, 'E-mail deve ter no máximo 255 caracteres')
    .transform((v) => v.toLowerCase().trim()),

  password: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .max(72, 'Senha deve ter no máximo 72 caracteres'), // Limite bcrypt

  role: z.enum(PUBLIC_ROLES, { message: 'Papel inválido' }),

  captchaToken: z.string().min(1, 'CAPTCHA obrigatório'),
});

export type RegisterPersonInput = z.infer<typeof registerPersonSchema>;

// ── Schema da 2ª transação: aceite da finalidade do papel ────────────────────
export const acceptRoleConsentSchema = z.object({
  personId: z.string().uuid('personId inválido'),
  role: z.enum(PUBLIC_ROLES, { message: 'Papel inválido' }),
  termVersion: z.string().min(1),
  termContentHash: z.string().min(1),
});

export type AcceptRoleConsentInput = z.infer<typeof acceptRoleConsentSchema>;

// ── Mapeamento papel → finalidade de consentimento LGPD ──────────────────────
// Fonte de verdade única: tanto TX1 quanto TX2 devem importar daqui.
export const ROLE_PURPOSE_MAP = {
  CANDIDATE: 'JOB_APPLICATION',
  PROVIDER: 'SERVICE_OFFERING',
  CLIENT: 'SERVICE_HIRING',
} as const satisfies Record<PublicRole, string>;

export type RolePurpose = (typeof ROLE_PURPOSE_MAP)[PublicRole];
