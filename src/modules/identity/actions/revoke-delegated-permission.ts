'use server';

import { z } from 'zod';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { getCurrentPerson } from '../server/session';
import { isCoordinator } from '../domain/permissions';

const revokeSchema = z.object({
  permissionGrantId: z.string().uuid('ID de concessão inválido'),
  justification: z.string().min(10, 'Justificativa deve ter ao menos 10 caracteres'),
});

export type RevokeDelegatedPermissionInput = z.infer<typeof revokeSchema>;

export interface RevokeDelegatedPermissionResult {
  permissionGrantId: string;
}

/**
 * Revoga uma permissão delegada (USP-008 / IDN-18).
 *
 * Preenche `revokedAt`/`revokedBy` — efeito no próximo carregamento do voluntário
 * (ADR-0030). Nunca deleta o registro (append-only para auditoria).
 */
export async function revokeDelegatedPermission(
  rawInput: RevokeDelegatedPermissionInput,
): Promise<ActionResult<RevokeDelegatedPermissionResult>> {
  const log = childLogger({ module: 'identity', action: 'revokeDelegatedPermission' });

  const parsed = revokeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { permissionGrantId, justification } = parsed.data;

  const actor = await getCurrentPerson();
  if (!actor) return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  if (!isCoordinator(actor)) return fail('FORBIDDEN', 'Apenas coordenadores podem revogar permissões.');

  try {
    await withAudit(
      AuditEvent.DELEGATED_PERMISSION_REVOKED,
      async (tx, audit) => {
        const grant = await tx.delegatedPermission.findUnique({
          where: { id: permissionGrantId },
          select: { id: true, personId: true, permission: true, revokedAt: true },
        });
        if (!grant) {
          throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        }
        if (grant.revokedAt !== null) {
          throw Object.assign(new Error('CONFLICT'), { code: 'CONFLICT' });
        }

        const now = new Date();
        await tx.delegatedPermission.update({
          where: { id: permissionGrantId },
          data: { revokedAt: now, revokedBy: actor.id },
          select: { id: true },
        });

        audit.entityType = 'delegated_permission';
        audit.entityId = permissionGrantId;
        audit.before = { revokedAt: null };
        audit.after = { revokedAt: now, revokedBy: actor.id };
        audit.justification = justification;
      },
      { actorPersonId: actor.id },
    );

    log.info({ actorId: actor.id, permissionGrantId }, 'identity:permission_revoked');
    return ok({ permissionGrantId });
  } catch (err) {
    if (err instanceof Error) {
      if ((err as NodeJS.ErrnoException).code === 'NOT_FOUND') {
        return fail('NOT_FOUND', 'Concessão não encontrada.');
      }
      if ((err as NodeJS.ErrnoException).code === 'CONFLICT') {
        return fail('CONFLICT', 'Esta permissão já foi revogada.');
      }
    }
    log.error({ err }, 'identity:revoke_permission_failed');
    return fail('INTERNAL', 'Não foi possível revogar a permissão. Tente novamente.');
  }
}
