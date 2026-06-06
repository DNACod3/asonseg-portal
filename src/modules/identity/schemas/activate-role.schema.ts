import { z } from 'zod';
import { PUBLIC_ROLES } from './registerPerson';

/**
 * Entrada de `activateAdditionalRole` (USP-006).
 *
 * **P-002 (sequestro lateral):** NÃO há `personId` no input — a action opera
 * exclusivamente sobre a Pessoa autenticada da sessão (`getCurrentPerson`).
 *
 * `termVersion`/`termContentHash` são a prova de aceite do termo da finalidade
 * (carregado e validado server-side na página — padrão da TX2 `acceptRoleConsent`).
 * `acceptTerm` exige o aceite explícito (`true`); `profile` traz apenas os campos
 * faltantes do perfil (a obrigatoriedade efetiva é decidida na action, contra o
 * estado atual da Pessoa — só os campos realmente ausentes são exigidos).
 */
export const activateAdditionalRoleSchema = z.object({
  role: z.enum(PUBLIC_ROLES, { message: 'Papel inválido' }),
  termVersion: z.string().min(1, 'Versão do termo ausente'),
  termContentHash: z.string().min(1, 'Hash do termo ausente'),
  acceptTerm: z.literal(true, { message: 'É necessário aceitar o termo da finalidade' }),
  profile: z
    .object({
      phone: z
        .string()
        .trim()
        .min(8, 'Telefone inválido')
        .max(20, 'Telefone muito longo')
        .optional(),
      fullAddress: z
        .string()
        .trim()
        .min(5, 'Endereço muito curto')
        .max(255, 'Endereço muito longo')
        .optional(),
    })
    .default({}),
});

export type ActivateAdditionalRoleInput = z.infer<typeof activateAdditionalRoleSchema>;
