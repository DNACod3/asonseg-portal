'use server';

import { z } from 'zod';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { requireCoordinator } from '../server/require-permission';

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

  const authz = await requireCoordinator();
  if (!authz.ok) return authz;
  const actor = authz.data.person;

  try {
    await withAudit(
      AuditEvent.DELEGATED_PERMISSION_REVOKED,
      async (tx, audit) => {
        const grant = await tx.delegatedPermission.findUnique({
          where: { id: permissionGrantId },
          select: { id: true },
        });
        if (!grant) {
          throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        }

        // Guard atômico de concorrência (duplo submit): mesmo padrão de
        // `reactivatePerson` — `updateMany` condicional ao estado atual
        // (`revokedAt: null`). Sob duas revogações simultâneas, só uma casa
        // a linha; o perdedor casa 0 linhas e vira CONFLICT. Evita o
        // check-then-update que, sob READ COMMITTED, deixaria ambas passar.
        const now = new Date();
        const transition = await tx.delegatedPermission.updateMany({
          where: { id: permissionGrantId, revokedAt: null },
          data: { revokedAt: now, revokedBy: actor.id },
        });
        if (transition.count === 0) {
          throw Object.assign(new Error('CONFLICT'), { code: 'CONFLICT' });
        }

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
