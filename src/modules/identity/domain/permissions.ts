import type { PermissionId, Role } from '@prisma/client';
import type { CurrentPerson } from '../server/session';

export type { PermissionId };

/**
 * Mapeamento papel → permissões inerentes (sem delegação explícita).
 * Coordenador tem todas as permissões delegáveis por papel.
 * Assistente Social tem REFER_PERSON_TO_JOB e REGISTER_REFERRAL_RESULT.
 */
const ROLE_PERMISSIONS: Partial<Record<Role, ReadonlySet<PermissionId>>> = {
  COORDINATOR: new Set<PermissionId>([
    'MODERATE_JOB',
    'MODERATE_CV',
    'MODERATE_SERVICE',
    'VALIDATE_COMPANY_FIRST_JOB',
    'INACTIVATE_PUBLISHED_CONTENT',
    'REFER_PERSON_TO_JOB',
    'APPROVE_CATEGORY_SUGGESTION',
    'REGISTER_REFERRAL_RESULT',
    'APPROVE_CREDENTIAL_CLAIM',
  ]),
  SOCIAL_ASSISTANT: new Set<PermissionId>([
    'REFER_PERSON_TO_JOB',
    'REGISTER_REFERRAL_RESULT',
  ]),
};

/** Todas as permissões delegáveis pelo coordenador (catálogo R1 — ADR-0001). */
export const DELEGABLE_PERMISSIONS: ReadonlyArray<PermissionId> = [
  'MODERATE_JOB',
  'MODERATE_CV',
  'MODERATE_SERVICE',
  'VALIDATE_COMPANY_FIRST_JOB',
  'INACTIVATE_PUBLISHED_CONTENT',
  'REFER_PERSON_TO_JOB',
  'APPROVE_CATEGORY_SUGGESTION',
  'REGISTER_REFERRAL_RESULT',
  'APPROVE_CREDENTIAL_CLAIM',
] as const;

export type PermissionCheckResult =
  | { granted: true }
  | { granted: false; reason: 'UNAUTHENTICATED' | 'FORBIDDEN' };

export interface DelegatedGrant {
  permission: PermissionId;
  scopeArea: string | null;
  revokedAt: Date | null;
}

/**
 * Verifica se a pessoa possui a permissão solicitada — via papel inerente
 * ou via delegação explícita não revogada (ADR-0001 / ADR-0030).
 *
 * Não lança. Retorna `{ granted: false }` em vez de throw para compor
 * com a sequência canônica de Server Action.
 */
export function checkPermission(
  person: CurrentPerson | null,
  permission: PermissionId,
  grants: DelegatedGrant[],
  opts: { scopeArea?: string } = {},
): PermissionCheckResult {
  if (!person) return { granted: false, reason: 'UNAUTHENTICATED' };

  // Permissão inerente ao papel
  for (const role of person.roles as Role[]) {
    if (ROLE_PERMISSIONS[role]?.has(permission)) {
      return { granted: true };
    }
  }

  // Permissão delegada explicitamente (não revogada).
  // Escopo fail-closed: um grant restrito a uma área (`scopeArea != null`) só
  // concede quando a action informa exatamente a mesma área. Grant sem escopo
  // (`scopeArea == null`) é irrestrito e cobre qualquer chamada. Nunca tratamos
  // um grant escopado como irrestrito só porque a action omitiu `opts.scopeArea`.
  const active = grants.find(
    (g) =>
      g.permission === permission &&
      g.revokedAt === null &&
      (g.scopeArea == null || g.scopeArea === opts.scopeArea),
  );
  if (active) return { granted: true };

  return { granted: false, reason: 'FORBIDDEN' };
}

/** `true` se a pessoa tem o papel COORDINATOR (pode conceder/revogar delegações). */
export function isCoordinator(person: CurrentPerson): boolean {
  return (person.roles as Role[]).includes('COORDINATOR');
}
