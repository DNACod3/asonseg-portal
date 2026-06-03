import { z } from 'zod';

/**
 * Schemas da recuperação de senha (USP-005 — IDN-12/IDN-13).
 *
 * Dois passos: (1) solicitar o link por e-mail; (2) redefinir a senha via token
 * do link. A mensagem de solicitação é sempre genérica (anti-enumeração — não
 * revela se o e-mail existe).
 */

/** Validade do link de redefinição, em horas (AC: 24h). Espelha `otp_expiry` do GoTrue. */
export const RESET_LINK_EXPIRY_HOURS = 24;

/**
 * Mensagem genérica única de confirmação da solicitação. Idêntica para e-mail
 * existente e inexistente — requisito de anti-enumeração da USP-005.
 */
export const GENERIC_RESET_REQUEST_MESSAGE =
  'Se houver uma conta associada a este e-mail, você receberá um link para redefinir a senha.';

/** Solicitação: apenas o e-mail (normalizado para lowercase + trim). */
export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido'),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Redefinição: token (do link) + nova senha + confirmação. Mesma política de
 * força da troca no 1º acesso (mín. 8, letras + dígitos — USP-004).
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Link inválido ou ausente'),
    senhaNova: z
      .string()
      .min(8, 'A senha deve ter ao menos 8 caracteres')
      .max(128, 'Senha muito longa')
      .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
      .regex(/[0-9]/, 'A senha deve conter ao menos um número'),
    confirmar: z.string(),
  })
  .refine((d) => d.senhaNova === d.confirmar, {
    message: 'As senhas não conferem',
    path: ['confirmar'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
