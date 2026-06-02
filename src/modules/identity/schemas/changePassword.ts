import { z } from 'zod';

/**
 * Schema de troca de senha no 1º acesso (USP-004 — T-09, AC-004-5).
 *
 * No 1º acesso não exigimos a senha atual (o usuário já está autenticado pela
 * sessão recém-criada). Pede senha nova + confirmação, com piso de 8 e um
 * mínimo de força (letras + dígitos) para não regredir a credencial provisória.
 */
export const changePasswordFirstAccessSchema = z
  .object({
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

export type ChangePasswordFirstAccessInput = z.infer<typeof changePasswordFirstAccessSchema>;
