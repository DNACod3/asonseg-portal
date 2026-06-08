import type { PermissionId } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { fail, type ActionResult } from '@/shared/errors';
import { checkPermission, isCoordinator, type DelegatedGrant } from '../domain/permissions';
import { getCurrentPerson, type CurrentPerson } from './session';

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

  // Filtra pela permissão exata no `where` (índice
  // delegated_permissions_person_id_permission_revoked_at_idx). Evita que o
  // `take` descarte silenciosamente o grant relevante quando a pessoa acumula
  // muitas delegações — a correção de autorização não pode depender do limite.
  const rawGrants = await prisma.delegatedPermission.findMany({
    where: { personId: person.id, permission, revokedAt: null },
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

/**
 * Guarda para meta-operações restritas ao COORDINATOR (conceder/revogar
 * delegações — USP-008). Diferente de `requirePermission`, não consulta o
 * catálogo de `PermissionId`: gerir delegações é prerrogativa de papel, não
 * uma permissão delegável. Centraliza a sequência sessão + papel das actions
 * de grant/revoke (passo 2 canônico).
 *
 * Retorna `{ ok:false, error: UNAUTHENTICATED | FORBIDDEN }` — nunca lança.
 */
export async function requireCoordinator(): Promise<ActionResult<{ person: CurrentPerson }>> {
  const person = await getCurrentPerson();
  if (!person) {
    return fail('UNAUTHENTICATED', 'Sessão expirada. Faça login novamente.');
  }
  if (!isCoordinator(person)) {
    return fail('FORBIDDEN', 'Apenas coordenadores podem realizar esta ação.');
  }
  return { ok: true, data: { person } };
}
