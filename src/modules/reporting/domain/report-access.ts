import { checkPermission, type CurrentPerson, type DelegatedGrant, type PermissionId } from '@/modules/identity';

/**
 * Guards puros de papel para os relatórios operacionais (USP-042 / design.md
 * §3 — a decisão central desta USP). Sem IO: recebem papéis/grants já
 * resolvidos e decidem `true`/`false`. A busca de grants (Prisma) fica com o
 * chamador (query/rota) — mesmo desenho de `checkPermission` (identity).
 *
 * `PermissionId` não existe hoje para relatório (nem `VIEW_OPERATIONAL_REPORTS`
 * nem `VIEW_SOCIAL_REPORTS`) — decisão registrada em design.md §3: guard
 * inline por papel, sem estender o enum (precedente AD-022/USP-036
 * `canManageSocioeconomicRecord`, AD-015/USP-003). A única exceção é R5 (fila
 * de moderação), que reusa `checkPermission` com as permissões `MODERATE_*`
 * já delegáveis (P-006) — é o único relatório com superfície de delegação.
 */

/** R1..R4 — coordenador (escopo próprio) e diretoria (geral). */
export const OPERATIONAL_REPORT_ROLES = ['COORDINATOR', 'BOARD'] as const;

/** R6 — assistente social e diretoria (dado social sensível). */
export const SOCIAL_REPORT_ROLES = ['SOCIAL_ASSISTANT', 'BOARD'] as const;

/**
 * Permissões de catálogo que dão acesso ao relatório de fila (R5) — P-006.
 * Exportada — é a fonte única também para `getModerationGrants`
 * (`queries/moderation-grants.ts`), que resolve o `DelegatedPermission.findMany`
 * usado pelos 3 chamadores de `isReportTypeAuthorized`/
 * `canViewModerationQueueReport` (rotas `relatorios/page.tsx`,
 * `relatorios/[tipo]/page.tsx` e a Server Action `exportReport`).
 */
export const MODERATION_QUEUE_PERMISSIONS: readonly PermissionId[] = [
  'MODERATE_JOB',
  'MODERATE_CV',
  'MODERATE_SERVICE',
];

/** `true` se algum papel ATIVO autoriza os relatórios operacionais R1..R4 (E-001). */
export function canViewOperationalReports(roles: readonly string[]): boolean {
  const allowed: readonly string[] = OPERATIONAL_REPORT_ROLES;
  return roles.some((role) => allowed.includes(role));
}

/** `true` se algum papel ATIVO autoriza o relatório social R6 (E-001 / REL42-MN-05). */
export function canViewSocialReports(roles: readonly string[]): boolean {
  const allowed: readonly string[] = SOCIAL_REPORT_ROLES;
  return roles.some((role) => allowed.includes(role));
}

/**
 * `true` se a Pessoa pode ver o relatório de fila de moderação (R5 —
 * REL42-MN-02): `BOARD` (diretoria, sem permissão de catálogo — design.md
 * §3) **ou** alguma das `MODERATE_JOB`/`MODERATE_CV`/`MODERATE_SERVICE` via
 * `checkPermission` (papel inerente do COORDINATOR **ou** delegação ativa de
 * um voluntário — P-006). `person=null` (anônimo/sem sessão) → sempre `false`.
 */
export function canViewModerationQueueReport(
  person: CurrentPerson | null,
  grants: readonly DelegatedGrant[],
): boolean {
  if (!person) return false;
  if (person.roles.includes('BOARD')) return true;
  return MODERATION_QUEUE_PERMISSIONS.some(
    (permission) => checkPermission(person, permission, [...grants]).granted,
  );
}
