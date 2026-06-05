/**
 * Regras puras do cadastro assistido pela assistente social (USP-002).
 *
 * Sem IO — apenas a política de autorização institucional e o limite mínimo da
 * justificativa de exceção de CPF. Isolar aqui mantém a regra testável sem banco
 * e reaproveitável pela Server Action e pelo gate da rota `(app)/cadastro-assistido`.
 */

/**
 * Papéis institucionais autorizados a usar o cadastro assistido e a marca de
 * "exceção de CPF" (P-001 / P-005 / D-004 das expectations). Qualquer outro
 * papel — incluindo o auto-cadastro público (USP-001) — é proibido.
 *
 * O RBAC delegado (`requirePermission()`) só chega na USP-007+; até lá esta
 * lista é a fonte de verdade da permissão deste fluxo.
 */
export const ASSISTED_REGISTRATION_ROLES = ['SOCIAL_ASSISTANT', 'BOARD'] as const;

export type AssistedRegistrationRole = (typeof ASSISTED_REGISTRATION_ROLES)[number];

/**
 * `true` se algum dos papéis ATIVOS da Pessoa autoriza o cadastro assistido.
 * Recebe os papéis ativos resolvidos em `getCurrentPerson()` (ADR-0030).
 */
export function canRegisterAssisted(roles: readonly string[]): boolean {
  const allowed: readonly string[] = ASSISTED_REGISTRATION_ROLES;
  return roles.some((role) => allowed.includes(role));
}

/**
 * Conteúdo mínimo da justificativa de exceção de CPF (F3 / P-003 — resolvido
 * pelo dono do intent: ≥ 20 caracteres em texto livre, sem lista fechada de
 * motivos). Defende a auditoria LGPD ("por que esta Pessoa existe sem CPF").
 */
export const CPF_EXCEPTION_MIN_JUSTIFICATION = 20;
