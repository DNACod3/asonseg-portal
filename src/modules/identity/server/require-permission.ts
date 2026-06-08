import type { PermissionId } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { fail, type ActionResult } from '@/shared/errors';
import { checkPermission, type DelegatedGrant } from '../domain/permissions';
import { getCurrentPerson } from './session';

/**
 * Guarda de autorização para Server Actions sensíveis (passo 2 da sequência canônica).
 *
 * Resolve a pessoa da sessão, carrega suas delegações ativas do DB e avalia via
 * `checkPermission` (papel inerente + delegação explícita — ADR-0001 / ADR-0030).
 *
 * Retorna `{ ok: false, error: FORBIDDEN | UNAUTHENTICATED }` quando negado —
 * nunca lança, para respeitar o padrão ActionResult.
 *
 * Uso nas actions:
 *   const authz = await requirePermission('MODERATE_JOB');
 *   if (!authz.ok) return authz;
 *   const person = authz.data.person;
 */
export async function requirePermission(
  permission: PermissionId,
  opts: { scopeArea?: string } = {},
): Promise<ActionResult<{ person: NonNullable<Awaited<ReturnType<typeof getCurrentPerson>>> }>> {
  const person = await getCurrentPerson();

  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }

  const rawGrants = await prisma.delegatedPermission.findMany({
    where: { personId: person.id, revokedAt: null },
    select: { permission: true, scopeArea: true, revokedAt: true },
    take: 50,
  });

  const grants: DelegatedGrant[] = rawGrants.map((g) => ({
    permission: g.permission,
    scopeArea: g.scopeArea,
    revokedAt: g.revokedAt,
  }));

  const result = checkPermission(person, permission, grants, opts);

  if (!result.granted) {
    if (result.reason === 'UNAUTHENTICATED') {
      return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
    }
    return fail('FORBIDDEN', 'Você não tem permissão para realizar esta ação.');
  }

  return { ok: true, data: { person } };
}
