/**
 * Regras puras da reativação de Pessoa (USP-045 — fluxo inverso da USP-007).
 *
 * Sem IO — apenas a política de autorização e o modelo de hierarquia de papéis.
 * Mesma estrutura de `person-inactivation.ts`: isolado aqui para ser testável
 * sem banco e reutilizável pela Server Action e pelo gate da rota.
 *
 * Decisão central (USP-045/R2 + D-006): reativação **zera grants** — não
 * restaura papéis/delegações automaticamente. A zeragem fica na Server Action
 * (dentro da transação `withAudit`), não aqui — este módulo só decide se o
 * ator está autorizado a iniciar o fluxo.
 *
 * Hierarquia de permissão (USP-045/R1 — "igual ou superior à de quem inativou"):
 *   BOARD (rank 2) > COORDINATOR (rank 1) > demais (rank 0 — sem privilégio)
 *
 * Um ator só pode reativar se `rank(ator) ≥ rank(quem inativou)`.
 */

/**
 * Papéis que conferem, em princípio, privilégio de reativação — mesmos da
 * inativação (USP-007). Filtro grosso para o gate da rota; a decisão fina
 * (hierarquia de rank vs. inativador) é de {@link canReactivatePerson}.
 */
export const PERSON_REACTIVATION_ROLES = ['COORDINATOR', 'BOARD'] as const;

export type PersonReactivationRole = (typeof PERSON_REACTIVATION_ROLES)[number];

/**
 * `true` se algum papel ATIVO do ator dá, em tese, privilégio de reativação.
 * Filtro grosso para o gate da rota; NÃO substitui {@link canReactivatePerson}.
 */
export function hasReactivationPrivilege(roles: readonly string[]): boolean {
  const allowed: readonly string[] = PERSON_REACTIVATION_ROLES;
  return roles.some((role) => allowed.includes(role));
}

/** Motivo da negativa de autorização. */
export type ReactivationDenialReason =
  /** Ator não tem papel institucional para reativar ninguém. */
  | 'NOT_AUTHORIZED'
  /**
   * Ator tem privilégio institucional, mas seu rank é inferior ao de quem
   * realizou a inativação original (USP-045/R1 — não abre por baixo o que
   * foi fechado por cima).
   */
  | 'INSUFFICIENT_RANK';

export type ReactivationAuthz =
  | { allowed: true }
  | { allowed: false; reason: ReactivationDenialReason };

/**
 * Rank numérico de um conjunto de papéis — o mais alto papel aplicável.
 *
 * Só papéis institucionais contam (COORDINATOR, BOARD); papéis públicos não
 * conferem privilégio de gestão de Pessoas. Retorna 0 para papéis desconhecidos
 * ou sem privilégio (inclusive `inactivatedByPersonId` nulo / inativador não
 * encontrado → tratar como rank 0 para não bloquear toda reativação).
 */
export function institutionalRank(roles: readonly string[]): number {
  if (roles.includes('BOARD')) return 2;
  if (roles.includes('COORDINATOR')) return 1;
  return 0;
}

/**
 * Decide se o ator pode reativar o alvo (USP-045/R1 + R2).
 *
 *  - Ator precisa ter `rank ≥ rank do inativador` (para não abrir por baixo).
 *  - Ator sem papel institucional (rank 0) nunca pode reativar.
 *  - Não há restrição de "ninguém reativa a si mesmo": quem está INATIVO não
 *    consegue autenticar (`getCurrentPerson` retorna null), portanto a situação
 *    é impossível — não precisa de guard explícito.
 *
 * @param actorRoles        Papéis ATIVOS do ator (de `getCurrentPerson`).
 * @param inactivatorRoles  Papéis ATIVOS atuais de quem fez a inativação. Passar
 *                          `[]` quando o inativador não for encontrado (tratado
 *                          como rank 0 — qualquer coordenador/diretoria reativa).
 */
export function canReactivatePerson(args: {
  actorRoles: readonly string[];
  inactivatorRoles: readonly string[];
}): ReactivationAuthz {
  const { actorRoles, inactivatorRoles } = args;

  const actorRank = institutionalRank(actorRoles);
  if (actorRank === 0) {
    return { allowed: false, reason: 'NOT_AUTHORIZED' };
  }

  const inactivatorRank = institutionalRank(inactivatorRoles);
  if (actorRank < inactivatorRank) {
    return { allowed: false, reason: 'INSUFFICIENT_RANK' };
  }

  return { allowed: true };
}
