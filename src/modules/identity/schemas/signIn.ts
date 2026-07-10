import { z } from 'zod';

/**
 * Mensagem única exibida na UI para qualquer falha de autenticação — e-mail
 * inexistente, senha errada, lockout ativo ou Pessoa inativa (P-001 / D-G:
 * anti-enumeração). Vive aqui (e não na action `'use server'`, que só pode
 * exportar funções async) para ser reutilizável por server e cliente.
 */
export const GENERIC_AUTH_ERROR = 'Credenciais inválidas. Verifique e tente novamente.';

/**
 * Schema de entrada do login (USP-004 — T-06, design.md §4).
 *
 * `email` é normalizado (lowercase + trim) já na validação, garantindo a chave
 * canônica usada no lockout `(email, ip)` e na busca da Pessoa (ADR-0021).
 * O limite de 128 chars na senha evita payloads abusivos; o piso de 8 alinha-se
 * ao mínimo do auto-cadastro (USP-001).
 */
export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Informe o e-mail')
    .max(255, 'E-mail muito longo')
    .email('E-mail inválido')
    .transform((v) => v.toLowerCase().trim()),

  senha: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres')
    .max(128, 'Senha muito longa'),

  /**
   * Token Turnstile — opcional (caminho feliz não envia). Só é exigido pela
   * `loginAction` quando a chave `(email, ip)` cruza `CAPTCHA_CHALLENGE_THRESHOLD`
   * falhas recentes (H1, Fase 6 — hardening; ADR-0014).
   */
  captchaToken: z.string().min(1).optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
