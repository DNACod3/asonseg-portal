import { z } from 'zod';
import { DELEGABLE_PERMISSIONS } from '../domain/permissions';

/**
 * Entrada de `grantDelegatedPermission` (USP-008 / IDN-17).
 *
 * `permission` é restrito ao catálogo finito `DELEGABLE_PERMISSIONS`
 * (`domain/permissions.ts`) — fonte única, não duplicada aqui.
 *
 * Extraído do schema inline da action para a convenção do módulo
 * (`schemas/*.schema.ts`) — movimento mecânico, comportamento-preservador
 * (mesmas regras Zod, mesmas mensagens).
 */
export const grantDelegatedPermissionSchema = z.object({
  targetPersonId: z.string().uuid('ID de pessoa inválido'),
  permission: z.enum(DELEGABLE_PERMISSIONS as [string, ...string[]]),
  scopeArea: z.string().min(1).max(100).optional(),
});

export type GrantDelegatedPermissionInput = z.infer<typeof grantDelegatedPermissionSchema>;

/**
 * Entrada de `revokeDelegatedPermission` (USP-008 / IDN-18).
 *
 * `justification` é exigida (append-only para auditoria — a action nunca
 * deleta o registro, só marca `revokedAt`/`revokedBy`).
 *
 * Extraído do schema inline da action para a convenção do módulo
 * (`schemas/*.schema.ts`) — movimento mecânico, comportamento-preservador
 * (mesmas regras Zod, mesmas mensagens).
 */
export const revokeDelegatedPermissionSchema = z.object({
  permissionGrantId: z.string().uuid('ID de concessão inválido'),
  justification: z.string().min(10, 'Justificativa deve ter ao menos 10 caracteres'),
});

export type RevokeDelegatedPermissionInput = z.infer<typeof revokeDelegatedPermissionSchema>;
