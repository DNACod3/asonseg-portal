'use server';

import { z } from 'zod';
import { AuditEvent, withAudit } from '@/modules/audit';
import { ok, fail, type ActionResult } from '@/shared/errors';
import { childLogger } from '@/shared/lib/logger';
import { getCurrentPerson } from '../server/session';
import { isCoordinator, DELEGABLE_PERMISSIONS } from '../domain/permissions';

const grantSchema = z.object({
  targetPersonId: z.string().uuid('ID de pessoa inválido'),
  permission: z.enum(DELEGABLE_PERMISSIONS as [string, ...string[]]),
  scopeArea: z.string().min(1).max(100).optional(),
});

export type GrantDelegatedPermissionInput = z.infer<typeof grantSchema>;

export interface GrantDelegatedPermissionResult {
  permissionId: string;
  targetPersonId: string;
}

/**
 * Concede uma permissão delegável a um voluntário (USP-008 / IDN-17).
 *
 * Sequência canônica:
 *  1. Valida entrada (Zod)
 *  2. Verifica papel COORDINATOR na sessão
 *  3. Verifica pré-condição: voluntário existe e está ATIVO
 *  4. Executa em withAudit(DELEGATED_PERMISSION_GRANTED)
 *
 * Aplica imediatamente (sem revokedAt). Nunca lança — retorna ActionResult.
 */
export async function grantDelegatedPermission(
  rawInput: GrantDelegatedPermissionInput,
): Promise<ActionResult<GrantDelegatedPermissionResult>> {
  const log = childLogger({ module: 'identity', action: 'grantDelegatedPermission' });

  const parsed = grantSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail('VALIDATION', 'Dados inválidos', parsed.error.flatten().fieldErrors);
  }
  const { targetPersonId, permission, scopeArea } = parsed.data;

  const actor = await getCurrentPerson();
  if (!actor) return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  if (!isCoordinator(actor)) return fail('FORBIDDEN', 'Apenas coordenadores podem conceder permissões.');

  try {
    let permissionId!: string;

    await withAudit(
      AuditEvent.DELEGATED_PERMISSION_GRANTED,
      async (tx, audit) => {
        const target = await tx.person.findUnique({
          where: { id: targetPersonId },
          select: { id: true, status: true, fullName: true },
        });
        if (!target) {
          throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        }
        if (target.status !== 'ATIVO') {
          throw Object.assign(new Error('PRECONDITION_FAILED'), { code: 'PRECONDITION_FAILED' });
        }

        const grant = await tx.delegatedPermission.create({
          data: {
            personId: targetPersonId,
            permission: permission as Parameters<typeof tx.delegatedPermission.create>[0]['data']['permission'],
            scopeArea: scopeArea ?? null,
            grantedBy: actor.id,
          },
          select: { id: true },
        });

        permissionId = grant.id;
        audit.entityType = 'delegated_permission';
        audit.entityId = grant.id;
        audit.after = { targetPersonId, permission, scopeArea: scopeArea ?? null, grantedBy: actor.id };
      },
      { actorPersonId: actor.id },
    );

    log.info({ actorId: actor.id, targetPersonId, permission }, 'identity:permission_granted');
    return ok({ permissionId, targetPersonId });
  } catch (err) {
    if (err instanceof Error) {
      if ((err as NodeJS.ErrnoException).code === 'NOT_FOUND') {
        return fail('NOT_FOUND', 'Voluntário não encontrado.');
      }
      if ((err as NodeJS.ErrnoException).code === 'PRECONDITION_FAILED') {
        return fail('PRECONDITION_FAILED', 'Não é possível conceder permissão a uma pessoa inativa.');
      }
    }
    log.error({ err }, 'identity:grant_permission_failed');
    return fail('INTERNAL', 'Não foi possível conceder a permissão. Tente novamente.');
  }
}
