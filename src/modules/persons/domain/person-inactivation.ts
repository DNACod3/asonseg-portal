/**
 * Regras puras da inativação de Pessoa (USP-007 / IDN-15, IDN-16).
 *
 * Sem IO — apenas a política de autorização institucional. Isolar aqui mantém a
 * regra testável sem banco e reaproveitável pela Server Action e pelo gate da
 * rota `(app)/pessoas/[id]`.
 *
 * O RBAC delegado (`requirePermission()`) só chega numa USP posterior; até lá
 * esta política é a fonte de verdade da permissão deste fluxo (mesmo padrão de
 * `assisted-registration` na USP-002).
 */

/**
 * Papéis institucionais que podem, em princípio, inativar uma Pessoa:
 *  - `BOARD` (diretoria) — qualquer Pessoa;
 *  - `COORDINATOR` (coordenador) — apenas voluntários (ver {@link canInactivatePerson}).
 *
 * Usado pelo gate da rota como filtro grosso (defesa em profundidade). A decisão
 * fina, sensível ao alvo, é de {@link canInactivatePerson}.
 */
export const PERSON_INACTIVATION_ROLES = ['COORDINATOR', 'BOARD'] as const;

export type PersonInactivationRole = (typeof PERSON_INACTIVATION_ROLES)[number];

/** Motivo da negativa de autorização (o caller mapeia para mensagem PT-BR). */
export type InactivationDenialReason =
  /** Ator não tem papel institucional para inativar ninguém. */
  | 'NOT_AUTHORIZED'
  /** Ator é coordenador, mas o alvo não é voluntário (fora do seu escopo). */
  | 'COORDINATOR_SCOPE'
  /** Ator tentou inativar a si mesmo (trava de segurança — perderia o acesso no meio da operação). */
  | 'SELF_INACTIVATION';

export type InactivationAuthz =
  | { allowed: true }
  | { allowed: false; reason: InactivationDenialReason };

/**
 * `true` se algum papel ATIVO do ator dá, em tese, privilégio de inativação.
 * Filtro grosso para o gate da rota; NÃO substitui {@link canInactivatePerson}
 * (que decide olhando também o alvo). Recebe papéis ativos de `getCurrentPerson`.
 */
export function hasInactivationPrivilege(roles: readonly string[]): boolean {
  const allowed: readonly string[] = PERSON_INACTIVATION_ROLES;
  return roles.some((role) => allowed.includes(role));
}

/**
 * Decide se o ator pode inativar o alvo (E-001 / política do intent).
 *
 *  - **Diretoria (`BOARD`)** inativa qualquer Pessoa.
 *  - **Coordenador (`COORDINATOR`)** inativa apenas voluntários (`VOLUNTEER`).
 *  - Ninguém inativa a si mesmo (trava de segurança — sairia da própria sessão
 *    no meio da transação; reativação seria por terceiro — USP-045).
 *
 * **Limitação consciente (sem modelo de área ainda):** o intent fala em
 * "coordenador da *sua* área". Como não há modelo de área/lotação no MVP, o
 * escopo do coordenador é "qualquer voluntário", não "voluntário da minha área".
 * Quando o modelo de área existir, basta apertar esta regra (e seus testes) —
 * a Server Action não muda.
 */
export function canInactivatePerson(args: {
  actorId: string;
  actorRoles: readonly string[];
  targetId: string;
  targetRoles: readonly string[];
}): InactivationAuthz {
  const { actorId, actorRoles, targetId, targetRoles } = args;

  if (actorId === targetId) {
    return { allowed: false, reason: 'SELF_INACTIVATION' };
  }

  if (actorRoles.includes('BOARD')) {
    return { allowed: true };
  }

  if (actorRoles.includes('COORDINATOR')) {
    return targetRoles.includes('VOLUNTEER')
      ? { allowed: true }
      : { allowed: false, reason: 'COORDINATOR_SCOPE' };
  }

  return { allowed: false, reason: 'NOT_AUTHORIZED' };
}
