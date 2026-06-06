// Fact (P2 — validação de fronteira como schema versionado).
// USP-004 — input da Server Action de login.
// Destino real: src/modules/identity/schemas/signInInput.ts
//
// Observações de domínio:
// - O Server Action de login NÃO chama requirePermission (é ação pública, pré-autenticação).
//   Ver project-guideline §"ação pública" — exceção justificada à regra do padrão canônico.
// - email_login é unique em `persons` (technical-design §2.1).

import { z } from 'zod'

export const signInInputSchema = z.object({
  email: z
    .string({ required_error: 'E-mail é obrigatório' })
    .trim()
    .toLowerCase()
    .email('E-mail inválido')
    .max(254), // RFC 5321
  password: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(1, 'Senha é obrigatória')
    .max(128),
  // Token do Cloudflare Turnstile — exigido apenas após 3 falhas do mesmo IP (ADR-0014).
  // Opcional no schema; a obrigatoriedade condicional é regra de negócio na Action.
  captchaToken: z.string().optional(),
})

export type SignInInput = z.infer<typeof signInInputSchema>

// Catálogo finito de códigos de erro retornados pela Action de login (ActionResult).
// Mensagens genéricas por design (AC-004-2): nunca revelar se foi e-mail ou senha.
export const SignInErrorCode = {
  VALIDATION: 'VALIDATION',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS', // AC-004-2 — mensagem: "Credenciais inválidas"
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS', // AC-004-3 — bloqueio 5/15min
  CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED', // ADR-0014 — após 3 falhas/IP
} as const

export type SignInErrorCode = (typeof SignInErrorCode)[keyof typeof SignInErrorCode]
